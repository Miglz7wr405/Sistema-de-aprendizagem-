import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";

import { chamarFuncao } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/**
 * Ditado por voz.
 * 1) Usa o reconhecimento do próprio navegador (Chrome/Android/Edge/Safari) — grátis e com texto ao vivo.
 * 2) Se o navegador não tiver (ou falhar, como no Brave/Opera), grava o áudio e manda para a Edge Function `transcrever` (ElevenLabs).
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

function reconhecimentoDoNavegador(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    (new () => SpeechRecognitionLike) | null;
}

/** Formato de gravação suportado (o iPhone só grava mp4). */
export function formatoDeGravacao(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const opcoes = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
  ];
  return opcoes.find((o) => MediaRecorder.isTypeSupported(o.mime)) ?? { mime: "", ext: "webm" };
}

/** Áudio → texto na Edge Function `transcrever` (ElevenLabs). */
function transcreverNoServidor(fd: FormData) {
  return chamarFuncao<{ texto?: string }>("transcrever", fd);
}

const CHAVE_SEM_DITADO = "voz-sem-ditado-navegador";

// Erros que querem dizer "este navegador não tem serviço de reconhecimento" (ex.: Brave, Opera).
const ERROS_SEM_SERVICO = new Set([
  "network",
  "service-not-allowed",
  "language-not-supported",
  "bad-grammar",
]);

/** Brave/Opera têm a API mas não o serviço da Google; e se já falhou aqui, não volta a tentar. */
function navegadorSemDitado() {
  const nav = navigator as Navigator & { brave?: unknown };
  if (nav.brave) return true;
  if (/\bOPR\/|\bOpera\b|\bOPX\//.test(navigator.userAgent)) return true;
  try {
    return localStorage.getItem(CHAVE_SEM_DITADO) === "1";
  } catch {
    return false;
  }
}

function marcarSemDitado() {
  try {
    localStorage.setItem(CHAVE_SEM_DITADO, "1");
  } catch {
    /* modo privado */
  }
}

export function vozDisponivel() {
  if (typeof window === "undefined") return false;
  return Boolean(
    reconhecimentoDoNavegador() || (formatoDeGravacao() && navigator.mediaDevices?.getUserMedia),
  );
}

export type EstadoDitado = "parado" | "a_ouvir" | "a_transcrever";
/** "navegador": texto ao vivo; "gravacao": grava e transcreve no servidor ao parar. */
export type ModoDitado = "navegador" | "gravacao";

const AJUDA_MICROFONE =
  "Sem acesso ao microfone. Toca no cadeado ao lado do endereço → Microfone → Permitir, e tenta outra vez.";

export function useDitado(onTexto: (texto: string) => void) {
  const [estado, setEstado] = useState<EstadoDitado>("parado");
  const [modo, setModo] = useState<ModoDitado>("navegador");
  const [parcial, setParcial] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const onTextoRef = useRef(onTexto);
  onTextoRef.current = onTexto;

  const pararTudo = useCallback(() => {
    recRef.current?.stop();
    if (gravadorRef.current && gravadorRef.current.state !== "inactive") gravadorRef.current.stop();
  }, []);

  useEffect(
    () => () => {
      recRef.current?.abort();
      gravadorRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const iniciarGravacao = useCallback(async () => {
    const formato = formatoDeGravacao();
    if (!formato || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Este navegador não permite ditado por voz. Experimenta o Google Chrome.");
      setEstado("parado");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, formato.mime ? { mimeType: formato.mime } : undefined);
      const pedacos: BlobPart[] = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) pedacos.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        gravadorRef.current = null;
        const tipo = rec.mimeType || formato.mime || "audio/webm";
        const blob = new Blob(pedacos, { type: tipo });
        if (blob.size === 0) {
          setEstado("parado");
          return;
        }
        setEstado("a_transcrever");
        try {
          const fd = new FormData();
          fd.append("audio", new File([blob], `ditado.${formato.ext}`, { type: tipo }));
          const r = await transcreverNoServidor(fd);
          if (r.texto?.trim()) onTextoRef.current(r.texto.trim());
          else toast.message("Não percebi nada. Tenta falar mais perto do microfone.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Não foi possível transcrever.");
        } finally {
          setEstado("parado");
        }
      };
      gravadorRef.current = rec;
      rec.start();
      setModo("gravacao");
      setEstado("a_ouvir");
    } catch {
      toast.error(AJUDA_MICROFONE);
      setEstado("parado");
    }
  }, []);

  const iniciarNavegador = useCallback(
    (SR: new () => SpeechRecognitionLike) => {
      const rec = new SR();
      let semServico = false;
      rec.lang = "pt-PT";
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) onTextoRef.current(r[0].transcript);
          else interim += r[0].transcript;
        }
        setParcial(interim);
      };
      rec.onerror = (e) => {
        if (ERROS_SEM_SERVICO.has(e.error)) {
          // O navegador não sabe transcrever: daqui em diante grava e transcreve no servidor.
          semServico = true;
          marcarSemDitado();
        } else if (e.error === "not-allowed" || e.error === "audio-capture") {
          toast.error(AJUDA_MICROFONE);
        } else if (e.error !== "no-speech" && e.error !== "aborted") {
          toast.error("O ditado parou. Tenta outra vez.");
        }
      };
      rec.onend = () => {
        setParcial("");
        recRef.current = null;
        if (semServico) {
          toast.message("Este navegador não tem ditado embutido.", {
            description: "Estou a gravar — fala e toca outra vez no microfone para parar.",
          });
          void iniciarGravacao();
        } else {
          setEstado("parado");
        }
      };
      recRef.current = rec;
      rec.start();
      setModo("navegador");
      setEstado("a_ouvir");
    },
    [iniciarGravacao],
  );

  const iniciar = useCallback(() => {
    const SR = reconhecimentoDoNavegador();
    if (SR && !navegadorSemDitado()) {
      try {
        iniciarNavegador(SR);
        return;
      } catch {
        /* cai para a gravação */
      }
    }
    void iniciarGravacao();
  }, [iniciarNavegador, iniciarGravacao]);

  const alternar = useCallback(() => {
    if (estado === "a_ouvir") pararTudo();
    else if (estado === "parado") iniciar();
  }, [estado, iniciar, pararTudo]);

  return { estado, modo, parcial, iniciar, parar: pararTudo, alternar };
}

/** Escreve texto num input/textarea controlado pelo React (dispara o onChange). */
export function inserirTexto(el: HTMLInputElement | HTMLTextAreaElement, texto: string) {
  const limpo = texto.trim();
  if (!limpo) return;
  const atual = el.value;
  const sep = atual && !/\s$/.test(atual) ? " " : "";
  const novo = atual + sep + limpo;
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, novo);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Botão de microfone: dita para o campo `alvo` ou entrega o texto a `onTexto`. */
export function MicButton({
  alvo,
  onTexto,
  className,
  tamanho = "sm",
  titulo = "Ditar por voz",
}: {
  alvo?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onTexto?: (texto: string) => void;
  className?: string;
  tamanho?: "sm" | "md";
  titulo?: string;
}) {
  const [disponivel] = useState(vozDisponivel);
  const { estado, modo, parcial, alternar } = useDitado((texto) => {
    if (onTexto) onTexto(texto);
    else if (alvo?.current) inserirTexto(alvo.current, texto);
  });

  if (!disponivel) return null;

  const ouvir = estado === "a_ouvir";
  // No modo gravação não há texto ao vivo: diz o que está a acontecer.
  const aviso =
    estado === "a_transcrever"
      ? "A transcrever..."
      : ouvir && modo === "gravacao"
        ? "A gravar — toca para parar"
        : ouvir
          ? parcial
          : "";
  return (
    <span className={cn("relative inline-flex", className)}>
      {aviso && (
        <span className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 max-w-[240px] truncate rounded-lg bg-text-hi px-2.5 py-1.5 text-xs text-white shadow-lg">
          {aviso}
        </span>
      )}
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={alternar}
        disabled={estado === "a_transcrever"}
        title={ouvir ? "Parar ditado" : titulo}
        aria-label={ouvir ? "Parar ditado" : titulo}
        aria-pressed={ouvir}
        className={cn(
          "grid shrink-0 place-items-center rounded-lg transition",
          tamanho === "md" ? "size-10" : "size-8",
          ouvir
            ? "animate-pulse bg-red-500 text-white"
            : "text-text-low hover:bg-accent-soft hover:text-accent",
        )}
      >
        {estado === "a_transcrever" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : ouvir ? (
          <Square className="size-3.5 fill-current" />
        ) : (
          <Mic className="size-4" />
        )}
      </button>
    </span>
  );
}
