-- Pedidos de teste (16/11)
-- Um aparelho com sessão da gestão pode ligar o "modo de teste" e fazer pedidos pelo site como um cliente.
-- Esses pedidos:
--   * ficam marcados (orders.is_test) e levam número negativo de uma sequência própria
--     (não gastam a numeração real; a gestão mostra "N.º TESTE");
--   * não contam em vendas, resultados, IVA, clientes, relatórios, Raio-X nem no aviso de desistência;
--   * não ocupam horas de entrega para os clientes (mas respeitam as horas ocupadas pelos pedidos reais);
--   * não descontam stock ao marcar como entregue;
--   * apagam-se na gestão (um a um ou todos de uma vez).
-- Só a equipa (is_staff) consegue criar um pedido de teste.

alter table public.orders add column if not exists is_test boolean not null default false;

create sequence if not exists public.orders_test_number_seq;
revoke all on sequence public.orders_test_number_seq from anon, authenticated;

-- 1) create_order: aceita "test": true só para a equipa
do $mig$
declare
  d text := pg_get_functiondef('public.create_order(jsonb)'::regprocedure);
  n text;
begin
  n := d;
  n := replace(n, E'  v_tz text;\nbegin\n',
    E'  v_tz text;\n  v_test boolean := coalesce((p->>''test'')::boolean, false);\nbegin\n'
    || E'  if v_test and not public.is_staff() then raise exception ''Só a equipa pode fazer pedidos de teste.''; end if;\n');
  n := replace(n, E'    select 1 from public.orders o\n    where o.status <> ''cancelled''\n',
                  E'    select 1 from public.orders o\n    where o.status <> ''cancelled'' and not o.is_test\n');
  n := replace(n, E'  insert into public.orders (\n    customer_id,',
                  E'  insert into public.orders (\n    is_test, number, customer_id,');
  n := replace(n, E'  ) values (\n    v_customer, v_name,',
                  E'  ) overriding system value values (\n    v_test, case when v_test then -nextval(''public.orders_test_number_seq'') else nextval(''public.orders_number_seq'') end,\n    v_customer, v_name,');
  n := replace(n, E'    ''id'', v_order, ''number'', v_number,',
                  E'    ''id'', v_order, ''number'', v_number, ''test'', v_test,');
  if n = d or (length(n) - length(d)) < 200 or position('overriding system value' in n) = 0
     or position('not o.is_test' in n) = 0 or position('''test'', v_test' in n) = 0 or position('Só a equipa' in n) = 0 then
    raise exception 'create_order: texto esperado não encontrado';
  end if;
  execute n;
end $mig$;

-- 2) horas ocupadas: os testes não tiram horas aos clientes
do $mig$
declare d text := pg_get_functiondef('public.blocked_times(timestamptz, timestamptz)'::regprocedure); n text;
begin
  n := replace(d, E'    where o.status <> ''cancelled''\n', E'    where o.status <> ''cancelled'' and not o.is_test\n');
  if n = d then raise exception 'blocked_times: texto esperado não encontrado'; end if;
  execute n;
end $mig$;

-- 3) entregue: não desconta stock nos testes
do $mig$
declare d text := pg_get_functiondef('public.set_order_status(uuid, public.order_status)'::regprocedure); n text;
begin
  n := replace(d, E'  if p_status = ''delivered'' and v_done is null then\n',
                  E'  if p_status = ''delivered'' and v_done is null\n     and not coalesce((select o.is_test from public.orders o where o.id = p_order), false) then\n');
  if n = d then raise exception 'set_order_status: texto esperado não encontrado'; end if;
  execute n;
end $mig$;

-- 4) contas, relatórios, Raio-X e aviso de desistência: só pedidos reais
do $mig$
declare
  f text;
  d text;
  n text;
begin
  foreach f in array array['dashboard(date, date)', 'period_extras(date, date)', 'report(date, date)',
                           'customers_summary()', 'site_analytics(date, date)', 'checkout_abandonos(text)'] loop
    d := pg_get_functiondef(('public.' || f)::regprocedure);
    n := regexp_replace(d, '(from|join)\s+(public\.)?orders\M', '\1 (select * from public.orders where not is_test)', 'gi');
    if n = d then raise exception '%: nenhuma referência a orders encontrada', f; end if;
    execute n;
  end loop;
end $mig$;

-- 5) apagar pedidos de teste (só a equipa; nunca apaga pedidos reais)
create or replace function public.delete_test_orders(p_id uuid default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_n integer;
  ids uuid[];
begin
  if not public.is_staff() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select array_agg(id) into ids from public.orders where is_test and (p_id is null or id = p_id);
  if ids is null then
    if p_id is not null then raise exception 'Esse pedido não é de teste (ou já foi apagado).'; end if;
    return 0;
  end if;
  -- se algum teste chegou a descontar stock (antes desta versão), devolve-o
  update public.ingredients i set stock_qty = i.stock_qty - m.q
    from (select im.ingredient_id, sum(im.quantity) as q from public.ingredient_movements im
          where im.order_id = any(ids) and im.kind = 'sale' group by im.ingredient_id) m
    where i.id = m.ingredient_id;
  delete from public.ingredient_movements where order_id = any(ids);
  delete from public.orders where id = any(ids) and is_test;
  get diagnostics v_n = row_count;
  if not exists (select 1 from public.orders where is_test) then
    perform setval('public.orders_test_number_seq', 1, false);
  end if;
  return v_n;
end;
$function$;

revoke all on function public.delete_test_orders(uuid) from public, anon;
grant execute on function public.delete_test_orders(uuid) to authenticated;
