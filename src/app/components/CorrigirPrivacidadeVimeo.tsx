// Botão + modal "Corrigir privacidade Vimeo": muda a privacidade de vários vídeos de
// uma vez (de "privado/nobody" para "público/anybody" ou "unlisted"), via Vimeo API,
// para o leitor embutido parar de pedir login ao aluno.
import { useMemo, useState } from "react";
import { Loader2, Video } from "lucide-react";
import { toast } from "sonner";

import { chamarFuncao } from "@/lib/supabase";
import type { Aula } from "@/lib/types";
import { Modal } from "./Modal";
import { Button } from "./primitives";

type Privacidade = "anybody" | "unlisted";
type Resultado = { ok: boolean; sucesso: number; total: number };

function vimeoId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export function BotaoCorrigirPrivacidadeVimeo({
  aulas,
  disabled,
}: {
  aulas: Aula[];
  disabled?: boolean;
}) {
  const vimeos = useMemo(() => {
    const unicos = new Map<string, Aula>();
    for (const a of aulas) {
      const id = vimeoId(a.url);
      if (id && !unicos.has(id)) unicos.set(id, a);
    }
    return Array.from(unicos.entries()).map(([id, aula]) => ({ id, aula }));
  }, [aulas]);

  const [aberto, setAberto] = useState(false);
  const [privacidade, setPrivacidade] = useState<Privacidade>("anybody");
  const [download, setDownload] = useState(true);
  const [executando, setExecutando] = useState(false);

  if (vimeos.length === 0) return null;

  async function aplicar() {
    setExecutando(true);
    try {
      const r = await chamarFuncao<Resultado>("vimeo-privacidade", {
        video_ids: vimeos.map((v) => v.id),
        privacidade,
        download,
      });
      if (r.sucesso === r.total) {
        toast.success(`${r.sucesso} vídeo${r.sucesso === 1 ? "" : "s"} atualizado(s) no Vimeo.`);
      } else {
        toast.warning(`${r.sucesso} de ${r.total} atualizados. Verifica os que falharam.`);
      }
      setAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro a chamar o Vimeo.");
    } finally {
      setExecutando(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-8 px-2.5"
        onClick={() => setAberto(true)}
        disabled={disabled}
        title="Mudar a privacidade dos vídeos Vimeo deste curso para pararem de pedir login"
      >
        <Video className="size-4" />
        Privacidade Vimeo
      </Button>

      <Modal
        open={aberto}
        onClose={() => !executando && setAberto(false)}
        title="Corrigir privacidade Vimeo"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-mid">
            Vão ser alterados <strong>{vimeos.length}</strong> vídeos do Vimeo deste curso. É
            preciso que o <code>VIMEO_TOKEN</code> esteja nos Secrets do Supabase.
          </p>

          <div>
            <p className="mb-1.5 text-sm font-medium text-text-hi">Privacidade</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPrivacidade("anybody")}
                className={`rounded-lg border p-3 text-left ${
                  privacidade === "anybody"
                    ? "border-accent bg-accent-soft"
                    : "border-hairline hover:border-accent/50"
                }`}
              >
                <span className="block text-sm font-semibold text-text-hi">Público (anybody)</span>
                <span className="block text-xs text-text-mid">
                  Qualquer pessoa vê sem login. Recomendado pelo dono.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPrivacidade("unlisted")}
                className={`rounded-lg border p-3 text-left ${
                  privacidade === "unlisted"
                    ? "border-accent bg-accent-soft"
                    : "border-hairline hover:border-accent/50"
                }`}
              >
                <span className="block text-sm font-semibold text-text-hi">
                  Não listado (unlisted)
                </span>
                <span className="block text-xs text-text-mid">
                  Só vê quem tem o link. Também não pede login.
                </span>
              </button>
            </div>
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-hairline p-3">
            <input
              type="checkbox"
              checked={download}
              onChange={(e) => setDownload(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium text-text-hi">
                Permitir download no Vimeo
              </span>
              <span className="block text-xs text-text-mid">
                Depende do plano Vimeo. Se o plano não tiver download, este ajuste é ignorado.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAberto(false)} disabled={executando}>
              Cancelar
            </Button>
            <Button onClick={aplicar} disabled={executando}>
              {executando ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> A aplicar...
                </>
              ) : (
                `Aplicar a ${vimeos.length}`
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
