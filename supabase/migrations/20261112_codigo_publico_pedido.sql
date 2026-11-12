-- Código público do pedido (ex.: K7M2): é o que o cliente vê em vez do n.º sequencial,
-- para não saber quantos pedidos a loja já teve. A gestão vê os dois.
-- 4 caracteres sem os que se confundem (0/O, 1/I/L): 32^4 ≈ 1 milhão de combinações.
alter table public.orders add column if not exists public_code text;

create or replace function public.order_new_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  abc constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text; b bytea;
begin
  loop
    b := extensions.gen_random_bytes(4);
    c := '';
    for i in 0..3 loop c := c || substr(abc, (get_byte(b, i) % length(abc)) + 1, 1); end loop;
    exit when not exists (select 1 from public.orders where public_code = c);
  end loop;
  return c;
end;
$$;
revoke all on function public.order_new_code() from public, anon, authenticated;

create or replace function public.orders_set_code() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.public_code is null then new.public_code := public.order_new_code(); end if;
  return new;
end;
$$;
revoke all on function public.orders_set_code() from public, anon, authenticated;
drop trigger if exists orders_set_code on public.orders;
create trigger orders_set_code before insert on public.orders for each row execute function public.orders_set_code();

update public.orders set public_code = public.order_new_code() where public_code is null;
alter table public.orders alter column public_code set not null;
create unique index if not exists orders_public_code_key on public.orders(public_code);

-- create_order passa a devolver também o código (o backend tira o n.º antes de responder ao site).
do $do$
declare d text := pg_get_functiondef('public.create_order(jsonb)'::regprocedure);
begin
  if position('''code'', (select public_code' in d) = 0 then
    d := replace(d, '''id'', v_order, ''number'', v_number,', '''id'', v_order, ''number'', v_number, ''code'', (select public_code from public.orders where id = v_order),');
    execute d;
  end if;
end;
$do$;

-- Acompanhamento público: código em vez do n.º.
create or replace function public.order_tracking(p_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'code', o.public_code, 'status', o.status,
    'asap', o.asap, 'deliver_at', o.deliver_at, 'updated_at', o.updated_at) order by o.created_at desc), '[]'::jsonb)
  from public.orders o where o.id = any(p_ids[1:20]);
$$;

-- "Os meus pedidos": código em vez do n.º.
create or replace function public.client_payload(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'nome', a.name, 'tel', a.phone, 'moradas', a.addresses,
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'code', o.public_code, 'created_at', o.created_at, 'total', o.total, 'status', o.status,
        'itens', (select coalesce(jsonb_agg(jsonb_build_object('id', oi.product_id, 'q', oi.quantity, 'nome', oi.product_name) order by oi.product_name), '[]'::jsonb)
                  from public.order_items oi where oi.order_id = o.id))
        order by o.created_at desc)
      from (select * from public.orders where client_account_id = a.id order by created_at desc limit 20) o), '[]'::jsonb))
  from public.client_accounts a where a.id = p_account;
$$;
