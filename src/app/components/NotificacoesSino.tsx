import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, UserPlus, MessageCircle, PartyPopper } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { Notificacoes } from "@/lib/db";
import type { Notificacao } from "@/lib/types";
import { cn, tempoRelativo } from "@/lib/utils";
import { useAuth } from "../auth";

const ICONES: Record<string, typeof Bell> = {
  pedido_acesso: UserPlus,
  resposta: MessageCircle,
  acesso_aprovado: PartyPopper,
};

export function NotificacoesSino() {
  const { sessao } = useAuth();
  const navigate = useNavigate();
  const [lista, setLista] = useState<Notificacao[]>([]);
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const userId = sessao?.user.id;

  const carregar = useCallback(async () => {
    try {
      setLista(await Notificacoes.minhas());
    } catch {
      /* sem rede — tenta na próxima */
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    carregar();
    const canal = supabase
      .channel(`notificacoes-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${userId}`,
        },
        (p) => {
          const n = p.new as Notificacao;
          setLista((prev) => [n, ...prev.filter((x) => x.id !== n.id)].slice(0, 30));
          toast(n.titulo, { description: n.corpo ?? undefined });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [userId, carregar]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const porLer = lista.filter((n) => !n.lida).length;

  async function abrir(n: Notificacao) {
    setAberto(false);
    if (!n.lida) {
      setLista((prev) => prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      Notificacoes.marcarLida(n.id);
    }
    if (n.link) navigate(n.link);
  }

  async function lerTodas() {
    if (!userId) return;
    setLista((prev) => prev.map((x) => ({ ...x, lida: true })));
    await Notificacoes.marcarTodasLidas(userId);
  }

  return (
    <div className="relative" ref={caixa}>
      <button
        onClick={() => setAberto((v) => !v)}
        className="relative grid size-9 place-items-center rounded-lg border border-hairline text-text-mid transition hover:border-accent hover:text-accent"
        aria-label={porLer ? `Notificações (${porLer} por ler)` : "Notificações"}
      >
        <Bell className="size-[18px]" />
        {porLer > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-[18px] text-white">
            {porLer > 9 ? "9+" : porLer}
          </span>
        )}
      </button>
      {aberto && (
        <div className="absolute right-0 top-11 z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-hairline bg-bg-elevated shadow-2xl">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <p className="font-display text-sm font-semibold text-text-hi">Notificações</p>
            {porLer > 0 && (
              <button
                onClick={lerTodas}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
              >
                <CheckCheck className="size-3.5" /> Marcar todas
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {lista.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-text-low">Sem notificações.</p>
            )}
            {lista.map((n) => {
              const Icone = ICONES[n.tipo] ?? Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => abrir(n)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b border-hairline px-4 py-3 text-left last:border-0 hover:bg-accent-soft/50",
                    !n.lida && "bg-accent-soft/40",
                  )}
                >
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                    <Icone className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-text-hi">{n.titulo}</span>
                    {n.corpo && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-text-mid">
                        {n.corpo}
                      </span>
                    )}
                    <span className="mt-1 block text-[11px] text-text-low">
                      {tempoRelativo(n.created_at)}
                    </span>
                  </span>
                  {!n.lida && <span className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
