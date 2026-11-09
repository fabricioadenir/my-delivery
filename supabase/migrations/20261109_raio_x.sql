-- Raio-X do site: o que os visitantes fazem (visitas, menus vistos, carrinho, pedidos enviados).
-- Anónimo: sem cookies, sem IP guardado, sem nome. Cada visita tem um código aleatório que só dura enquanto o separador está aberto.
-- A cidade vem da rede (cabeçalhos da Vercel) e é aproximada: nos dados móveis aparece muitas vezes a cidade da operadora.

create table if not exists public.site_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  session_id  text not null check (char_length(session_id) between 8 and 40),
  type        text not null check (type in ('visita','categoria','foto','carrinho_mais','carrinho_menos','carrinho_aberto','finalizar','pedido_enviado')),
  product_id  uuid,
  category_id uuid,
  qty         integer check (qty between -99 and 99),
  value       numeric(10,2) check (value between 0 and 10000),
  source      text check (char_length(source) <= 40),
  device      text check (device in ('telemovel','tablet','computador')),
  landing     text check (char_length(landing) <= 120),
  os          text check (char_length(os) <= 30),
  browser     text check (char_length(browser) <= 30),
  model       text check (char_length(model) <= 60),
  screen      text check (char_length(screen) <= 15),
  lang        text check (char_length(lang) <= 12),
  city        text check (char_length(city) <= 60),
  region      text check (char_length(region) <= 60),
  country     text check (char_length(country) <= 4),
  repeat_visit boolean
);
create index if not exists site_events_created_at_idx on public.site_events (created_at);
create index if not exists site_events_session_idx on public.site_events (session_id);

alter table public.site_events enable row level security;
revoke all on public.site_events from anon, authenticated;
-- sem políticas: só as duas funções abaixo mexem na tabela

-- Grava até 40 eventos de uma vez, vindos do site público. Ignora o que não for válido.
create or replace function public.log_site_events(p jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  e jsonb;
  n integer := 0;
  uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  sess text;
begin
  if jsonb_typeof(p) <> 'array' then return 0; end if;
  for e in select value from jsonb_array_elements(p) limit 40 loop
    sess := left(coalesce(e->>'session_id', ''), 40);
    continue when char_length(sess) < 8;
    continue when coalesce(e->>'type', '') not in ('visita','categoria','foto','carrinho_mais','carrinho_menos','carrinho_aberto','finalizar','pedido_enviado');
    -- trava contra abusos: no máximo 400 eventos por visita
    continue when (select count(*) from site_events where session_id = sess) >= 400;
    insert into site_events (session_id, type, product_id, category_id, qty, value, source, device, landing,
                             os, browser, model, screen, lang, city, region, country, repeat_visit)
    values (
      sess,
      e->>'type',
      case when e->>'product_id' ~ uuid_re then (e->>'product_id')::uuid end,
      case when e->>'category_id' ~ uuid_re then (e->>'category_id')::uuid end,
      case when e->>'qty' ~ '^-?[0-9]{1,2}$' then (e->>'qty')::integer end,
      case when e->>'value' ~ '^[0-9]{1,4}(\.[0-9]{1,2})?$' then (e->>'value')::numeric end,
      nullif(left(lower(regexp_replace(coalesce(e->>'source', ''), '[^a-zA-Z0-9_.-]', '', 'g')), 40), ''),
      case when e->>'device' in ('telemovel','tablet','computador') then e->>'device' end,
      nullif(left(coalesce(e->>'landing', ''), 120), ''),
      nullif(left(e->>'os', 30), ''),
      nullif(left(e->>'browser', 30), ''),
      nullif(left(e->>'model', 60), ''),
      case when e->>'screen' ~ '^[0-9]{3,4}x[0-9]{3,4}$' then e->>'screen' end,
      nullif(left(regexp_replace(coalesce(e->>'lang', ''), '[^a-zA-Z-]', '', 'g'), 12), ''),
      nullif(left(e->>'city', 60), ''),
      nullif(left(e->>'region', 60), ''),
      nullif(left(upper(regexp_replace(coalesce(e->>'country', ''), '[^a-zA-Z]', '', 'g')), 4), ''),
      case when e->>'returning' in ('true','false') then (e->>'returning')::boolean end
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.log_site_events(jsonb) from public;
grant execute on function public.log_site_events(jsonb) to anon, authenticated;

-- Resumo para a gestão, entre duas datas (inclusive), na hora de Portugal. Só a equipa.
create or replace function public.site_analytics(p_from date, p_to date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t0 timestamptz := (p_from::timestamp) at time zone 'Europe/Lisbon';
  t1 timestamptz := ((p_to + 1)::timestamp) at time zone 'Europe/Lisbon';
  res jsonb;
begin
  if not public.is_staff() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;

  with ev as (
    select * from site_events where created_at >= t0 and created_at < t1
  ),
  sess as (
    select session_id,
           min(created_at) as inicio,
           max(created_at) as fim,
           bool_or(type = 'visita') as visita,
           bool_or(type in ('categoria','foto','carrinho_mais','carrinho_aberto')) as menu,
           bool_or(type = 'carrinho_mais') as carrinho,
           bool_or(type = 'finalizar') as finalizar,
           bool_or(type = 'pedido_enviado') as pedido,
           max(source) filter (where type = 'visita') as source,
           max(device) filter (where type = 'visita') as device,
           max(os) filter (where type = 'visita') as os,
           max(browser) filter (where type = 'visita') as browser,
           max(model) filter (where type = 'visita') as model,
           max(lang) filter (where type = 'visita') as lang,
           max(city) filter (where type = 'visita') as city,
           max(region) filter (where type = 'visita') as region,
           max(country) filter (where type = 'visita') as country,
           bool_or(repeat_visit) filter (where type = 'visita') as repetida
    from ev group by session_id
  ),
  -- carrinho líquido por visita (juntou − tirou) com o preço atual dos produtos
  cesto as (
    select ev.session_id, ev.product_id, sum(case when ev.type = 'carrinho_mais' then ev.qty else -ev.qty end) as q
    from ev where ev.type in ('carrinho_mais','carrinho_menos') and ev.product_id is not null
    group by ev.session_id, ev.product_id
  ),
  ped as (
    select o.* from orders o where o.created_at >= t0 and o.created_at < t1 and o.cancelled_at is null
  )
  select jsonb_build_object(
    'de', p_from, 'ate', p_to,
    'funil', jsonb_build_object(
      'visitas',    (select count(*) from sess where visita),
      'viram_menu', (select count(*) from sess where menu),
      'carrinho',   (select count(*) from sess where carrinho),
      'finalizar',  (select count(*) from sess where finalizar),
      'enviados',   (select count(*) from sess where pedido)
    ),
    'pedidos', jsonb_build_object(
      'n', (select count(*) from ped),
      'total', (select coalesce(sum(total), 0) from ped)
    ),
    'repetidas', (select count(*) from sess where visita and repetida),
    'tempo_medio_seg', (select coalesce(round(avg(extract(epoch from fim - inicio))), 0) from sess where menu),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object('dia', d.dia, 'visitas', d.visitas, 'carrinhos', d.carrinhos, 'enviados', d.enviados) order by d.dia)
      from (
        select (inicio at time zone 'Europe/Lisbon')::date as dia,
               count(*) filter (where visita) as visitas,
               count(*) filter (where carrinho) as carrinhos,
               count(*) filter (where pedido) as enviados
        from sess group by 1
      ) d), '[]'::jsonb),
    'por_hora', coalesce((
      select jsonb_agg(jsonb_build_object('hora', h.hora, 'visitas', h.n) order by h.hora)
      from (select extract(hour from inicio at time zone 'Europe/Lisbon')::int as hora, count(*) as n from sess where visita group by 1) h), '[]'::jsonb),
    'mapa', coalesce((
      select jsonb_agg(jsonb_build_object('dow', m.dow, 'hora', m.hora, 'visitas', m.n))
      from (select extract(dow from inicio at time zone 'Europe/Lisbon')::int as dow,
                   extract(hour from inicio at time zone 'Europe/Lisbon')::int as hora, count(*) as n
            from sess where visita group by 1, 2) m), '[]'::jsonb),
    'sistemas', coalesce((
      select jsonb_agg(jsonb_build_object('nome', a.nome, 'visitas', a.n) order by a.n desc)
      from (select coalesce(os, 'Outro') as nome, count(*) as n from sess where visita group by 1) a), '[]'::jsonb),
    'navegadores', coalesce((
      select jsonb_agg(jsonb_build_object('nome', a.nome, 'visitas', a.n) order by a.n desc)
      from (select coalesce(browser, 'Outro') as nome, count(*) as n from sess where visita group by 1) a), '[]'::jsonb),
    'modelos', coalesce((
      select jsonb_agg(jsonb_build_object('nome', a.nome, 'visitas', a.n) order by a.n desc)
      from (select model as nome, count(*) as n from sess where visita and model is not null group by 1 order by 2 desc limit 15) a), '[]'::jsonb),
    'idiomas', coalesce((
      select jsonb_agg(jsonb_build_object('nome', a.nome, 'visitas', a.n) order by a.n desc)
      from (select coalesce(lang, '?') as nome, count(*) as n from sess where visita group by 1) a), '[]'::jsonb),
    'cidades', coalesce((
      select jsonb_agg(jsonb_build_object('cidade', a.cidade, 'regiao', a.regiao, 'pais', a.pais, 'visitas', a.n) order by a.n desc)
      from (select coalesce(city, 'Desconhecida') as cidade, region as regiao, country as pais, count(*) as n
            from sess where visita group by 1, 2, 3 order by 4 desc limit 15) a), '[]'::jsonb),
    'localidades_pedidos', coalesce((
      select jsonb_agg(jsonb_build_object('nome', a.nome, 'pedidos', a.n, 'total', a.t) order by a.n desc)
      from (select coalesce(nullif(trim(address_locality), ''), zone_name, 'Sem localidade') as nome, count(*) as n, sum(total) as t
            from ped group by 1 order by 2 desc limit 15) a), '[]'::jsonb),
    'origens', coalesce((
      select jsonb_agg(jsonb_build_object('origem', o.origem, 'visitas', o.n) order by o.n desc)
      from (select coalesce(source, 'direto') as origem, count(*) as n from sess where visita group by 1) o), '[]'::jsonb),
    'aparelhos', coalesce((
      select jsonb_agg(jsonb_build_object('aparelho', a.aparelho, 'visitas', a.n) order by a.n desc)
      from (select coalesce(device, 'computador') as aparelho, count(*) as n from sess where visita group by 1) a), '[]'::jsonb),
    'categorias', coalesce((
      select jsonb_agg(jsonb_build_object('nome', c.nome, 'visitas', c.n) order by c.n desc)
      from (select coalesce(pc.name, 'Categoria apagada') as nome, count(distinct ev.session_id) as n
            from ev left join product_categories pc on pc.id = ev.category_id
            where ev.type = 'categoria' group by 1) c), '[]'::jsonb),
    'produtos', coalesce((
      select jsonb_agg(jsonb_build_object('nome', x.nome, 'carrinhos', x.carrinhos, 'unidades', x.unidades, 'fotos', x.fotos) order by x.carrinhos desc, x.fotos desc)
      from (select coalesce(p.name, 'Produto apagado') as nome,
                   count(distinct ev.session_id) filter (where ev.type = 'carrinho_mais') as carrinhos,
                   coalesce(sum(ev.qty) filter (where ev.type = 'carrinho_mais'), 0) as unidades,
                   count(distinct ev.session_id) filter (where ev.type = 'foto') as fotos
            from ev left join products p on p.id = ev.product_id
            where ev.type in ('carrinho_mais','foto') and ev.product_id is not null
            group by 1 order by 2 desc, 4 desc limit 30) x), '[]'::jsonb),
    'mais_pedidos', coalesce((
      select jsonb_agg(jsonb_build_object('nome', y.nome, 'quantidade', y.q, 'total', y.t) order by y.q desc)
      from (select oi.product_name as nome, sum(oi.quantity) as q, sum(oi.line_total) as t
            from order_items oi join ped on ped.id = oi.order_id group by 1 order by 2 desc limit 15) y), '[]'::jsonb),
    'abandonados', coalesce((
      select jsonb_agg(z.obj order by z.quando desc)
      from (
        select s.fim as quando,
               jsonb_build_object(
                 'quando', s.fim,
                 'chegou_a_finalizar', s.finalizar,
                 'origem', coalesce(s.source, 'direto'),
                 'aparelho', coalesce(s.device, 'computador'),
                 'modelo', coalesce(s.model, s.os),
                 'cidade', s.city,
                 'valor', coalesce((select sum(c.q * coalesce(p.price, 0)) from cesto c left join products p on p.id = c.product_id where c.session_id = s.session_id and c.q > 0), 0),
                 'itens', coalesce((select jsonb_agg(jsonb_build_object('nome', coalesce(p.name, 'Produto apagado'), 'q', c.q))
                                    from cesto c left join products p on p.id = c.product_id where c.session_id = s.session_id and c.q > 0), '[]'::jsonb)
               ) as obj
        from sess s
        where s.carrinho and not s.pedido
          and exists (select 1 from cesto c where c.session_id = s.session_id and c.q > 0)
        order by s.fim desc limit 20
      ) z), '[]'::jsonb)
  ) into res;
  return res;
end;
$$;
revoke all on function public.site_analytics(date, date) from public, anon;
grant execute on function public.site_analytics(date, date) to authenticated;
