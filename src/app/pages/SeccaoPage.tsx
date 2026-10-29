import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FolderOpen, Pencil } from "lucide-react";

import { useAuth } from "../auth";
import { CabecalhoSeccao, CursoCard } from "../components/Catalogo";
import { Button, Carregando, EmptyState, Erro } from "../components/primitives";
import { useCatalogo } from "../use-catalogo";

export default function SeccaoPage() {
  const { id = "" } = useParams();
  const { eAdmin } = useAuth();
  const { data: cat, loading, error, refetch } = useCatalogo();

  if (loading) return <Carregando />;
  if (error || !cat) return <Erro mensagem={error ?? "Erro"} onRetry={refetch} />;

  const seccao = cat.seccoes.find((s) => s.id === id);
  if (!seccao) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Secção não encontrada"
        description="Pode ter sido apagada ou não tens acesso a ela."
        action={
          <Link to="/">
            <Button variant="outline">Voltar ao início</Button>
          </Link>
        }
      />
    );
  }
  const cursos = cat.cursos.filter((c) => c.seccao_id === id);

  return (
    <div className="page-fade-in">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-text-mid hover:text-accent"
      >
        <ArrowLeft className="size-4" /> Início
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CabecalhoSeccao seccao={seccao} nCursos={cursos.length} />
        {eAdmin && (
          <Link to={`/admin/conteudo?seccao=${seccao.id}`}>
            <Button variant="outline">
              <Pencil className="size-4" /> Editar
            </Button>
          </Link>
        )}
      </div>
      {seccao.descricao && (
        <p className="mb-5 max-w-2xl text-sm text-text-mid">{seccao.descricao}</p>
      )}
      {cursos.length === 0 ? (
        <EmptyState icon={FolderOpen} title="Ainda sem cursos nesta secção" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cursos.map((c) => (
            <CursoCard key={c.id} cat={cat} curso={c} />
          ))}
        </div>
      )}
    </div>
  );
}
