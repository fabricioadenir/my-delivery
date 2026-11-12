-- Pedidos externos (WhatsApp, telefone, presencial) registados pela equipa na gestão.
-- Mesma numeração, código público, estados, custos e stock dos pedidos do site.
-- Diferenças: só equipa; sem pedido mínimo; hora de entrega livre; desconto em euros; origem em orders.channel.

create or replace function public.create_order_staff(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.settings%rowtype;
  z public.delivery_zones%rowtype;
  pr public.products%rowtype;
  it record;
  v_name text := btrim(coalesce(p->>'customer_name', ''));
  v_phone text := btrim(coalesce(p->>'customer_phone', ''));
  v_street text := btrim(coalesce(p->>'address_street', ''));
  v_locality text := btrim(coalesce(p->>'address_locality', ''));
  v_asap boolean := coalesce((p->>'asap')::boolean, false);
  v_channel text := coalesce(nullif(p->>'channel', ''), 'whatsapp');
  v_discount numeric(10,2) := round(coalesce(nullif(p->>'discount', '')::numeric, 0), 2);
  v_deliver timestamptz;
  v_subtotal numeric(10,2) := 0;
  v_customer uuid;
  v_order uuid;
  v_number bigint;
begin
  if not public.is_staff() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select * into s from public.settings limit 1;
  if length(v_name) < 2 then raise exception 'Escreva o nome do cliente.'; end if;
  if length(regexp_replace(v_phone, '\D', '', 'g')) < 9 then raise exception 'Escreva um telemóvel com 9 dígitos.'; end if;
  if v_street = '' or v_locality = '' then raise exception 'Escreva a morada de entrega.'; end if;
  if v_channel not in ('whatsapp', 'telefone', 'presencial', 'outro') then raise exception 'Origem inválida.'; end if;

  select * into z from public.delivery_zones where id = (p->>'zone_id')::uuid;
  if not found then raise exception 'Escolha a zona de entrega.'; end if;

  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'Junte pelo menos um produto.';
  end if;
  for it in select * from jsonb_to_recordset(p->'items') as x(product_id uuid, quantity integer, option text) loop
    select * into pr from public.products where id = it.product_id and deleted_at is null;
    if not found then raise exception 'Um dos produtos já não existe.'; end if;
    if it.quantity is null or it.quantity < 1 or it.quantity > 999 then raise exception '%: quantidade inválida.', pr.name; end if;
    if it.option is not null and (not pr.temp_option or it.option not in ('Fresca', 'Natural')) then
      raise exception '%: opção inválida.', pr.name;
    end if;
    v_subtotal := v_subtotal + pr.price * it.quantity;
  end loop;

  if v_discount < 0 then raise exception 'O desconto não pode ser negativo.'; end if;
  if v_discount > v_subtotal then raise exception 'O desconto não pode ser maior do que os produtos (% €).', to_char(v_subtotal, 'FM999990D00'); end if;

  if not v_asap then
    if coalesce(p->>'deliver_at_local', '') = '' then raise exception 'Escolha o dia e a hora da entrega.'; end if;
    v_deliver := (p->>'deliver_at_local')::timestamp at time zone coalesce(s.timezone, 'Europe/Lisbon');
  end if;

  select id into v_customer from public.customers
    where phone = v_phone and deleted_at is null order by created_at limit 1;
  if v_customer is null then
    insert into public.customers (name, phone) values (v_name, v_phone) returning id into v_customer;
  else
    update public.customers set name = v_name where id = v_customer;
  end if;

  insert into public.orders (
    customer_id, customer_name, customer_phone, channel, zone_id, zone_name,
    address_street, address_locality, address_reference, asap, deliver_at,
    subtotal, discount, delivery_fee, total, payment_method, change_for, extras, allergy_notes, notes
  ) values (
    v_customer, v_name, v_phone, v_channel, z.id, z.name,
    v_street, v_locality, nullif(btrim(coalesce(p->>'address_reference', '')), ''), v_asap, v_deliver,
    v_subtotal, v_discount, z.fee, v_subtotal - v_discount + z.fee, nullif(p->>'payment_method', ''),
    nullif(regexp_replace(coalesce(p->>'change_for', ''), '[^0-9.,]', '', 'g'), '')::text::numeric,
    '{}'::jsonb, nullif(btrim(coalesce(p->>'allergy_notes', '')), ''), nullif(btrim(coalesce(p->>'notes', '')), '')
  ) returning id, number into v_order, v_number;

  insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
  select v_order, pr2.id, pr2.name || coalesce(' (' || lower(x.option) || ')', ''), pr2.price, x.quantity, pr2.price * x.quantity
  from jsonb_to_recordset(p->'items') as x(product_id uuid, quantity integer, option text)
  join public.products pr2 on pr2.id = x.product_id;

  insert into public.order_status_history (order_id, status) values (v_order, 'received');

  return jsonb_build_object('id', v_order, 'number', v_number,
    'code', (select public_code from public.orders where id = v_order),
    'total', v_subtotal - v_discount + z.fee);
end;
$$;
revoke all on function public.create_order_staff(jsonb) from public, anon;
grant execute on function public.create_order_staff(jsonb) to authenticated;

-- Vendas passam a descontar o desconto (resultados, clientes, relatório CSV e Raio-X só com pedidos do site).
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.dashboard(date,date)'::regprocedure);
  if position('ord.subtotal - coalesce(ord.discount, 0) as subtotal' in d) = 0 then
    d := replace(d, 'select ord.id, ord.customer_name, ord.customer_phone, ord.zone_id, ord.subtotal, ord.delivery_fee,',
                    'select ord.id, ord.customer_name, ord.customer_phone, ord.zone_id, ord.subtotal - coalesce(ord.discount, 0) as subtotal, ord.delivery_fee,');
    d := replace(d, 'select count(*) as n, coalesce(sum(ord.subtotal), 0) as vendas from public.orders ord',
                    'select count(*) as n, coalesce(sum(ord.subtotal - coalesce(ord.discount, 0)), 0) as vendas from public.orders ord');
    if position('ord.subtotal - coalesce(ord.discount, 0) as subtotal' in d) = 0 then raise exception 'dashboard: texto não encontrado'; end if;
    execute d;
  end if;

  d := pg_get_functiondef('public.customers_summary()'::regprocedure);
  if position('discount' in d) = 0 then
    d := replace(d, 'sum(o.subtotal) as total', 'sum(o.subtotal - coalesce(o.discount, 0)) as total');
    d := replace(d, 'avg(o.subtotal + o.delivery_fee)', 'avg(o.total)');
    if position('discount' in d) = 0 then raise exception 'customers_summary: texto não encontrado'; end if;
    execute d;
  end if;

  d := pg_get_functiondef('public.report(date,date)'::regprocedure);
  if position('''discount''' in d) = 0 then
    d := replace(d, '''subtotal'', o.subtotal, ''fee''', '''subtotal'', o.subtotal, ''discount'', o.discount, ''channel'', o.channel, ''fee''');
    if position('''discount''' in d) = 0 then raise exception 'report: texto não encontrado'; end if;
    execute d;
  end if;

  d := pg_get_functiondef('public.site_analytics(date,date)'::regprocedure);
  if position('pedidos_fora' in d) = 0 then
    d := replace(d, 'select o.* from orders o where o.created_at >= t0 and o.created_at < t1 and o.cancelled_at is null',
                    'select o.* from orders o where o.created_at >= t0 and o.created_at < t1 and o.cancelled_at is null and coalesce(o.channel, ''site'') = ''site''');
    d := replace(d, '''repetidas'', (select count(*) from sess where visita and repetida),',
                    '''pedidos_fora'', (select jsonb_build_object(''n'', count(*), ''total'', coalesce(sum(total), 0)) from orders o
                       where o.created_at >= t0 and o.created_at < t1 and o.cancelled_at is null and coalesce(o.channel, ''site'') <> ''site''),
    ''repetidas'', (select count(*) from sess where visita and repetida),');
    if position('pedidos_fora' in d) = 0 or position('coalesce(o.channel, ''site'') = ''site''' in d) = 0 then raise exception 'site_analytics: texto não encontrado'; end if;
    execute d;
  end if;
end;
$do$;
