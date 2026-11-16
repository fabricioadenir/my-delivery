-- Raio-X do checkout: até onde o cliente foi no formulário e onde parou.
-- Continua anónimo: sem nome, telemóvel nem rua. O site só manda se os campos estão preenchidos (sim/não),
-- a localidade, a zona, quando queria receber, pagamento, respostas (wasabi/elástico), avisos que viu e por onde saiu.
--
-- Eventos novos em site_events:
--   checkout       resumo do formulário (enviado quando muda)          detail = { passo, passos, nome, tel, morada, rua, localidade, zona, taxa,
--                                                                                 quando, dia, hora, ja, primeira, pag, wasabi, elastico, conta, subtotal, ... }
--   checkout_erro  avisos que apareceram ("Diga se quer wasabi", "Essa hora já está ocupada"...)   detail = { msgs: [...], passo }
--   checkout_saiu  fechou o formulário, voltou ao carrinho ou saiu do site                       detail = { como, passo, seg }
--   finalizar      passa a levar o valor e os itens do carrinho                                   detail = { itens: [{p, q}] }
--
-- Aviso de desistência: um pg_cron de minuto a minuto vê se há visitas que abriram o formulário, não enviaram
-- e estão há 10 min sem mexer. Se houver, chama POST https://sakuraesalsushi.pt/api/abandonos; o backend
-- (com o segredo PUSH_SECRET) pede a lista a checkout_abandonos(), que marca cada visita como avisada (uma vez só).

-- 1) tipos novos e coluna detail ------------------------------------------------------------
alter table public.site_events drop constraint if exists site_events_type_check;
alter table public.site_events add constraint site_events_type_check check (type in (
  'visita','categoria','foto','carrinho_mais','carrinho_menos','carrinho_aberto','finalizar','pedido_enviado',
  'checkout','checkout_erro','checkout_saiu'));
alter table public.site_events add column if not exists detail jsonb
  check (detail is null or (jsonb_typeof(detail) = 'object' and octet_length(detail::text) <= 3000));

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
    continue when coalesce(e->>'type', '') not in ('visita','categoria','foto','carrinho_mais','carrinho_menos','carrinho_aberto',
                                                   'finalizar','pedido_enviado','checkout','checkout_erro','checkout_saiu');
    -- trava contra abusos: no máximo 400 eventos por visita
    continue when (select count(*) from site_events where session_id = sess) >= 400;
    insert into site_events (session_id, type, product_id, category_id, qty, value, source, device, landing,
                             os, browser, model, screen, lang, city, region, country, repeat_visit, detail)
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
      case when e->>'returning' in ('true','false') then (e->>'returning')::boolean end,
      case when jsonb_typeof(e->'detail') = 'object' and octet_length((e->'detail')::text) <= 3000 then e->'detail' end
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.log_site_events(jsonb) from public;
grant execute on function public.log_site_events(jsonb) to anon, authenticated;

-- 2) detalhe de uma visita que não chegou a pedido ------------------------------------------------
-- Carrinho: o que estava no carrinho ao abrir o formulário (último "finalizar") + o que mudou depois
-- (acompanhamentos no checkout). Sem "finalizar" com itens, usa o que juntou e tirou na visita.
create or replace function public.checkout_detalhe(p_session text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with ev as (
    select * from site_events where session_id = p_session
  ),
  fin as (
    select * from ev where type = 'finalizar' order by created_at desc, id desc limit 1
  ),
  itens_fin as (
    select (x->>'p')::uuid as product_id, (x->>'q')::int as q
    from fin, jsonb_array_elements(case when jsonb_typeof(fin.detail->'itens') = 'array' then fin.detail->'itens' else '[]'::jsonb end) x
    where x->>'p' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' and x->>'q' ~ '^[0-9]{1,3}$'
  ),
  mov as (
    select ev.product_id, case when ev.type = 'carrinho_mais' then coalesce(ev.qty, 0) else -coalesce(ev.qty, 0) end as q
    from ev
    where ev.type in ('carrinho_mais','carrinho_menos') and ev.product_id is not null
      and (not exists (select 1 from itens_fin) or ev.created_at > (select created_at from fin))
  ),
  itens as (
    select product_id, sum(q) as q from (select * from itens_fin union all select * from mov) t group by product_id
  ),
  vis as (
    select * from ev where type = 'visita' order by created_at limit 1
  )
  select jsonb_build_object(
    'quando', (select max(created_at) from ev),
    'chegou_a_finalizar', exists (select 1 from ev where type = 'finalizar'),
    'origem', coalesce((select source from vis), 'direto'),
    'aparelho', coalesce((select device from vis), 'computador'),
    'modelo', (select coalesce(model, os) from vis),
    'cidade', (select city from vis),
    'valor', coalesce((select sum(i.q * coalesce(p.price, 0)) from itens i left join products p on p.id = i.product_id where i.q > 0), 0),
    'itens', coalesce((select jsonb_agg(jsonb_build_object('nome', coalesce(p.name, 'Produto apagado'), 'q', i.q) order by p.name)
                       from itens i left join products p on p.id = i.product_id where i.q > 0), '[]'::jsonb),
    'seg_checkout', (select extract(epoch from max(created_at) - min(created_at) filter (where type = 'finalizar'))::int
                     from ev where type in ('finalizar','checkout','checkout_erro','checkout_saiu')),
    'checkout', (select detail from ev where type = 'checkout' and detail is not null order by created_at desc, id desc limit 1),
    'passo', (select detail->>'passo' from ev where type in ('checkout','checkout_erro','checkout_saiu') and detail->>'passo' is not null
              order by created_at desc, id desc limit 1),
    'erros', coalesce((select jsonb_agg(z.m order by z.primeiro) from (
                select m, min(e.created_at) as primeiro
                from ev e, jsonb_array_elements_text(case when jsonb_typeof(e.detail->'msgs') = 'array' then e.detail->'msgs' else '[]'::jsonb end) m
                where e.type = 'checkout_erro' group by m) z), '[]'::jsonb),
    'saida', (select detail->>'como' from ev where type = 'checkout_saiu' order by created_at desc, id desc limit 1),
    'tentativas', coalesce((select (detail->>'tentativas')::int from ev where type = 'checkout' and detail->>'tentativas' ~ '^[0-9]{1,3}$'
                            order by created_at desc, id desc limit 1), 0)
  );
$$;
revoke all on function public.checkout_detalhe(text) from public, anon, authenticated;

-- 3) aviso de desistência -----------------------------------------------------------------------
create table if not exists public.checkout_avisos (
  session_id text primary key,
  created_at timestamptz not null default now()
);
alter table public.checkout_avisos enable row level security;
revoke all on public.checkout_avisos from anon, authenticated;

-- as visitas que já existem não dão aviso (só as novas, a partir de agora)
insert into public.checkout_avisos (session_id)
select distinct session_id from public.site_events where type = 'finalizar'
on conflict do nothing;

-- Visitas que abriram o formulário nas últimas 12 h, não enviaram, estão há 10 min sem mexer e ainda não deram aviso.
create or replace function public.checkout_pendentes()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select session_id from site_events
  where created_at > now() - interval '12 hours'
  group by session_id
  having bool_or(type = 'finalizar') and not bool_or(type = 'pedido_enviado')
     and max(created_at) < now() - interval '10 minutes'
  except
  select session_id from checkout_avisos;
$$;
revoke all on function public.checkout_pendentes() from public, anon, authenticated;

-- Backend (com o segredo): devolve as desistências novas e marca-as como avisadas.
create or replace function public.checkout_abandonos(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  res jsonb;
begin
  if p_secret is null or p_secret <> coalesce((select value from app_secrets where name = 'push'), '') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  with novos as (
    insert into checkout_avisos (session_id) select s from checkout_pendentes() s
    on conflict do nothing returning session_id
  )
  select coalesce(jsonb_agg(
           checkout_detalhe(n.session_id) || jsonb_build_object('pedido_depois', (
             select jsonb_build_object('numero', o.number, 'total', o.total)
             from orders o
             where coalesce(o.channel, 'site') = 'site' and o.cancelled_at is null
               and o.created_at > (select min(created_at) from site_events where session_id = n.session_id and type = 'finalizar')
             order by o.created_at limit 1))), '[]'::jsonb)
    into res
  from novos n;
  return res;
end;
$$;
revoke all on function public.checkout_abandonos(text) from public;
grant execute on function public.checkout_abandonos(text) to anon, authenticated;

-- 4) de minuto a minuto: se houver desistências por avisar, chama o backend --------------------------
create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.checkout_abandonos_ping()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from checkout_pendentes()) then
    perform net.http_post(
      url := 'https://sakuraesalsushi.pt/api/abandonos',
      body := '{}'::jsonb,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      timeout_milliseconds := 20000);
  end if;
end;
$$;
revoke all on function public.checkout_abandonos_ping() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'checkout-abandonos';
select cron.schedule('checkout-abandonos', '* * * * *', 'select public.checkout_abandonos_ping()');

-- 5) Raio-X: carrinhos abandonados com o detalhe do formulário -------------------------------------
-- Troca só o bloco 'abandonados' de site_analytics (o resto fica como está). Para se não o encontrar.
do $mig$
declare
  d text;
  i int;
  j int;
begin
  d := pg_get_functiondef('public.site_analytics(date,date)'::regprocedure);
  i := strpos(d, '''abandonados'', coalesce((');
  j := strpos(d, ') into res;');
  if i = 0 or j = 0 or j < i then
    raise exception 'site_analytics: bloco abandonados não encontrado';
  end if;
  execute left(d, i - 1) || $blk$'abandonados', coalesce((
      select jsonb_agg(x.d order by x.fim desc)
      from (select s.fim, public.checkout_detalhe(s.session_id) as d
            from sess s
            where (s.carrinho or s.finalizar) and not s.pedido
            order by s.fim desc limit 40) x
      where jsonb_array_length(x.d->'itens') > 0), '[]'::jsonb)
  $blk$ || substr(d, j);
end;
$mig$;
