create table if not exists public.segredos (
  nome text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.segredos enable row level security;
revoke all on public.segredos from anon, authenticated;
