-- Horário com dois períodos por dia (ex.: almoço e jantar).
-- opens/closes continuam a ser o 1.º período; opens2/closes2 o 2.º, opcional.
-- O 2.º período tem de começar depois de o 1.º fechar.

alter table public.opening_hours
  add column if not exists opens2 time,
  add column if not exists closes2 time;

alter table public.opening_hours
  drop constraint if exists opening_hours_periodo2_check;

alter table public.opening_hours
  add constraint opening_hours_periodo2_check check (
    (opens2 is null and closes2 is null)
    or (is_open and opens2 is not null and closes2 is not null and closes < opens2 and opens2 < closes2)
  );
