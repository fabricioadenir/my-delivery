-- Ingredientes: além de ingrediente e embalagem, passam a existir utensílio (ex.: papel toalha) e equipamento (ex.: bandeja de refrigeração).
alter table public.ingredients drop constraint if exists ingredients_kind_check;
alter table public.ingredients add constraint ingredients_kind_check
  check (kind = any (array['ingredient', 'packaging', 'utensil', 'equipment']));

update public.ingredients set kind = 'utensil', updated_at = now()
  where deleted_at is null and kind = 'packaging' and name = 'Papel toalha';
update public.ingredients set kind = 'equipment', updated_at = now()
  where deleted_at is null and kind = 'packaging' and name = 'Bandeja refrigeração';
