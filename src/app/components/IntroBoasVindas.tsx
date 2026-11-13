import { useEffect, useRef, useState } from "react";

import { primeiroNome } from "@/lib/utils";
import { LogoMark } from "./Logo";

/*
 * Intro leve: só CSS com transform/opacity/clip-path (GPU), sem canvas.
 * Falhas curtas com separação azul/vermelha nos cortes entre cenas.
 */

type Cena = { chave: string; dur: number; el: React.ReactNode };

function Falha({ texto, className }: { texto: string; className?: string }) {
  return (
    <span className={`intro-falha ${className ?? ""}`} data-text={texto}>
      {texto}
    </span>
  );
}

/** Pequeno estalido de estática no corte (só toca se o navegador já permitir som). */
function estalido() {
  try {
    const AC = window.AudioContext;
    if (!AC) return;
    const ac = (estalido as { ac?: AudioContext }).ac ?? new AC();
    (estalido as { ac?: AudioContext }).ac = ac;
    if (ac.state !== "running") return;
    const n = ac.sampleRate * 0.08;
    const buf = ac.createBuffer(1, n, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource();
    const g = ac.createGain();
    g.gain.value = 0.18;
    s.buffer = buf;
    s.connect(g).connect(ac.destination);
    s.start();
  } catch {
    /* sem som, sem problema */
  }
}

export function IntroBoasVindas({
  nome,
  soSaudacao = false,
  onFim,
}: {
  nome?: string | null;
  soSaudacao?: boolean;
  onFim: () => void;
}) {
  const primeiro = nome ? primeiroNome(nome) : "";
  const cenas: Cena[] = [
    ...(soSaudacao
      ? []
      : [
          { chave: "bv", dur: 1300, el: <Falha texto="Bem-vindo" className="intro-grande" /> },
          {
            chave: "logo",
            dur: 1500,
            el: (
              <div className="flex flex-col items-center gap-3">
                <LogoMark className="intro-logo size-14 text-accent" />
                <Falha texto="insight" className="intro-grande" />
                <span className="intro-pequeno">Academia</span>
              </div>
            ),
          },
        ]),
    ...(primeiro
      ? [
          {
            chave: "nome",
            dur: 1500,
            el: (
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="intro-pequeno">Seja bem-vindo,</span>
                <Falha texto={primeiro} className="intro-grande text-accent" />
              </div>
            ),
          },
        ]
      : []),
  ];

  const [i, setI] = useState(0);
  const [saindo, setSaindo] = useState(false);
  const fimRef = useRef(onFim);
  fimRef.current = onFim;

  useEffect(() => {
    if (i >= cenas.length) {
      setSaindo(true);
      const t = setTimeout(() => fimRef.current(), 380);
      return () => clearTimeout(t);
    }
    estalido();
    const t = setTimeout(() => setI((x) => x + 1), cenas[i].dur);
    return () => clearTimeout(t);
  }, [i, cenas.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const desbloquear = () => (estalido as { ac?: AudioContext }).ac?.resume().catch(() => {});
    window.addEventListener("pointerdown", desbloquear, { once: true });
    return () => window.removeEventListener("pointerdown", desbloquear);
  }, []);

  const cena = cenas[Math.min(i, cenas.length - 1)];

  return (
    <div className={`intro-leve fixed inset-0 z-[100] grid place-items-center ${saindo ? "intro-sai" : ""}`}>
      <div className="intro-linhas" aria-hidden="true" />
      <div key={cena?.chave} className="intro-cena relative">
        {cena?.el}
      </div>
      <button
        type="button"
        className="absolute bottom-6 right-6 rounded-full px-3 py-1 text-xs font-medium text-text-low"
        onClick={() => setI(cenas.length)}
      >
        Saltar
      </button>
    </div>
  );
}
