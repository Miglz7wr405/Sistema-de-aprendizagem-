-- Ranking ordenado por aulas concluídas (ver sem acabar não conta à frente);
-- empate desfeito por vídeos vistos.
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
    row_number() over (order by b.concluidas desc, b.total desc) as posicao
  from base b
  join public.perfis pf on pf.id = b.user_id
  where pf.estado = 'aprovado'
    and public.e_aprovado()
  order by posicao
  limit 100;
$$;

revoke execute on function public.ranking(text) from public, anon;
grant execute on function public.ranking(text) to authenticated;
