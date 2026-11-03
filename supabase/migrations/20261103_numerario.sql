-- "Dinheiro" passa a chamar-se "Numerário" no site
update public.settings
   set payment_methods = array_replace(payment_methods, 'Dinheiro', 'Numerário');
