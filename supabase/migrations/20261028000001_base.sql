-- Insight Academia — base: perfis, conteúdo, comunidade, notificações e RLS.
-- Regra de visibilidade usada em todo o lado:
--   'academia' → qualquer pessoa aprovada (alunos e equipa)
--   'privada'  → só a equipa Insight (papel admin ou equipa)

create type public.papel as enum ('admin', 'equipa', 'aluno');
create type public.estado_perfil as enum ('pendente', 'aprovado', 'recusado', 'bloqueado');
create type public.visibilidade as enum ('privada', 'academia');
create type public.tipo_aula as enum ('youtube', 'link', 'upload');

-- ─── Perfis ────────────────────────────────────────────────────────────────

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome_completo text not null default '',
  email text not null default '',
  telefone text,
  motivo text,
  avatar_url text,
  papel public.papel not null default 'aluno',
  estado public.estado_perfil not null default 'pendente',
  aprovado_por uuid references public.perfis (id) on delete set null,
  aprovado_em timestamptz,
  created_at timestamptz not null default now()
);

create index perfis_estado_idx on public.perfis (estado);

-- Funções de permissão (security definer para não entrarem em recursão com o RLS de perfis).
create or replace function public.e_aprovado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and estado = 'aprovado'
  );
$$;

create or replace function public.e_equipa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and estado = 'aprovado' and papel in ('admin', 'equipa')
  );
$$;

create or replace function public.e_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and estado = 'aprovado' and papel = 'admin'
  );
$$;

create or replace function public.pode_ver(v public.visibilidade)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.e_equipa() or (v = 'academia' and public.e_aprovado());
$$;

revoke execute on function public.e_aprovado() from public, anon;
revoke execute on function public.e_equipa() from public, anon;
revoke execute on function public.e_admin() from public, anon;
revoke execute on function public.pode_ver(public.visibilidade) from public, anon;
grant execute on function public.e_aprovado() to authenticated;
grant execute on function public.e_equipa() to authenticated;
grant execute on function public.e_admin() to authenticated;
grant execute on function public.pode_ver(public.visibilidade) to authenticated;

alter table public.perfis enable row level security;

create policy perfis_ver_proprio_ou_admin on public.perfis
  for select to authenticated
  using (id = (select auth.uid()) or (select public.e_admin()));

create policy perfis_editar_proprio_ou_admin on public.perfis
  for update to authenticated
  using (id = (select auth.uid()) or (select public.e_admin()))
  with check (id = (select auth.uid()) or (select public.e_admin()));

-- Quem não é admin só pode mudar o nome, telefone e foto do próprio perfil.
create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() nulo = SQL do servidor/painel, que pode mudar tudo.
  if (select auth.uid()) is not null and not public.e_admin() then
    new.papel := old.papel;
    new.estado := old.estado;
    new.email := old.email;
    new.aprovado_por := old.aprovado_por;
    new.aprovado_em := old.aprovado_em;
  elsif new.estado = 'aprovado' and old.estado is distinct from 'aprovado' then
    new.aprovado_por := (select auth.uid());
    new.aprovado_em := now();
  end if;
  return new;
end;
$$;

create trigger proteger_perfil
  before update on public.perfis
  for each row execute function public.proteger_perfil();

-- Lista de nomes para a comunidade (sem email nem telefone).
create or replace function public.listar_membros()
returns table (id uuid, nome_completo text, papel public.papel, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nome_completo, p.papel, p.avatar_url
  from public.perfis p
  where p.estado = 'aprovado' and public.e_aprovado()
  order by p.nome_completo;
$$;

revoke execute on function public.listar_membros() from public, anon;
grant execute on function public.listar_membros() to authenticated;

-- ─── Notificações ──────────────────────────────────────────────────────────

create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfis (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  corpo text,
  link text,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

create index notificacoes_user_idx on public.notificacoes (user_id, created_at desc);

alter table public.notificacoes enable row level security;

create policy notificacoes_ver_proprias on public.notificacoes
  for select to authenticated using (user_id = (select auth.uid()));
create policy notificacoes_marcar_proprias on public.notificacoes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy notificacoes_apagar_proprias on public.notificacoes
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.notificar_admins(p_tipo text, p_titulo text, p_corpo text, p_link text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notificacoes (user_id, tipo, titulo, corpo, link)
  select id, p_tipo, p_titulo, p_corpo, p_link
  from public.perfis
  where papel = 'admin' and estado = 'aprovado';
$$;

revoke execute on function public.notificar_admins(text, text, text, text) from public, anon, authenticated;

-- ─── Novo utilizador → perfil pendente (fundadores entram logo como admin) ──

create or replace function public.ao_criar_utilizador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(new.email));
  v_fundador boolean := v_email = any (array[
    'miguelzinhonordez@gmail.com',
    'samirbarros9@gmail.com',
    'cleitomsilvania@gmail.com',
    'edmilsonmario402@gmail.com',
    'rogerio.gaspar94@gmail.com',
    'insightstudio16@gmail.com',
    'jeronimojafete@gmail.com'
  ]);
  v_nome text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome_completo'), ''), split_part(v_email, '@', 1));
begin
  insert into public.perfis (id, nome_completo, email, telefone, motivo, papel, estado, aprovado_em)
  values (
    new.id,
    v_nome,
    v_email,
    nullif(trim(new.raw_user_meta_data ->> 'telefone'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'motivo'), ''),
    case when v_fundador then 'admin'::public.papel else 'aluno'::public.papel end,
    case when v_fundador then 'aprovado'::public.estado_perfil else 'pendente'::public.estado_perfil end,
    case when v_fundador then now() end
  );

  if not v_fundador then
    perform public.notificar_admins(
      'pedido_acesso',
      'Novo pedido de acesso',
      v_nome || ' (' || v_email || ') quer entrar na academia.',
      '/admin/pedidos'
    );
  end if;

  return new;
end;
$$;

create trigger ao_criar_utilizador
  after insert on auth.users
  for each row execute function public.ao_criar_utilizador();

-- Avisa a pessoa quando o pedido é aceite ou recusado.
create or replace function public.ao_decidir_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.estado = 'aprovado' and old.estado is distinct from 'aprovado' then
    insert into public.notificacoes (user_id, tipo, titulo, corpo, link)
    values (new.id, 'acesso_aprovado', 'Bem-vindo à Insight Academia!', 'O teu acesso foi aprovado. Já podes ver as aulas.', '/');
  end if;
  return new;
end;
$$;

create trigger ao_decidir_pedido
  after update of estado on public.perfis
  for each row execute function public.ao_decidir_pedido();

-- ─── Conteúdo: secções → cursos → aulas ────────────────────────────────────

create table public.seccoes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  icone text,
  visibilidade public.visibilidade not null default 'academia',
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.cursos (
  id uuid primary key default gen_random_uuid(),
  seccao_id uuid not null references public.seccoes (id) on delete cascade,
  titulo text not null,
  descricao text,
  nivel text not null default 'iniciante' check (nivel in ('iniciante', 'intermedio', 'avancado')),
  duracao text,
  capa_url text,
  ordem integer not null default 0,
  publicado boolean not null default true,
  created_at timestamptz not null default now()
);

create index cursos_seccao_idx on public.cursos (seccao_id, ordem);

create table public.aulas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id) on delete cascade,
  titulo text not null,
  descricao text,
  tipo public.tipo_aula not null default 'youtube',
  url text,
  storage_path text,
  duracao text,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  constraint aulas_tem_fonte check (url is not null or storage_path is not null)
);

create index aulas_curso_idx on public.aulas (curso_id, ordem);

alter table public.seccoes enable row level security;
alter table public.cursos enable row level security;
alter table public.aulas enable row level security;

create policy seccoes_ver on public.seccoes
  for select to authenticated using (public.pode_ver(visibilidade));
create policy seccoes_admin on public.seccoes
  for all to authenticated
  using ((select public.e_admin())) with check ((select public.e_admin()));

create policy cursos_ver on public.cursos
  for select to authenticated using (
    (publicado or (select public.e_admin()))
    and exists (
      select 1 from public.seccoes s
      where s.id = cursos.seccao_id and public.pode_ver(s.visibilidade)
    )
  );
create policy cursos_admin on public.cursos
  for all to authenticated
  using ((select public.e_admin())) with check ((select public.e_admin()));

create or replace function public.pode_ver_aula(p_aula uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.aulas a
    join public.cursos c on c.id = a.curso_id
    join public.seccoes s on s.id = c.seccao_id
    where a.id = p_aula
      and (c.publicado or public.e_admin())
      and public.pode_ver(s.visibilidade)
  );
$$;

revoke execute on function public.pode_ver_aula(uuid) from public, anon;
grant execute on function public.pode_ver_aula(uuid) to authenticated;

create policy aulas_ver on public.aulas
  for select to authenticated using (public.pode_ver_aula(id));
create policy aulas_admin on public.aulas
  for all to authenticated
  using ((select public.e_admin())) with check ((select public.e_admin()));

-- ─── Progresso por pessoa ──────────────────────────────────────────────────

create table public.progresso (
  user_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  aula_id uuid not null references public.aulas (id) on delete cascade,
  concluida boolean not null default false,
  vista_em timestamptz not null default now(),
  concluida_em timestamptz,
  primary key (user_id, aula_id)
);

create index progresso_aula_idx on public.progresso (aula_id);

alter table public.progresso enable row level security;

create policy progresso_ver on public.progresso
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.e_admin()));
create policy progresso_inserir on public.progresso
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.pode_ver_aula(aula_id));
create policy progresso_atualizar on public.progresso
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy progresso_apagar on public.progresso
  for delete to authenticated using (user_id = (select auth.uid()));

-- ─── Perguntas e respostas por aula ────────────────────────────────────────

create table public.perguntas (
  id uuid primary key default gen_random_uuid(),
  aula_id uuid not null references public.aulas (id) on delete cascade,
  autor_id uuid default auth.uid() references public.perfis (id) on delete set null,
  autor_nome text not null default '',
  autor_papel public.papel,
  texto text not null check (length(trim(texto)) > 0),
  responde_a uuid references public.perguntas (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index perguntas_aula_idx on public.perguntas (aula_id, created_at);
create index perguntas_responde_idx on public.perguntas (responde_a);
create index perguntas_autor_idx on public.perguntas (autor_id);

alter table public.perguntas enable row level security;

create policy perguntas_ver on public.perguntas
  for select to authenticated using (public.pode_ver_aula(aula_id));
create policy perguntas_inserir on public.perguntas
  for insert to authenticated
  with check (autor_id = (select auth.uid()) and public.pode_ver_aula(aula_id));
create policy perguntas_apagar on public.perguntas
  for delete to authenticated
  using (autor_id = (select auth.uid()) or (select public.e_admin()));

-- Nome e papel do autor vêm sempre do perfil (ninguém escreve em nome de outro).
create or replace function public.carimbar_autor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.autor_id := (select auth.uid());
  select p.nome_completo, p.papel into new.autor_nome, new.autor_papel
  from public.perfis p where p.id = new.autor_id;
  new.autor_nome := coalesce(new.autor_nome, '');
  return new;
end;
$$;

create trigger carimbar_autor
  before insert on public.perguntas
  for each row execute function public.carimbar_autor();

-- Quem fez a pergunta é avisado quando alguém responde.
create or replace function public.ao_responder_pergunta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dono uuid;
  v_curso uuid;
begin
  if new.responde_a is null then
    return new;
  end if;
  select autor_id into v_dono from public.perguntas where id = new.responde_a;
  select curso_id into v_curso from public.aulas where id = new.aula_id;
  if v_dono is not null and v_dono <> new.autor_id then
    insert into public.notificacoes (user_id, tipo, titulo, corpo, link)
    values (
      v_dono, 'resposta', new.autor_nome || ' respondeu à tua pergunta',
      left(new.texto, 140), '/curso/' || v_curso || '?aula=' || new.aula_id
    );
  end if;
  return new;
end;
$$;

create trigger ao_responder_pergunta
  after insert on public.perguntas
  for each row execute function public.ao_responder_pergunta();

-- ─── Comunidade: grupos e mensagens ────────────────────────────────────────

create table public.grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  icone text,
  visibilidade public.visibilidade not null default 'academia',
  so_admins_escrevem boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.grupos enable row level security;

create policy grupos_ver on public.grupos
  for select to authenticated using (public.pode_ver(visibilidade));
create policy grupos_admin on public.grupos
  for all to authenticated
  using ((select public.e_admin())) with check ((select public.e_admin()));

create or replace function public.pode_ver_grupo(p_grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.grupos g
    where g.id = p_grupo and public.pode_ver(g.visibilidade)
  );
$$;

create or replace function public.pode_escrever_grupo(p_grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.grupos g
    where g.id = p_grupo
      and public.pode_ver(g.visibilidade)
      and (not g.so_admins_escrevem or public.e_admin())
  );
$$;

revoke execute on function public.pode_ver_grupo(uuid) from public, anon;
revoke execute on function public.pode_escrever_grupo(uuid) from public, anon;
grant execute on function public.pode_ver_grupo(uuid) to authenticated;
grant execute on function public.pode_escrever_grupo(uuid) to authenticated;

create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  autor_id uuid default auth.uid() references public.perfis (id) on delete set null,
  autor_nome text not null default '',
  autor_papel public.papel,
  texto text not null default '',
  responde_a uuid references public.mensagens (id) on delete set null,
  ficheiro_path text,
  ficheiro_nome text,
  ficheiro_tipo text,
  tamanho bigint,
  duracao integer,
  created_at timestamptz not null default now(),
  constraint mensagens_tem_conteudo check (length(trim(texto)) > 0 or ficheiro_path is not null)
);

create index mensagens_grupo_idx on public.mensagens (grupo_id, created_at desc);
create index mensagens_autor_idx on public.mensagens (autor_id);
create index mensagens_responde_idx on public.mensagens (responde_a);

alter table public.mensagens enable row level security;

create policy mensagens_ver on public.mensagens
  for select to authenticated using (public.pode_ver_grupo(grupo_id));
create policy mensagens_inserir on public.mensagens
  for insert to authenticated
  with check (autor_id = (select auth.uid()) and public.pode_escrever_grupo(grupo_id));
create policy mensagens_apagar on public.mensagens
  for delete to authenticated
  using (autor_id = (select auth.uid()) or (select public.e_admin()));

create trigger carimbar_autor
  before insert on public.mensagens
  for each row execute function public.carimbar_autor();

-- Última leitura de cada pessoa em cada grupo (para "mensagens por ler").
create table public.leituras (
  user_id uuid not null default auth.uid() references public.perfis (id) on delete cascade,
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  lida_em timestamptz not null default now(),
  primary key (user_id, grupo_id)
);

create index leituras_grupo_idx on public.leituras (grupo_id);

alter table public.leituras enable row level security;

create policy leituras_proprias on public.leituras
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.pode_ver_grupo(grupo_id));

-- Resumo dos grupos visíveis: por ler, última mensagem (corre com as permissões de quem chama).
create or replace function public.resumo_grupos()
returns table (grupo_id uuid, por_ler bigint, ultima_em timestamptz, ultima_texto text, ultima_autor text)
language sql
stable
set search_path = ''
as $$
  select
    g.id,
    (
      select count(*) from public.mensagens m
      where m.grupo_id = g.id
        and m.autor_id is distinct from (select auth.uid())
        and m.created_at > coalesce(
          (select l.lida_em from public.leituras l where l.grupo_id = g.id and l.user_id = (select auth.uid())),
          '-infinity'::timestamptz
        )
    ),
    u.created_at,
    case
      when u.id is null then null
      when length(trim(u.texto)) > 0 then u.texto
      when u.ficheiro_tipo like 'audio/%' then '🎤 Mensagem de voz'
      when u.ficheiro_tipo like 'image/%' then '📷 Imagem'
      when u.ficheiro_tipo like 'video/%' then '🎬 Vídeo'
      else '📎 ' || coalesce(u.ficheiro_nome, 'Ficheiro')
    end,
    u.autor_nome
  from public.grupos g
  left join lateral (
    select m.id, m.texto, m.ficheiro_tipo, m.ficheiro_nome, m.autor_nome, m.created_at
    from public.mensagens m
    where m.grupo_id = g.id
    order by m.created_at desc
    limit 1
  ) u on true;
$$;

revoke execute on function public.resumo_grupos() from public, anon;
grant execute on function public.resumo_grupos() to authenticated;
