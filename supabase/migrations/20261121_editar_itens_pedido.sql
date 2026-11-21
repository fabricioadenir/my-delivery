-- Editar os itens de um pedido já feito (gestão), sem criar outro pedido.
-- Itens existentes mantêm o preço e o custo com que foram pedidos; itens novos entram ao preço atual.
-- Só até "Em preparação" (antes de sair para entrega e de descontar stock).

create table if not exists public.order_changes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  summary text not null,
  note text,
  old_total numeric(10,2),
  new_total numeric(10,2),
  before_items jsonb,
  after_items jsonb
);
create index if not exists order_changes_order_idx on public.order_changes(order_id, changed_at);
alter table public.order_changes enable row level security;
create policy "equipa le alteracoes" on public.order_changes for select using (public.is_staff());

-- p_items: [{ "item_id": uuid, "quantity": n }]               -> linha existente (0 = tirar)
--          [{ "product_id": uuid, "quantity": n, "option": "Fresca"|"Natural" }] -> linha nova
-- Linhas existentes que não venham na lista são tiradas.
create or replace function public.edit_order_items(p_order uuid, p_items jsonb, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  o public.orders%rowtype;
  pr public.products%rowtype;
  oi public.order_items%rowtype;
  it record;
  v_keep uuid[] := '{}';
  v_parts text[] := '{}';
  v_before jsonb;
  v_after jsonb;
  v_subtotal numeric(10,2);
  v_total numeric(10,2);
  v_cost numeric(10,2);
  v_new uuid;
  v_name text;
  v_summary text;
begin
  if not public.is_staff() then raise exception 'Sem permissão.' using errcode = '42501'; end if;

  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.status in ('out_for_delivery', 'delivered', 'cancelled') or o.stock_deducted_at is not null then
    raise exception 'Este pedido já não pode ser alterado (%).',
      case o.status when 'out_for_delivery' then 'já saiu para entrega'
                    when 'delivered' then 'já foi entregue'
                    when 'cancelled' then 'está cancelado'
                    else 'stock já descontado' end;
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'O pedido tem de ficar com pelo menos um produto.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', product_name, 'quantity', quantity, 'unit_price', unit_price)
                            order by product_name), '[]'::jsonb)
    into v_before from public.order_items where order_id = p_order;

  for it in select * from jsonb_to_recordset(p_items) as x(item_id uuid, product_id uuid, quantity integer, option text) loop
    if it.quantity is null or it.quantity < 0 or it.quantity > 999 then
      raise exception 'Quantidade inválida.';
    end if;

    if it.item_id is not null then
      select * into oi from public.order_items where id = it.item_id and order_id = p_order;
      if not found then raise exception 'Um dos produtos do pedido mudou entretanto. Abra o pedido de novo.'; end if;
      if it.item_id = any(v_keep) then raise exception '% aparece duas vezes.', oi.product_name; end if;
      if it.quantity > 0 then
        v_keep := v_keep || oi.id;
        if it.quantity <> oi.quantity then
          update public.order_items set quantity = it.quantity, line_total = unit_price * it.quantity where id = oi.id;
          v_parts := v_parts || format('%s: %s → %s', oi.product_name, oi.quantity, it.quantity);
        end if;
      end if;

    elsif it.product_id is not null then
      continue when it.quantity = 0;
      select * into pr from public.products where id = it.product_id and deleted_at is null;
      if not found then raise exception 'Um dos produtos já não existe.'; end if;
      if it.option is not null and (not pr.temp_option or it.option not in ('Fresca', 'Natural')) then
        raise exception '%: opção inválida.', pr.name;
      end if;
      v_name := pr.name || coalesce(' (' || lower(it.option) || ')', '');
      insert into public.order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
        values (p_order, pr.id, v_name, pr.price, it.quantity, pr.price * it.quantity)
        returning id into v_new;
      v_keep := v_keep || v_new;
      v_parts := v_parts || format('+%s× %s', it.quantity, v_name);

    else
      raise exception 'Produto inválido.';
    end if;
  end loop;

  for oi in select * from public.order_items where order_id = p_order and not (id = any(v_keep)) order by product_name loop
    v_parts := v_parts || format('−%s× %s', oi.quantity, oi.product_name);
  end loop;
  delete from public.order_items where order_id = p_order and not (id = any(v_keep));

  if cardinality(v_parts) = 0 then raise exception 'Não mudou nada no pedido.'; end if;
  if not exists (select 1 from public.order_items where order_id = p_order) then
    raise exception 'O pedido tem de ficar com pelo menos um produto. Para o anular, cancele-o.';
  end if;

  select round(sum(line_total), 2),
         case when count(*) filter (where unit_cost is null) > 0 then null
              else round(sum(unit_cost * quantity), 2) end
    into v_subtotal, v_cost
    from public.order_items where order_id = p_order;

  if coalesce(o.discount, 0) > v_subtotal then
    raise exception 'O desconto (% €) ficava maior do que os produtos (% €). Ajuste o desconto primeiro.',
      to_char(o.discount, 'FM999990D00'), to_char(v_subtotal, 'FM999990D00');
  end if;
  v_total := v_subtotal - coalesce(o.discount, 0) + coalesce(o.delivery_fee, 0);

  update public.orders set subtotal = v_subtotal, total = v_total, cost_total = v_cost where id = p_order;

  select jsonb_agg(jsonb_build_object('name', product_name, 'quantity', quantity, 'unit_price', unit_price)
                   order by product_name)
    into v_after from public.order_items where order_id = p_order;

  v_summary := array_to_string(v_parts, '; ');
  insert into public.order_changes (order_id, changed_by, summary, note, old_total, new_total, before_items, after_items)
    values (p_order, (select auth.uid()), v_summary, nullif(btrim(coalesce(p_note, '')), ''), o.total, v_total, v_before, v_after);

  return jsonb_build_object(
    'id', p_order, 'number', o.number, 'code', o.public_code,
    'summary', v_summary, 'old_total', o.total, 'total', v_total,
    'difference', v_total - o.total, 'subtotal', v_subtotal, 'cost_total', v_cost,
    'change_for', o.change_for, 'payment_method', o.payment_method);
end;
$function$;

revoke all on function public.edit_order_items(uuid, jsonb, text) from public, anon;
grant execute on function public.edit_order_items(uuid, jsonb, text) to authenticated;
