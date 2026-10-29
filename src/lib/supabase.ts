import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigurado = Boolean(url && chave);

export const supabase = createClient(url ?? "http://localhost", chave ?? "sem-chave", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "insight-academia-auth",
  },
});

/** Chama uma Edge Function e devolve o JSON, com a mensagem de erro do servidor quando falha. */
export async function chamarFuncao<T = Record<string, unknown>>(
  nome: string,
  corpo: Record<string, unknown> | FormData,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(nome, { body: corpo });
  if (error) {
    let mensagem = "Não foi possível falar com o servidor.";
    const resposta = (error as { context?: Response }).context;
    if (resposta && typeof resposta.json === "function") {
      try {
        const j = await resposta.json();
        if (j?.erro) mensagem = j.erro;
      } catch {
        /* sem corpo JSON */
      }
    }
    throw new Error(mensagem);
  }
  return data as T;
}
