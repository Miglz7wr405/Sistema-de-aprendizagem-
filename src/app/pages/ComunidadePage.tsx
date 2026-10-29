import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  FileText,
  Lock,
  Megaphone,
  MessagesSquare,
  Mic,
  Paperclip,
  Reply,
  Send,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { Ficheiros, Grupos, LIMITE_UPLOAD, Mensagens } from "@/lib/db";
import type { Grupo, Mensagem, ResumoGrupo } from "@/lib/types";
import { PAPEL_LABEL } from "@/lib/types";
import { cn, dia, duracaoLegivel, hora, tamanhoLegivel, tempoRelativo } from "@/lib/utils";
import { useAuth } from "../auth";
import { Carregando, EmptyState } from "../components/primitives";
import { formatoDeGravacao, MicButton } from "../components/Voz";

const CORES_NOMES = [
  "text-blue-700",
  "text-emerald-700",
  "text-violet-700",
  "text-orange-700",
  "text-pink-700",
  "text-teal-700",
  "text-indigo-700",
  "text-rose-700",
];

function corDoNome(nome: string) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES_NOMES[h % CORES_NOMES.length];
}

function resumoMensagem(m: Pick<Mensagem, "texto" | "ficheiro_tipo" | "ficheiro_nome">) {
  if (m.texto.trim()) return m.texto;
  if (m.ficheiro_tipo?.startsWith("audio/")) return "🎤 Mensagem de voz";
  if (m.ficheiro_tipo?.startsWith("image/")) return "📷 Imagem";
  if (m.ficheiro_tipo?.startsWith("video/")) return "🎬 Vídeo";
  return `📎 ${m.ficheiro_nome ?? "Ficheiro"}`;
}

// ─── Lista de grupos ─────────────────────────────────────────────────────

function ListaGrupos({
  grupos,
  resumo,
  ativo,
}: {
  grupos: Grupo[];
  resumo: Record<string, ResumoGrupo>;
  ativo?: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-hairline px-4 py-3">
        <h2 className="font-display text-lg font-bold text-text-hi">Comunidade</h2>
        <p className="text-xs text-text-low">Grupos para conversar, partilhar e tirar dúvidas.</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {grupos.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-text-low">Ainda não há grupos.</p>
        )}
        {grupos.map((g) => {
          const r = resumo[g.id];
          return (
            <Link
              key={g.id}
              to={`/comunidade/${g.id}`}
              className={cn(
                "flex items-center gap-3 border-b border-hairline px-4 py-3 transition hover:bg-accent-soft/40",
                ativo === g.id && "bg-accent-soft/70",
              )}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-xl">
                {g.icone || "💬"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-text-hi">{g.nome}</span>
                  {g.visibilidade === "privada" && (
                    <Lock className="size-3 shrink-0 text-text-low" />
                  )}
                  {g.so_admins_escrevem && <Megaphone className="size-3 shrink-0 text-text-low" />}
                  {r?.ultima_em && (
                    <span className="ml-auto shrink-0 text-[11px] text-text-low">
                      {tempoRelativo(r.ultima_em)}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 flex items-center gap-2">
                  <span className="truncate text-xs text-text-mid">
                    {r?.ultima_texto
                      ? `${r.ultima_autor ? r.ultima_autor.split(" ")[0] + ": " : ""}${r.ultima_texto}`
                      : (g.descricao ?? "Sem mensagens ainda")}
                  </span>
                  {r && r.por_ler > 0 && (
                    <span className="ml-auto grid min-w-[20px] shrink-0 place-items-center rounded-full bg-green-500 px-1.5 text-[11px] font-bold leading-5 text-white">
                      {r.por_ler > 99 ? "99+" : r.por_ler}
                    </span>
                  )}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Anexos ──────────────────────────────────────────────────────────────

function Anexo({ m, url, minha }: { m: Mensagem; url?: string; minha: boolean }) {
  if (!m.ficheiro_path) return null;
  const tipo = m.ficheiro_tipo ?? "";
  if (!url) return <div className="h-10 w-48 animate-pulse rounded-lg bg-black/10" />;
  if (tipo.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block">
        <img src={url} alt={m.ficheiro_nome ?? ""} className="max-h-72 rounded-lg object-cover" />
      </a>
    );
  }
  if (tipo.startsWith("audio/")) {
    return (
      <div className="flex items-center gap-2">
        <audio src={url} controls preload="metadata" className="h-10 max-w-[240px]" />
        {m.duracao ? (
          <span className={cn("text-[11px]", minha ? "text-white/80" : "text-text-low")}>
            {duracaoLegivel(m.duracao)}
          </span>
        ) : null}
      </div>
    );
  }
  if (tipo.startsWith("video/")) {
    return <video src={url} controls playsInline className="max-h-72 rounded-lg" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
        minha ? "bg-white/15" : "bg-chat",
      )}
    >
      <FileText className="size-5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{m.ficheiro_nome}</span>
      <span className="text-[11px] opacity-70">{tamanhoLegivel(m.tamanho)}</span>
      <Download className="size-4 shrink-0" />
    </a>
  );
}

// ─── Conversa ────────────────────────────────────────────────────────────

type Pendente = { file: File; duracao?: number };

function Conversa({ grupo, onLido }: { grupo: Grupo; onLido: () => void }) {
  const { sessao, eAdmin } = useAuth();
  const userId = sessao?.user.id ?? "";
  const navigate = useNavigate();
  const [mensagens, setMensagens] = useState<Mensagem[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [texto, setTexto] = useState("");
  const [respondendo, setRespondendo] = useState<Mensagem | null>(null);
  const [anexo, setAnexo] = useState<Pendente | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const fimRef = useRef<HTMLDivElement>(null);
  const caixaTexto = useRef<HTMLTextAreaElement>(null);
  const ficheiroRef = useRef<HTMLInputElement>(null);
  const gravadorRef = useRef<MediaRecorder | null>(null);
  const cancelarRef = useRef(false);

  const podeEscrever = !grupo.so_admins_escrevem || eAdmin;

  const assinar = useCallback(async (lista: Mensagem[]) => {
    const caminhos = lista.map((m) => m.ficheiro_path).filter(Boolean) as string[];
    const falta = caminhos.filter((c) => !urls[c]);
    if (falta.length === 0) return;
    try {
      const novos = await Ficheiros.urlsAssinados(falta, 60 * 60 * 6);
      setUrls((prev) => ({ ...prev, ...novos }));
    } catch {
      /* sem acesso aos ficheiros */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega + escuta mensagens novas em tempo real.
  useEffect(() => {
    let ativo = true;
    setMensagens(null);
    setRespondendo(null);
    Mensagens.doGrupo(grupo.id)
      .then((lista) => {
        if (!ativo) return;
        setMensagens(lista);
        assinar(lista);
      })
      .catch((e) => toast.error(e.message));
    Grupos.marcarLido(userId, grupo.id).then(onLido);

    const canal = supabase
      .channel(`grupo-${grupo.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `grupo_id=eq.${grupo.id}`,
        },
        (p) => {
          const m = p.new as Mensagem;
          setMensagens((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, m] : prev));
          assinar([m]);
          Grupos.marcarLido(userId, grupo.id).then(onLido);
        },
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "mensagens" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) setMensagens((prev) => prev?.filter((x) => x.id !== id) ?? prev);
      })
      .subscribe();
    return () => {
      ativo = false;
      supabase.removeChannel(canal);
    };
  }, [grupo.id, userId, assinar, onLido]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens?.length]);

  useEffect(() => {
    if (!gravando) return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [gravando]);

  // Ajusta a altura da caixa de texto ao conteúdo.
  useEffect(() => {
    const el = caixaTexto.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [texto]);

  async function enviar() {
    if (aEnviar) return;
    const corpo = texto.trim();
    if (!corpo && !anexo) return;
    setAEnviar(true);
    try {
      let ficheiro: Partial<Mensagem> = {};
      if (anexo) {
        if (anexo.file.size > LIMITE_UPLOAD) throw new Error("O ficheiro é maior que 50 MB.");
        const caminho = await Ficheiros.enviar(`chat/${grupo.id}`, anexo.file);
        ficheiro = {
          ficheiro_path: caminho,
          ficheiro_nome: anexo.file.name,
          ficheiro_tipo: anexo.file.type || "application/octet-stream",
          tamanho: anexo.file.size,
          duracao: anexo.duracao ?? null,
        };
      }
      const nova = await Mensagens.enviar({
        grupo_id: grupo.id,
        texto: corpo,
        responde_a: respondendo?.id ?? null,
        ...ficheiro,
      });
      setMensagens((prev) =>
        prev && !prev.some((x) => x.id === nova.id) ? [...prev, nova] : prev,
      );
      assinar([nova]);
      setTexto("");
      setAnexo(null);
      setRespondendo(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setAEnviar(false);
    }
  }

  async function apagar(m: Mensagem) {
    if (!confirm("Apagar esta mensagem para todos?")) return;
    try {
      await Mensagens.apagar(m);
      setMensagens((prev) => prev?.filter((x) => x.id !== m.id) ?? prev);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao apagar");
    }
  }

  async function comecarGravacao() {
    const formato = formatoDeGravacao();
    if (!formato || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Este telemóvel não permite gravar áudio no navegador.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, formato.mime ? { mimeType: formato.mime } : undefined);
      const pedacos: BlobPart[] = [];
      const inicio = Date.now();
      cancelarRef.current = false;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) pedacos.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setGravando(false);
        setSegundos(0);
        if (cancelarRef.current) return;
        const tipo = rec.mimeType || formato.mime || "audio/webm";
        const blob = new Blob(pedacos, { type: tipo });
        if (blob.size === 0) return;
        setAnexo({
          file: new File([blob], `voz-${Date.now()}.${formato.ext}`, { type: tipo }),
          duracao: Math.max(1, Math.round((Date.now() - inicio) / 1000)),
        });
      };
      rec.start();
      gravadorRef.current = rec;
      setSegundos(0);
      setGravando(true);
    } catch {
      toast.error("Sem acesso ao microfone. Autoriza nas definições do navegador.");
    }
  }

  function pararGravacao(cancelar = false) {
    cancelarRef.current = cancelar;
    gravadorRef.current?.stop();
    gravadorRef.current = null;
  }

  const porId = useMemo(() => {
    const m = new Map<string, Mensagem>();
    for (const x of mensagens ?? []) m.set(x.id, x);
    return m;
  }, [mensagens]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-hairline bg-bg-elevated px-3 py-2.5">
        <button
          onClick={() => navigate("/comunidade")}
          className="grid size-9 place-items-center rounded-lg text-text-mid hover:bg-accent-soft lg:hidden"
          aria-label="Voltar aos grupos"
        >
          <ArrowLeft className="size-5" />
        </button>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-lg">
          {grupo.icone || "💬"}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-semibold text-text-hi">
            {grupo.nome}
            {grupo.visibilidade === "privada" && <Lock className="size-3.5 text-text-low" />}
          </p>
          {grupo.descricao && <p className="truncate text-xs text-text-low">{grupo.descricao}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-chat px-3 py-4 md:px-6">
        {mensagens === null ? (
          <Carregando />
        ) : mensagens.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xs rounded-xl bg-bg-elevated px-4 py-3 text-center text-sm text-text-mid shadow-sm">
            Ainda não há mensagens. Diz olá! 👋
          </div>
        ) : (
          mensagens.map((m, i) => {
            const minha = m.autor_id === userId;
            const anterior = mensagens[i - 1];
            const novoDia = !anterior || dia(anterior.created_at) !== dia(m.created_at);
            const mesmoAutor =
              !novoDia &&
              anterior?.autor_id === m.autor_id &&
              new Date(m.created_at).getTime() - new Date(anterior.created_at).getTime() < 5 * 60e3;
            const citada = m.responde_a ? porId.get(m.responde_a) : null;
            return (
              <Fragment key={m.id}>
                {novoDia && (
                  <div className="my-3 flex justify-center">
                    <span className="rounded-lg bg-bg-elevated px-3 py-1 text-[11px] font-medium capitalize text-text-mid shadow-sm">
                      {dia(m.created_at)}
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    "group flex",
                    minha ? "justify-end" : "justify-start",
                    mesmoAutor ? "mt-0.5" : "mt-2.5",
                  )}
                >
                  <div
                    className={cn(
                      "relative max-w-[85%] rounded-2xl px-3 py-2 shadow-sm md:max-w-[70%]",
                      minha
                        ? "rounded-br-md bg-accent text-white"
                        : "rounded-bl-md bg-bg-elevated text-text-hi",
                    )}
                  >
                    {!minha && !mesmoAutor && (
                      <p className={cn("mb-0.5 text-xs font-semibold", corDoNome(m.autor_nome))}>
                        {m.autor_nome}
                        {m.autor_papel && m.autor_papel !== "aluno" && (
                          <span className="ml-1.5 rounded bg-accent-soft px-1 py-px text-[9px] font-semibold uppercase text-accent">
                            {m.autor_papel === "admin" ? "Admin" : PAPEL_LABEL[m.autor_papel]}
                          </span>
                        )}
                      </p>
                    )}
                    {m.responde_a && (
                      <div
                        className={cn(
                          "mb-1.5 rounded-lg border-l-4 px-2 py-1 text-xs",
                          minha ? "border-white/60 bg-white/15" : "border-accent bg-chat",
                        )}
                      >
                        <p className="font-semibold">{citada?.autor_nome ?? "Mensagem"}</p>
                        <p className="line-clamp-2 opacity-80">
                          {citada ? resumoMensagem(citada) : "Mensagem apagada"}
                        </p>
                      </div>
                    )}
                    {m.ficheiro_path && (
                      <div className="mb-1">
                        <Anexo m={m} url={urls[m.ficheiro_path]} minha={minha} />
                      </div>
                    )}
                    {m.texto && (
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {m.texto}
                      </p>
                    )}
                    <div
                      className={cn(
                        "mt-0.5 flex items-center justify-end gap-2 text-[10px]",
                        minha ? "text-white/70" : "text-text-low",
                      )}
                    >
                      <span>{hora(m.created_at)}</span>
                    </div>
                    <div
                      className={cn(
                        "absolute top-1 hidden gap-0.5 rounded-lg bg-bg-elevated p-0.5 text-text-mid shadow group-hover:flex",
                        minha ? "-left-16" : "-right-16",
                      )}
                    >
                      {podeEscrever && (
                        <button
                          onClick={() => {
                            setRespondendo(m);
                            caixaTexto.current?.focus();
                          }}
                          className="grid size-7 place-items-center rounded-md hover:bg-accent-soft hover:text-accent"
                          aria-label="Responder"
                        >
                          <Reply className="size-3.5" />
                        </button>
                      )}
                      {(minha || eAdmin) && (
                        <button
                          onClick={() => apagar(m)}
                          className="grid size-7 place-items-center rounded-md hover:bg-red-50 hover:text-red-600"
                          aria-label="Apagar"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      {podeEscrever ? (
        <div
          className="border-t border-hairline bg-bg-elevated px-2 py-2 md:px-4"
          style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
        >
          {respondendo && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border-l-4 border-accent bg-chat px-3 py-1.5 text-xs">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-accent">A responder a {respondendo.autor_nome}</p>
                <p className="truncate text-text-mid">{resumoMensagem(respondendo)}</p>
              </div>
              <button onClick={() => setRespondendo(null)} aria-label="Cancelar resposta">
                <X className="size-4 text-text-low" />
              </button>
            </div>
          )}
          {anexo && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-chat px-3 py-2 text-sm">
              {anexo.file.type.startsWith("audio/") ? (
                <Mic className="size-4 text-accent" />
              ) : (
                <Paperclip className="size-4 text-accent" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {anexo.file.type.startsWith("audio/")
                  ? `Mensagem de voz (${duracaoLegivel(anexo.duracao)})`
                  : anexo.file.name}
              </span>
              <span className="text-xs text-text-low">{tamanhoLegivel(anexo.file.size)}</span>
              <button onClick={() => setAnexo(null)} aria-label="Remover anexo">
                <X className="size-4 text-text-low" />
              </button>
            </div>
          )}
          {gravando ? (
            <div className="flex items-center gap-3 px-2 py-1.5">
              <span className="size-3 animate-pulse rounded-full bg-red-500" />
              <span className="text-sm font-medium text-text-hi">
                A gravar... {duracaoLegivel(segundos)}
              </span>
              <button
                onClick={() => pararGravacao(true)}
                className="ml-auto rounded-lg px-3 py-2 text-sm text-text-mid hover:bg-red-50 hover:text-red-600"
              >
                Cancelar
              </button>
              <button
                onClick={() => pararGravacao(false)}
                className="grid size-10 place-items-center rounded-full bg-accent text-white"
                aria-label="Parar gravação"
              >
                <Square className="size-4 fill-current" />
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-1.5">
              <input
                ref={ficheiroRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > LIMITE_UPLOAD) toast.error("O ficheiro é maior que 50 MB.");
                    else setAnexo({ file: f });
                  }
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => ficheiroRef.current?.click()}
                className="grid size-10 shrink-0 place-items-center rounded-full text-text-mid hover:bg-accent-soft hover:text-accent"
                aria-label="Anexar ficheiro"
                title="Anexar foto, vídeo ou ficheiro"
              >
                <Paperclip className="size-5" />
              </button>
              <div className="relative flex min-w-0 flex-1 items-end rounded-2xl border border-hairline bg-bg-base pr-1">
                <textarea
                  ref={caixaTexto}
                  rows={1}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      window.matchMedia("(min-width: 768px)").matches
                    ) {
                      e.preventDefault();
                      enviar();
                    }
                  }}
                  placeholder="Escreve ou dita uma mensagem..."
                  className="max-h-40 min-h-[40px] w-full resize-none bg-transparent px-3.5 py-2.5 text-sm text-text-hi outline-none placeholder:text-text-low"
                />
                <MicButton alvo={caixaTexto} className="mb-1" titulo="Ditar mensagem" />
              </div>
              {texto.trim() || anexo ? (
                <button
                  onClick={enviar}
                  disabled={aEnviar}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white shadow-sm hover:bg-accent-dim disabled:opacity-60"
                  aria-label="Enviar"
                >
                  <Send className="size-[18px]" />
                </button>
              ) : (
                <button
                  onClick={comecarGravacao}
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-white shadow-sm hover:bg-accent-dim"
                  aria-label="Gravar mensagem de voz"
                  title="Gravar mensagem de voz"
                >
                  <Mic className="size-[18px]" />
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="border-t border-hairline bg-bg-elevated px-4 py-3 text-center text-xs text-text-low">
          <Megaphone className="mr-1 inline size-3.5" /> Só os administradores podem escrever neste
          grupo.
        </div>
      )}
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────

export default function ComunidadePage() {
  const { grupoId } = useParams();
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [resumo, setResumo] = useState<Record<string, ResumoGrupo>>({});

  const carregarResumo = useCallback(async () => {
    try {
      const r = await Grupos.resumo();
      setResumo(Object.fromEntries(r.map((x) => [x.grupo_id, x])));
    } catch {
      /* tenta na próxima */
    }
  }, []);

  useEffect(() => {
    Grupos.listar()
      .then(setGrupos)
      .catch((e) => {
        toast.error(e.message);
        setGrupos([]);
      });
    carregarResumo();
    // Qualquer mensagem nova em qualquer grupo atualiza a lista (por ler / última mensagem).
    const canal = supabase
      .channel("comunidade-resumo")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, () =>
        carregarResumo(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregarResumo]);

  const ordenados = useMemo(() => {
    if (!grupos) return [];
    return [...grupos].sort((a, b) => {
      const ua = resumo[a.id]?.ultima_em ?? "";
      const ub = resumo[b.id]?.ultima_em ?? "";
      if (ua !== ub) return ub.localeCompare(ua);
      return a.ordem - b.ordem;
    });
  }, [grupos, resumo]);

  if (grupos === null) return <Carregando />;
  const ativo = grupos.find((g) => g.id === grupoId);

  if (grupos.length === 0) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="Ainda não há grupos"
        description="Os administradores podem criar grupos em Administração → Grupos."
      />
    );
  }

  return (
    <div
      className={cn(
        "flex overflow-hidden bg-bg-elevated lg:h-[calc(100dvh-7rem)] lg:rounded-2xl lg:border lg:border-hairline",
        grupoId ? "h-[100dvh]" : "h-[calc(100dvh-4rem)]",
      )}
    >
      <div
        className={cn(
          "w-full shrink-0 border-r border-hairline lg:block lg:w-[340px]",
          grupoId ? "hidden" : "block pb-16 lg:pb-0",
        )}
      >
        <ListaGrupos grupos={ordenados} resumo={resumo} ativo={grupoId} />
      </div>
      <div
        className={cn("min-w-0 flex-1", grupoId ? "flex flex-col" : "hidden lg:flex lg:flex-col")}
      >
        {ativo ? (
          <Conversa key={ativo.id} grupo={ativo} onLido={carregarResumo} />
        ) : grupoId ? (
          <div className="grid flex-1 place-items-center p-6 text-center text-sm text-text-low">
            Grupo não encontrado ou sem acesso.
          </div>
        ) : (
          <div className="grid flex-1 place-items-center bg-chat p-6 text-center">
            <div>
              <MessagesSquare className="mx-auto size-12 text-accent/40" />
              <p className="mt-3 font-display text-lg font-semibold text-text-hi">
                Escolhe um grupo
              </p>
              <p className="mt-1 text-sm text-text-mid">
                Conversa com a comunidade da Insight Academia.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
