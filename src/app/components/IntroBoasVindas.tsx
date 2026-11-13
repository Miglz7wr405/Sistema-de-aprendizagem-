import { useEffect, useState } from "react";

import { primeiroNome } from "@/lib/utils";
import { LogoMark } from "./Logo";

type Cena = { chave: string; dur: number; conteudo: React.ReactNode };

function Glitch({ texto, className }: { texto: string; className?: string }) {
  return (
    <span className={`glitch ${className ?? ""}`} data-text={texto}>
      {texto}
    </span>
  );
}

/**
 * Intro de entrada com efeito de falhas (glitch), em tema claro.
 * `nome` presente → termina com "Seja bem-vindo, <nome>"; `soSaudacao` → só essa cena.
 */
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
          { chave: "bv", dur: 1700, conteudo: <Glitch texto="Bem-vindo" className="intro-titulo" /> },
          {
            chave: "logo",
            dur: 1900,
            conteudo: (
              <div className="flex flex-col items-center gap-4">
                <LogoMark className="intro-logo size-16 text-accent md:size-20" />
                <Glitch texto="insight" className="intro-titulo" />
                <Glitch texto="ACADEMIA" className="intro-sub" />
              </div>
            ),
          },
        ]),
    ...(primeiro
      ? [
          {
            chave: "nome",
            dur: 1900,
            conteudo: (
              <div className="flex flex-col items-center gap-2 text-center">
                <Glitch texto="Seja bem-vindo," className="intro-sub" />
                <Glitch texto={primeiro} className="intro-titulo text-accent" />
              </div>
            ),
          },
        ]
      : []),
  ];

  const [i, setI] = useState(0);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    if (i >= cenas.length) {
      setSaindo(true);
      const t = setTimeout(onFim, 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((x) => x + 1), cenas[i].dur);
    return () => clearTimeout(t);
  }, [i, cenas.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const cena = cenas[Math.min(i, cenas.length - 1)];

  return (
    <div
      className={`intro-glitch fixed inset-0 z-[100] grid place-items-center overflow-hidden ${saindo ? "intro-saida" : ""}`}
      role="presentation"
      onClick={() => setI(cenas.length)}
    >
      <div className="intro-bandas" aria-hidden="true" />
      <div key={cena?.chave} className="intro-cena relative z-10 px-6">
        {cena?.conteudo}
      </div>
      <button
        type="button"
        className="absolute bottom-6 right-6 z-10 rounded-full px-3 py-1 text-xs font-medium text-text-low hover:text-text-mid"
        onClick={(e) => {
          e.stopPropagation();
          setI(cenas.length);
        }}
      >
        Saltar
      </button>
    </div>
  );
}
