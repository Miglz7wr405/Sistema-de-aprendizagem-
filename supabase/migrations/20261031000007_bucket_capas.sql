-- Capas dos cursos num bucket público próprio: o URL fica guardado em cursos.capa_url
-- e é mostrado direto num <img>. Só admins carregam, substituem ou apagam.
-- O bucket "academia" (vídeos e anexos) mantém-se privado, servido por URL assinado.

update storage.buckets set public = false where id = 'academia';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'capas', 'capas', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy capas_enviar on storage.objects
  for insert to authenticated
  with check (bucket_id = 'capas' and (select public.e_admin()));

create policy capas_atualizar on storage.objects
  for update to authenticated
  using (bucket_id = 'capas' and (select public.e_admin()));

create policy capas_apagar on storage.objects
  for delete to authenticated
  using (bucket_id = 'capas' and (select public.e_admin()));
