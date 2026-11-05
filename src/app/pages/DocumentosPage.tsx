import { useState } from "react";
import { Download, FileText, Lock, Search } from "lucide-react";
import { toast } from "sonner";

import { Documentos, Ficheiros } from "@/lib/db";
import type { Documento } from "@/lib/types";
import { tamanhoLegivel } from "@/lib/utils";
import { Badge, Carregando, EmptyState, Erro, PageHeader } from "../components/primitives";
import { useData } from "../use-data";

export default function DocumentosPage() {
  const { data, loading, error, refetch } = useData(() => Documentos.listar(), []);
  const [filtro, setFiltro] = useState("");

  if (loading) return <Carregando />;
  if (error || !data) return <Erro mensagem={error ?? "Erro"} onRetry={refetch} />;

  const categorias = [...new Set(data.map((d) => d.categoria).filter(Boolean))] as string[];

  const docs = data.filter((d) => {
    if (!filtro) return true;
    const q = filtro.toLowerCase();
    return (
      d.titulo.toLowerCase().includes(q) ||
      d.categoria?.toLowerCase().includes(q) ||
      d.ficheiro_nome.toLowerCase().includes(q)
    );
  });

  async function abrir(d: Documento) {
    try {
      const url = await Ficheiros.urlAssinado(d.storage_path);
      window.open(url, "_blank");
    } catch {
      toast.error("Não foi possível abrir o documento.");
    }
  }

  const agrupados = categorias.length > 1;
  const porCategoria = agrupados
    ? categorias.reduce(
        (acc, cat) => {
          const itens = docs.filter((d) => d.categoria === cat);
          if (itens.length) acc.push({ categoria: cat, itens });
          return acc;
        },
        [] as { categoria: string; itens: Documento[] }[],
      )
    : [];
  const semCategoria = docs.filter((d) => !d.categoria);

  return (
    <div className="page-fade-in">
      <PageHeader
        title="Documentos"
        subtitle="Guias, PDFs e materiais de apoio disponíveis para ti."
      />

      {data.length > 4 && (
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-low" />
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Pesquisar documentos..."
            className="h-10 w-full rounded-lg border border-hairline bg-bg-elevated pl-10 pr-4 text-sm text-text-hi placeholder:text-text-low focus:border-accent focus:outline-none"
          />
        </div>
      )}

      {docs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={filtro ? "Nenhum documento encontrado" : "Ainda não há documentos"}
        />
      ) : agrupados ? (
        <div className="space-y-6">
          {porCategoria.map(({ categoria, itens }) => (
            <section key={categoria}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-low">
                {categoria}
              </h2>
              <div className="app-card divide-y divide-hairline">
                {itens.map((d) => (
                  <DocRow key={d.id} doc={d} onAbrir={abrir} />
                ))}
              </div>
            </section>
          ))}
          {semCategoria.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-low">
                Outros
              </h2>
              <div className="app-card divide-y divide-hairline">
                {semCategoria.map((d) => (
                  <DocRow key={d.id} doc={d} onAbrir={abrir} />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="app-card divide-y divide-hairline">
          {docs.map((d) => (
            <DocRow key={d.id} doc={d} onAbrir={abrir} />
          ))}
        </div>
      )}
    </div>
  );
}

function DocRow({ doc, onAbrir }: { doc: Documento; onAbrir: (d: Documento) => void }) {
  return (
    <button
      onClick={() => onAbrir(doc)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent-soft/30"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft">
        <FileText className="size-5 text-accent" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-text-hi">{doc.titulo}</p>
        {doc.descricao && <p className="mt-0.5 text-xs text-text-mid line-clamp-1">{doc.descricao}</p>}
        <p className="mt-0.5 text-xs text-text-low">
          {doc.ficheiro_nome}
          {doc.tamanho ? ` · ${tamanhoLegivel(doc.tamanho)}` : ""}
        </p>
      </div>
      {doc.visibilidade === "privada" && (
        <Badge className="bg-slate-100 text-slate-700">
          <Lock className="size-3" /> Equipa
        </Badge>
      )}
      <Download className="size-4 shrink-0 text-text-low" />
    </button>
  );
}
