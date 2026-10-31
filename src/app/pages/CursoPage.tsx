import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  ListVideo,
  Loader2,
  MessageCircleQuestion,
  Pencil,
  PlayCircle,
  Reply,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Aulas, Cursos, Ficheiros, Perguntas, ProgressoDb, Seccoes } from "@/lib/db";
import type { Aula, Pergunta } from "@/lib/types";
import { NIVEL_LABEL, NIVEL_STYLE, PAPEL_LABEL } from "@/lib/types";
import { driveId, leitorDoLink, miniaturaDoLink } from "@/lib/video";
import { cn, tempoRelativo } from "@/lib/utils";
import { useAuth } from "../auth";
import { AvisoDrivePrivado, useEstadoDrive } from "../components/Drive";
import { Textarea } from "../components/Modal";
import {
  Avatar,
  Badge,
  BadgePrivado,
  Button,
  Carregando,
  EmptyState,
  ProgressBar,
} from "../components/primitives";
import { useData } from "../use-data";

function teclaBloqueada(e: KeyboardEvent) {
  const k = e.key.toLowerCase();
  const mod = e.ctrlKey || e.metaKey;
  if (k === "f12") return true;
  if (mod && ["s", "u", "p"].includes(k)) return true;
  if (mod && e.shiftKey && ["i", "j", "c"].includes(k)) return true;
  return false;
}

function MarcaDeAgua() {
  const { sessao } = useAuth();
  const email = sessao?.user.email;
  if (!email) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 select-none overflow-hidden"
    >
      <span className="absolute left-3 top-3 text-[10px] font-medium text-white/30">{email}</span>
    </div>
  );
}

// Abaixo desta largura o player do Drive passa ao layout de telemóvel e corta o vídeo
// (só se vê o centro). Desenhamo-lo com esta largura e reduzimos com CSS.
const LARGURA_MIN_DRIVE = 640;

function useLargura<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    if (!el) return;
    const obs = new ResizeObserver(([entrada]) => setLargura(entrada.contentRect.width));
    obs.observe(el);
    return () => obs.disconnect();
  }, [el]);
  return [setEl, largura] as const;
}

function Leitor({ aula }: { aula: Aula }) {
  const [urlFicheiro, setUrlFicheiro] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const estadoDrive = useEstadoDrive(aula.tipo === "upload" ? null : aula.url);
  const [refCaixa, largura] = useLargura<HTMLDivElement>();

  useEffect(() => {
    const bloquear = (e: KeyboardEvent) => {
      if (teclaBloqueada(e)) e.preventDefault();
    };
    window.addEventListener("keydown", bloquear, true);
    return () => window.removeEventListener("keydown", bloquear, true);
  }, []);

  useEffect(() => {
    setUrlFicheiro(null);
    setErro(false);
    if (aula.tipo === "upload" && aula.storage_path) {
      Ficheiros.urlAssinado(aula.storage_path, 60 * 60 * 6)
        .then(setUrlFicheiro)
        .catch(() => setErro(true));
    }
  }, [aula.id, aula.tipo, aula.storage_path]);

  const caixa =
    "relative w-full select-none overflow-hidden rounded-2xl border border-hairline bg-black";
  const semMenu = (e: React.MouseEvent) => e.preventDefault();

  if (aula.tipo === "upload") {
    return (
      <div className={caixa} style={{ aspectRatio: "16 / 9" }} onContextMenu={semMenu}>
        {urlFicheiro ? (
          <video
            key={urlFicheiro}
            src={urlFicheiro}
            controls
            playsInline
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            onContextMenu={semMenu}
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
            {erro ? "Não foi possível abrir o vídeo." : <Loader2 className="size-6 animate-spin" />}
          </div>
        )}
        <MarcaDeAgua />
      </div>
    );
  }

  const leitor = leitorDoLink(aula.url ?? "");
  if (leitor.tipo === "iframe") {
    const ehDrive = Boolean(driveId(aula.url));
    const escala =
      ehDrive && largura > 0 && largura < LARGURA_MIN_DRIVE ? largura / LARGURA_MIN_DRIVE : 1;
    return (
      <div>
        <div
          ref={refCaixa}
          className={caixa}
          style={{ aspectRatio: "16 / 9" }}
          onContextMenu={semMenu}
        >
          {/* O player do Drive não reproduz dentro de um iframe com sandbox. */}
          <iframe
            key={aula.id}
            src={leitor.src}
            title={aula.titulo}
            className={escala < 1 ? "absolute left-0 top-0" : "absolute inset-0 h-full w-full"}
            style={
              escala < 1
                ? {
                    width: LARGURA_MIN_DRIVE,
                    height: (LARGURA_MIN_DRIVE * 9) / 16,
                    transform: `scale(${escala})`,
                    transformOrigin: "top left",
                  }
                : undefined
            }
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
          {ehDrive && (
            // Esconde e bloqueia o botão "abrir noutra janela" do Drive.
            <div
              aria-hidden="true"
              data-capa-drive
              className="absolute right-0 top-0 h-14 w-16 rounded-bl-2xl bg-black"
              onContextMenu={semMenu}
            />
          )}
          <MarcaDeAgua />
        </div>
        {estadoDrive === "talvez_privado" && <AvisoDrivePrivado className="mt-3" />}
      </div>
    );
  }
  if (leitor.tipo === "video") {
    return (
      <div className={caixa} style={{ aspectRatio: "16 / 9" }} onContextMenu={semMenu}>
        <video
          key={leitor.src}
          src={leitor.src}
          controls
          playsInline
          controlsList="nodownload noremoteplayback"
          disablePictureInPicture
          onContextMenu={semMenu}
          className="absolute inset-0 h-full w-full"
        />
        <MarcaDeAgua />
      </div>
    );
  }
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-hairline bg-bg-elevated p-6 text-center"
      style={{ aspectRatio: "16 / 9" }}
    >
      <PlayCircle className="size-10 text-accent" />
      <p className="text-sm text-text-mid">Esta aula abre noutra página.</p>
      <a href={leitor.src} target="_blank" rel="noreferrer">
        <Button>
          Abrir aula <ExternalLink className="size-4" />
        </Button>
      </a>
    </div>
  );
}

function PerguntasDaAula({ aula }: { aula: Aula }) {
  const { sessao, eAdmin } = useAuth();
  const { data, refetch, loading } = useData(() => Perguntas.daAula(aula.id), [aula.id]);
  const [texto, setTexto] = useState("");
  const [respostaA, setRespostaA] = useState<Pergunta | null>(null);
  const [textoResposta, setTextoResposta] = useState("");
  const [busy, setBusy] = useState(false);

  const raiz = (data ?? []).filter((p) => !p.responde_a);
  const respostas = (id: string) => (data ?? []).filter((p) => p.responde_a === id);

  async function enviar(conteudo: string, responde?: string) {
    if (!conteudo.trim()) return;
    setBusy(true);
    try {
      await Perguntas.criar(aula.id, conteudo, responde);
      if (responde) {
        setTextoResposta("");
        setRespostaA(null);
      } else setTexto("");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
    }
  }

  async function apagar(p: Pergunta) {
    if (!confirm("Apagar esta mensagem?")) return;
    try {
      await Perguntas.apagar(p.id);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao apagar");
    }
  }

  function Item({ p, resposta }: { p: Pergunta; resposta?: boolean }) {
    const meu = p.autor_id === sessao?.user.id;
    return (
      <div className={cn("flex gap-3", resposta && "mt-3")}>
        <Avatar nome={p.autor_nome || "?"} className={resposta ? "size-7 text-xs" : undefined} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold text-text-hi">{p.autor_nome}</span>
            {p.autor_papel && p.autor_papel !== "aluno" && (
              <Badge className="bg-accent-soft px-2 py-0 text-[10px] text-accent">
                {PAPEL_LABEL[p.autor_papel]}
              </Badge>
            )}
            <span className="text-[11px] text-text-low">{tempoRelativo(p.created_at)}</span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-text-hi">{p.texto}</p>
          <div className="mt-1 flex gap-3">
            {!resposta && (
              <button
                onClick={() => {
                  setRespostaA(p);
                  setTextoResposta("");
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-text-mid hover:text-accent"
              >
                <Reply className="size-3.5" /> Responder
              </button>
            )}
            {(meu || eAdmin) && (
              <button
                onClick={() => apagar(p)}
                className="inline-flex items-center gap-1 text-xs font-medium text-text-low hover:text-red-600"
              >
                <Trash2 className="size-3.5" /> Apagar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="app-card mt-6 p-5">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="size-5 text-accent" />
        <h3 className="font-display text-base font-semibold text-text-hi">
          Perguntas e respostas{" "}
          <span className="text-sm font-normal text-text-low">({data?.length ?? 0})</span>
        </h3>
      </div>
      <p className="mt-1 text-xs text-text-low">
        Tens uma dúvida sobre esta aula? Pergunta aqui — a equipa e os colegas respondem.
      </p>

      <form
        className="mt-4 flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
      >
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreve ou dita a tua pergunta..."
          className="min-h-[60px]"
        />
        <Button type="submit" disabled={busy || !texto.trim()} className="shrink-0">
          <Send className="size-4" />
          <span className="hidden sm:inline">Perguntar</span>
        </Button>
      </form>

      <div className="mt-5 space-y-5">
        {loading && <Carregando />}
        {!loading && raiz.length === 0 && (
          <p className="py-4 text-center text-sm text-text-low">
            Ainda ninguém perguntou nada. Sê o primeiro!
          </p>
        )}
        {raiz.map((p) => (
          <div key={p.id} className="border-b border-hairline pb-4 last:border-0">
            <Item p={p} />
            <div className="ml-12">
              {respostas(p.id).map((r) => (
                <Item key={r.id} p={r} resposta />
              ))}
              {respostaA?.id === p.id && (
                <form
                  className="mt-3 flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    enviar(textoResposta, p.id);
                  }}
                >
                  <Textarea
                    autoFocus
                    value={textoResposta}
                    onChange={(e) => setTextoResposta(e.target.value)}
                    placeholder={`Responder a ${p.autor_nome}...`}
                    className="min-h-[50px]"
                  />
                  <Button type="submit" disabled={busy || !textoResposta.trim()}>
                    <Send className="size-4" />
                  </Button>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CursoPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { sessao, eAdmin } = useAuth();
  const userId = sessao?.user.id ?? "";

  const { data, loading } = useData(async () => {
    const curso = await Cursos.obter(id);
    if (!curso) return null;
    const [aulas, seccao, progresso] = await Promise.all([
      Aulas.doCurso(id),
      Seccoes.obter(curso.seccao_id),
      ProgressoDb.meu(userId),
    ]);
    return { curso, aulas, seccao, progresso };
  }, [id, userId]);

  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (data) setFeitas(new Set(data.progresso.filter((p) => p.concluida).map((p) => p.aula_id)));
  }, [data]);

  const aulas = useMemo(() => data?.aulas ?? [], [data]);
  const aulaId = params.get("aula");
  const ativa =
    aulas.find((a) => a.id === aulaId) ?? aulas.find((a) => !feitas.has(a.id)) ?? aulas[0];
  const idx = ativa ? aulas.indexOf(ativa) : -1;

  // Regista que a aula foi aberta (para o "Continuar a ver").
  useEffect(() => {
    if (ativa && userId) ProgressoDb.marcarVista(userId, ativa.id).catch(() => undefined);
  }, [ativa, userId]);

  if (loading) return <Carregando />;
  if (!data) {
    return (
      <EmptyState
        icon={PlayCircle}
        title="Curso não encontrado"
        description="Pode ter sido apagado ou não tens acesso a ele."
        action={
          <Link to="/">
            <Button variant="outline">Voltar ao início</Button>
          </Link>
        }
      />
    );
  }

  const { curso, seccao } = data;
  const concluidas = aulas.filter((a) => feitas.has(a.id)).length;
  const pct = aulas.length ? Math.round((concluidas / aulas.length) * 100) : 0;

  function abrir(a: Aula) {
    setParams({ aula: a.id }, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function alternarConcluida(a: Aula) {
    const nova = !feitas.has(a.id);
    // Fixa a aula atual no URL para não saltar sozinha para a próxima por fazer.
    if (!aulaId) setParams({ aula: a.id }, { replace: true });
    setFeitas((prev) => {
      const s = new Set(prev);
      if (nova) s.add(a.id);
      else s.delete(a.id);
      return s;
    });
    try {
      await ProgressoDb.definirConcluida(userId, a.id, nova);
      if (nova) {
        const proxima = aulas[aulas.indexOf(a) + 1];
        if (concluidas + 1 === aulas.length) toast.success("🎉 Terminaste o curso! Parabéns!");
        else if (proxima)
          toast.success("Aula concluída", {
            action: { label: "Próxima", onClick: () => abrir(proxima) },
          });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível guardar.");
    }
  }

  return (
    <div className="page-fade-in">
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-text-mid">
        <Link to="/" className="inline-flex items-center gap-1.5 font-medium hover:text-accent">
          <ArrowLeft className="size-4" /> Início
        </Link>
        {seccao && (
          <>
            <ChevronRight className="size-4 text-text-low" />
            <Link to={`/seccao/${seccao.id}`} className="font-medium hover:text-accent">
              {seccao.titulo}
            </Link>
          </>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-text-hi md:text-3xl">
            {curso.titulo}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={NIVEL_STYLE[curso.nivel]}>{NIVEL_LABEL[curso.nivel]}</Badge>
            {seccao?.visibilidade === "privada" && <BadgePrivado />}
            <span className="text-xs text-text-low">
              {aulas.length} aulas{curso.duracao ? ` · ${curso.duracao}` : ""}
            </span>
          </div>
          {curso.descricao && (
            <p className="mt-2 max-w-3xl text-sm text-text-mid">{curso.descricao}</p>
          )}
        </div>
        {eAdmin && (
          <Link to={`/admin/conteudo?seccao=${curso.seccao_id}&curso=${curso.id}`}>
            <Button variant="outline">
              <Pencil className="size-4" /> Editar curso
            </Button>
          </Link>
        )}
      </div>

      {aulas.length === 0 || !ativa ? (
        <EmptyState icon={PlayCircle} title="Este curso ainda não tem aulas" />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <Leitor aula={ativa} />
            <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-low">
                  Aula {idx + 1} de {aulas.length}
                </p>
                <h2 className="font-display text-lg font-semibold text-text-hi">{ativa.titulo}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => alternarConcluida(ativa)}
                  className={cn(
                    "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition",
                    feitas.has(ativa.id)
                      ? "bg-green-50 text-green-700"
                      : "border border-hairline bg-bg-elevated text-text-mid hover:border-accent hover:text-accent",
                  )}
                >
                  {feitas.has(ativa.id) ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                  {feitas.has(ativa.id) ? "Concluída" : "Marcar como concluída"}
                </button>
                {aulas[idx + 1] && (
                  <Button onClick={() => abrir(aulas[idx + 1])}>
                    Próxima <ChevronRight className="size-4" />
                  </Button>
                )}
              </div>
            </div>
            {ativa.descricao && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-text-mid">{ativa.descricao}</p>
            )}
            <PerguntasDaAula aula={ativa} />
          </div>

          <aside className="app-card flex h-fit flex-col p-4 lg:sticky lg:top-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListVideo className="size-5 text-accent" />
                <h3 className="font-display text-base font-semibold text-text-hi">Aulas</h3>
              </div>
              <span className="text-xs text-text-low">
                {concluidas}/{aulas.length}
              </span>
            </div>
            <ProgressBar value={pct} className="mt-2 h-1.5" />
            <div className="mt-3 max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
              {aulas.map((a, i) => {
                const thumb = miniaturaDoLink(a.url);
                return (
                  <button
                    key={a.id}
                    onClick={() => abrir(a)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition",
                      a.id === ativa.id
                        ? "border-accent bg-accent-soft"
                        : "border-hairline hover:border-accent/50",
                    )}
                  >
                    <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-text-hi">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-white/60">
                          <PlayCircle className="size-5" />
                        </div>
                      )}
                      {feitas.has(a.id) && (
                        <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-green-500 text-white">
                          <CheckCircle2 className="size-3" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-text-low">Aula {i + 1}</p>
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-text-hi">
                        {a.titulo}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
