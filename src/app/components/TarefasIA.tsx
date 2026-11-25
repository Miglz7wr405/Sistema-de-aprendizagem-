// Tarefas de IA em segundo plano (correm no servidor, função `tarefas-ia`):
// o admin escolhe o que a IA faz a um curso e pode sair da página.
// - BotaoIACurso: escolher passos e começar.
// - PainelTarefasIA: indicador no topo com o progresso de todas as tarefas.
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, Loader2, Sparkles, X, XCircle } from "lucide-react";
import { toast } from "sonner";

import { chamarFuncao } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Modal } from "./Modal";
import { Button } from "./primitives";

export type Passo = "textos" | "organizar" | "descricoes";

export type TarefaIA = {
  id: string;
  curso_id: string | null;
  curso_titulo: string | null;
  passos: Passo[];
  passo_atual: number;
  feitos: number;
  falhas: number;
  total: number;
  estado: "pendente" | "a_correr" | "concluida" | "erro" | "cancelada";
  mensagem: string | null;
  automatica: boolean;
  criado_em: string;
};

const NOME_PASSO: Record<Passo, string> = {
  textos: "Títulos e textos das aulas",
  organizar: "Organizar em módulos",
  descricoes: "Descrição do curso e dos módulos",
};

const EVENTO = "tarefas-ia:mudou";

/** Avisa o resto da app (ex.: a página de conteúdo recarrega quando uma tarefa acaba). */
export function aoMudarTarefas(fn: () => void) {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}

export function BotaoIACurso({
  cursoId,
  temAulas,
  disabled,
}: {
  cursoId: string;
  temAulas: boolean;
  disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [passos, setPassos] = useState<Record<Passo, boolean>>({
    textos: true,
    organizar: true,
    descricoes: true,
  });
  const [sobrescrever, setSobrescrever] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);

  async function comecar() {
    const escolhidos = (Object.keys(NOME_PASSO) as Passo[]).filter((p) => passos[p]);
    if (escolhidos.length === 0) return toast.error("Escolhe pelo menos uma opção.");
    setAEnviar(true);
    try {
      await chamarFuncao("tarefas-ia", {
        acao: "criar",
        curso_id: cursoId,
        passos: escolhidos,
        sobrescrever,
      });
      window.dispatchEvent(new Event(EVENTO));
      toast.success("A IA começou em segundo plano. Podes sair desta página.", {
        description: "Acompanha no ícone do robô, no topo.",
      });
      setAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível começar.");
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-8 px-2.5"
        onClick={() => setAberto(true)}
        disabled={disabled || !temAulas}
        title="Textos, módulos e descrições com IA (em segundo plano)"
      >
        <Sparkles className="size-4" /> IA
      </Button>
      <Modal open={aberto} onClose={() => !aEnviar && setAberto(false)} title="IA para este curso">
        <div className="space-y-3">
          <p className="text-sm text-text-mid">
            Corre no servidor, <strong>em segundo plano</strong>: podes fechar esta janela, mudar de
            página ou sair. Avisamos-te no sino quando terminar.
          </p>
          {(Object.keys(NOME_PASSO) as Passo[]).map((p, i) => (
            <label
              key={p}
              className="flex items-start gap-2 rounded-lg border border-hairline p-3 hover:bg-bg-base"
            >
              <input
                type="checkbox"
                checked={passos[p]}
                onChange={(e) => setPassos((s) => ({ ...s, [p]: e.target.checked }))}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-text-hi">
                  {i + 1}. {NOME_PASSO[p]}
                </span>
                <span className="block text-xs text-text-mid">
                  {p === "textos" &&
                    "A IA ouve o início de cada vídeo e escreve título e descrição (demora ~30 s por aula)."}
                  {p === "organizar" &&
                    "Agrupa as aulas em módulos e põe-nas por ordem. Substitui os módulos atuais."}
                  {p === "descricoes" &&
                    "Escreve a descrição do curso e uma frase para cada módulo."}
                </span>
              </span>
            </label>
          ))}
          <label className="flex items-center gap-2 px-1 text-sm text-text-mid">
            <input
              type="checkbox"
              checked={sobrescrever}
              onChange={(e) => setSobrescrever(e.target.checked)}
            />
            Refazer também o que já tem texto
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setAberto(false)} disabled={aEnviar}>
              Cancelar
            </Button>
            <Button onClick={comecar} disabled={aEnviar}>
              {aEnviar ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Começar em segundo plano
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function descreverProgresso(t: TarefaIA) {
  if (t.estado === "concluida") return t.mensagem ?? "Concluída.";
  if (t.estado === "erro") return t.mensagem ?? "Parou com erro.";
  if (t.estado === "cancelada") return "Cancelada.";
  const passo = t.passos[t.passo_atual];
  if (!passo) return "A terminar…";
  const etapa = `Passo ${t.passo_atual + 1}/${t.passos.length}: ${NOME_PASSO[passo]}`;
  if (passo === "textos" && t.total > 0) return `${etapa} — aula ${t.feitos} de ${t.total}`;
  return `${etapa}…`;
}

function percentagem(t: TarefaIA) {
  if (t.estado === "concluida") return 100;
  const porPasso = 100 / Math.max(1, t.passos.length);
  const dentro = t.passos[t.passo_atual] === "textos" && t.total > 0 ? t.feitos / t.total : 0.15;
  return Math.min(99, Math.round(t.passo_atual * porPasso + dentro * porPasso));
}

/** Indicador no topo (só admins): mostra as tarefas de IA e o progresso. */
export function PainelTarefasIA() {
  const [tarefas, setTarefas] = useState<TarefaIA[]>([]);
  const [aberto, setAberto] = useState(false);
  const primeira = useRef(true);
  const caixa = useRef<HTMLDivElement>(null);
  const ativasAntes = useRef<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    try {
      const r = await chamarFuncao<{ tarefas: TarefaIA[] }>("tarefas-ia", {
        acao: "listar",
        // Na 1.ª vez também põe a IA a escrever descrições em falta (cursos/módulos novos).
        auto: primeira.current,
      });
      primeira.current = false;
      const lista = r.tarefas ?? [];
      // Tarefa que acabou desde a última vez → a página de conteúdo recarrega.
      const ativas = new Set(
        lista.filter((t) => t.estado === "a_correr" || t.estado === "pendente").map((t) => t.id),
      );
      for (const id of ativasAntes.current) {
        if (!ativas.has(id)) {
          window.dispatchEvent(new Event(EVENTO));
          const t = lista.find((x) => x.id === id);
          if (t?.estado === "concluida" && !t.automatica)
            toast.success(`IA terminou: ${t.curso_titulo ?? "curso"}`);
          break;
        }
      }
      ativasAntes.current = ativas;
      setTarefas(lista);
    } catch {
      /* sem rede: tenta na próxima */
    }
  }, []);

  const aCorrer = tarefas.filter((t) => t.estado === "a_correr" || t.estado === "pendente");

  useEffect(() => {
    void carregar();
    const t = window.setInterval(carregar, aCorrer.length > 0 ? 6000 : 45000);
    return () => window.clearInterval(t);
  }, [carregar, aCorrer.length]);

  useEffect(() => aoMudarTarefas(() => void carregar()), [carregar]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  async function cancelar(id: string) {
    await chamarFuncao("tarefas-ia", { acao: "cancelar", id }).catch(() => {});
    void carregar();
  }

  if (tarefas.length === 0) return null;

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        title="Tarefas de IA"
        className="relative grid size-9 place-items-center rounded-xl border border-hairline bg-bg-elevated text-text-mid hover:text-text-hi"
      >
        {aCorrer.length > 0 ? (
          <Loader2 className="size-4 animate-spin text-accent" />
        ) : (
          <Bot className="size-4" />
        )}
        {aCorrer.length > 0 && (
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-on-accent">
            {aCorrer.length}
          </span>
        )}
      </button>
      {aberto && (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-hairline bg-bg-elevated shadow-xl">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <p className="text-sm font-semibold text-text-hi">IA em segundo plano</p>
            <button onClick={() => setAberto(false)} className="text-text-low hover:text-text-hi">
              <X className="size-4" />
            </button>
          </div>
          <div className="max-h-[60vh] divide-y divide-hairline overflow-y-auto">
            {tarefas.map((t) => {
              const ativa = t.estado === "a_correr" || t.estado === "pendente";
              return (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    {ativa ? (
                      <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-accent" />
                    ) : t.estado === "concluida" ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-hi">
                        {t.curso_titulo ?? "Curso"}
                        {t.automatica && (
                          <span className="ml-1.5 text-[10px] font-normal text-text-low">
                            automática
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-text-mid">{descreverProgresso(t)}</p>
                      {ativa && (
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-base">
                          <div
                            className={cn("h-full bg-accent transition-all")}
                            style={{ width: `${percentagem(t)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {ativa && (
                      <button
                        onClick={() => cancelar(t.id)}
                        className="text-xs text-text-low hover:text-red-600"
                        title="Cancelar"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
