import { useState } from "react";
import { Check, Clock, EyeOff, Globe, Loader2, Lock, Video } from "lucide-react";
import { toast } from "sonner";
import { chamarFuncao } from "@/lib/supabase";
import { Modal } from "./Modal";
import { Badge, Button } from "./primitives";

export type VideoVimeo = {
  id: string;
  nome: string;
  url: string;
  duracao: number;
  miniatura: string | null;
  privacidade: string;
};

function formatarDuracao(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}m`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function podeEmbutir(privacidade: string) {
  return privacidade === "anybody" || privacidade === "unlisted";
}

function BadgePrivacidade({ p }: { p: string }) {
  if (p === "anybody")
    return (
      <Badge className="bg-green-50 text-green-700">
        <Globe className="size-3" /> Público
      </Badge>
    );
  if (p === "unlisted")
    return (
      <Badge className="bg-blue-50 text-blue-700">
        <EyeOff className="size-3" /> Não listado
      </Badge>
    );
  if (p === "password")
    return (
      <Badge className="bg-amber-50 text-amber-700">
        <Lock className="size-3" /> Com senha
      </Badge>
    );
  return (
    <Badge className="bg-amber-50 text-amber-700">
      <Lock className="size-3" /> Privado
    </Badge>
  );
}

export function BotaoImportarVimeo({
  onImportar,
  disabled,
}: {
  onImportar: (videos: VideoVimeo[]) => void;
  disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [videos, setVideos] = useState<VideoVimeo[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setAberto(true);
    setCarregando(true);
    setErro(null);
    setSelecionados(new Set());
    try {
      const resp = await chamarFuncao<{ ok: boolean; videos: VideoVimeo[]; total: number }>(
        "listar-vimeo",
        {},
      );
      setVideos(resp.videos);
      const embutiveis = new Set(
        resp.videos.filter((v) => podeEmbutir(v.privacidade)).map((v) => v.id),
      );
      setSelecionados(embutiveis);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar vídeos do Vimeo.";
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  }

  function alternar(id: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function selecionarTodos() {
    if (selecionados.size === videos.length) setSelecionados(new Set());
    else setSelecionados(new Set(videos.map((v) => v.id)));
  }

  function importar() {
    const escolhidos = videos.filter((v) => selecionados.has(v.id));
    if (escolhidos.length === 0) return toast.error("Seleciona pelo menos um vídeo.");
    onImportar(escolhidos);
    setAberto(false);
  }

  const nSel = selecionados.size;
  const nPriv = videos.filter((v) => selecionados.has(v.id) && !podeEmbutir(v.privacidade)).length;

  return (
    <>
      <Button
        variant="outline"
        className="h-8 px-2.5"
        onClick={carregar}
        disabled={disabled}
        title="Importar vídeos do Vimeo"
      >
        <Video className="size-4" />
        Vimeo
      </Button>

      <Modal
        open={aberto}
        onClose={() => !carregando && setAberto(false)}
        title="Importar do Vimeo"
        size="lg"
      >
        {carregando ? (
          <div className="flex flex-col items-center gap-3 py-12 text-text-low">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">A carregar vídeos do Vimeo...</p>
          </div>
        ) : erro ? (
          <div className="py-8 text-center">
            <p className="text-sm text-red-600">{erro}</p>
            <Button className="mt-4" variant="outline" onClick={carregar}>
              Tentar outra vez
            </Button>
          </div>
        ) : videos.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-low">
            Nenhum vídeo encontrado na tua conta Vimeo.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={selecionarTodos}
                className="text-sm font-medium text-accent hover:underline"
              >
                {selecionados.size === videos.length ? "Desselecionar tudo" : "Selecionar tudo"}
              </button>
              <span className="text-xs text-text-low">
                {nSel} de {videos.length} selecionado{nSel !== 1 ? "s" : ""}
                {nPriv > 0 && (
                  <span className="text-amber-600">
                    {" "}
                    · {nPriv} privado{nPriv !== 1 ? "s" : ""}
                  </span>
                )}
              </span>
            </div>

            <div className="max-h-[400px] space-y-1 overflow-y-auto rounded-lg border border-hairline p-1">
              {videos.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => alternar(v.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                    selecionados.has(v.id)
                      ? "border-accent bg-accent-soft"
                      : "border-transparent hover:bg-bg-base"
                  }`}
                >
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded border ${
                      selecionados.has(v.id)
                        ? "border-accent bg-accent text-white"
                        : "border-text-low"
                    }`}
                  >
                    {selecionados.has(v.id) && <Check className="size-3.5" />}
                  </span>

                  <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-slate-200">
                    {v.miniatura ? (
                      <img
                        src={v.miniatura}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-slate-400">
                        <Video className="size-4" />
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text-hi">
                      {v.nome}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-text-low">
                      <Clock className="size-3" /> {formatarDuracao(v.duracao)}
                    </span>
                  </span>

                  <BadgePrivacidade p={v.privacidade} />
                </button>
              ))}
            </div>

            {nPriv > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Vídeos privados não tocam na academia. No Vimeo, vai a cada vídeo → Definições →
                Privacidade → escolhe <strong>Ocultar em vimeo.com</strong> (não listado).
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={importar} disabled={nSel === 0}>
                Importar {nSel} vídeo{nSel !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
