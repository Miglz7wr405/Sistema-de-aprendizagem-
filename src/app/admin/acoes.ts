import { chamarFuncao } from "@/lib/supabase";

/** Avisa a pessoa por email (se o Gmail estiver configurado nas Edge Functions). Não bloqueia. */
export function avisarDecisao(userId: string) {
  chamarFuncao("admin-utilizadores", { acao: "avisar_decisao", user_id: userId }).catch(
    () => undefined,
  );
}

export async function reporPalavraPasse(userId: string, nova: string) {
  await chamarFuncao("admin-utilizadores", { acao: "repor_palavra_passe", user_id: userId, nova });
}

export async function apagarConta(userId: string) {
  await chamarFuncao("admin-utilizadores", { acao: "apagar", user_id: userId });
}

export function gerarPalavraPasse() {
  const letras = "abcdefghjkmnpqrstuvwxyz";
  const numeros = "23456789";
  const r = (s: string) => s[Math.floor(Math.random() * s.length)];
  return `${r(letras).toUpperCase()}${r(letras)}${r(letras)}${r(letras)}-${r(numeros)}${r(numeros)}${r(numeros)}${r(numeros)}`;
}

/** Link de WhatsApp para o número da pessoa (formato de Moçambique por defeito). */
export function linkWhatsApp(telefone: string | null, mensagem?: string) {
  if (!telefone) return null;
  let n = telefone.replace(/\D/g, "");
  if (n.length === 9 && n.startsWith("8")) n = `258${n}`;
  if (n.length < 8) return null;
  return `https://wa.me/${n}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ""}`;
}
