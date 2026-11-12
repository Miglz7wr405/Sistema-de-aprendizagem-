import { useState } from "react";
import { Crown, Trophy } from "lucide-react";

import { Social } from "@/lib/db";
import type { PeriodoRanking } from "@/lib/types";
import { PAPEL_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { Avatar, Badge, Carregando, EmptyState, PageHeader } from "../components/primitives";
import { useData } from "../use-data";

const PERIODOS: { chave: PeriodoRanking; label: string }[] = [
  { chave: "semana", label: "Semana" },
  { chave: "mes", label: "Mês" },
  { chave: "geral", label: "Geral" },
];

const CORES_PODIO = [
  "from-amber-300 to-amber-500 text-amber-950", // 1.º ouro
  "from-slate-200 to-slate-400 text-slate-800", // 2.º prata
  "from-orange-300 to-orange-500 text-orange-950", // 3.º bronze
];

export default function RankingPage() {
  const { sessao } = useAuth();
  const meuId = sessao?.user.id;
  const [periodo, setPeriodo] = useState<PeriodoRanking>("semana");
  const { data, loading } = useData(() => Social.ranking(periodo), [periodo]);

  const lista = data ?? [];
  const podio = lista.slice(0, 3);
  const restantes = lista.slice(3);

  return (
    <div className="page-fade-in">
      <PageHeader
        title="Ranking"
        subtitle="Quem assistiu a mais vídeos na academia. Os 3 primeiros do mês ganham um prémio!"
      />

      <div className="mb-5 inline-flex rounded-xl border border-hairline bg-bg-elevated p-1">
        {PERIODOS.map((p) => (
          <button
            key={p.chave}
            onClick={() => setPeriodo(p.chave)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition",
              periodo === p.chave ? "bg-accent text-on-accent" : "text-text-mid hover:text-text-hi",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {periodo === "mes" && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Trophy className="size-5 shrink-0" />
          <p>
            <strong>Prémio mensal:</strong> os 3 primeiros deste mês ganham um prémio. Continua a
            estudar para subires no ranking!
          </p>
        </div>
      )}

      {loading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Ainda sem atividade"
          description="Assim que as pessoas começarem a ver aulas, aparecem aqui por ordem."
        />
      ) : (
        <>
          {/* Pódio top 3 */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {podio.map((p, i) => (
              <div
                key={p.user_id}
                className={cn(
                  "app-card flex items-center gap-3 overflow-hidden p-4",
                  p.user_id === meuId && "ring-2 ring-accent",
                  i === 0 && "sm:order-2",
                  i === 1 && "sm:order-1",
                  i === 2 && "sm:order-3",
                )}
              >
                <div
                  className={cn(
                    "grid size-12 shrink-0 place-items-center rounded-full bg-gradient-to-br font-display text-lg font-bold",
                    CORES_PODIO[i],
                  )}
                >
                  {i === 0 ? <Crown className="size-6" /> : p.posicao}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold text-text-hi">{p.nome}</span>
                    {p.papel !== "aluno" && (
                      <Badge className="bg-accent-soft px-1.5 py-0 text-[10px] text-accent">
                        {PAPEL_LABEL[p.papel]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-text-low">
                    {p.total} {p.total === 1 ? "vídeo" : "vídeos"} · {p.concluidas} concluídos
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Lista restante */}
          {restantes.length > 0 && (
            <div className="app-card divide-y divide-hairline">
              {restantes.map((p) => (
                <div
                  key={p.user_id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    p.user_id === meuId && "bg-accent-soft",
                  )}
                >
                  <span className="w-7 shrink-0 text-center font-display text-sm font-bold text-text-low">
                    {p.posicao}
                  </span>
                  <Avatar nome={p.nome || "?"} className="size-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-text-hi">{p.nome}</span>
                      {p.papel !== "aluno" && (
                        <Badge className="bg-accent-soft px-1.5 py-0 text-[10px] text-accent">
                          {PAPEL_LABEL[p.papel]}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-text-low">{p.concluidas} concluídos</p>
                  </div>
                  <span className="shrink-0 text-right">
                    <span className="font-display text-lg font-bold text-text-hi">{p.total}</span>
                    <span className="block text-[11px] text-text-low">vídeos</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
