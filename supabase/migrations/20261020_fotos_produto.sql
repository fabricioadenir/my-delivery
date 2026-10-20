-- Um produto pode ter várias fotos. A primeira é a principal (a que aparece no menu).
-- photo_url continua a guardar a principal, para o que já a usa.

alter table public.products
  add column if not exists photos text[] not null default '{}';

alter table public.products
  add constraint products_photos_max check (cardinality(photos) <= 12);

update public.products
set photos = array[photo_url]
where photo_url is not null and cardinality(photos) = 0;
