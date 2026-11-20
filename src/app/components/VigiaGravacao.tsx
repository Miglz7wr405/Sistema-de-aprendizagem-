// Vigia de captura/gravação de ecrã.
// Um site não consegue ver todas as gravações (OBS, telemóvel apontado ao ecrã…), mas apanha
// os atalhos de captura do sistema: Print Screen, Win+Shift+S, Win+Alt+R (Xbox Game Bar),
// Cmd+Shift+3/4/5 (Mac). Cada deteção = 1 aviso no servidor; ao 3.º a conta é bloqueada.
import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "../auth";
import { Button } from "./primitives";

type Resposta = { avisos: number; bloqueado: boolean; repetido: boolean };

const MAX_AVISOS = 3;

function motivoDaTecla(e: KeyboardEvent): string | null {
  const k = e.key?.toLowerCase();
  if (e.key === "PrintScreen" || e.code === "PrintScreen") return "print_screen";
  if (e.metaKey && e.shiftKey && k === "s") return "win_shift_s";
  if (e.metaKey && e.altKey && (k === "r" || k === "®")) return "game_bar";
  if (e.metaKey && e.shiftKey && ["3", "4", "5", "#", "$", "%"].includes(k)) return "mac_captura";
  return null;
}

export function VigiaGravacao() {
  const { perfil, recarregarPerfil } = useAuth();
  const [aviso, setAviso] = useState<Resposta | null>(null);
  const [tapar, setTapar] = useState(false);
  const emCurso = useRef(false);
  const staff = perfil?.papel === "admin" || perfil?.papel === "equipa";

  const detetar = useCallback(async (motivo: string) => {
    // Tapa o ecrã logo, para a captura sair preta.
    setTapar(true);
    window.setTimeout(() => setTapar(false), 2500);
    try {
      navigator.clipboard?.writeText(" ").catch(() => {});
    } catch {
      /* ignora */
    }
    if (emCurso.current) return;
    emCurso.current = true;
    try {
      const { data, error } = await supabase.rpc("registar_aviso_gravacao", {
        p_motivo: motivo,
        p_pagina: window.location.pathname,
      });
      if (!error && data) {
        const r = data as Resposta;
        if (!r.repetido) setAviso(r);
      }
    } finally {
      emCurso.current = false;
    }
  }, []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const motivo = motivoDaTecla(e);
      if (motivo) {
        e.preventDefault();
        void detetar(motivo);
      }
    };
    window.addEventListener("keydown", aoTeclar, true);
    // No Windows o Print Screen muitas vezes só chega no "keyup".
    window.addEventListener("keyup", aoTeclar, true);
    return () => {
      window.removeEventListener("keydown", aoTeclar, true);
      window.removeEventListener("keyup", aoTeclar, true);
    };
  }, [detetar]);

  const fechar = async () => {
    const bloqueado = aviso?.bloqueado;
    setAviso(null);
    if (bloqueado) await recarregarPerfil();
  };

  return (
    <>
      {tapar && <div aria-hidden="true" className="fixed inset-0 z-[300] bg-black" />}
      {aviso && (
        <div className="fixed inset-0 z-[310] grid place-items-center bg-black/70 p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl"
          >
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-red-50 text-red-600">
              <ShieldAlert className="size-6" />
            </span>
            {aviso.bloqueado ? (
              <>
                <h2 className="mt-3 font-display text-lg font-bold text-text-hi">
                  Conta bloqueada
                </h2>
                <p className="mt-2 text-sm text-text-mid">
                  Foram detetadas {aviso.avisos} tentativas de capturar ou gravar o ecrã. O teu
                  acesso foi suspenso. Fala com a Insight pelo WhatsApp.
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-3 font-display text-lg font-bold text-text-hi">
                  Aviso {Math.min(aviso.avisos, MAX_AVISOS)} de {MAX_AVISOS}
                </h2>
                <p className="mt-2 text-sm text-text-mid">
                  É proibido capturar ou gravar o ecrã das aulas. Detetámos uma tentativa.
                  {staff
                    ? " (Contas da equipa não são bloqueadas — isto é só um teste.)"
                    : aviso.avisos >= MAX_AVISOS - 1
                      ? " Na próxima vez a tua conta é bloqueada."
                      : ` Ao ${MAX_AVISOS}.º aviso a tua conta é bloqueada.`}
                </p>
              </>
            )}
            <Button className="mt-5 w-full" onClick={fechar}>
              Entendi
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
