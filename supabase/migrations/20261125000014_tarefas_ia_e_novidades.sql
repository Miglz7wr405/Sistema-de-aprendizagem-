-- 1) Tarefas de IA em segundo plano (correm no servidor; o admin pode sair da página).
create table if not exists public.tarefas_ia (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid references public.cursos(id) on delete cascade,
  -- passos por ordem: 'textos' (títulos/descrições das aulas), 'organizar' (módulos),
  -- 'descricoes' (descrição do curso e dos módulos)
  passos text[] not null,
  passo_atual int not null default 0,
  opcoes jsonb not null default '{}'::jsonb,
  itens jsonb not null default '[]'::jsonb,      -- ids das aulas do passo 'textos'
  feitos int not null default 0,
  falhas int not null default 0,
  estado text not null default 'pendente'
    check (estado in ('pendente', 'a_correr', 'concluida', 'erro', 'cancelada')),
  mensagem text,
  automatica boolean not null default false,
  criado_por uuid references public.perfis(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  bloqueado_ate timestamptz
);
create index if not exists tarefas_ia_estado_idx on public.tarefas_ia (estado, atualizado_em);
create index if not exists tarefas_ia_curso_idx on public.tarefas_ia (curso_id, criado_em desc);
alter table public.tarefas_ia enable row level security;
create policy "tarefas_ia: equipa lê"
  on public.tarefas_ia for select to authenticated using (public.e_equipa());

-- 2) Novidades (pop-up "Novidades da Plataforma" quando entra um curso novo).
create table if not exists public.novidades (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid references public.cursos(id) on delete cascade,
  titulo text not null,
  texto text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists novidades_curso_uidx on public.novidades (curso_id) where curso_id is not null;
alter table public.novidades enable row level security;
create policy "novidades: aprovados leem"
  on public.novidades for select to authenticated using (public.e_aprovado() or public.e_equipa());
create policy "novidades: admin gere"
  on public.novidades for all to authenticated using (public.e_admin()) with check (public.e_admin());

create table if not exists public.novidades_dispensadas (
  user_id uuid not null references public.perfis(id) on delete cascade,
  novidade_id uuid not null references public.novidades(id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (user_id, novidade_id)
);
alter table public.novidades_dispensadas enable row level security;
create policy "dispensadas: o próprio lê"
  on public.novidades_dispensadas for select to authenticated using (user_id = (select auth.uid()));
create policy "dispensadas: o próprio grava"
  on public.novidades_dispensadas for insert to authenticated with check (user_id = (select auth.uid()));

-- Curso publicado (novo, ou que passou a publicado) → novidade.
create or replace function public.novidade_de_curso()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.publicado and (tg_op = 'INSERT' or coalesce(old.publicado, false) = false) then
    insert into public.novidades (curso_id, titulo)
    values (new.id, new.titulo)
    on conflict (curso_id) where curso_id is not null do nothing;
  end if;
  return new;
end;
$$;
create or replace trigger cursos_novidade
  after insert or update of publicado on public.cursos
  for each row execute function public.novidade_de_curso();
