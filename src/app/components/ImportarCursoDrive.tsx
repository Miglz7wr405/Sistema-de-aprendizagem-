import { useState } from "react";
import { FolderDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { chamarFuncao } from "@/lib/supabase";
import { Field, Input, Modal, Switch } from "./Modal";
import { Button } from "./primitives";

type Previa = {
  titulo: string;
  total: number;
  modulos: Array<{ titulo: string | null; aulas: Array<{ titulo: string; url: string }> }>;
};

/** Cria um curso inteiro a partir do link de uma pasta do Google Drive (subpastas = módulos). */
export function BotaoImportarCursoDrive({
  seccaoId,
  onCriado,
}: {
  seccaoId: string;
  onCriado: (cursoId: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [link, setLink] = useState("");
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [titulo, setTitulo] = useState("");
  const [publicar, setPublicar] = useState(true);
  const [ocupado, setOcupado] = useState<"ler" | "criar" | null>(null);

  function fechar() {
    setAberto(false);
    setLink("");
    setPrevia(null);
    setTitulo("");
    setPublicar(true);
  }

  async function ler() {
    if (!link.trim()) return toast.error("Cola o link da pasta do Google Drive.");
    setOcupado("ler");
    try {
      const r = await chamarFuncao<Previa>("importar-drive", { acao: "ler", link });
      setPrevia(r);
      setTitulo(r.titulo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler a pasta.");
    } finally {
      setOcupado(null);
    }
  }

  async function criar() {
    if (!previa || !titulo.trim()) return;
    setOcupado("criar");
    try {
      const r = await chamarFuncao<{ curso_id: string; aulas: number }>("importar-drive", {
        acao: "criar",
        seccao_id: seccaoId,
        titulo: titulo.trim(),
        publicar,
        modulos: previa.modulos,
      });
      toast.success(`Curso criado com ${r.aulas} aulas.`);
      fechar();
      onCriado(r.curso_id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o curso.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <>
      <Button variant="outline" className="h-8 px-2.5" onClick={() => setAberto(true)} title="Criar curso a partir de uma pasta do Google Drive">
        <FolderDown className="size-4" /> Drive
      </Button>
      <Modal open={aberto} onClose={fechar} title="Importar curso do Google Drive">
        {!previa ? (
          <div className="space-y-4">
            <p className="text-sm text-text-mid">
              Cola o link da pasta do curso. Cada subpasta vira um módulo e cada vídeo uma aula. A pasta tem de
              estar partilhada como <strong>“Qualquer pessoa com o link”</strong>.
            </p>
            <Field label="Link da pasta">
              <Input
                semVoz
                placeholder="https://drive.google.com/drive/folders/…"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ler()}
              />
            </Field>
            <div className="flex justify-end">
              <Button onClick={ler} disabled={ocupado !== null}>
                {ocupado === "ler" ? <Loader2 className="size-4 animate-spin" /> : <FolderDown className="size-4" />}
                {ocupado === "ler" ? "A ler a pasta…" : "Ler pasta"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Título do curso" required>
              <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </Field>
            <p className="text-sm text-text-mid">
              Encontrei <strong>{previa.total} vídeos</strong>
              {previa.modulos.some((m) => m.titulo) &&
                ` em ${previa.modulos.filter((m) => m.titulo).length} módulos`}
              .
            </p>
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-hairline p-3">
              {previa.modulos.map((m, i) => (
                <div key={i}>
                  {m.titulo && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">{m.titulo}</p>}
                  <ol className="space-y-0.5 text-sm text-text-hi">
                    {m.aulas.map((a) => (
                      <li key={a.url} className="truncate">· {a.titulo}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            <label className="flex items-center justify-between gap-3 text-sm text-text-hi">
              Publicar já para os alunos
              <Switch checked={publicar} onChange={setPublicar} />
            </label>
            <p className="text-xs text-text-low">
              Depois de criado, podes usar “Organizar com IA” e “Gerar títulos” no curso para dar nomes e módulos
              automáticos às aulas.
            </p>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setPrevia(null)} disabled={ocupado !== null}>
                Voltar
              </Button>
              <Button onClick={criar} disabled={ocupado !== null || !titulo.trim()}>
                {ocupado === "criar" && <Loader2 className="size-4 animate-spin" />}
                {ocupado === "criar" ? "A criar…" : "Criar curso"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
