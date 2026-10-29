import { Link } from "react-router-dom";
import { CheckCircle2, EyeOff, PlayCircle } from "lucide-react";

import type { Aula, Curso, Progresso, Seccao } from "@/lib/types";
import { NIVEL_LABEL, NIVEL_STYLE } from "@/lib/types";
import { miniaturaDoLink } from "@/lib/video";
import { cn } from "@/lib/utils";
import { Badge, BadgePrivado, ProgressBar } from "./primitives";

export type Catalogo = {
  seccoes: Seccao[];
  cursos: Curso[];
  aulas: Aula[];
  progresso: Progresso[];
};

export function aulasDoCurso(cat: Catalogo, cursoId: string) {
  return cat.aulas.filter((a) => a.curso_id === cursoId).sort((a, b) => a.ordem - b.ordem);
}

export function progressoDoCurso(cat: Catalogo, cursoId: string) {
  const aulas = aulasDoCurso(cat, cursoId);
  const feitas = new Set(cat.progresso.filter((p) => p.concluida).map((p) => p.aula_id));
  const concluidas = aulas.filter((a) => feitas.has(a.id)).length;
  return {
    total: aulas.length,
    concluidas,
    pct: aulas.length ? Math.round((concluidas / aulas.length) * 100) : 0,
  };
}

export function capaDoCurso(cat: Catalogo, curso: Curso) {
  if (curso.capa_url) return curso.capa_url;
  for (const a of aulasDoCurso(cat, curso.id)) {
    const t = miniaturaDoLink(a.url);
    if (t) return t;
  }
  return null;
}

export function CursoCard({ cat, curso }: { cat: Catalogo; curso: Curso }) {
  const { total, concluidas, pct } = progressoDoCurso(cat, curso.id);
  const capa = capaDoCurso(cat, curso);
  const feito = total > 0 && concluidas === total;
  return (
    <Link
      to={`/curso/${curso.id}`}
      className="app-card app-card-hover group flex flex-col overflow-hidden"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-accent to-accent-2">
        {capa ? (
          <img
            src={capa}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            onError={(e) => (e.currentTarget.style.visibility = "hidden")}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-white/80">
            <PlayCircle className="size-10" />
          </div>
        )}
        {!curso.publicado && (
          <span className="absolute left-2 top-2">
            <Badge className="bg-black/70 text-white">
              <EyeOff className="size-3" /> Rascunho
            </Badge>
          </span>
        )}
        {feito && (
          <span className="absolute right-2 top-2">
            <Badge className="bg-green-600 text-white">
              <CheckCircle2 className="size-3" /> Concluído
            </Badge>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={NIVEL_STYLE[curso.nivel]}>{NIVEL_LABEL[curso.nivel]}</Badge>
          <span className="text-xs text-text-low">
            {total} {total === 1 ? "aula" : "aulas"}
            {curso.duracao ? ` · ${curso.duracao}` : ""}
          </span>
        </div>
        <h3 className="mt-2 font-display text-base font-semibold leading-snug text-text-hi">
          {curso.titulo}
        </h3>
        {curso.descricao && (
          <p className="mt-1 line-clamp-2 text-sm text-text-mid">{curso.descricao}</p>
        )}
        <div className="mt-auto pt-4">
          <div className="mb-1 flex justify-between text-[11px] text-text-low">
            <span>{pct > 0 ? `${pct}% feito` : "Por começar"}</span>
            <span>
              {concluidas}/{total}
            </span>
          </div>
          <ProgressBar value={pct} className="h-1.5" />
        </div>
      </div>
    </Link>
  );
}

export function CabecalhoSeccao({
  seccao,
  nCursos,
  link,
}: {
  seccao: Seccao;
  nCursos: number;
  link?: boolean;
}) {
  const titulo = (
    <span className="inline-flex items-center gap-2">
      <span className="text-2xl leading-none">{seccao.icone || "📚"}</span>
      <span className={cn(link && "hover:text-accent")}>{seccao.titulo}</span>
    </span>
  );
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 className="font-display text-lg font-bold text-text-hi md:text-xl">
        {link ? <Link to={`/seccao/${seccao.id}`}>{titulo}</Link> : titulo}
      </h2>
      {seccao.visibilidade === "privada" && <BadgePrivado />}
      <span className="text-xs text-text-low">
        {nCursos} {nCursos === 1 ? "curso" : "cursos"}
      </span>
    </div>
  );
}
