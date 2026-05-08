-- JM Transportes Financeiro — schema Supabase
-- Rodar UMA VEZ no SQL Editor do projeto Supabase.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  plan_renews_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profile owner read" on public.profiles;
create policy "profile owner read" on public.profiles for select using (auth.uid() = id);

drop policy if exists "profile owner update" on public.profiles;
create policy "profile owner update" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.lancamentos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data date,
  descricao text,
  categoria text,
  tipo text,
  valor numeric,
  updated_at timestamptz not null default now()
);

create table if not exists public.boletos (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  fornecedor text,
  categoria text,
  valor numeric,
  vencimento date,
  status text,
  updated_at timestamptz not null default now()
);

create table if not exists public.notas (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente text,
  num_nota text,
  valor numeric,
  vencimento date,
  status text,
  updated_at timestamptz not null default now()
);

create table if not exists public.dividas (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  credor text,
  tipo text,
  valor_original numeric,
  saldo numeric,
  parcela_total int,
  parcela_paga int,
  valor_parcela numeric,
  prox_venc date,
  status text,
  updated_at timestamptz not null default now()
);

do $$ declare t text;
begin
  for t in select unnest(array['lancamentos','boletos','notas','dividas']) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner all" on public.%I', t);
    execute format('create policy "owner all" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

create index if not exists idx_lancamentos_user on public.lancamentos(user_id);
create index if not exists idx_boletos_user on public.boletos(user_id);
create index if not exists idx_notas_user on public.notas(user_id);
create index if not exists idx_dividas_user on public.dividas(user_id);
