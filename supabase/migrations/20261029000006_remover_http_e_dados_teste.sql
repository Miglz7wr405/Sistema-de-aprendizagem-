-- Limpeza depois dos testes: dados de teste e a extensão http temporária.
delete from public.mensagens
where autor_id in (select id from public.perfis where email like 'teste.%@exemplo.mz');
delete from public.seccoes where titulo in ('TESTE pública', 'hack');
delete from auth.users where email like 'teste.%@exemplo.mz';
drop extension if exists http;
