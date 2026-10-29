-- Funções de gatilho não precisam de ser chamadas pela API (os gatilhos correm sem verificar EXECUTE).
revoke execute on function public.ao_criar_utilizador() from public, anon, authenticated;
revoke execute on function public.ao_decidir_pedido() from public, anon, authenticated;
revoke execute on function public.ao_responder_pergunta() from public, anon, authenticated;
revoke execute on function public.carimbar_autor() from public, anon, authenticated;
revoke execute on function public.proteger_perfil() from public, anon, authenticated;
