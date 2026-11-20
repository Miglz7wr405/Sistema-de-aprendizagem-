-- Avisos por captura/gravação de ecrã: 3 avisos → conta bloqueada (estado 'bloqueado').
-- Admins e equipa ficam registados mas nunca são bloqueados.
create table if not exists public.avisos_gravacao (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.perfis(id) on delete cascade,
  motivo text not null,
  pagina text,
  criado_em timestamptz not null default now()
);
create index if not exists avisos_gravacao_user_idx on public.avisos_gravacao (user_id, criado_em desc);
alter table public.avisos_gravacao enable row level security;

create policy "avisos: o próprio ou a equipa leem"
  on public.avisos_gravacao for select to authenticated
  using (user_id = (select auth.uid()) or public.e_equipa());

-- Regista um aviso para quem chama e devolve { avisos, bloqueado }.
create or replace function public.registar_aviso_gravacao(p_motivo text, p_pagina text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_papel text;
  v_total int;
  v_bloq boolean := false;
begin
  if v_uid is null then
    raise exception 'sem sessão';
  end if;
  select papel into v_papel from public.perfis where id = v_uid;

  -- No máximo 1 aviso por minuto (a mesma captura dispara vários eventos).
  if exists (
    select 1 from public.avisos_gravacao
    where user_id = v_uid and criado_em > now() - interval '1 minute'
  ) then
    select count(*) into v_total from public.avisos_gravacao where user_id = v_uid;
    return jsonb_build_object('avisos', v_total, 'bloqueado', false, 'repetido', true);
  end if;

  insert into public.avisos_gravacao (user_id, motivo, pagina)
  values (v_uid, left(coalesce(p_motivo, '?'), 60), left(p_pagina, 200));
  select count(*) into v_total from public.avisos_gravacao where user_id = v_uid;

  if v_total >= 3 and coalesce(v_papel, 'aluno') not in ('admin', 'equipa') then
    update public.perfis set estado = 'bloqueado' where id = v_uid;
    v_bloq := true;
  end if;
  return jsonb_build_object('avisos', v_total, 'bloqueado', v_bloq, 'repetido', false);
end;
$$;
revoke execute on function public.registar_aviso_gravacao(text, text) from public, anon;
grant execute on function public.registar_aviso_gravacao(text, text) to authenticated;
