import { Link } from "react-router-dom";
import { BookOpen, GraduationCap, Play, Trophy } from "lucide-react";

import { primeiroNome } from "@/lib/utils";
import { PLANO } from "@/lib/types";
import { useAuth } from "../auth";
import { progressoDoCurso, SeccaoCard } from "../components/Catalogo";
import { Button, Carregando, EmptyState, Erro, ProgressBar, SeloPlano } from "../components/primitives";
import { useCatalogo } from "../use-catalogo";

export default function InicioPage() {
  const { perfil, eAdmin } = useAuth();
  const { data: cat, loading, error, refetch } = useCatalogo();

  if (loading) return <Carregando />;
  if (error || !cat) return <Erro mensagem={error ?? "Erro"} onRetry={refetch} />;

  const seccoes = cat.seccoes
    .map((s) => ({ seccao: s, cursos: cat.cursos.filter((c) => c.seccao_id === s.id) }))
    .filter((x) => x.cursos.length > 0);

  const totalAulas = cat.aulas.length;
  const feitas = new Set(cat.progresso.filter((p) => p.concluida).map((p) => p.aula_id));
  const concluidas = cat.aulas.filter((a) => feitas.has(a.id)).length;
  const pctGeral = totalAulas ? Math.round((concluidas / totalAulas) * 100) : 0;
  const cursosFeitos = cat.cursos.filter((c) => {
    const p = progressoDoCurso(cat, c.id);
    return p.total > 0 && p.concluidas === p.total;
  }).length;

  // Cursos com progresso, ordenados por vista_em mais recente
  const aulaIdParaCursoId = new Map(cat.aulas.map((a) => [a.id, a.curso_id]));
  const cursoPorId = new Map(cat.cursos.map((c) => [c.id, c]));
  const ultimaVistaPorCurso = new Map<string, string>();
  for (const p of cat.progresso) {
    const cursoId = aulaIdParaCursoId.get(p.aula_id);
    if (!cursoId) continue;
    const atual = ultimaVistaPorCurso.get(cursoId);
    if (!atual || p.vista_em > atual) ultimaVistaPorCurso.set(cursoId, p.vista_em);
  }
  const continuar = Array.from(ultimaVistaPorCurso.entries())
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 4)
    .map(([cursoId]) => cursoPorId.get(cursoId))
    .filter((c): c is NonNullable<typeof c> => c != null);

  const expiraEm = perfil?.acesso_expira_em
    ? new Date(perfil.acesso_expira_em).toLocaleDateString("pt-PT")
    : null;

  return (
    <div className="page-fade-in space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent via-accent-2 to-accent-3 p-6 text-white md:p-8">
        <div className="relative z-10 max-w-xl">
          {/* Patente / plano de acesso */}
          {perfil?.plano && (
            <div className="mb-3 flex items-center gap-2">
              <SeloPlano plano={perfil.plano} className="text-sm px-3 py-1" />
              <span className="text-xs text-white/70">
                Acesso {PLANO[perfil.plano].selo}
                {expiraEm && <> · expira {expiraEm}</>}
              </span>
            </div>
          )}

          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            Insight Academia
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold md:text-3xl">
            Olá, {primeiroNome(perfil?.nome_completo ?? "")} 👋
          </h1>
          <p className="mt-2 text-sm text-white/85">
            Escolhe uma área para veres os cursos e começares a aprender.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5">
              <GraduationCap className="size-4" /> {cat.cursos.length} cursos
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5">
              <BookOpen className="size-4" /> {concluidas}/{totalAulas} aulas vistas
            </span>
            <span className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5">
              <Trophy className="size-4" /> {cursosFeitos} concluídos
            </span>
          </div>
          {totalAulas > 0 && (
            <div className="mt-4 max-w-sm">
              <div className="mb-1 flex justify-between text-xs text-white/80">
                <span>O teu progresso</span>
                <span>{pctGeral}%</span>
              </div>
              <ProgressBar value={pctGeral} className="h-1.5 bg-white/25 [&>div]:bg-white" />
            </div>
          )}
        </div>
        <GraduationCap className="absolute -bottom-6 -right-6 size-44 text-white/10" />
      </section>

      {continuar.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-text-hi">Continuar a ver</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {continuar.map((curso) => {
              const prog = progressoDoCurso(cat, curso.id);
              return (
                <Link
                  key={curso.id}
                  to={`/curso/${curso.id}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:shadow-md"
                >
                  {curso.capa_url ? (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={curso.capa_url}
                        alt={curso.titulo}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-accent/10">
                      <Play className="size-8 text-accent" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-3">
                    <p className="line-clamp-2 text-xs font-medium text-text-hi sm:text-sm">
                      {curso.titulo}
                    </p>
                    <div className="mt-auto pt-2">
                      <div className="mb-1 flex justify-between text-xs text-text-mid">
                        <span>{prog.concluidas}/{prog.total} aulas</span>
                        <span>{prog.pct}%</span>
                      </div>
                      <ProgressBar value={prog.pct} className="h-1" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {seccoes.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Ainda não há cursos para ti"
          description="A equipa da Insight está a preparar o conteúdo. Volta em breve!"
          action={
            eAdmin ? (
              <Link to="/admin/conteudo">
                <Button>Adicionar conteúdo</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-text-hi">Escolhe uma área</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {seccoes.map(({ seccao, cursos }) => (
              <SeccaoCard key={seccao.id} cat={cat} seccao={seccao} cursos={cursos} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
