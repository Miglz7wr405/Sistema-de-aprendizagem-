-- 1) Acesso de teste de 5 minutos (uma vez por IP e por email).
-- 2) Limite diário de tempo por plano (Bronze 1 h, Prata 2 h, Ouro 4 h, Diamante sem limite).
-- 3) Ranking (ranking_v2) mostra a última aula vista e ignora contas de teste.

-- ── contas de teste (sem apagar nada: coluna nova; usam o plano 'semana' com 5 min de validade) ──
alter table public.perfis add column if not exists teste boolean not null default false;

-- Registo de quem já usou o teste (o IP fica guardado só como hash).
create table if not exists public.acessos_teste (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null unique,
  email text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now()
);
alter table public.acessos_teste enable row level security; -- só a chave de serviço mexe

-- ── uso diário ──
create table if not exists public.uso_diario (
  user_id uuid not null references public.perfis (id) on delete cascade,
  dia date not null,
  segundos integer not null default 0,
  primary key (user_id, dia)
);
alter table public.uso_diario enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'uso_diario' and policyname = 'uso_diario_ver_o_meu') then
    create policy "uso_diario_ver_o_meu" on public.uso_diario
      for select to authenticated using (user_id = (select auth.uid()));
  end if;
end $$;

-- Dia corrente no fuso de Maputo (o limite volta a zero à meia-noite de lá).
create or replace function public.hoje()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Africa/Maputo')::date;
$$;

-- Segundos por dia de cada plano; null = sem limite.
create or replace function public.limite_diario_segundos(p_plano text)
returns integer language sql immutable set search_path = '' as $$
  select case p_plano
    when 'semana' then 3600   -- Bronze: 1 h
    when 'mes'    then 7200   -- Prata: 2 h
    when 'ano'    then 14400  -- Ouro: 4 h
    else null                 -- Diamante (legacy): sem limite diário
  end;
$$;

-- Soma tempo ao dia de hoje (chamado pela Edge Function do batimento).
create or replace function public.somar_uso(p_user uuid, p_segundos integer)
returns integer language sql volatile security definer set search_path = '' as $$
  insert into public.uso_diario as u (user_id, dia, segundos)
  values (p_user, public.hoje(), greatest(0, least(p_segundos, 90)))
  on conflict (user_id, dia) do update set segundos = u.segundos + excluded.segundos
  returning segundos;
$$;
revoke execute on function public.somar_uso(uuid, integer) from public, anon, authenticated;

-- Aprovado = estado aprovado, dentro da validade e (para alunos) abaixo do limite diário.
create or replace function public.e_aprovado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis p
    where p.id = (select auth.uid())
      and p.estado = 'aprovado'
      and (
        p.papel in ('admin', 'equipa')
        or (
          (p.plano = 'legacy' or p.acesso_expira_em is null or p.acesso_expira_em > now())
          and (
            public.limite_diario_segundos(p.plano) is null
            or coalesce(
                 (select u.segundos from public.uso_diario u where u.user_id = p.id and u.dia = public.hoje()),
                 0
               ) < public.limite_diario_segundos(p.plano)
          )
        )
      )
  );
$$;

-- Novos utilizadores: contas de teste (marca só possível pela chave de serviço, em app_metadata)
-- entram logo aprovadas por 5 minutos e não notificam os admins.
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
  v_teste boolean := coalesce((new.raw_app_meta_data ->> 'teste')::boolean, false);
  v_nome text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome_completo'), ''), split_part(v_email, '@', 1));
begin
  if v_teste and not v_fundador then
    insert into public.perfis (id, nome_completo, email, papel, estado, plano, teste, acesso_expira_em, aprovado_em)
    values (new.id, v_nome, v_email, 'aluno', 'aprovado', 'semana', true, now() + interval '5 minutes', now());
    return new;
  end if;

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

-- ── ranking v2: última aula vista; sem contas de teste (a função antiga fica intacta) ──
create or replace function public.ranking_v2(p_periodo text default 'geral')
returns table (
  user_id uuid,
  nome text,
  avatar_url text,
  papel public.papel,
  total bigint,
  concluidas bigint,
  posicao bigint,
  ultima_aula text,
  ultimo_curso text,
  ultima_vista timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with filtrado as (
    select p.* from public.progresso p
    where (
      p_periodo = 'geral'
      or (p_periodo = 'semana' and p.vista_em >= now() - interval '7 days')
      or (p_periodo = 'mes' and p.vista_em >= now() - interval '30 days')
    )
  ),
  base as (
    select f.user_id,
           count(*) as total,
           count(*) filter (where f.concluida) as concluidas
    from filtrado f
    group by f.user_id
  ),
  ultima as (
    select distinct on (f.user_id) f.user_id, a.titulo as aula, c.titulo as curso, f.vista_em
    from filtrado f
    join public.aulas a on a.id = f.aula_id
    join public.cursos c on c.id = a.curso_id
    order by f.user_id, f.vista_em desc
  )
  select
    b.user_id,
    pf.nome_completo,
    pf.avatar_url,
    pf.papel,
    b.total,
    b.concluidas,
    row_number() over (order by b.concluidas desc, b.total desc) as posicao,
    u.aula,
    u.curso,
    u.vista_em
  from base b
  join public.perfis pf on pf.id = b.user_id
  left join ultima u on u.user_id = b.user_id
  where pf.estado = 'aprovado'
    and not pf.teste
    and public.e_aprovado()
  order by posicao
  limit 100;
$$;

revoke execute on function public.ranking_v2(text) from public, anon;
grant execute on function public.ranking_v2(text) to authenticated;
