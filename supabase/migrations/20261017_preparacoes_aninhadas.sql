-- Uma preparação pode levar outras preparações (ex.: o arroz leva molho su).
-- Custo e baixa de stock passam a seguir a cadeia; voltas (A leva B e B leva A) são recusadas.

alter table public.preparation_items
  alter column ingredient_id drop not null,
  add column if not exists sub_preparation_id uuid references public.preparations(id);

alter table public.preparation_items
  add constraint preparation_items_one_source check (num_nonnulls(ingredient_id, sub_preparation_id) = 1),
  add constraint preparation_items_not_self check (sub_preparation_id is distinct from preparation_id);

create index if not exists preparation_items_sub_preparation_idx on public.preparation_items (sub_preparation_id);

-- Custo por unidade pronta, somando ingredientes e preparações usadas (até 6 níveis).
create or replace function public.preparation_unit_cost_at(p uuid, depth integer)
returns numeric language plpgsql stable set search_path to '' as $$
declare
  total numeric := 0;
  y numeric;
  r record;
begin
  if depth > 5 then return 0; end if;
  select yield_qty into y from public.preparations where id = p;
  if y is null or y = 0 then return null; end if;
  for r in select * from public.preparation_items where preparation_id = p loop
    if r.ingredient_id is not null then
      total := total + r.quantity * coalesce((select unit_cost from public.ingredients where id = r.ingredient_id), 0);
    else
      total := total + r.quantity * coalesce(public.preparation_unit_cost_at(r.sub_preparation_id, depth + 1), 0);
    end if;
  end loop;
  return round(total / y, 6);
end;
$$;

create or replace function public.preparation_unit_cost(p uuid)
returns numeric language sql stable set search_path to '' as $$
  select public.preparation_unit_cost_at(p, 0);
$$;

-- Ingredientes comprados que entram numa quantidade pronta de uma preparação.
create or replace function public.preparation_ingredients(p uuid, qty numeric, depth integer default 0)
returns table(ingredient_id uuid, quantity numeric) language plpgsql stable set search_path to '' as $$
#variable_conflict use_column
declare
  y numeric;
  r record;
begin
  if depth > 5 then return; end if;
  select pp.yield_qty into y from public.preparations pp where pp.id = p;
  if y is null or y = 0 then return; end if;
  for r in select pi.* from public.preparation_items pi where pi.preparation_id = p loop
    if r.ingredient_id is not null then
      return query select r.ingredient_id, qty * r.quantity / y;
    else
      return query select u.ingredient_id, u.quantity
        from public.preparation_ingredients(r.sub_preparation_id, qty * r.quantity / y, depth + 1) u;
    end if;
  end loop;
end;
$$;

create or replace function public.product_ingredients(p uuid, qty numeric, depth integer default 0)
returns table(ingredient_id uuid, quantity numeric) language plpgsql stable set search_path to '' as $$
#variable_conflict use_column
declare
  y numeric;
  r record;
begin
  if depth > 4 then return; end if;
  select pr.recipe_yield into y from public.products pr where pr.id = p;
  if y is null then return; end if;
  for r in select ri.* from public.recipe_items ri where ri.product_id = p loop
    if r.ingredient_id is not null then
      return query select r.ingredient_id, qty * r.quantity / y;
    elsif r.preparation_id is not null then
      return query select u.ingredient_id, u.quantity
        from public.preparation_ingredients(r.preparation_id, qty * r.quantity / y) u;
    else
      return query select u.ingredient_id, u.quantity
        from public.product_ingredients(r.component_id, qty * r.quantity / y, depth + 1) u;
    end if;
  end loop;
end;
$$;

-- Guarda uma preparação com ingredientes e preparações. A save_preparation original troca as linhas
-- de ingredientes; esta junta as preparações usadas e recusa voltas.
create or replace function public.save_preparation_tree(p_id uuid, p_name text, p_unit text, p_yield numeric, p_items jsonb)
returns uuid language plpgsql set search_path to '' as $$
declare
  v uuid;
  items jsonb := coalesce(p_items, '[]'::jsonb);
begin
  v := public.save_preparation(p_id, p_name, p_unit, p_yield,
    coalesce((select jsonb_agg(e) from jsonb_array_elements(items) e where e ? 'ingredient_id'), '[]'::jsonb));
  insert into public.preparation_items (preparation_id, sub_preparation_id, quantity)
  select v, x.sub_preparation_id, x.quantity
  from jsonb_to_recordset(coalesce((select jsonb_agg(e) from jsonb_array_elements(items) e where e ? 'sub_preparation_id'), '[]'::jsonb))
    as x(sub_preparation_id uuid, quantity numeric);
  if exists (
    with recursive usadas(id) as (
      select pi.sub_preparation_id from public.preparation_items pi
      where pi.preparation_id = v and pi.sub_preparation_id is not null
      union
      select pi.sub_preparation_id from public.preparation_items pi
      join usadas u on pi.preparation_id = u.id
      where pi.sub_preparation_id is not null
    )
    select 1 from usadas where id = v
  ) then
    raise exception 'Esta preparação já é usada por uma das que escolheu. Uma preparação não pode entrar nela própria.';
  end if;
  return v;
end;
$$;

revoke execute on function public.save_preparation_tree(uuid, text, text, numeric, jsonb) from public, anon;
grant execute on function public.save_preparation_tree(uuid, text, text, numeric, jsonb) to authenticated, service_role;
revoke all on function public.preparation_unit_cost_at(uuid, integer) from public, anon;
revoke all on function public.preparation_ingredients(uuid, numeric, integer) from public, anon;
grant execute on function public.preparation_unit_cost_at(uuid, integer) to authenticated, service_role;
grant execute on function public.preparation_ingredients(uuid, numeric, integer) to authenticated, service_role;
