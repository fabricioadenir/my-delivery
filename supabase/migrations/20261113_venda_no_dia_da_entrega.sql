-- Vendas contam no dia da entrega, não no dia em que o cliente encomendou.
-- Um pedido feito ontem para entregar hoje entra nas vendas, resultados, IVA, recebimentos, relatório e clientes de hoje.
-- Pedidos "o mais cedo possível" (sem deliver_at) continuam a contar no dia em que foram feitos.

create or replace function public.dia_venda(p_created timestamptz, p_deliver timestamptz)
 returns date
 language sql
 stable
 set search_path to ''
as $$ select (coalesce(p_deliver, p_created) at time zone 'Europe/Lisbon')::date $$;

-- As funções abaixo são reescritas a partir da definição atual, trocando só a data usada.
-- Se alguma troca não encontrar o texto, a migração para (nada fica a meio).
do $mig$
declare
  d text; novo text;
begin
  -- dashboard: Hoje, Resultados, gráfico por dia/semana, top produtos e clientes
  d := pg_get_functiondef('public.dashboard(date,date)'::regprocedure);
  novo := replace(d, '(ord.created_at at time zone tz)::date', 'public.dia_venda(ord.created_at, ord.deliver_at)');
  if novo = d then raise exception 'dashboard: texto não encontrado'; end if;
  execute novo;

  -- period_extras: recebimentos por meio de pagamento, por receber e IVA
  d := pg_get_functiondef('public.period_extras(date,date)'::regprocedure);
  novo := replace(d, '(o.created_at at time zone tz)::date', 'public.dia_venda(o.created_at, o.deliver_at)');
  if novo = d then raise exception 'period_extras: texto não encontrado'; end if;
  execute novo;

  -- report (CSV): data/hora passam a ser as da entrega; "ordered" guarda quando foi encomendado
  d := pg_get_functiondef('public.report(date,date)'::regprocedure);
  novo := replace(d, 'select ord.*, (ord.created_at at time zone ''Europe/Lisbon'') as local_at',
                     'select ord.*, (coalesce(ord.deliver_at, ord.created_at) at time zone ''Europe/Lisbon'') as local_at');
  novo := replace(novo, 'where (ord.created_at at time zone ''Europe/Lisbon'')::date between p_from and p_to',
                        'where public.dia_venda(ord.created_at, ord.deliver_at) between p_from and p_to');
  novo := replace(novo, '''time'', to_char(o.local_at, ''HH24:MI''),',
                        '''time'', to_char(o.local_at, ''HH24:MI''), ''ordered'', to_char(o.created_at at time zone ''Europe/Lisbon'', ''YYYY-MM-DD HH24:MI''),');
  if novo = d or novo !~ 'dia_venda' or novo !~ '''ordered''' or novo !~ 'coalesce\(ord.deliver_at' then raise exception 'report: texto não encontrado'; end if;
  execute novo;

  -- customers_summary: 1.º e último pedido pelo dia da venda
  d := pg_get_functiondef('public.customers_summary()'::regprocedure);
  novo := replace(d, '(o.created_at at time zone ''Europe/Lisbon'')::date', 'public.dia_venda(o.created_at, o.deliver_at)');
  if novo = d then raise exception 'customers_summary: texto não encontrado'; end if;
  execute novo;
end
$mig$;
