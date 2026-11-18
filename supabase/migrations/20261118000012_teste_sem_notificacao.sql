-- O app_metadata de createUser só é gravado depois do INSERT, por isso o gatilho não o vê:
-- a Edge Function acesso-teste aprova a conta de teste logo a seguir. Aqui o gatilho só
-- deixa de avisar os admins quando a conta vem do teste (user_metadata.origem = 'teste').
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
  v_origem_teste boolean := coalesce(new.raw_user_meta_data ->> 'origem', '') = 'teste';
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

  if not v_fundador and not v_origem_teste then
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
