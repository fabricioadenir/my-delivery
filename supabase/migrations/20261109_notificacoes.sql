-- Notificações no telemóvel da equipa (Web Push): visitas, quem está a finalizar e pedidos novos.
-- O segredo que o backend usa para ler as subscrições fica em app_secrets (não está neste ficheiro):
--   insert into public.app_secrets (name, value) values ('push', '<o mesmo valor da variável PUSH_SECRET na Vercel>');

create table if not exists public.app_secrets (
  name  text primary key,
  value text not null
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

create table if not exists public.push_subscriptions (
  id              bigint generated always as identity primary key,
  endpoint        text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh          text not null check (char_length(p256dh) <= 200),
  auth            text not null check (char_length(auth) <= 100),
  user_id         uuid,
  device          text check (char_length(device) <= 80),
  notify_visits   boolean not null default true,
  notify_checkout boolean not null default true,
  notify_orders   boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Equipa: guarda ou atualiza a subscrição deste aparelho e as preferências.
create or replace function public.push_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r push_subscriptions;
begin
  if not public.is_staff() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  insert into push_subscriptions (endpoint, p256dh, auth, user_id, device, notify_visits, notify_checkout, notify_orders)
  values (p->>'endpoint', p->>'p256dh', p->>'auth', auth.uid(), left(p->>'device', 80),
          coalesce((p->>'notify_visits')::boolean, true), coalesce((p->>'notify_checkout')::boolean, true), coalesce((p->>'notify_orders')::boolean, true))
  on conflict (endpoint) do update set
    p256dh = coalesce(nullif(excluded.p256dh, ''), push_subscriptions.p256dh),
    auth = coalesce(nullif(excluded.auth, ''), push_subscriptions.auth),
    user_id = excluded.user_id, device = coalesce(excluded.device, push_subscriptions.device),
    notify_visits = excluded.notify_visits, notify_checkout = excluded.notify_checkout, notify_orders = excluded.notify_orders,
    updated_at = now()
  returning * into r;
  return jsonb_build_object('notify_visits', r.notify_visits, 'notify_checkout', r.notify_checkout, 'notify_orders', r.notify_orders);
end; $$;

-- Equipa: preferências e chaves de uma subscrição (para o teste), ou null se não existir.
create or replace function public.push_get(p_endpoint text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  return (select jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth,
            'notify_visits', notify_visits, 'notify_checkout', notify_checkout, 'notify_orders', notify_orders)
          from push_subscriptions where endpoint = p_endpoint);
end; $$;

-- Equipa: desliga as notificações deste aparelho.
create or replace function public.push_remove(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  delete from push_subscriptions where endpoint = p_endpoint;
end; $$;

-- Backend (com o segredo): para quem enviar um aviso de um tipo (visits, checkout, orders).
create or replace function public.push_targets(p_secret text, p_kind text)
returns setof jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or p_secret <> coalesce((select value from app_secrets where name = 'push'), '') then return; end if;
  return query select jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)
    from push_subscriptions
    where (p_kind = 'visits' and notify_visits) or (p_kind = 'checkout' and notify_checkout) or (p_kind = 'orders' and notify_orders);
end; $$;

-- Backend (com o segredo): apaga uma subscrição que o serviço de notificações deu como caducada.
create or replace function public.push_drop(p_secret text, p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_secret is null or p_secret <> coalesce((select value from app_secrets where name = 'push'), '') then return; end if;
  delete from push_subscriptions where endpoint = p_endpoint;
end; $$;

revoke all on function public.push_save(jsonb), public.push_get(text), public.push_remove(text) from public, anon;
grant execute on function public.push_save(jsonb), public.push_get(text), public.push_remove(text) to authenticated;
revoke all on function public.push_targets(text, text), public.push_drop(text, text) from public;
grant execute on function public.push_targets(text, text), public.push_drop(text, text) to anon, authenticated;
