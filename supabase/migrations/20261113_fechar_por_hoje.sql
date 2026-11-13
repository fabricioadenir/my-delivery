-- "Fechar por hoje": a gestão fecha a loja só no dia de hoje, sem mexer no horário.
-- settings.closed_on = dia (hora de Lisboa) em que a loja não aceita pedidos; no dia seguinte volta a abrir sozinha.
-- O site deixa de mostrar "o mais cedo possível" e as horas de hoje; agendar para outros dias continua.
alter table public.settings add column if not exists closed_on date;

create or replace function public.create_order(p jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
  v_deliver timestamptz;
  v_subtotal numeric(10,2) := 0;
  v_min numeric(10,2);
  v_customer uuid;
  v_order uuid;
  v_number bigint;
  v_tz text;
begin
  select * into s from public.settings limit 1;
  v_tz := coalesce(s.timezone, 'Europe/Lisbon');
  if length(v_name) < 2 then raise exception 'Escreva o seu nome.'; end if;
  if length(regexp_replace(v_phone, '\D', '', 'g')) < 9 then raise exception 'Escreva um telemóvel com 9 dígitos.'; end if;
  if v_street = '' or v_locality = '' then raise exception 'Escreva a morada de entrega.'; end if;

  select * into z from public.delivery_zones where id = (p->>'zone_id')::uuid and active;
  if not found then raise exception 'Zona de entrega inválida.'; end if;

  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'O carrinho está vazio.';
  end if;

  for it in select * from jsonb_to_recordset(p->'items') as x(product_id uuid, quantity integer, option text) loop
    select * into pr from public.products where id = it.product_id and active and deleted_at is null;
    if not found then raise exception 'Um dos produtos já não está disponível.'; end if;
    if it.quantity is null or it.quantity < pr.min_qty or it.quantity > 99 then
      raise exception '%: o mínimo são % unidades.', pr.name, pr.min_qty;
    end if;
    if it.option is not null and (not pr.temp_option or it.option not in ('Fresca', 'Natural')) then
      raise exception '%: opção inválida.', pr.name;
    end if;
    v_subtotal := v_subtotal + pr.price * it.quantity;
  end loop;

  v_min := coalesce(z.min_order, s.min_order, 0);
  if v_subtotal < v_min then
    raise exception 'O pedido mínimo é de % €.', to_char(v_min, 'FM999990D00');
  end if;

  if not v_asap then
    if coalesce(p->>'deliver_at_local', '') = '' then raise exception 'Escolha o dia e a hora da entrega.'; end if;
    v_deliver := (p->>'deliver_at_local')::timestamp at time zone v_tz;
  end if;

  -- loja fechada hoje: nada para hoje (nem "o mais cedo possível"); outros dias continuam
  if s.closed_on is not null and s.closed_on = (now() at time zone v_tz)::date
     and (v_asap or (v_deliver at time zone v_tz)::date = s.closed_on) then
    raise exception 'Hoje já não aceitamos pedidos. Pode agendar para outro dia.';
  end if;

  select id into v_customer from public.customers
    where phone = v_phone and deleted_at is null order by created_at limit 1;
  if v_customer is null then
    insert into public.customers (name, phone) values (v_name, v_phone) returning id into v_customer;
  else
    update public.customers set name = v_name where id = v_customer;
  end if;

  insert into public.orders (
    customer_id, customer_name, customer_phone, zone_id, zone_name,
    address_street, address_locality, address_reference, asap, deliver_at,
    subtotal, delivery_fee, total, payment_method, change_for, extras, allergy_notes, nif
  ) values (
    v_customer, v_name, v_phone, z.id, z.name,
    v_street, v_locality, nullif(btrim(coalesce(p->>'address_reference', '')), ''), v_asap, v_deliver,
    v_subtotal, z.fee, v_subtotal + z.fee, nullif(p->>'payment_method', ''),
    nullif(regexp_replace(coalesce(p->>'change_for', ''), '[^0-9.,]', '', 'g'), '')::text::numeric,
    coalesce(p->'extras', '{}'::jsonb), nullif(btrim(coalesce(p->>'allergy_notes', '')), ''), nullif(p->>'nif', '')
  ) returning id, number into v_order, v_number;

  insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
  select v_order, pr2.id, pr2.name || coalesce(' (' || lower(x.option) || ')', ''), pr2.price, x.quantity, pr2.price * x.quantity
  from jsonb_to_recordset(p->'items') as x(product_id uuid, quantity integer, option text)
  join public.products pr2 on pr2.id = x.product_id;

  insert into public.order_status_history (order_id, status) values (v_order, 'received');

  return jsonb_build_object(
    'id', v_order, 'number', v_number, 'code', (select public_code from public.orders where id = v_order), 'subtotal', v_subtotal, 'delivery_fee', z.fee,
    'total', v_subtotal + z.fee, 'zone_name', z.name,
    'items', (select jsonb_agg(jsonb_build_object('name', oi.product_name, 'quantity', oi.quantity,
              'unit_price', oi.unit_price, 'line_total', oi.line_total))
              from public.order_items oi where oi.order_id = v_order)
  );
end;
$function$;
