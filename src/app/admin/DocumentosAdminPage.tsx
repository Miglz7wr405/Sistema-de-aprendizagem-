import { useRef, useState } from "react";
import {
  Download,
  FileText,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Documentos, Ficheiros, LIMITE_UPLOAD } from "@/lib/db";
import type { Documento, Visibilidade } from "@/lib/types";
import { tamanhoLegivel } from "@/lib/utils";
import { Field, Input, Modal, Textarea } from "../components/Modal";
import { Badge, Button, Carregando, EmptyState, Erro, PageHeader } from "../components/primitives";
import { useData } from "../use-data";
import { EscolhaVisibilidade } from "./Visibilidade";

type FormDoc = {
  titulo: string;
  descricao: string;
  categoria: string;
  visibilidade: Visibilidade;
};

const VAZIO: FormDoc = {
  titulo: "",
  descricao: "",
  categoria: "",
  visibilidade: "academia",
};

export default function DocumentosAdminPage() {
  const { data, loading, error, refetch } = useData(() => Documentos.listar(), []);
  const [editar, setEditar] = useState<Documento | "novo" | null>(null);
  const [form, setForm] = useState<FormDoc>(VAZIO);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (loading) return <Carregando />;
  if (error || !data) return <Erro mensagem={error ?? "Erro"} onRetry={refetch} />;

  function abrir(d: Documento | "novo") {
    setEditar(d);
    setFicheiro(null);
    setForm(
      d === "novo"
        ? VAZIO
        : {
            titulo: d.titulo,
            descricao: d.descricao ?? "",
            categoria: d.categoria ?? "",
            visibilidade: d.visibilidade,
          },
    );
  }

  async function guardar() {
    if (!form.titulo.trim()) return toast.error("Dá um título ao documento.");
    if (editar === "novo" && !ficheiro) return toast.error("Escolhe um ficheiro.");
    if (ficheiro && ficheiro.size > LIMITE_UPLOAD)
      return toast.error("Ficheiro demasiado grande (máx. 50 MB).");

    setBusy(true);
    try {
      let storagePath: string | undefined;
      if (ficheiro) {
        storagePath = await Ficheiros.enviar("documentos", ficheiro);
      }

      const dados: Partial<Documento> = {
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim() || null,
        categoria: form.categoria.trim() || null,
        visibilidade: form.visibilidade,
      };

      if (editar === "novo") {
        await Documentos.criar({
          ...dados,
          storage_path: storagePath!,
          ficheiro_nome: ficheiro!.name,
          ficheiro_tipo: ficheiro!.type || null,
          tamanho: ficheiro!.size,
          ordem: data!.length,
        });
      } else if (editar) {
        if (storagePath) {
          await Ficheiros.apagar(editar.storage_path);
          dados.storage_path = storagePath;
          dados.ficheiro_nome = ficheiro!.name;
          dados.ficheiro_tipo = ficheiro!.type || null;
          dados.tamanho = ficheiro!.size;
        }
        await Documentos.atualizar(editar.id, dados);
      }

      toast.success("Documento guardado");
      setEditar(null);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function apagar(d: Documento) {
    if (!confirm(`Apagar "${d.titulo}"? O ficheiro será eliminado.`)) return;
    try {
      await Documentos.apagar(d);
      toast.success("Documento apagado");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function descarregar(d: Documento) {
    try {
      const url = await Ficheiros.urlAssinado(d.storage_path);
      window.open(url, "_blank");
    } catch (e) {
      toast.error("Não foi possível obter o link.");
    }
  }

  const categorias = [...new Set(data.map((d) => d.categoria).filter(Boolean))] as string[];

  return (
    <div className="page-fade-in">
      <PageHeader
        title="Documentos"
        subtitle="Guias, PDFs e materiais de apoio. Define cada documento como público (toda a academia) ou privado (só equipa)."
        action={
          <Button onClick={() => abrir("novo")}>
            <Plus className="size-4" /> Novo documento
          </Button>
        }
      />
      {data.length === 0 ? (
        <EmptyState icon={FileText} title="Ainda não há documentos" />
      ) : (
        <div className="app-card divide-y divide-hairline">
          {data.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="grid size-10 place-items-center rounded-full bg-accent-soft">
                <FileText className="size-5 text-accent" />
              </span>
              <div className="min-w-[160px] flex-1">
                <p className="font-medium text-text-hi">{d.titulo}</p>
                <p className="text-xs text-text-mid">
                  {d.ficheiro_nome}
                  {d.tamanho ? ` · ${tamanhoLegivel(d.tamanho)}` : ""}
                  {d.categoria ? ` · ${d.categoria}` : ""}
                </p>
              </div>
              {d.visibilidade === "privada" ? (
                <Badge className="bg-slate-100 text-slate-700">
                  <Lock className="size-3" /> Só equipa
                </Badge>
              ) : (
                <Badge className="bg-green-50 text-green-700">Público</Badge>
              )}
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => descarregar(d)}
                  aria-label="Descarregar"
                >
                  <Download className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => abrir(d)}
                  aria-label="Editar"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 px-2 hover:text-red-600"
                  onClick={() => apagar(d)}
                  aria-label="Apagar"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editar !== null}
        onClose={() => setEditar(null)}
        title={editar === "novo" ? "Novo documento" : "Editar documento"}
      >
        <div className="space-y-4">
          <Field label="Título" required>
            <Input
              value={form.titulo}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex.: Guia de Prospecção"
            />
          </Field>
          <Field label="Descrição">
            <Textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className="min-h-[70px]"
              placeholder="Breve descrição do conteúdo..."
            />
          </Field>
          <Field label="Categoria">
            <Input
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              placeholder="Ex.: Prospecção, Marketing, Vendas"
              list="categorias-doc"
            />
            {categorias.length > 0 && (
              <datalist id="categorias-doc">
                {categorias.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium text-text-hi">
              Ficheiro {editar === "novo" ? "*" : "(substituir)"}
            </p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed border-hairline p-3 text-sm text-text-mid transition hover:border-accent hover:bg-accent-soft/30"
            >
              <Upload className="size-5 text-accent" />
              {ficheiro ? (
                <span className="truncate text-text-hi">{ficheiro.name}</span>
              ) : editar !== "novo" && editar ? (
                <span>Manter ficheiro actual ({(editar as Documento).ficheiro_nome})</span>
              ) : (
                <span>Clica para escolher um ficheiro</span>
              )}
            </button>
          </div>
          <EscolhaVisibilidade
            valor={form.visibilidade}
            onChange={(v) => setForm({ ...form, visibilidade: v })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditar(null)}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={busy}>
              {busy ? "A guardar..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
