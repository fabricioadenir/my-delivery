-- Resultados: almoço x jantar e horários (24/11/2026).
-- Pedido do Fabricio: a loja abre ao almoço e ao jantar; quer ver em cada dia quanto foi de cada
-- período e saber o dia, o horário e o período que mais vendem, para se planear.
--
-- vendas_por_turno(de, até) devolve:
--   por_dia:    [{day, periodo, orders, revenue}]       periodo = 'almoco' | 'jantar'
--   por_hora:   [{slot 'HH:MI', periodo, orders, revenue}]   meias horas
--   por_semana: [{weekday, periodo, orders, revenue}]   weekday 0 = domingo
--   mais_cedo:  n.º de pedidos "o mais cedo possível" (sem hora agendada)
-- Mesmas regras do dashboard: dia da entrega (dia_venda), sem cancelados nem pedidos de teste,
-- vendas = produtos − desconto.
-- Hora de cada pedido: a hora agendada; no "o mais cedo possível", a hora em que foi marcado como
-- entregue ou, se não houver, a hora do pedido + "Preparação (min)". Almoço = antes das 16:00
-- (como em Clientes). O dashboard passa a devolver estes dados em "by_period".

create or replace function public.vendas_por_turno(p_from date, p_to date)
returns jsonb
language sql
stable
set search_path to ''
as $body$
  with prep as (
    select coalesce((select s.prep_minutes from public.settings s limit 1), 0) as m
  ), o as (
    select public.dia_venda(ord.created_at, ord.deliver_at) as dia,
           ord.subtotal - coalesce(ord.discount, 0) as v,
           ord.deliver_at is null as cedo,
           coalesce(ord.deliver_at,
                    (select max(h.changed_at) from public.order_status_history h
                      where h.order_id = ord.id and h.status = 'delivered'),
                    ord.created_at + make_interval(mins => (select m from prep))) as hora
    from public.orders ord
    where not ord.is_test and ord.status <> 'cancelled'
      and public.dia_venda(ord.created_at, ord.deliver_at) between p_from and p_to
  ), t as (
    select o.dia, o.v, o.cedo,
           -- se passar da meia-noite fica no fim do dia da venda
           case when (o.hora at time zone 'Europe/Lisbon')::date > o.dia then time '23:59'
                else (o.hora at time zone 'Europe/Lisbon')::time end as h
    from o
  ), x as (
    select t.dia, t.v, t.cedo,
           case when t.h < time '16:00' then 'almoco' else 'jantar' end as periodo,
           to_char(make_time(extract(hour from t.h)::int, (extract(minute from t.h)::int / 30) * 30, 0), 'HH24:MI') as slot
    from t
  )
  select jsonb_build_object(
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('day', a.dia, 'periodo', a.periodo, 'orders', a.n, 'revenue', a.v)
                  order by a.dia, a.periodo), '[]'::jsonb)
                from (select dia, periodo, count(*) as n, sum(v) as v from x group by dia, periodo) a),
    'por_hora', (select coalesce(jsonb_agg(jsonb_build_object('slot', a.slot, 'periodo', a.periodo, 'orders', a.n, 'revenue', a.v)
                  order by a.slot), '[]'::jsonb)
                from (select slot, periodo, count(*) as n, sum(v) as v from x group by slot, periodo) a),
    'por_semana', (select coalesce(jsonb_agg(jsonb_build_object('weekday', a.dow, 'periodo', a.periodo, 'orders', a.n, 'revenue', a.v)
                  order by a.dow, a.periodo), '[]'::jsonb)
                from (select extract(dow from dia)::int as dow, periodo, count(*) as n, sum(v) as v from x group by 1, 2) a),
    'mais_cedo', (select count(*) from x where x.cedo)
  );
$body$;

revoke all on function public.vendas_por_turno(date, date) from public, anon;
grant execute on function public.vendas_por_turno(date, date) to authenticated;

-- Junta "by_period" à resposta do dashboard (Resultados). Reescreve a partir da definição atual.
do $mig$
declare
  def text := pg_get_functiondef('public.dashboard(date,date)'::regprocedure);
  novo text;
begin
  if position('by_period' in def) > 0 then return; end if;
  novo := replace(def, $t$'product_sales', public.vendas_por_produto(p_from, p_to),$t$,
    $t$'product_sales', public.vendas_por_produto(p_from, p_to),
    'by_period', public.vendas_por_turno(p_from, p_to),$t$);
  if novo = def then raise exception 'dashboard: não encontrei o texto a substituir'; end if;
  execute novo;
end
$mig$;
