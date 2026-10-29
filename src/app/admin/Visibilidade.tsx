import { GraduationCap, Lock } from "lucide-react";

import type { Visibilidade } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Escolha entre "Academia" (todos os aprovados) e "Privada" (só equipa Insight). */
export function EscolhaVisibilidade({
  valor,
  onChange,
}: {
  valor: Visibilidade;
  onChange: (v: Visibilidade) => void;
}) {
  const opcoes = [
    {
      v: "academia" as const,
      icone: GraduationCap,
      titulo: "Academia",
      texto: "Todos os alunos aprovados veem.",
    },
    {
      v: "privada" as const,
      icone: Lock,
      titulo: "Privada",
      texto: "Só a equipa Insight vê.",
    },
  ];
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-text-hi">Quem pode ver?</p>
      <div className="grid grid-cols-2 gap-2">
        {opcoes.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={cn(
              "flex items-start gap-2 rounded-lg border p-3 text-left transition",
              valor === o.v
                ? "border-accent bg-accent-soft"
                : "border-hairline hover:border-accent/50",
            )}
          >
            <o.icone
              className={cn(
                "mt-0.5 size-4 shrink-0",
                valor === o.v ? "text-accent" : "text-text-low",
              )}
            />
            <span>
              <span className="block text-sm font-semibold text-text-hi">{o.titulo}</span>
              <span className="block text-xs text-text-mid">{o.texto}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
