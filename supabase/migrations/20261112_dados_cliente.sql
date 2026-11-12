-- Dados do cliente guardados na base de dados, ligados ao telemóvel e protegidos por PIN.
-- Opcional: quem encomenda como convidado não fica com nada guardado.
-- Segurança:
--   * PIN de 4 números guardado só em hash (bcrypt); PINs óbvios (0000, 1234…) são recusados.
--   * 5 PINs errados bloqueiam 15 minutos; 10 seguidos bloqueiam até usar o link de recuperação.
--   * Sessões: token aleatório, guardado só em hash (sha256), caduca após 180 dias sem uso.
--   * O histórico mostra só pedidos feitos com a sessão iniciada (nunca todos os pedidos daquele número),
--     por isso quem criar conta com o número de outra pessoa não vê os pedidos dela.
--   * Link de recuperação: código secreto por conta, que a equipa envia pelo WhatsApp para o próprio número.
--     Muda sempre que é usado.
--   * Tabelas com RLS e sem políticas: só estas funções lhes mexem.

create table if not exists public.client_accounts (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text not null,
  pin_hash text not null,
  addresses jsonb not null default '[]'::jsonb,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  recovery_code text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);
alter table public.client_accounts enable row level security;

create table if not exists public.client_sessions (
  token_hash text primary key,
  account_id uuid not null references public.client_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
create index if not exists client_sessions_account_idx on public.client_sessions(account_id);
alter table public.client_sessions enable row level security;

alter table public.orders add column if not exists client_account_id uuid references public.client_accounts(id) on delete set null;
create index if not exists orders_client_account_idx on public.orders(client_account_id, created_at desc);

-- ---------- auxiliares (não expostas) ----------

create or replace function public.client_phone(p text) returns text
language sql immutable set search_path = '' as $$
  select case
    when d like '00351%' then substr(d, 6)
    when d like '351%' and length(d) = 12 then substr(d, 4)
    else d end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x;
$$;

create or replace function public.client_check_pin(p text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p is null or p !~ '^[0-9]{4}$' then raise exception 'O PIN tem de ter 4 números.'; end if;
  if p ~ '^(.)\1{3}$' or position(p in '0123456789') > 0 or position(p in '9876543210') > 0 then
    raise exception 'Esse PIN é fácil de adivinhar. Escolha outro (evite 1111, 1234…).';
  end if;
end;
$$;

create or replace function public.client_clean_addresses(p jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  a jsonb; out jsonb := '[]'::jsonb; tem_padrao boolean := false; n int := 0;
begin
  if jsonb_typeof(p) is distinct from 'array' then return out; end if;
  for a in select value from jsonb_array_elements(p) loop
    exit when n >= 10;
    continue when jsonb_typeof(a) is distinct from 'object';
    continue when btrim(coalesce(a->>'rua', '')) = '' or btrim(coalesce(a->>'localidade', '')) = '';
    n := n + 1;
    out := out || jsonb_build_array(jsonb_build_object(
      'id', left(coalesce(nullif(btrim(a->>'id'), ''), 'm' || n), 40),
      'rotulo', left(coalesce(nullif(btrim(a->>'rotulo'), ''), 'Morada'), 40),
      'rua', left(btrim(a->>'rua'), 150),
      'localidade', left(btrim(a->>'localidade'), 80),
      'zona', left(coalesce(a->>'zona', ''), 40),
      'ref', left(btrim(coalesce(a->>'ref', '')), 200),
      'padrao', (not tem_padrao) and coalesce(a->'padrao' = 'true'::jsonb, false)));
    if coalesce(a->'padrao' = 'true'::jsonb, false) then tem_padrao := true; end if;
  end loop;
  if jsonb_array_length(out) > 0 and not tem_padrao then out := jsonb_set(out, '{0,padrao}', 'true'::jsonb); end if;
  return out;
end;
$$;

create or replace function public.client_new_session(p_account uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare t text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into public.client_sessions (token_hash, account_id)
    values (encode(extensions.digest(t, 'sha256'), 'hex'), p_account);
  update public.client_accounts set last_login_at = now() where id = p_account;
  return t;
end;
$$;

create or replace function public.client_session_account(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v uuid; h text;
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then raise exception 'Sessão terminada. Entre outra vez.' using errcode = '28000'; end if;
  h := encode(extensions.digest(p_token, 'sha256'), 'hex');
  delete from public.client_sessions where last_used_at < now() - interval '180 days';
  update public.client_sessions set last_used_at = now() where token_hash = h returning account_id into v;
  if v is null then raise exception 'Sessão terminada. Entre outra vez.' using errcode = '28000'; end if;
  return v;
end;
$$;

create or replace function public.client_payload(p_account uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'nome', a.name, 'tel', a.phone, 'moradas', a.addresses,
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'number', o.number, 'created_at', o.created_at, 'total', o.total, 'status', o.status,
        'itens', (select coalesce(jsonb_agg(jsonb_build_object('id', oi.product_id, 'q', oi.quantity, 'nome', oi.product_name) order by oi.product_name), '[]'::jsonb)
                  from public.order_items oi where oi.order_id = o.id))
        order by o.created_at desc)
      from (select * from public.orders where client_account_id = a.id order by created_at desc limit 20) o), '[]'::jsonb))
  from public.client_accounts a where a.id = p_account;
$$;

-- ---------- funções públicas (site) ----------

create or replace function public.client_signup(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_phone text := public.client_phone(p->>'tel');
  v_name text := left(btrim(coalesce(p->>'nome', '')), 80);
  v_id uuid;
begin
  if length(v_name) < 2 then raise exception 'Escreva o seu nome.'; end if;
  if length(v_phone) < 9 or length(v_phone) > 15 then raise exception 'Escreva um número de telemóvel com 9 dígitos.'; end if;
  perform public.client_check_pin(p->>'pin');
  if exists (select 1 from public.client_accounts where phone = v_phone) then
    raise exception 'Este número já tem dados guardados. Entre com o seu PIN.' using errcode = '23505';
  end if;
  insert into public.client_accounts (phone, name, pin_hash, addresses)
    values (v_phone, v_name, extensions.crypt(p->>'pin', extensions.gen_salt('bf', 8)), public.client_clean_addresses(p->'moradas'))
    returning id into v_id;
  return jsonb_build_object('token', public.client_new_session(v_id), 'conta', public.client_payload(v_id));
end;
$$;

-- Erros de PIN voltam como {"erro": ...} em vez de exceção, para a contagem de tentativas não ser desfeita.
create or replace function public.client_login(p_tel text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.client_accounts%rowtype; n int;
  bloqueado constant text := 'PIN bloqueado por segurança. Peça-nos pelo WhatsApp um link para escolher um PIN novo.';
begin
  select * into a from public.client_accounts where phone = public.client_phone(p_tel) for update;
  if not found then return jsonb_build_object('erro', 'Não há dados guardados com este número.', 'sem_conta', true); end if;
  if a.failed_attempts >= 10 then return jsonb_build_object('erro', bloqueado, 'bloqueado', true); end if;
  if a.locked_until is not null and a.locked_until > now() then
    return jsonb_build_object('erro', 'Muitas tentativas erradas. Tente outra vez daqui a '
      || ceil(extract(epoch from a.locked_until - now()) / 60)::int || ' minutos.');
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' or a.pin_hash <> extensions.crypt(p_pin, a.pin_hash) then
    n := a.failed_attempts + 1;
    update public.client_accounts set failed_attempts = n,
      locked_until = case when n = 5 then now() + interval '15 minutes' else locked_until end
      where id = a.id;
    if n >= 10 then return jsonb_build_object('erro', bloqueado, 'bloqueado', true); end if;
    if n = 5 then return jsonb_build_object('erro', 'PIN errado 5 vezes. Por segurança, espere 15 minutos.'); end if;
    return jsonb_build_object('erro', 'PIN errado. ' || case when n < 5 then 5 - n else 10 - n end
      || case when (case when n < 5 then 5 - n else 10 - n end) = 1 then ' tentativa' else ' tentativas' end || ' antes do bloqueio.');
  end if;
  update public.client_accounts set failed_attempts = 0, locked_until = null where id = a.id;
  return jsonb_build_object('token', public.client_new_session(a.id), 'conta', public.client_payload(a.id));
end;
$$;

create or replace function public.client_me(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  return public.client_payload(public.client_session_account(p_token));
end;
$$;

create or replace function public.client_update(p_token text, p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v uuid := public.client_session_account(p_token); v_name text := left(btrim(coalesce(p->>'nome', '')), 80);
begin
  if p ? 'nome' and length(v_name) < 2 then raise exception 'Escreva o seu nome.'; end if;
  update public.client_accounts set
    name = case when p ? 'nome' then v_name else name end,
    addresses = case when p ? 'moradas' then public.client_clean_addresses(p->'moradas') else addresses end,
    updated_at = now()
    where id = v;
  return public.client_payload(v);
end;
$$;

create or replace function public.client_change_pin(p_token text, p_old text, p_new text) returns void
language plpgsql security definer set search_path = '' as $$
declare v uuid := public.client_session_account(p_token); h text;
begin
  select pin_hash into h from public.client_accounts where id = v;
  if coalesce(p_old, '') !~ '^[0-9]{4}$' or h <> extensions.crypt(p_old, h) then raise exception 'O PIN atual está errado.'; end if;
  perform public.client_check_pin(p_new);
  update public.client_accounts set pin_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 8)), updated_at = now() where id = v;
end;
$$;

create or replace function public.client_logout(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.client_sessions where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create or replace function public.client_delete(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.client_accounts where id = public.client_session_account(p_token);
end;
$$;

-- Liga um pedido acabado de fazer à conta com sessão iniciada (só pedidos dos últimos 15 minutos e ainda sem conta).
-- O id do pedido só é conhecido por quem o fez, por isso não é preciso o telemóvel coincidir
-- (ex.: encomendar para outra pessoa e ver o pedido na própria lista).
create or replace function public.client_attach_order(p_token text, p_order uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v uuid := public.client_session_account(p_token);
begin
  update public.orders set client_account_id = v
    where id = p_order and client_account_id is null and created_at > now() - interval '15 minutes';
end;
$$;

create or replace function public.client_recover_info(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('nome', split_part(name, ' ', 1), 'tel_fim', right(phone, 3))
  from public.client_accounts where recovery_code = p_code and p_code ~ '^[0-9a-f]{36}$';
$$;

create or replace function public.client_recover(p_code text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  perform public.client_check_pin(p_pin);
  update public.client_accounts set
    pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), failed_attempts = 0, locked_until = null,
    recovery_code = encode(extensions.gen_random_bytes(18), 'hex'), updated_at = now()
    where recovery_code = p_code and p_code ~ '^[0-9a-f]{36}$'
    returning id into v;
  if v is null then raise exception 'Este link já foi usado ou não é válido. Peça-nos um novo pelo WhatsApp.' using errcode = 'P0002'; end if;
  delete from public.client_sessions where account_id = v;
  return jsonb_build_object('token', public.client_new_session(v), 'conta', public.client_payload(v));
end;
$$;

-- ---------- equipa ----------

-- Telemóveis com dados guardados e o código do link de recuperação (para enviar ao próprio cliente).
create or replace function public.client_accounts_staff() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_staff() then raise exception 'Sem acesso.' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('phone', phone, 'code', recovery_code, 'locked', failed_attempts >= 10))
    from public.client_accounts), '[]'::jsonb);
end;
$$;

-- ---------- permissões ----------
revoke all on function public.client_phone(text), public.client_check_pin(text), public.client_clean_addresses(jsonb),
  public.client_new_session(uuid), public.client_session_account(text), public.client_payload(uuid) from public, anon, authenticated;
revoke all on function public.client_signup(jsonb), public.client_login(text, text), public.client_me(text),
  public.client_update(text, jsonb), public.client_change_pin(text, text, text), public.client_logout(text),
  public.client_delete(text), public.client_attach_order(text, uuid), public.client_recover_info(text),
  public.client_recover(text, text), public.client_accounts_staff() from public;
revoke execute on function public.client_accounts_staff() from anon;
grant execute on function public.client_signup(jsonb), public.client_login(text, text), public.client_me(text),
  public.client_update(text, jsonb), public.client_change_pin(text, text, text), public.client_logout(text),
  public.client_delete(text), public.client_attach_order(text, uuid), public.client_recover_info(text),
  public.client_recover(text, text) to anon, authenticated;
grant execute on function public.client_accounts_staff() to authenticated;
