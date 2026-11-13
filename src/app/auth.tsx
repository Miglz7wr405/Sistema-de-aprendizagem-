import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { Perfis } from "@/lib/db";
import { iniciarHeartbeat, limparSessaoLocal, registarSessaoAtual } from "@/lib/sessao";
import type { Perfil } from "@/lib/types";

type AuthCtx = {
  sessao: Session | null;
  perfil: Perfil | null;
  carregando: boolean;
  eAdmin: boolean;
  eEquipa: boolean;
  acessoExpirado: boolean;
  entrar: (email: string, palavraPasse: string) => Promise<string | null>;
  sair: () => Promise<void>;
  recarregarPerfil: () => Promise<void>;
};

/** O acesso de um aluno com plano temporário já passou da validade? */
function expirou(perfil: Perfil | null): boolean {
  return Boolean(
    perfil &&
    perfil.estado === "aprovado" &&
    perfil.papel === "aluno" &&
    perfil.plano !== "legacy" &&
    perfil.acesso_expira_em &&
    new Date(perfil.acesso_expira_em).getTime() < Date.now(),
  );
}

const Ctx = createContext<AuthCtx | null>(null);

function traduzirErro(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "Email ou palavra-passe errados.";
  if (/email not confirmed/i.test(msg)) return "Este email ainda não foi confirmado.";
  if (/rate limit|too many/i.test(msg))
    return "Muitas tentativas. Espera um pouco e tenta outra vez.";
  if (/failed to fetch|network/i.test(msg)) return "Sem ligação à internet.";
  return msg;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregarPerfil = useCallback(async (s: Session | null) => {
    if (!s) {
      setPerfil(null);
      return;
    }
    try {
      setPerfil(await Perfis.meu(s.user.id));
    } catch {
      setPerfil(null);
    }
  }, []);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return;
      setSessao(data.session);
      await carregarPerfil(data.session);
      if (ativo) setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s);
      if (evento === "SIGNED_IN" || evento === "SIGNED_OUT" || evento === "USER_UPDATED") {
        // Fora do callback para não bloquear o cliente do Supabase.
        setTimeout(() => carregarPerfil(s), 0);
      }
      if (evento === "SIGNED_IN") {
        // Toma conta desta sessão — qualquer outra ligação com a mesma conta é expulsa.
        setTimeout(() => registarSessaoAtual(), 0);
      }
      if (evento === "SIGNED_OUT") limparSessaoLocal();
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, [carregarPerfil]);

  // Sessão única: de 30 em 30s confirma que ninguém entrou noutro sítio com a mesma conta.
  useEffect(() => {
    if (!sessao) return;
    // Primeiro arranque pós-reload: se ainda não há id local, regista agora.
    (async () => {
      const temLocal = (() => {
        try {
          return Boolean(localStorage.getItem("insight-academia-sessao"));
        } catch {
          return false;
        }
      })();
      if (!temLocal) await registarSessaoAtual();
    })();
    const parar = iniciarHeartbeat(async () => {
      toast.error("A tua conta foi aberta noutro dispositivo. Vais ter de entrar outra vez.", {
        duration: 8000,
      });
      limparSessaoLocal();
      await supabase.auth.signOut();
    });
    return parar;
  }, [sessao]);

  // Se o admin aprovar/bloquear enquanto a pessoa está na app, o estado muda sozinho.
  useEffect(() => {
    if (!sessao) return;
    const canal = supabase
      .channel(`perfil-${sessao.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${sessao.user.id}`,
        },
        (p) => {
          if ((p.new as { tipo?: string }).tipo === "acesso_aprovado") carregarPerfil(sessao);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [sessao, carregarPerfil]);

  const entrar = useCallback(async (email: string, palavraPasse: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: palavraPasse,
    });
    return error ? traduzirErro(error.message) : null;
  }, []);

  const sair = useCallback(async () => {
    await supabase.auth.signOut();
    setPerfil(null);
  }, []);

  const recarregarPerfil = useCallback(() => carregarPerfil(sessao), [carregarPerfil, sessao]);

  const aprovado = perfil?.estado === "aprovado";
  const valor: AuthCtx = {
    sessao,
    perfil,
    carregando,
    eAdmin: aprovado && perfil?.papel === "admin",
    eEquipa: aprovado && (perfil?.papel === "admin" || perfil?.papel === "equipa"),
    acessoExpirado: expirou(perfil),
    entrar,
    sair,
    recarregarPerfil,
  };

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth fora do AuthProvider");
  return c;
}
