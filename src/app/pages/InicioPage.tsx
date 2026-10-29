import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, GraduationCap, PlayCircle, Trophy } from "lucide-react";

import { primeiroNome } from "@/lib/utils";
import { youtubeThumb } from "@/lib/video";
import { useAuth } from "../auth";
import { aulasDoCurso, CabecalhoSeccao, CursoCard, progressoDoCurso } from "../components/Catalogo";
import { Button, Carregando, EmptyState, Erro, ProgressBar } from "../components/primitives";
import { useCatalogo } from "../use-catalogo";

export default function InicioPage() {
  const { perfil, eAdmin } = useAuth();
  const { data: cat, loading, error, refetch } = useCatalogo();

  if (loading) return <Carregando />;
  if (error || !cat) return <Erro mensagem={error ?? "Erro"} onRetry={refetch} />;

  const totalAulas = cat.aulas.length;
  const feitas = new Set(cat.progresso.filter((p) => p.concluida).map((p) => p.aula_id));
  const concluidas = cat.aulas.filter((a) => feitas.has(a.id)).length;
  const pctGeral = totalAulas ? Math.round((concluidas / totalAulas) * 100) : 0;
  const cursosFeitos = cat.cursos.filter((c) => {
    const p = progressoDoCurso(cat, c.id);
    return p.total > 0 && p.concluidas === p.total;
  }).length;

  // "Continuar a ver": a última aula aberta de um curso que ainda não está terminado.
  const continuar = (() => {
    for (const p of cat.progresso) {
      const aula = cat.aulas.find((a) => a.id === p.aula_id);
      if (!aula) continue;
      const curso = cat.cursos.find((c) => c.id === aula.curso_id);
      if (!curso) continue;
      const prog = progressoDoCurso(cat, curso.id);
      if (prog.concluidas === prog.total) continue;
      const lista = aulasDoCurso(cat, curso.id);
      const proxima = p.concluida
        ? (lista.find((a) => !feitas.has(a.id) && a.ordem > aula.ordem) ??
          lista.find((a) => !feitas.has(a.id)) ??
          aula)
        : aula;
      return { curso, aula: proxima, prog };
    }
    return null;
  })();

  const seccoesComCursos = cat.seccoes
    .map((s) => ({ seccao: s, cursos: cat.cursos.filter((c) => c.seccao_id === s.id) }))
    .filter((x) => x.cursos.length > 0 || eAdmin);

  return (
    <div className="page-fade-in space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent via-accent-2 to-accent-3 p-6 text-white md:p-8">
        <div className="relative z-10 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
            Insight Academia
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold md:text-3xl">
            Olá, {primeiroNome(perfil?.nome_completo ?? "")} 👋
          </h1>
          <p className="mt-2 text-sm text-white/85">
            Aprende ao teu ritmo. Escolhe uma área, vê as aulas e tira dúvidas na comunidade.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm">
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
              <ProgressBar value={pctGeral} className="h-1.5 bg-white/25 [&>div]:bg-white" />
            </div>
          )}
        </div>
        <GraduationCap className="absolute -bottom-6 -right-6 size-44 text-white/10" />
      </section>

      {continuar && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-text-hi">Continuar a ver</h2>
          <Link
            to={`/curso/${continuar.curso.id}?aula=${continuar.aula.id}`}
            className="app-card app-card-hover flex items-center gap-4 p-3"
          >
            <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-text-hi">
              {youtubeThumb(continuar.aula.url) ? (
                <img
                  src={youtubeThumb(continuar.aula.url)!}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-white/70">
                  <PlayCircle className="size-8" />
                </div>
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
                <PlayCircle className="size-8" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-text-low">{continuar.curso.titulo}</p>
              <p className="truncate font-medium text-text-hi">{continuar.aula.titulo}</p>
              <div className="mt-2 flex items-center gap-2">
                <ProgressBar value={continuar.prog.pct} className="h-1.5 max-w-[200px]" />
                <span className="text-[11px] text-text-low">{continuar.prog.pct}%</span>
              </div>
            </div>
            <ArrowRight className="hidden size-5 text-accent sm:block" />
          </Link>
        </section>
      )}

      {seccoesComCursos.length === 0 ? (
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
        seccoesComCursos.map(({ seccao, cursos }) => (
          <section key={seccao.id}>
            <CabecalhoSeccao seccao={seccao} nCursos={cursos.length} link />
            {cursos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-hairline px-4 py-6 text-center text-sm text-text-low">
                Secção vazia.{" "}
                <Link to={`/admin/conteudo?seccao=${seccao.id}`} className="text-accent">
                  Adicionar curso
                </Link>
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {cursos.map((c) => (
                  <CursoCard key={c.id} cat={cat} curso={c} />
                ))}
              </div>
            )}
          </section>
        ))
      )}
    </div>
  );
}
