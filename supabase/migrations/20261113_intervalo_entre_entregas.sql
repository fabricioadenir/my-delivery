-- Intervalo mínimo de 15 minutos entre entregas.
-- Cada pedido (não cancelado) ocupa uma hora: a hora agendada, ou, no "o mais cedo possível",
-- a hora do pedido + "Preparação (min)". Uma encomenda agendada no site só pode ficar a 15 minutos ou mais dessas horas.
-- "O mais cedo possível" nunca é recusado (é o tempo de preparação e pronto).
-- Pedidos registados na gestão (create_order_staff) não são bloqueados; a gestão só avisa.
-- As horas passam a ser escolhidas de 5 em 5 minutos (settings.slot_minutes = 5).

-- Hora que um pedido ocupa.
create or replace function public.hora_entrega(p_created timestamptz, p_deliver timestamptz, p_prep integer)
 returns timestamptz
 language sql
 immutable
 set search_path to ''
as $$ select coalesce(p_deliver, p_created + make_interval(mins => coalesce(p_prep, 0))) $$;

-- Intervalos ocupados (hora de Lisboa, limites exclusivos), já juntos, para o site esconder essas horas.
-- Não devolve pedidos nem quantidades: só "de"/"até".
create or replace function public.blocked_times(p_from timestamptz, p_to timestamptz)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to ''
as $$
  with s as (select prep_minutes, coalesce(timezone, 'Europe/Lisbon') as tz from public.settings limit 1),
  h as (
    select public.hora_entrega(o.created_at, o.deliver_at, s.prep_minutes) as t
    from public.orders o, s
    where o.status <> 'cancelled'
  ),
  r as (
    select t - interval '15 minutes' as de, t + interval '15 minutes' as ate from h
    where t between p_from - interval '1 hour' and p_to + interval '1 hour'
  ),
  g as (
    select de, ate, case when de < max(ate) over (order by de rows between unbounded preceding and 1 preceding) then 0 else 1 end as novo from r
  ),
  ilha as (select de, ate, sum(novo) over (order by de) as grupo from g),
  junto as (select min(de) as de, max(ate) as ate from ilha group by grupo)
  select coalesce(jsonb_agg(jsonb_build_array(
           to_char(j.de at time zone s.tz, 'YYYY-MM-DD"T"HH24:MI'),
           to_char(j.ate at time zone s.tz, 'YYYY-MM-DD"T"HH24:MI')) order by j.de), '[]'::jsonb)
  from junto j, s;
$$;
grant execute on function public.blocked_times(timestamptz, timestamptz) to anon, authenticated;

update public.settings set slot_minutes = 5, updated_at = now();

-- create_order: recusa horas a menos de 15 minutos de outro pedido.
do $mig$
declare d text; novo text;
begin
  d := pg_get_functiondef('public.create_order(jsonb)'::regprocedure);
  novo := replace(d,
'  select id into v_customer from public.customers',
'  -- intervalo mínimo de 15 minutos entre entregas (um pedido de cada vez decide a hora)
  -- só nas encomendas agendadas; "o mais cedo possível" nunca é recusado (mas ocupa a hora prevista)
  perform pg_advisory_xact_lock(hashtext(''sakura_horas_entrega''));
  if not v_asap and exists (
    select 1 from public.orders o
    where o.status <> ''cancelled''
      and abs(extract(epoch from public.hora_entrega(o.created_at, o.deliver_at, s.prep_minutes) - v_deliver)) < 900
  ) then
    raise exception ''Essa hora já está ocupada. Escolha outra hora, com pelo menos 15 minutos de diferença.'';
  end if;

  select id into v_customer from public.customers');
  if novo = d then raise exception 'create_order: texto não encontrado'; end if;
  execute novo;
end
$mig$;
