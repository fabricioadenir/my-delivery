-- Pergunta "Gostaria de gengibre?" (sem custo) no checkout, como a do wasabi (27/11).
-- O site grava a resposta em orders.extras.gengibre (true/false); create_order já guarda extras como vêm.
-- Aqui só a ficha do cliente (customers_overview) passa a contar o gengibre nos "Gostos".
-- Pedidos antigos (antes de 13/11) tinham extras.gengibre marcado por defeito junto com "pauzinhos":
-- esses ficam de fora (not extras ? 'pauzinhos').
-- Reescreve a função a partir da definição atual com replace e para se não encontrar o texto.
do $m$
declare d text; n text;
begin
  d := pg_get_functiondef('public.customers_overview()'::regprocedure);

  n := replace(d,
    $a$count(*) filter (where (o.extras->>'elastico') = 'false')::int as elastico_nao,$a$,
    $a$count(*) filter (where (o.extras->>'elastico') = 'false')::int as elastico_nao,
      count(*) filter (where (o.extras->>'gengibre') = 'true' and not (o.extras ? 'pauzinhos'))::int as gengibre_sim,
      count(*) filter (where (o.extras->>'gengibre') = 'false' and not (o.extras ? 'pauzinhos'))::int as gengibre_nao,$a$);
  if n = d then raise exception 'customers_overview: não encontrei elastico_nao'; end if;
  d := n;

  n := replace(d,
    $a$'elastico', jsonb_build_object('sim', coalesce(b.elastico_sim, 0), 'nao', coalesce(b.elastico_nao, 0)),$a$,
    $a$'elastico', jsonb_build_object('sim', coalesce(b.elastico_sim, 0), 'nao', coalesce(b.elastico_nao, 0)),
      'gengibre', jsonb_build_object('sim', coalesce(b.gengibre_sim, 0), 'nao', coalesce(b.gengibre_nao, 0)),$a$);
  if n = d then raise exception 'customers_overview: não encontrei o bloco elastico do json'; end if;

  execute n;
end $m$;
