// Sessão única por conta: a mesma pessoa só pode estar aberta num sítio.
// - Ao entrar, a app regista a sessão no servidor e guarda o id localmente.
// - De 30 em 30s pergunta ao servidor se o id local ainda é o válido.
// - Quando outra sessão toma conta, esta é expulsa com `signOut()`.
import { supabase, chamarFuncao } from "./supabase";

const CHAVE_LOCAL = "insight-academia-sessao";
const INTERVALO = 30 * 1000;

type RegistoResposta = { ok: true; sessao_id: string };
type VerificacaoResposta = { ativa: boolean; erro?: boolean };

/** Chamado logo depois de o utilizador entrar. Invalida qualquer sessão anterior. */
export async function registarSessaoAtual(): Promise<string | null> {
  try {
    const r = await chamarFuncao<RegistoResposta>("registar-sessao", {});
    if (r?.sessao_id) {
      localStorage.setItem(CHAVE_LOCAL, r.sessao_id);
      return r.sessao_id;
    }
  } catch (e) {
    console.warn("registar-sessao", e);
  }
  return null;
}

export function lerSessaoLocal(): string | null {
  try {
    return localStorage.getItem(CHAVE_LOCAL);
  } catch {
    return null;
  }
}

export function limparSessaoLocal() {
  try {
    localStorage.removeItem(CHAVE_LOCAL);
  } catch {
    /* ignora */
  }
}

/**
 * Inicia o heartbeat: a cada 30s pergunta ao servidor se esta sessão ainda é a válida.
 * Devolve uma função para parar. `onExpulso` é chamado quando outro dispositivo tomou conta.
 */
export function iniciarHeartbeat(onExpulso: () => void): () => void {
  let parado = false;

  async function tick() {
    if (parado) return;
    const sessaoId = lerSessaoLocal();
    const sessao = (await supabase.auth.getSession()).data.session;
    if (!sessao || !sessaoId) return;
    try {
      const r = await chamarFuncao<VerificacaoResposta>("verificar-sessao", {
        sessao_id: sessaoId,
      });
      if (!parado && !r.ativa && !r.erro) {
        parado = true;
        onExpulso();
      }
    } catch (e) {
      // Erro de rede não expulsa ninguém.
      console.warn("verificar-sessao", e);
    }
  }

  // Primeira verificação pouco depois do arranque (dá tempo ao registo).
  const timeoutInicial = setTimeout(tick, 5000);
  const intervalo = setInterval(tick, INTERVALO);
  return () => {
    parado = true;
    clearTimeout(timeoutInicial);
    clearInterval(intervalo);
  };
}
