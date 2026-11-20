-- Clientes agrupados pelo telemóvel (20/11/2026)
-- Problema: os pedidos guardam o telemóvel como o cliente o escreveu ("965268866", "965 268 866",
-- "+351965268866"), e o resumo de clientes agrupava pelo texto: a mesma pessoa aparecia em várias linhas
-- (ex.: Odete Soares, Michael Teixeira).
-- 1) tel_chave(): os 9 algarismos do número (sem espaços nem indicativo 351/00351).
-- 2) customers_summary (CSV) e "Melhores clientes" do dashboard passam a agrupar por tel_chave.
-- 3) customers_overview(): ficha completa de cada cliente para o novo ecrã Clientes da gestão.

create or replace function public.tel_chave(p text)
returns text language sql immutable set search_path to '' as $$
  select case
    when d like '00351%' and length(d) = 14 then substr(d, 6)
    when d like '351%' and length(d) = 12 then substr(d, 4)
    else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

create or replace function public.customers_summary()
returns jsonb language sql stable set search_path to '' as $function$
  with o as (select * from public.orders where not is_test and status <> 'cancelled' and public.tel_chave(customer_phone) <> '')
  select coalesce(jsonb_agg(to_jsonb(c) order by c.total desc), '[]'::jsonb) from (
    select (array_agg(o.customer_name order by o.created_at desc))[1] as name,
           (array_agg(o.customer_phone order by o.created_at desc))[1] as phone,
           count(*) as orders, sum(o.subtotal - coalesce(o.discount, 0)) as total,
           round(avg(o.total), 2) as ticket, (array_agg(o.zone_name order by o.created_at desc))[1] as zone,
           min(public.dia_venda(o.created_at, o.deliver_at)) as first_order,
           max(public.dia_venda(o.created_at, o.deliver_at)) as last_order,
           (select oi.product_name from public.order_items oi join o o2 on o2.id = oi.order_id
             where public.tel_chave(o2.customer_phone) = public.tel_chave(min(o.customer_phone))
             group by oi.product_name order by sum(oi.quantity) desc limit 1) as favorite
    from o group by public.tel_chave(o.customer_phone)) c;
$function$;

-- "Melhores clientes" nos Resultados: mesma pessoa = mesmo número, seja como for escrito
do $$
declare d text := pg_get_functiondef('public.dashboard(date,date)'::regprocedure);
begin
  if position('from o group by o.customer_phone order by' in d) = 0 then
    raise exception 'dashboard: texto do agrupamento por telemóvel não encontrado';
  end if;
  d := replace(d, 'from o group by o.customer_phone order by', 'from o group by public.tel_chave(o.customer_phone) order by');
  execute d;
end $$;

-- Ficha de cada cliente (só a equipa). Devolve uma lista; os números com "dados guardados" sem nenhum
-- pedido também aparecem (orders = 0), exceto os números da própria loja.
create or replace function public.customers_overview()
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  v_tz text := 'Europe/Lisbon';
  v_hoje date := (now() at time zone 'Europe/Lisbon')::date;
  v_prep int;
  v_loja text[];
  r jsonb;
begin
  if not public.is_staff() then raise exception 'Sem acesso.' using errcode = '42501'; end if;
  select coalesce(prep_minutes, 0), array[public.tel_chave(coalesce(whatsapp, '')), public.tel_chave(coalesce(phone_display, '')), '913838543', '920725615']
    into v_prep, v_loja from public.settings limit 1;

  with o as (
    select x.*, public.tel_chave(x.customer_phone) as chave,
           public.dia_venda(x.created_at, x.deliver_at) as dia,
           coalesce(x.deliver_at, x.created_at + make_interval(mins => v_prep)) at time zone v_tz as entrega_local
    from public.orders x where not x.is_test and public.tel_chave(x.customer_phone) <> ''
  ),
  ok as (select * from o where status <> 'cancelled'),
  itens as (
    select o.chave, oi.product_name as nome, sum(oi.quantity)::int as qtd, sum(oi.line_total) as valor
    from ok o join public.order_items oi on oi.order_id = o.id group by 1, 2
  ),
  lista as (
    select o.chave, jsonb_agg(jsonb_build_object(
      'id', o.id, 'number', o.number, 'code', o.public_code, 'status', o.status, 'channel', o.channel,
      'asap', o.asap, 'deliver_at', o.deliver_at, 'created_at', o.created_at, 'total', o.total,
      'discount', o.discount, 'payment', o.payment_method, 'locality', o.address_locality,
      'items', (select string_agg(oi.quantity || '× ' || oi.product_name, ', ' order by oi.line_total desc)
                from public.order_items oi where oi.order_id = o.id)
    ) order by o.created_at desc) as pedidos
    from o group by o.chave
  ),
  base as (
    select o.chave,
      (array_agg(o.customer_name order by o.created_at desc))[1] as name,
      array_agg(distinct btrim(o.customer_name)) as names,
      count(*)::int as orders,
      sum(o.subtotal - coalesce(o.discount, 0)) as total,
      sum(o.delivery_fee) as fees,
      round(avg(o.total), 2) as ticket,
      round(sum(o.subtotal - coalesce(o.discount, 0) - o.cost_total) filter (where o.cost_total is not null), 2) as profit,
      count(*) filter (where o.cost_total is null)::int as cost_missing,
      min(o.dia) as first_order, max(o.dia) as last_order,
      max(o.dia) filter (where o.status = 'delivered') as last_delivered,
      count(*) filter (where o.status = 'delivered')::int as delivered,
      (array_agg(o.address_street order by o.created_at desc))[1] as street,
      (array_agg(o.address_locality order by o.created_at desc))[1] as locality,
      (array_agg(o.address_reference order by o.created_at desc))[1] as reference,
      (array_agg(o.zone_name order by o.created_at desc))[1] as zone,
      count(*) filter (where (o.extras->>'wasabi') = 'true')::int as wasabi_sim,
      count(*) filter (where (o.extras->>'wasabi') = 'false')::int as wasabi_nao,
      count(*) filter (where (o.extras->>'elastico') = 'true')::int as elastico_sim,
      count(*) filter (where (o.extras->>'elastico') = 'false')::int as elastico_nao,
      count(*) filter (where extract(hour from o.entrega_local) < 16)::int as almoco,
      count(*) filter (where extract(hour from o.entrega_local) >= 16)::int as jantar,
      round(avg(extract(epoch from (o.deliver_at - o.created_at)) / 3600) filter (where not o.asap and o.deliver_at is not null)::numeric, 1) as antecedencia_h,
      count(*) filter (where o.asap)::int as asap
    from ok o group by o.chave
  ),
  canais as (select chave, jsonb_object_agg(c, n) as channels from (select chave, coalesce(channel, 'site') c, count(*) n from ok group by 1, 2) z group by 1),
  pagamentos as (select chave, jsonb_object_agg(p, n) as payments from (select chave, coalesce(payment_method, '—') p, count(*) n from ok group by 1, 2) z group by 1),
  dias as (select chave, jsonb_object_agg(d, n) as weekdays from (select chave, extract(dow from dia)::int d, count(*) n from ok group by 1, 2) z group by 1),
  canc as (select chave, count(*)::int as cancelled from o where status = 'cancelled' group by 1),
  proximo as (
    select distinct on (chave) chave, jsonb_build_object('number', number, 'code', public_code, 'deliver_at', deliver_at,
           'asap', asap, 'status', status, 'total', total) as next_order
    from ok where status not in ('delivered', 'cancelled') order by chave, coalesce(deliver_at, created_at)
  ),
  contas as (
    select public.tel_chave(a.phone) as chave, a.name, jsonb_build_object('since', a.created_at, 'last_login', a.last_login_at,
           'locked', a.failed_attempts >= 10, 'addresses', jsonb_array_length(coalesce(a.addresses, '[]'::jsonb)),
           'code', a.recovery_code) as account
    from public.client_accounts a
  ),
  todos as (
    select distinct o.chave from o  -- inclui quem só tem pedidos cancelados
    union select c.chave from contas c where c.chave <> all (coalesce(v_loja, array['913838543', '920725615'])) and not exists (select 1 from o where o.chave = c.chave)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'key', t.chave,
      'name', coalesce(b.name, ct.name, (select (array_agg(customer_name order by created_at desc))[1] from o where o.chave = t.chave)),
      'names', coalesce(to_jsonb(b.names), '[]'::jsonb),
      'phone', case when length(t.chave) = 9 then substr(t.chave, 1, 3) || ' ' || substr(t.chave, 4, 3) || ' ' || substr(t.chave, 7) else t.chave end,
      'orders', coalesce(b.orders, 0), 'delivered', coalesce(b.delivered, 0), 'cancelled', coalesce(cc.cancelled, 0),
      'total', coalesce(b.total, 0), 'fees', coalesce(b.fees, 0), 'ticket', b.ticket,
      'profit', b.profit, 'cost_missing', coalesce(b.cost_missing, 0),
      'first_order', b.first_order, 'last_order', b.last_order, 'last_delivered', b.last_delivered,
      'days_since', v_hoje - coalesce(b.last_delivered, b.last_order),
      'avg_gap_days', case when b.orders > 1 then round((b.last_order - b.first_order)::numeric / (b.orders - 1), 1) end,
      'street', b.street, 'locality', b.locality, 'reference', b.reference, 'zone', b.zone,
      'channels', coalesce(cn.channels, '{}'::jsonb), 'payments', coalesce(pg.payments, '{}'::jsonb), 'weekdays', coalesce(dw.weekdays, '{}'::jsonb),
      'wasabi', jsonb_build_object('sim', coalesce(b.wasabi_sim, 0), 'nao', coalesce(b.wasabi_nao, 0)),
      'elastico', jsonb_build_object('sim', coalesce(b.elastico_sim, 0), 'nao', coalesce(b.elastico_nao, 0)),
      'almoco', coalesce(b.almoco, 0), 'jantar', coalesce(b.jantar, 0), 'asap', coalesce(b.asap, 0), 'antecedencia_h', b.antecedencia_h,
      'products', coalesce((select jsonb_agg(jsonb_build_object('name', i.nome, 'qty', i.qtd, 'value', i.valor) order by i.qtd desc, i.valor desc)
                            from itens i where i.chave = t.chave), '[]'::jsonb),
      'next_order', px.next_order,
      'account', ct.account,
      'history', coalesce(l.pedidos, '[]'::jsonb)
    ) order by coalesce(b.last_order, (ct.account->>'since')::date) desc nulls last, b.total desc nulls last), '[]'::jsonb)
  into r
  from todos t
  left join base b on b.chave = t.chave
  left join canais cn on cn.chave = t.chave
  left join pagamentos pg on pg.chave = t.chave
  left join dias dw on dw.chave = t.chave
  left join canc cc on cc.chave = t.chave
  left join proximo px on px.chave = t.chave
  left join contas ct on ct.chave = t.chave
  left join lista l on l.chave = t.chave;
  return r;
end;
$function$;

revoke all on function public.customers_overview() from public, anon;
grant execute on function public.customers_overview() to authenticated;
grant execute on function public.tel_chave(text) to anon, authenticated;
