-- Planos de acesso: cada membro tem um plano (selo) e, se não for legacy, uma data de expiração.
-- semana→Bronze, mes→Prata, ano→Ouro, legacy→Diamante (permanente).

alter table public.perfis
  add column if not exists plano text not null default 'legacy'
    check (plano in ('semana', 'mes', 'ano', 'legacy'));
alter table public.perfis
  add column if not exists acesso_expira_em timestamptz;

-- O acesso de alunos expira automaticamente (admins/equipa e legacy nunca expiram).
create or replace function public.e_aprovado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid())
      and estado = 'aprovado'
      and (
        papel in ('admin', 'equipa')
        or plano = 'legacy'
        or acesso_expira_em is null
        or acesso_expira_em > now()
      )
  );
$$;

-- Não-admin não pode mexer no seu plano nem na validade.
create or replace function public.proteger_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.e_admin() then
    new.papel := old.papel;
    new.estado := old.estado;
    new.email := old.email;
    new.aprovado_por := old.aprovado_por;
    new.aprovado_em := old.aprovado_em;
    new.plano := old.plano;
    new.acesso_expira_em := old.acesso_expira_em;
  elsif new.estado = 'aprovado' and old.estado is distinct from 'aprovado' then
    new.aprovado_por := (select auth.uid());
    new.aprovado_em := now();
  end if;
  return new;
end;
$$;

-- Plano (selo) de cada membro aprovado — para mostrar os selos no ranking e no "quem viu".
create or replace function public.planos_membros()
returns table (user_id uuid, plano text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.plano
  from public.perfis p
  where p.estado = 'aprovado' and public.e_aprovado();
$$;

revoke execute on function public.planos_membros() from public, anon;
grant execute on function public.planos_membros() to authenticated;
