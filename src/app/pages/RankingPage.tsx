import { useState } from "react";
import { Crown, Trophy } from "lucide-react";

import { Social } from "@/lib/db";
import type { PeriodoRanking, PosicaoRanking } from "@/lib/types";
import { PAPEL_LABEL } from "@/lib/types";
import { cn, primeiroNome } from "@/lib/utils";
import { useAuth } from "../auth";
import {
  Avatar,
  Badge,
  Carregando,
  EmptyState,
  PageHeader,
  SeloPlano,
} from "../components/primitives";
import { useData } from "../use-data";

const PERIODOS: { chave: PeriodoRanking; label: string }[] = [
  { chave: "semana", label: "Semana" },
  { chave: "mes", label: "Mês" },
  { chave: "geral", label: "Geral" },
];

const TROFEU = ["text-amber-400", "text-slate-400", "text-orange-500"]; // ouro, prata, bronze
const ALTURA_BLOCO = ["h-36", "h-24", "h-16"]; // 1.º mais alto

function Podio({ top, meuId }: { top: PosicaoRanking[]; meuId?: string }) {
  // ordem visual: 2.º à esquerda, 1.º ao centro, 3.º à direita
  const lugares = [1, 0, 2].filter((i) => top[i]);
  return (
    <div className="app-card overflow-hidden p-5">
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-text-low">
        Pódio
      </p>
      <div className="flex items-end justify-center gap-2">
        {lugares.map((i) => {
          const p = top[i];
          return (
            <div key={p.user_id} className="flex w-1/3 max-w-[140px] flex-col items-center">
              {i === 0 && <Crown className="mb-1 size-6 text-amber-400" />}
              <Trophy className={cn("mb-1.5", i === 0 ? "size-8" : "size-6", TROFEU[i])} />
              <Avatar
                nome={p.nome || "?"}
                tom={i === 0 ? "solid" : "soft"}
                className={cn(
                  i === 0 ? "size-14 text-base" : "size-11",
                  p.user_id === meuId && "ring-2 ring-accent ring-offset-2",
                )}
              />
              <p className="mt-1.5 w-full truncate text-center text-sm font-semibold text-text-hi">
                {primeiroNome(p.nome)}
              </p>
              <p className="mb-2 text-center text-[11px] text-text-low">
                {p.concluidas} concluída{p.concluidas === 1 ? "" : "s"}
              </p>
              <div
                className={cn(
                  "grid w-full place-items-center rounded-t-xl border border-b-0 border-hairline bg-gradient-to-b from-white to-accent-soft shadow-[0_-6px_20px_-12px_rgba(0,51,255,.35)]",
                  ALTURA_BLOCO[i],
                )}
              >
                <span className={cn("font-display font-bold text-accent", i === 0 ? "text-5xl" : "text-4xl")}>
                  {i + 1}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="h-2 rounded-b-lg bg-accent/15" />
    </div>
  );
}

export default function RankingPage() {
  const { sessao } = useAuth();
  const meuId = sessao?.user.id;
  const [periodo, setPeriodo] = useState<PeriodoRanking>("semana");
  const { data, loading } = useData(async () => {
    const [lista, planos] = await Promise.all([Social.ranking(periodo), Social.planos()]);
    return { lista, planos };
  }, [periodo]);

  const lista = data?.lista ?? [];
  const planos = data?.planos ?? {};

  return (
    <div className="page-fade-in">
      <PageHeader
        title="Ranking"
        subtitle="Quem concluiu mais aulas na academia. Os 3 primeiros do mês ganham um prémio!"
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
            <strong>Prémio mensal:</strong> os 3 primeiros deste mês ganham um prémio. Conclui aulas
            para subires no ranking!
          </p>
        </div>
      )}

      {loading ? (
        <Carregando />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Ainda sem atividade"
          description="Assim que as pessoas começarem a concluir aulas, aparecem aqui por ordem."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          {/* Pódio: à direita no computador, em cima no telemóvel */}
          <div className="lg:order-2">
            <div className="lg:sticky lg:top-24">
              <Podio top={lista.slice(0, 3)} meuId={meuId} />
            </div>
          </div>

          {/* Lista completa */}
          <div className="app-card divide-y divide-hairline lg:order-1">
            {lista.map((p) => (
              <div
                key={p.user_id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  p.user_id === meuId && "bg-accent-soft",
                )}
              >
                <span
                  className={cn(
                    "w-7 shrink-0 text-center font-display text-sm font-bold",
                    p.posicao <= 3 ? TROFEU[p.posicao - 1] : "text-text-low",
                  )}
                >
                  {p.posicao}
                </span>
                <Avatar nome={p.nome || "?"} className="size-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-text-hi">{p.nome}</span>
                    {planos[p.user_id] && <SeloPlano plano={planos[p.user_id]} />}
                    {p.papel !== "aluno" && (
                      <Badge className="bg-accent-soft px-1.5 py-0 text-[10px] text-accent">
                        {PAPEL_LABEL[p.papel]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-low">
                    {p.total} {p.total === 1 ? "vídeo visto" : "vídeos vistos"}
                  </p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="font-display text-lg font-bold text-text-hi">{p.concluidas}</span>
                  <span className="block text-[11px] text-text-low">
                    concluída{p.concluidas === 1 ? "" : "s"}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
