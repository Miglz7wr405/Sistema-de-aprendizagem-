-- Ficheiros (vídeos carregados, capas, anexos do chat) e tempo real.
-- Caminhos no bucket privado "academia":
--   aulas/<uuid>.<ext>            vídeo carregado de uma aula
--   capas/<uuid>.<ext>            imagem de capa de um curso
--   chat/<grupo_id>/<uuid>-<nome> anexo ou nota de voz da comunidade

insert into storage.buckets (id, name, public, file_size_limit)
values ('academia', 'academia', false, 52428800)
on conflict (id) do nothing;

create or replace function public.pode_ler_ficheiro(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case split_part(p_nome, '/', 1)
    when 'aulas' then public.e_admin() or exists (
      select 1 from public.aulas a
      where a.storage_path = p_nome and public.pode_ver_aula(a.id)
    )
    when 'chat' then exists (
      select 1 from public.grupos g
      where g.id::text = split_part(p_nome, '/', 2) and public.pode_ver(g.visibilidade)
    )
    when 'capas' then public.e_aprovado()
    else public.e_admin()
  end;
$$;

create or replace function public.pode_enviar_ficheiro(p_nome text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case split_part(p_nome, '/', 1)
    when 'chat' then exists (
      select 1 from public.grupos g
      where g.id::text = split_part(p_nome, '/', 2)
        and public.pode_ver(g.visibilidade)
        and (not g.so_admins_escrevem or public.e_admin())
    )
    else public.e_admin()
  end;
$$;

revoke execute on function public.pode_ler_ficheiro(text) from public, anon;
revoke execute on function public.pode_enviar_ficheiro(text) from public, anon;
grant execute on function public.pode_ler_ficheiro(text) to authenticated;
grant execute on function public.pode_enviar_ficheiro(text) to authenticated;

create policy academia_ler on storage.objects
  for select to authenticated
  using (bucket_id = 'academia' and public.pode_ler_ficheiro(name));

create policy academia_enviar on storage.objects
  for insert to authenticated
  with check (bucket_id = 'academia' and public.pode_enviar_ficheiro(name));

create policy academia_apagar on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'academia'
    and (owner_id = (select auth.uid())::text or (select public.e_admin()))
  );

alter publication supabase_realtime add table public.mensagens, public.notificacoes;
