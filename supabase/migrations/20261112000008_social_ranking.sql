-- Insight Academia — social: quem viu cada aula (visível a todos os aprovados)
-- e ranking de quem assistiu a mais vídeos (semana / mês / geral).

-- Quem já viu/concluiu uma aula. Qualquer membro aprovado vê, desde que possa ver a aula.
create or replace function public.quem_viu_aula(p_aula uuid)
returns table (
  user_id uuid,
  nome text,
  avatar_url text,
  papel public.papel,
  concluida boolean,
  vista_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.user_id, pf.nome_completo, pf.avatar_url, pf.papel, p.concluida, p.vista_em
  from public.progresso p
  join public.perfis pf on pf.id = p.user_id
  where p.aula_id = p_aula
    and pf.estado = 'aprovado'
    and public.e_aprovado()
    and public.pode_ver_aula(p_aula)
  order by p.concluida desc, p.vista_em desc;
$$;

revoke execute on function public.quem_viu_aula(uuid) from public, anon;
grant execute on function public.quem_viu_aula(uuid) to authenticated;

-- Ranking: quantos vídeos cada pessoa assistiu num período. `total` conta aulas vistas;
-- `concluidas` conta as que marcou como concluídas (desempate).
create or replace function public.ranking(p_periodo text default 'geral')
returns table (
  user_id uuid,
  nome text,
  avatar_url text,
  papel public.papel,
  total bigint,
  concluidas bigint,
  posicao bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select p.user_id,
           count(*) as total,
           count(*) filter (where p.concluida) as concluidas
    from public.progresso p
    where (
      p_periodo = 'geral'
      or (p_periodo = 'semana' and p.vista_em >= now() - interval '7 days')
      or (p_periodo = 'mes' and p.vista_em >= now() - interval '30 days')
    )
    group by p.user_id
  )
  select
    b.user_id,
    pf.nome_completo,
    pf.avatar_url,
    pf.papel,
    b.total,
    b.concluidas,
    row_number() over (order by b.total desc, b.concluidas desc) as posicao
  from base b
  join public.perfis pf on pf.id = b.user_id
  where pf.estado = 'aprovado'
    and public.e_aprovado()
  order by posicao
  limit 100;
$$;

revoke execute on function public.ranking(text) from public, anon;
grant execute on function public.ranking(text) to authenticated;
