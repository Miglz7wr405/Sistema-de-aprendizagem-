// Sessão única por conta: a mesma pessoa só pode estar aberta num sítio.
// - Ao entrar, a app regista a sessão no servidor e guarda o id localmente.
// - De 30 em 30s pergunta ao servidor se o id local ainda é o válido.
// - Quando outra sessão toma conta, esta é expulsa com `signOut()`.
import { supabase, chamarFuncao } from "./supabase";

const CHAVE_LOCAL = "insight-academia-sessao";
const INTERVALO = 30 * 1000;

type RegistoResposta = { ok: true; sessao_id: string };
type VerificacaoResposta = {
  ativa: boolean;
  erro?: boolean;
  usado?: number;
  limite?: number | null;
};
export type UsoDiario = { usado: number; limite: number | null };

let registoEmCurso: Promise<string | null> | null = null;

/**
 * Chamado logo depois de o utilizador entrar. Invalida qualquer sessão anterior.
 * Pedidos em simultâneo partilham o mesmo registo — dois registos em paralelo deixavam
 * o id local diferente do do servidor, e a pessoa era expulsa segundos depois de entrar.
 */
export function registarSessaoAtual(): Promise<string | null> {
  if (!registoEmCurso) {
    registoEmCurso = registar().finally(() => {
      registoEmCurso = null;
    });
  }
  return registoEmCurso;
}

async function registar(): Promise<string | null> {
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
export function iniciarHeartbeat(
  onExpulso: () => void,
  onUso?: (uso: UsoDiario) => void,
): () => void {
  let parado = false;

  async function tick() {
    if (parado) return;
    if (registoEmCurso) await registoEmCurso;
    const sessaoId = lerSessaoLocal();
    const sessao = (await supabase.auth.getSession()).data.session;
    if (!sessao || !sessaoId) return;
    try {
      const r = await chamarFuncao<VerificacaoResposta>("verificar-sessao", {
        sessao_id: sessaoId,
        visivel: document.visibilityState === "visible",
      });
      if (!parado && r.ativa && typeof r.usado === "number") {
        onUso?.({ usado: r.usado, limite: r.limite ?? null });
      }
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
