import { useState } from "react";
import { Brain, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { chamarFuncao } from "@/lib/supabase";
import type { Aula, Curso } from "@/lib/types";
import { Button } from "./primitives";

type AulaOrg = { id: string; modulo: string; ordem: number; titulo: string };
type Estado = "pronto" | "a-carregar" | "sugestao" | "a-aplicar" | "fim";

export function OrganizarAulasIA({
  curso,
  aulas,
  onAplicar,
  disabled,
}: {
  curso: Curso;
  aulas: Aula[];
  onAplicar: () => void;
  disabled?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>("pronto");
  const [proposta, setProposta] = useState<AulaOrg[]>([]);
  const [totalAplicadas, setTotalAplicadas] = useState(0);

  async function sugerir() {
    setEstado("a-carregar");
    try {
      const r = await chamarFuncao<{ ok: boolean; aulas?: AulaOrg[]; motivo?: string }>(
        "gerar-descricoes",
        { acao: "organizar", modo: "sugerir", curso_id: curso.id },
      );
      if (!r.ok || !r.aulas?.length) {
        toast.error("A IA não conseguiu organizar as aulas. Tenta novamente.");
        setEstado("pronto");
        return;
      }
      setProposta(r.aulas);
      setEstado("sugestao");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao contactar a IA.");
      setEstado("pronto");
    }
  }

  async function aplicar() {
    setEstado("a-aplicar");
    try {
      const r = await chamarFuncao<{ ok: boolean; total?: number }>("gerar-descricoes", {
        acao: "organizar",
        modo: "aplicar",
        resultado: proposta.map(({ id, modulo, ordem }) => ({ id, modulo, ordem })),
      });
      if (!r.ok) throw new Error("Não foi possível guardar.");
      setTotalAplicadas(r.total ?? proposta.length);
      setEstado("fim");
      onAplicar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao guardar.");
      setEstado("sugestao");
    }
  }

  // Agrupa por módulo para a pré-visualização
  const modulosMap = proposta.reduce<Record<string, AulaOrg[]>>((acc, a) => {
    (acc[a.modulo] ??= []).push(a);
    return acc;
  }, {});
  const modulosOrdenados = Object.entries(modulosMap).sort(
    ([, a], [, b]) => Math.min(...a.map((x) => x.ordem)) - Math.min(...b.map((x) => x.ordem)),
  );

  if (estado === "pronto") {
    return (
      <button
        onClick={sugerir}
        disabled={disabled || aulas.length < 2}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-hairline px-3 py-2 text-sm text-text-mid transition hover:border-accent hover:text-accent disabled:opacity-40"
      >
        <Brain className="size-4 shrink-0" />
        Organizar aulas em módulos com IA
      </button>
    );
  }

  if (estado === "a-carregar") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2.5 text-sm text-text-mid">
        <Loader2 className="size-4 shrink-0 animate-spin" />
        A analisar os {aulas.length} títulos...
      </div>
    );
  }

  if (estado === "fim") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm font-medium text-green-700">
        <Check className="size-4 shrink-0" />
        {totalAplicadas} aulas organizadas em {modulosOrdenados.length} módulos.
        <button
          onClick={() => setEstado("pronto")}
          className="ml-auto text-green-600 hover:text-green-800"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  // estado === "sugestao" | "a-aplicar"
  return (
    <div className="rounded-lg border border-accent/30 bg-accent-soft">
      <div className="flex items-center gap-2 border-b border-accent/20 px-3 py-2">
        <Brain className="size-4 shrink-0 text-accent" />
        <span className="flex-1 text-sm font-semibold text-text-hi">
          Proposta da IA — {modulosOrdenados.length} módulos
        </span>
        <button
          onClick={() => setEstado("pronto")}
          disabled={estado === "a-aplicar"}
          className="text-text-low hover:text-text-hi disabled:opacity-40"
          aria-label="Cancelar"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto p-2">
        {modulosOrdenados.map(([modulo, aulasDoModulo]) => (
          <div key={modulo}>
            <p className="px-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
              {modulo}{" "}
              <span className="font-normal text-text-low">({aulasDoModulo.length})</span>
            </p>
            {aulasDoModulo
              .slice()
              .sort((a, b) => a.ordem - b.ordem)
              .map((a, i) => (
                <p key={a.id} className="flex gap-1.5 rounded px-1 py-0.5 text-sm text-text-hi">
                  <span className="shrink-0 text-text-low">{i + 1}.</span>
                  <span className="line-clamp-1">{a.titulo}</span>
                </p>
              ))}
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 border-t border-accent/20 p-2">
        <Button
          variant="outline"
          className="h-8 px-3"
          disabled={estado === "a-aplicar"}
          onClick={() => setEstado("pronto")}
        >
          Cancelar
        </Button>
        <Button className="h-8 px-3" disabled={estado === "a-aplicar"} onClick={aplicar}>
          {estado === "a-aplicar" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> A guardar...
            </>
          ) : (
            "Aplicar"
          )}
        </Button>
      </div>
    </div>
  );
}
