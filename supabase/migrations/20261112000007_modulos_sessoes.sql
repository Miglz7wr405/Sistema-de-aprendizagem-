-- Insight Academia — módulos (agrupar aulas dentro de um curso)
-- e sessões ativas (uma sessão viva por conta).

-- ─── Módulos ───────────────────────────────────────────────────────────────

create table public.modulos (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id) on delete cascade,
  titulo text not null,
  descricao text,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create index modulos_curso_idx on public.modulos (curso_id, ordem);

alter table public.aulas
  add column modulo_id uuid references public.modulos (id) on delete set null;

create index aulas_modulo_idx on public.aulas (modulo_id, ordem);

alter table public.modulos enable row level security;

create policy modulos_ver on public.modulos
  for select to authenticated using (
    exists (
      select 1
      from public.cursos c
      join public.seccoes s on s.id = c.seccao_id
      where c.id = modulos.curso_id and public.pode_ver(s.visibilidade)
    )
  );

create policy modulos_admin on public.modulos
  for all to authenticated
  using ((select public.e_admin())) with check ((select public.e_admin()));

-- ─── Sessão ativa (uma por conta) ──────────────────────────────────────────

create table public.sessoes_ativas (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sessao_id text not null,
  ip inet,
  agente text,
  criada_em timestamptz not null default now(),
  vista_em timestamptz not null default now()
);

alter table public.sessoes_ativas enable row level security;

-- Cada pessoa só lê a SUA linha (para a app poder perguntar "a minha sessão ainda é a válida?").
create policy sessoes_ler_a_minha on public.sessoes_ativas
  for select to authenticated using (user_id = (select auth.uid()));

-- A escrita é feita apenas pelas Edge Functions (service_role bypassa o RLS).
