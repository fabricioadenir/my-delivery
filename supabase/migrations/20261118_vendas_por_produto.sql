-- Resultados: vendas por produto, por categoria e por peça (18/11/2026).
-- Pedido do Fabricio: em "Produtos mais vendidos" ver separado combinados, unidades (porções de 4),
-- quentes… e uma visão geral por peça que junta as peças vendidas avulso com as que vão dentro
-- dos combinados (pela receita do combinado).
--
-- vendas_por_produto(de, até) devolve:
--   categorias: [{id, nome, ordem, quantidade, receita, lucro, pedidos}]
--   produtos:   [{id, nome, categoria_id, categoria, ordem, min_qty, combinado, quantidade, receita, lucro, sem_custo, pedidos}]
--   pecas:      [{id, nome, categoria, avulso, em_combinados, total, pedidos_avulso, combinados: [{nome, pecas}]}]
-- Mesmas regras do dashboard: dia da entrega (dia_venda), sem cancelados nem pedidos de teste.
-- Combinado = produto que tem outros produtos na receita. Peça = produto que não é combinado e
-- se vende em porções (mínimo > 1) ou entra em algum combinado. As peças dentro dos combinados
-- usam a receita atual do combinado.
-- O dashboard passa a devolver estes dados em "product_sales".

create or replace function public.vendas_por_produto(p_from date, p_to date)
returns jsonb
language sql
stable
set search_path to ''
as $body$
  with o as (
    select ord.id
    from public.orders ord
    where not ord.is_test and ord.status <> 'cancelled'
      and public.dia_venda(ord.created_at, ord.deliver_at) between p_from and p_to
  ), it as (
    select oi.order_id, oi.product_id, oi.product_name, oi.quantity, oi.line_total, oi.unit_cost
    from public.order_items oi join o on o.id = oi.order_id
  ), comp as (
    select ri.product_id as combo_id, ri.component_id,
           ri.quantity / nullif(coalesce(p.recipe_yield, 1), 0) as por_combo
    from public.recipe_items ri join public.products p on p.id = ri.product_id
    where ri.component_id is not null
  ), combos as (
    select distinct combo_id from comp
  ), vend as (
    select it.product_id as id, coalesce(max(p.name), max(it.product_name)) as nome,
           p.category_id as categoria_id, coalesce(max(c.name), 'Sem categoria') as categoria,
           coalesce(max(c.sort_order), 9999) as ordem, coalesce(max(p.min_qty), 1) as min_qty,
           (it.product_id in (select combo_id from combos)) as combinado,
           sum(it.quantity) as quantidade, sum(it.line_total) as receita,
           round(sum(it.line_total - coalesce(it.unit_cost, 0) * it.quantity), 2) as lucro,
           bool_or(it.unit_cost is null) as sem_custo, count(distinct it.order_id) as pedidos
    from it
    left join public.products p on p.id = it.product_id
    left join public.product_categories c on c.id = p.category_id
    group by it.product_id, p.category_id
  ), dentro as (  -- peças que saíram dentro dos combinados vendidos
    select comp.component_id as id, v.nome as combo, sum(v.quantidade * comp.por_combo) as pecas
    from vend v join comp on comp.combo_id = v.id
    group by comp.component_id, v.nome
  ), peca_ids as (
    select v.id from vend v where not v.combinado and v.min_qty > 1
    union select d.id from dentro d
    union select v.id from vend v where not v.combinado and v.id in (select component_id from comp)
  ), pecas as (
    select pi.id, coalesce(v.nome, p.name) as nome, coalesce(v.categoria, c.name, 'Sem categoria') as categoria,
           coalesce(v.quantidade, 0) as avulso, coalesce(v.pedidos, 0) as pedidos_avulso,
           coalesce((select sum(d.pecas) from dentro d where d.id = pi.id), 0) as em_combinados,
           (select coalesce(jsonb_agg(jsonb_build_object('nome', d.combo, 'pecas', round(d.pecas, 1)) order by d.pecas desc), '[]'::jsonb)
              from dentro d where d.id = pi.id) as combinados
    from peca_ids pi
    left join vend v on v.id = pi.id
    left join public.products p on p.id = pi.id
    left join public.product_categories c on c.id = p.category_id
  )
  select jsonb_build_object(
    'categorias', (select coalesce(jsonb_agg(to_jsonb(x) order by x.ordem, x.receita desc), '[]'::jsonb) from (
        select v.categoria_id as id, v.categoria as nome, min(v.ordem) as ordem, sum(v.quantidade) as quantidade,
               sum(v.receita) as receita, sum(v.lucro) as lucro,
               (select count(distinct it.order_id) from it join public.products p on p.id = it.product_id
                 where p.category_id is not distinct from v.categoria_id) as pedidos
        from vend v group by v.categoria_id, v.categoria) x),
    'produtos', (select coalesce(jsonb_agg(to_jsonb(v) order by v.ordem, v.quantidade desc, v.receita desc), '[]'::jsonb) from vend v),
    'pecas', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', pc.id, 'nome', pc.nome, 'categoria', pc.categoria, 'avulso', pc.avulso,
                 'pedidos_avulso', pc.pedidos_avulso, 'em_combinados', round(pc.em_combinados, 1),
                 'total', round(pc.avulso + pc.em_combinados, 1), 'combinados', pc.combinados)
               order by pc.avulso + pc.em_combinados desc, pc.nome), '[]'::jsonb) from pecas pc)
  );
$body$;

revoke all on function public.vendas_por_produto(date, date) from public, anon;
grant execute on function public.vendas_por_produto(date, date) to authenticated;

-- Junta "product_sales" à resposta do dashboard (Resultados). Reescreve a partir da definição atual.
do $mig$
declare
  def text := pg_get_functiondef('public.dashboard(date,date)'::regprocedure);
  novo text;
begin
  if position('product_sales' in def) > 0 then return; end if;
  novo := replace(def, $t$'top_customers', (select$t$, $t$'product_sales', public.vendas_por_produto(p_from, p_to),
    'top_customers', (select$t$);
  if novo = def then raise exception 'dashboard: não encontrei o texto a substituir'; end if;
  execute novo;
end
$mig$;
