-- Pedidos externos: nova origem "instagram" (mensagem pelo Instagram), além de WhatsApp, telefone, presencial e outro.
do $mig$
declare d text; novo text;
begin
  d := pg_get_functiondef('public.create_order_staff(jsonb)'::regprocedure);
  novo := replace(d, '''whatsapp'', ''telefone'', ''presencial'', ''outro''', '''whatsapp'', ''instagram'', ''telefone'', ''presencial'', ''outro''');
  if novo = d then raise exception 'create_order_staff: texto não encontrado'; end if;
  execute novo;
end
$mig$;
