import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ExternalLink,
  Eye,
  EyeOff,
  FileVideo,
  GripVertical,
  HardDrive,
  Image,
  Link2,
  Loader2,
  Lock,
  Pencil,
  PlayCircle,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Aulas, Capas, Cursos, Ficheiros, LIMITE_CAPA, LIMITE_UPLOAD, Seccoes } from "@/lib/db";
import type { Aula, Curso, Nivel, Seccao, Visibilidade } from "@/lib/types";
import { NIVEL_LABEL } from "@/lib/types";
import { driveId, linkValido, miniaturaDoLink, tipoDoLink } from "@/lib/video";
import { cn, tamanhoLegivel } from "@/lib/utils";
import { AvisoDrivePrivado, useEstadoDrive } from "../components/Drive";
import { BotaoDrive, BotaoImportarPasta } from "../components/DrivePicker";
import { limparNomeFicheiro, type FicheiroDrive } from "@/lib/google-picker";
import { BotaoImportarVimeo, type VideoVimeo } from "../components/VimeoImporter";
import { Field, Input, Modal, Select, Switch, Textarea } from "../components/Modal";
import { Badge, Button, Carregando, Erro, PageHeader } from "../components/primitives";
import { useData } from "../use-data";
import { EscolhaVisibilidade } from "./Visibilidade";

type Dados = { seccoes: Seccao[]; cursos: Curso[]; aulas: Aula[] };

function Coluna({
  titulo,
  acao,
  children,
  voltar,
  className,
}: {
  titulo: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
  voltar?: () => void;
  className?: string;
}) {
  return (
    <section className={cn("app-card flex min-h-[300px] flex-col overflow-hidden", className)}>
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        {voltar && (
          <button
            onClick={voltar}
            className="grid size-8 place-items-center rounded-lg text-text-mid hover:bg-accent-soft lg:hidden"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-4" />
          </button>
        )}
        <h2 className="min-w-0 flex-1 truncate font-display text-base font-semibold text-text-hi">
          {titulo}
        </h2>
        {acao}
      </div>
      <div className="flex-1 overflow-y-auto p-2">{children}</div>
    </section>
  );
}

function BotoesOrdem({
  i,
  n,
  onMover,
}: {
  i: number;
  n: number;
  onMover: (i: number, d: -1 | 1) => void;
}) {
  return (
    <span className="flex shrink-0 flex-col">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMover(i, -1);
        }}
        disabled={i === 0}
        className="rounded p-0.5 text-text-low hover:text-accent disabled:opacity-30"
        aria-label="Subir"
      >
        <ArrowUp className="size-3.5" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMover(i, 1);
        }}
        disabled={i === n - 1}
        className="rounded p-0.5 text-text-low hover:text-accent disabled:opacity-30"
        aria-label="Descer"
      >
        <ArrowDown className="size-3.5" />
      </button>
    </span>
  );
}

function BotaoIcone({
  onClick,
  label,
  children,
  perigo,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  perigo?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={label}
      aria-label={label}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg text-text-low",
        perigo ? "hover:bg-red-50 hover:text-red-600" : "hover:bg-accent-soft hover:text-accent",
      )}
    >
      {children}
    </button>
  );
}

/** Selo na lista de aulas quando o vídeo do Drive parece privado. */
function SeloDrivePrivado({ url }: { url: string | null }) {
  const estado = useEstadoDrive(url);
  if (estado !== "talvez_privado") return null;
  return (
    <Badge className="mt-1 w-fit bg-amber-50 text-amber-700">
      <Lock className="size-3" /> Privado no Drive
    </Badge>
  );
}

/** Miniatura do link colado e, se for do Drive, se os alunos o vão conseguir ver. */
function PreVisualizacaoLink({ url }: { url: string }) {
  const estado = useEstadoDrive(url);
  const miniatura = miniaturaDoLink(url);
  return (
    <>
      {miniatura && estado !== "talvez_privado" && (
        <img
          src={miniatura}
          alt=""
          className="mt-2 h-24 rounded-lg object-cover"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      )}
      {estado === "a_verificar" && (
        <p className="mt-2 text-xs text-text-low">A verificar a partilha no Google Drive...</p>
      )}
      {estado === "publico" && (
        <p className="mt-2 text-xs font-medium text-green-700">
          ✓ Vídeo público no Drive — os alunos conseguem ver.
        </p>
      )}
      {estado === "talvez_privado" && <AvisoDrivePrivado admin className="mt-2" />}
    </>
  );
}

// ─── Formulários ─────────────────────────────────────────────────────────

type FormSeccao = { titulo: string; descricao: string; icone: string; visibilidade: Visibilidade };
type FormCurso = {
  titulo: string;
  descricao: string;
  nivel: Nivel;
  duracao: string;
  publicado: boolean;
  seccao_id: string;
  capa_url: string;
};
type FormAula = {
  titulo: string;
  descricao: string;
  fonte: "link" | "upload" | "drive";
  url: string;
  ficheiro: File | null;
};

export default function ConteudoPage() {
  const [params, setParams] = useSearchParams();
  const seccaoId = params.get("seccao");
  const cursoId = params.get("curso");
  const { data, loading, error, refetch } = useData<Dados>(async () => {
    const [seccoes, cursos, aulas] = await Promise.all([
      Seccoes.listar(),
      Cursos.listar(),
      Aulas.listar(),
    ]);
    return { seccoes, cursos, aulas };
  }, []);

  const [modalSeccao, setModalSeccao] = useState<Seccao | "nova" | null>(null);
  const [fs, setFs] = useState<FormSeccao>({
    titulo: "",
    descricao: "",
    icone: "📚",
    visibilidade: "academia",
  });
  const [modalCurso, setModalCurso] = useState<Curso | "novo" | null>(null);
  const [fc, setFc] = useState<FormCurso>({
    titulo: "",
    descricao: "",
    nivel: "iniciante",
    duracao: "",
    publicado: true,
    seccao_id: "",
    capa_url: "",
  });
  const [modalAula, setModalAula] = useState<Aula | "nova" | null>(null);
  const [fa, setFa] = useState<FormAula>({
    titulo: "",
    descricao: "",
    fonte: "link",
    url: "",
    ficheiro: null,
  });
  const [busy, setBusy] = useState(false);
  const [aEnviarCapa, setAEnviarCapa] = useState(false);
  const [arrastar, setArrastar] = useState<number | null>(null);

  async function enviarCapa(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Escolhe um ficheiro de imagem.");
    if (file.size > LIMITE_CAPA) return toast.error("A imagem tem de ter até 5 MB.");
    setAEnviarCapa(true);
    try {
      const url = await Capas.enviar(file);
      setFc((atual) => ({ ...atual, capa_url: url }));
      toast.success("Imagem carregada — carrega em Guardar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar a imagem.");
    } finally {
      setAEnviarCapa(false);
    }
  }

  const seccao = data?.seccoes.find((s) => s.id === seccaoId) ?? null;
  const curso = data?.cursos.find((c) => c.id === cursoId) ?? null;
  const cursos = useMemo(
    () => (data && seccao ? data.cursos.filter((c) => c.seccao_id === seccao.id) : []),
    [data, seccao],
  );
  const aulas = useMemo(
    () =>
      data && curso
        ? data.aulas.filter((a) => a.curso_id === curso.id).sort((a, b) => a.ordem - b.ordem)
        : [],
    [data, curso],
  );

  if (loading) return <Carregando />;
  if (error || !data) return <Erro mensagem={error ?? "Erro"} onRetry={refetch} />;

  const escolher = (s?: string | null, c?: string | null) => {
    const p: Record<string, string> = {};
    if (s) p.seccao = s;
    if (c) p.curso = c;
    setParams(p, { replace: true });
  };

  async function tentar(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await refetch();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function reordenar<T extends { id: string; ordem: number }>(
    lista: T[],
    i: number,
    d: -1 | 1,
    atualizar: (id: string, p: { ordem: number }) => Promise<void>,
  ) {
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    const nova = [...lista];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    await Promise.all(nova.map((x, k) => (x.ordem === k ? null : atualizar(x.id, { ordem: k }))));
    await refetch();
  }

  // ── Secções
  function abrirSeccao(s: Seccao | "nova") {
    setModalSeccao(s);
    setFs(
      s === "nova"
        ? { titulo: "", descricao: "", icone: "📚", visibilidade: "academia" }
        : {
            titulo: s.titulo,
            descricao: s.descricao ?? "",
            icone: s.icone ?? "📚",
            visibilidade: s.visibilidade,
          },
    );
  }
  async function guardarSeccao() {
    if (!fs.titulo.trim()) return toast.error("Dá um nome à secção.");
    const dados = {
      titulo: fs.titulo.trim(),
      descricao: fs.descricao.trim() || null,
      icone: fs.icone.trim() || "📚",
      visibilidade: fs.visibilidade,
    };
    const ok = await tentar(async () => {
      if (modalSeccao === "nova") {
        const nova = await Seccoes.criar({ ...dados, ordem: data!.seccoes.length });
        escolher(nova.id);
      } else if (modalSeccao) await Seccoes.atualizar(modalSeccao.id, dados);
    }, "Secção guardada");
    if (ok) setModalSeccao(null);
  }
  async function apagarSeccao(s: Seccao) {
    const n = data!.cursos.filter((c) => c.seccao_id === s.id).length;
    if (
      !confirm(
        `Apagar a secção "${s.titulo}"${n ? ` e os seus ${n} cursos (com todas as aulas)` : ""}?`,
      )
    )
      return;
    await tentar(() => Seccoes.apagar(s.id), "Secção apagada");
    if (seccaoId === s.id) escolher();
  }
  async function alternarVisibilidade(s: Seccao) {
    const v: Visibilidade = s.visibilidade === "privada" ? "academia" : "privada";
    await tentar(
      () => Seccoes.atualizar(s.id, { visibilidade: v }),
      v === "privada"
        ? "Agora só a equipa vê esta secção"
        : "Agora todos os alunos veem esta secção",
    );
  }

  // ── Cursos
  function abrirCurso(c: Curso | "novo") {
    setModalCurso(c);
    setFc(
      c === "novo"
        ? {
            titulo: "",
            descricao: "",
            nivel: "iniciante",
            duracao: "",
            publicado: true,
            seccao_id: seccaoId ?? "",
            capa_url: "",
          }
        : {
            titulo: c.titulo,
            descricao: c.descricao ?? "",
            nivel: c.nivel,
            duracao: c.duracao ?? "",
            publicado: c.publicado,
            seccao_id: c.seccao_id,
            capa_url: c.capa_url ?? "",
          },
    );
  }
  async function guardarCurso() {
    if (!fc.titulo.trim()) return toast.error("Dá um título ao curso.");
    if (!fc.seccao_id) return toast.error("Escolhe a secção.");
    const dados = {
      titulo: fc.titulo.trim(),
      descricao: fc.descricao.trim() || null,
      nivel: fc.nivel,
      duracao: fc.duracao.trim() || null,
      publicado: fc.publicado,
      seccao_id: fc.seccao_id,
      capa_url: fc.capa_url.trim() || null,
    };
    const ok = await tentar(async () => {
      if (modalCurso === "novo") {
        const novo = await Cursos.criar({
          ...dados,
          ordem: data!.cursos.filter((c) => c.seccao_id === fc.seccao_id).length,
        });
        escolher(novo.seccao_id, novo.id);
      } else if (modalCurso) {
        await Cursos.atualizar(modalCurso.id, dados);
        if (modalCurso.seccao_id !== dados.seccao_id) escolher(dados.seccao_id, modalCurso.id);
      }
    }, "Curso guardado");
    if (ok) setModalCurso(null);
  }
  async function apagarCurso(c: Curso) {
    if (!confirm(`Apagar o curso "${c.titulo}" e todas as suas aulas?`)) return;
    const comFicheiro = data!.aulas.filter((a) => a.curso_id === c.id && a.storage_path);
    await tentar(async () => {
      for (const a of comFicheiro) await Aulas.apagar(a);
      await Cursos.apagar(c.id);
    }, "Curso apagado");
    if (cursoId === c.id) escolher(seccaoId);
  }

  // ── Aulas
  function abrirAula(a: Aula | "nova") {
    setModalAula(a);
    setFa(
      a === "nova"
        ? { titulo: "", descricao: "", fonte: "link", url: "", ficheiro: null }
        : {
            titulo: a.titulo,
            descricao: a.descricao ?? "",
            fonte: a.tipo === "upload" ? "upload" : "link",
            url: a.url ?? "",
            ficheiro: null,
          },
    );
  }
  async function guardarAula() {
    if (!curso) return;
    const titulo = fa.titulo.trim() || `Aula ${aulas.length + 1}`;
    const editar = modalAula !== "nova" ? modalAula : null;
    if (fa.fonte === "link" || fa.fonte === "drive") {
      if (!linkValido(fa.url))
        return toast.error("Cola um link válido (YouTube, Vimeo, Loom, Drive...).");
    } else if (!fa.ficheiro && !(editar?.tipo === "upload" && editar.storage_path)) {
      return toast.error("Escolhe o vídeo a carregar.");
    }
    if (fa.ficheiro && fa.ficheiro.size > LIMITE_UPLOAD) {
      return toast.error(
        "O vídeo tem mais de 50 MB. Põe-no no YouTube (não listado) e cola o link.",
      );
    }
    const ok = await tentar(
      async () => {
        let fonte: Partial<Aula>;
        if (fa.fonte === "link" || fa.fonte === "drive") {
          fonte = { tipo: tipoDoLink(fa.url.trim()), url: fa.url.trim(), storage_path: null };
        } else if (fa.ficheiro) {
          const caminho = await Ficheiros.enviar("aulas", fa.ficheiro);
          fonte = { tipo: "upload", storage_path: caminho, url: null };
        } else {
          fonte = {};
        }
        const dados = { titulo, descricao: fa.descricao.trim() || null, ...fonte };
        if (editar) {
          await Aulas.atualizar(editar.id, dados);
          // Se trocou o ficheiro (ou passou para link), apaga o vídeo antigo.
          if (
            editar.storage_path &&
            fonte.storage_path !== undefined &&
            fonte.storage_path !== editar.storage_path
          ) {
            await Ficheiros.apagar(editar.storage_path);
          }
        } else {
          await Aulas.criar({ ...dados, curso_id: curso.id, ordem: aulas.length });
        }
      },
      editar ? "Aula guardada" : "Aula adicionada",
    );
    if (ok) setModalAula(null);
  }
  async function apagarAula(a: Aula) {
    if (!confirm(`Apagar a aula "${a.titulo}"?`)) return;
    await tentar(() => Aulas.apagar(a), "Aula apagada");
  }
  async function largarEm(destino: number) {
    if (arrastar === null || arrastar === destino) return;
    const nova = [...aulas];
    const [m] = nova.splice(arrastar, 1);
    nova.splice(destino, 0, m);
    setArrastar(null);
    await Aulas.reordenar(nova);
    await refetch();
  }

  async function importarPastaDrive(ficheiros: FicheiroDrive[]) {
    if (!curso) return;
    const ok = await tentar(
      async () => {
        for (let i = 0; i < ficheiros.length; i++) {
          const f = ficheiros[i];
          await Aulas.criar({
            curso_id: curso.id,
            titulo: limparNomeFicheiro(f.nome),
            descricao: null,
            tipo: "link",
            url: f.url,
            storage_path: null,
            ordem: aulas.length + i,
          });
        }
      },
      `${ficheiros.length} aula${ficheiros.length !== 1 ? "s" : ""} importada${ficheiros.length !== 1 ? "s" : ""} do Drive`,
    );
    if (!ok) return;
    toast.info('Verifica se os vídeos estão partilhados como "Qualquer pessoa com o link".');
  }

  async function importarVimeo(videos: VideoVimeo[]) {
    if (!curso) return;
    const ok = await tentar(
      async () => {
        for (let i = 0; i < videos.length; i++) {
          const v = videos[i];
          await Aulas.criar({
            curso_id: curso.id,
            titulo: v.nome,
            descricao: null,
            tipo: "link",
            url: v.url,
            storage_path: null,
            ordem: aulas.length + i,
          });
        }
      },
      `${videos.length} aula${videos.length !== 1 ? "s" : ""} importada${videos.length !== 1 ? "s" : ""} do Vimeo`,
    );
    if (!ok) return;
    const privados = videos.filter(
      (v) => v.privacidade !== "anybody" && v.privacidade !== "unlisted",
    );
    if (privados.length > 0) {
      toast.info(
        `${privados.length} vídeo${privados.length > 1 ? "s precisam" : " precisa"} de ser "Não listado" no Vimeo para os alunos verem.`,
      );
    }
  }

  // Em telemóvel mostra só a coluna mais funda escolhida.
  const nivelMovel = curso ? 3 : seccao ? 2 : 1;

  return (
    <div className="page-fade-in">
      <PageHeader
        title="Conteúdo da academia"
        subtitle="Organiza por Secções (áreas) → Cursos → Aulas. Cada secção é Privada (só equipa Insight) ou da Academia (todos os alunos)."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.3fr]">
        {/* Secções */}
        <Coluna
          className={cn(nivelMovel !== 1 && "hidden lg:flex")}
          titulo="Secções"
          acao={
            <Button className="h-8 px-3" onClick={() => abrirSeccao("nova")}>
              <Plus className="size-4" /> Nova
            </Button>
          }
        >
          {data.seccoes.length === 0 && (
            <p className="p-6 text-center text-sm text-text-low">
              Cria a primeira secção (ex.: Vercel, Prospecção, Design).
            </p>
          )}
          {data.seccoes.map((s, i) => {
            const n = data.cursos.filter((c) => c.seccao_id === s.id).length;
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => escolher(s.id)}
                onKeyDown={(e) => e.key === "Enter" && escolher(s.id)}
                className={cn(
                  "mb-1 flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 transition",
                  s.id === seccaoId
                    ? "border-accent bg-accent-soft"
                    : "border-transparent hover:bg-bg-base",
                )}
              >
                <BotoesOrdem
                  i={i}
                  n={data.seccoes.length}
                  onMover={(i2, d) => reordenar(data.seccoes, i2, d, Seccoes.atualizar)}
                />
                <span className="text-xl">{s.icone || "📚"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-text-hi">
                    {s.titulo}
                  </span>
                  <span className="text-xs text-text-low">
                    {n} {n === 1 ? "curso" : "cursos"}
                  </span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    alternarVisibilidade(s);
                  }}
                  title="Mudar quem pode ver"
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    s.visibilidade === "privada"
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "bg-green-50 text-green-700 hover:bg-green-100",
                  )}
                >
                  {s.visibilidade === "privada" ? (
                    <>
                      <Lock className="size-3" /> Privada
                    </>
                  ) : (
                    "Academia"
                  )}
                </button>
                <BotaoIcone label="Editar secção" onClick={() => abrirSeccao(s)}>
                  <Pencil className="size-4" />
                </BotaoIcone>
                <BotaoIcone label="Apagar secção" perigo onClick={() => apagarSeccao(s)}>
                  <Trash2 className="size-4" />
                </BotaoIcone>
              </div>
            );
          })}
        </Coluna>

        {/* Cursos */}
        <Coluna
          className={cn(nivelMovel !== 2 && "hidden lg:flex")}
          voltar={() => escolher()}
          titulo={seccao ? `Cursos · ${seccao.titulo}` : "Cursos"}
          acao={
            seccao && (
              <Button className="h-8 px-3" onClick={() => abrirCurso("novo")}>
                <Plus className="size-4" /> Novo
              </Button>
            )
          }
        >
          {!seccao ? (
            <p className="p-6 text-center text-sm text-text-low">Escolhe uma secção.</p>
          ) : cursos.length === 0 ? (
            <p className="p-6 text-center text-sm text-text-low">
              Esta secção ainda não tem cursos.
            </p>
          ) : (
            cursos.map((c, i) => {
              const n = data.aulas.filter((a) => a.curso_id === c.id).length;
              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => escolher(seccaoId, c.id)}
                  onKeyDown={(e) => e.key === "Enter" && escolher(seccaoId, c.id)}
                  className={cn(
                    "mb-1 flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 transition",
                    c.id === cursoId
                      ? "border-accent bg-accent-soft"
                      : "border-transparent hover:bg-bg-base",
                  )}
                >
                  <BotoesOrdem
                    i={i}
                    n={cursos.length}
                    onMover={(i2, d) => reordenar(cursos, i2, d, Cursos.atualizar)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-text-hi">
                      {c.titulo}
                    </span>
                    <span className="text-xs text-text-low">
                      {n} {n === 1 ? "aula" : "aulas"} · {NIVEL_LABEL[c.nivel]}
                    </span>
                  </span>
                  <BotaoIcone
                    label={c.publicado ? "Esconder (rascunho)" : "Publicar"}
                    onClick={() =>
                      tentar(
                        () => Cursos.atualizar(c.id, { publicado: !c.publicado }),
                        c.publicado ? "Curso escondido (rascunho)" : "Curso publicado",
                      )
                    }
                  >
                    {c.publicado ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4 text-amber-600" />
                    )}
                  </BotaoIcone>
                  <BotaoIcone label="Editar curso" onClick={() => abrirCurso(c)}>
                    <Pencil className="size-4" />
                  </BotaoIcone>
                  <BotaoIcone label="Apagar curso" perigo onClick={() => apagarCurso(c)}>
                    <Trash2 className="size-4" />
                  </BotaoIcone>
                </div>
              );
            })
          )}
        </Coluna>

        {/* Aulas */}
        <Coluna
          className={cn(nivelMovel !== 3 && "hidden lg:flex")}
          voltar={() => escolher(seccaoId)}
          titulo={curso ? `Aulas · ${curso.titulo}` : "Aulas"}
          acao={
            curso && (
              <div className="flex gap-1.5">
                <Link to={`/curso/${curso.id}`} title="Ver como aluno">
                  <Button variant="outline" className="h-8 px-2.5">
                    <ExternalLink className="size-4" />
                  </Button>
                </Link>
                <BotaoImportarVimeo onImportar={importarVimeo} disabled={busy} />
                <BotaoImportarPasta onImportar={importarPastaDrive} disabled={busy} />
                <Button className="h-8 px-3" onClick={() => abrirAula("nova")}>
                  <Plus className="size-4" /> Aula
                </Button>
              </div>
            )
          }
        >
          {!curso ? (
            <p className="p-6 text-center text-sm text-text-low">Escolhe um curso.</p>
          ) : aulas.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm text-text-low">Ainda sem aulas.</p>
              <Button className="mt-3" onClick={() => abrirAula("nova")}>
                <Plus className="size-4" /> Adicionar a primeira aula
              </Button>
            </div>
          ) : (
            aulas.map((a, i) => {
              const thumb = miniaturaDoLink(a.url);
              return (
                <div
                  key={a.id}
                  draggable
                  onDragStart={() => setArrastar(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => largarEm(i)}
                  className={cn(
                    "mb-1 flex items-center gap-2 rounded-lg border border-hairline bg-bg-elevated px-2 py-2",
                    arrastar === i && "opacity-50",
                  )}
                >
                  <GripVertical className="hidden size-4 shrink-0 cursor-grab text-text-low lg:block" />
                  <BotoesOrdem
                    i={i}
                    n={aulas.length}
                    onMover={async (i2, d) => {
                      const nova = [...aulas];
                      const j = i2 + d;
                      [nova[i2], nova[j]] = [nova[j], nova[i2]];
                      await Aulas.reordenar(nova);
                      await refetch();
                    }}
                  />
                  <div className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md bg-text-hi">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-white/70">
                        {a.tipo === "upload" ? (
                          <FileVideo className="size-5" />
                        ) : (
                          <PlayCircle className="size-5" />
                        )}
                      </span>
                    )}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] text-text-low">Aula {i + 1}</span>
                    <span className="line-clamp-2 text-sm font-medium leading-snug text-text-hi">
                      {a.titulo}
                    </span>
                    <SeloDrivePrivado url={a.tipo === "upload" ? null : a.url} />
                  </span>
                  <Badge className="hidden shrink-0 bg-bg-base text-text-mid sm:inline-flex">
                    {a.tipo === "upload"
                      ? "Vídeo"
                      : a.tipo === "youtube"
                        ? "YouTube"
                        : driveId(a.url)
                          ? "Drive"
                          : "Link"}
                  </Badge>
                  <BotaoIcone label="Editar aula" onClick={() => abrirAula(a)}>
                    <Pencil className="size-4" />
                  </BotaoIcone>
                  <BotaoIcone label="Apagar aula" perigo onClick={() => apagarAula(a)}>
                    <Trash2 className="size-4" />
                  </BotaoIcone>
                </div>
              );
            })
          )}
        </Coluna>
      </div>

      {/* Modal secção */}
      <Modal
        open={modalSeccao !== null}
        onClose={() => setModalSeccao(null)}
        title={modalSeccao === "nova" ? "Nova secção" : "Editar secção"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <Field label="Ícone">
              <Input
                semVoz
                value={fs.icone}
                maxLength={4}
                className="text-center text-lg"
                onChange={(e) => setFs({ ...fs, icone: e.target.value })}
              />
            </Field>
            <Field label="Nome da secção" required>
              <Input
                value={fs.titulo}
                placeholder="Ex.: Vercel"
                onChange={(e) => setFs({ ...fs, titulo: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Descrição">
            <Textarea
              value={fs.descricao}
              className="min-h-[70px]"
              onChange={(e) => setFs({ ...fs, descricao: e.target.value })}
            />
          </Field>
          <EscolhaVisibilidade
            valor={fs.visibilidade}
            onChange={(v) => setFs({ ...fs, visibilidade: v })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalSeccao(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarSeccao} disabled={busy}>
              {busy ? "A guardar..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal curso */}
      <Modal
        open={modalCurso !== null}
        onClose={() => setModalCurso(null)}
        title={modalCurso === "novo" ? "Novo curso" : "Editar curso"}
      >
        <div className="space-y-4">
          <Field label="Título" required>
            <Input
              value={fc.titulo}
              placeholder="Ex.: Publicar um site no Vercel"
              onChange={(e) => setFc({ ...fc, titulo: e.target.value })}
            />
          </Field>
          <Field label="Descrição">
            <Textarea
              value={fc.descricao}
              className="min-h-[70px]"
              onChange={(e) => setFc({ ...fc, descricao: e.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nível">
              <Select
                value={fc.nivel}
                onChange={(e) => setFc({ ...fc, nivel: e.target.value as Nivel })}
              >
                <option value="iniciante">Iniciante</option>
                <option value="intermedio">Intermédio</option>
                <option value="avancado">Avançado</option>
              </Select>
            </Field>
            <Field label="Duração" hint="Ex.: 2h, 45 min">
              <Input
                value={fc.duracao}
                onChange={(e) => setFc({ ...fc, duracao: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Secção">
            <Select
              value={fc.seccao_id}
              onChange={(e) => setFc({ ...fc, seccao_id: e.target.value })}
            >
              {data.seccoes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icone} {s.titulo} {s.visibilidade === "privada" ? "(privada)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Capa do curso"
            hint="Carrega uma imagem (até 5 MB) ou cola um link. Vazio = miniatura da primeira aula."
          >
            <label
              className={cn(
                "mb-2 flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-hairline text-sm font-medium text-text-mid transition hover:border-accent hover:text-accent",
                aEnviarCapa && "pointer-events-none opacity-60",
              )}
            >
              {aEnviarCapa ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {aEnviarCapa ? "A carregar imagem..." : "Carregar imagem do dispositivo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                disabled={aEnviarCapa}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) enviarCapa(f);
                }}
              />
            </label>
            <div className="flex gap-2">
              <Input
                type="url"
                inputMode="url"
                placeholder="ou cola o link: https://exemplo.com/capa.png"
                value={fc.capa_url}
                onChange={(e) => setFc({ ...fc, capa_url: e.target.value })}
                className="flex-1"
              />
              {fc.capa_url && (
                <button
                  type="button"
                  onClick={() => setFc({ ...fc, capa_url: "" })}
                  className="grid size-10 shrink-0 place-items-center rounded-lg border border-hairline text-text-low hover:bg-red-50 hover:text-red-600"
                  title="Remover capa"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            {fc.capa_url && (
              <img
                key={fc.capa_url}
                src={fc.capa_url}
                alt="Pré-visualização da capa"
                className="mt-2 h-32 rounded-lg object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
            {!fc.capa_url && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-text-low">
                <Image className="size-3.5" />
                Sem capa definida — será usada a miniatura do primeiro vídeo do curso.
              </p>
            )}
          </Field>
          <Switch
            checked={fc.publicado}
            onChange={(v) => setFc({ ...fc, publicado: v })}
            label="Publicado (desliga para guardar como rascunho)"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalCurso(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarCurso} disabled={busy}>
              {busy ? "A guardar..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal aula */}
      <Modal
        open={modalAula !== null}
        onClose={() => !busy && setModalAula(null)}
        title={modalAula === "nova" ? "Nova aula" : "Editar aula"}
        size="lg"
      >
        <div className="space-y-4">
          <Field label="Título da aula">
            <Input
              value={fa.titulo}
              placeholder={`Aula ${aulas.length + 1}`}
              onChange={(e) => setFa({ ...fa, titulo: e.target.value })}
            />
          </Field>
          <div>
            <p className="mb-1.5 text-sm font-medium text-text-hi">Vídeo</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(
                [
                  ["link", Link2, "Colar link", "YouTube, Vimeo, Loom, Drive"],
                  ["upload", Upload, "Carregar vídeo", "Ficheiro até 50 MB"],
                  ["drive", HardDrive, "Google Drive", "Escolher do Drive"],
                ] as const
              ).map(([v, Icone, titulo, texto]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFa({ ...fa, fonte: v })}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-3 text-left",
                    v === "drive" && !import.meta.env.VITE_GOOGLE_CLIENT_ID && "hidden",
                    fa.fonte === v
                      ? "border-accent bg-accent-soft"
                      : "border-hairline hover:border-accent/50",
                  )}
                >
                  <Icone
                    className={cn(
                      "mt-0.5 size-4",
                      fa.fonte === v ? "text-accent" : "text-text-low",
                    )}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-text-hi">{titulo}</span>
                    <span className="block text-xs text-text-mid">{texto}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          {fa.fonte === "link" ? (
            <Field
              label="Link do vídeo"
              required
              hint={
                'YouTube, Vimeo, Loom ou Google Drive. Dica: no Drive, partilha a PASTA do curso como "Qualquer pessoa com o link" — todos os vídeos lá dentro ficam visíveis para os alunos.'
              }
            >
              <Input
                type="url"
                inputMode="url"
                placeholder="https://drive.google.com/file/d/... ou https://youtu.be/..."
                value={fa.url}
                onChange={(e) => setFa({ ...fa, url: e.target.value })}
              />
              <PreVisualizacaoLink url={fa.url} />
            </Field>
          ) : fa.fonte === "drive" ? (
            <div className="space-y-3">
              <BotaoDrive
                className="w-full"
                onEscolher={(f) =>
                  setFa({
                    ...fa,
                    url: f.url,
                    titulo: fa.titulo || limparNomeFicheiro(f.nome),
                  })
                }
              />
              {fa.url && (
                <Field label="Vídeo escolhido">
                  <Input type="url" readOnly value={fa.url} className="bg-bg-base text-text-mid" />
                  <PreVisualizacaoLink url={fa.url} />
                </Field>
              )}
            </div>
          ) : (
            <Field
              label="Ficheiro de vídeo"
              hint={
                modalAula !== "nova" && modalAula?.tipo === "upload" && !fa.ficheiro
                  ? "Já tem um vídeo carregado. Escolhe outro só se quiseres trocar."
                  : "MP4 de preferência. Para vídeos grandes usa YouTube (não listado)."
              }
            >
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setFa({ ...fa, ficheiro: e.target.files?.[0] ?? null })}
                className="block w-full text-sm text-text-mid file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-accent"
              />
              {fa.ficheiro && (
                <p
                  className={cn(
                    "mt-1 text-xs",
                    fa.ficheiro.size > LIMITE_UPLOAD ? "text-red-600" : "text-text-low",
                  )}
                >
                  {fa.ficheiro.name} · {tamanhoLegivel(fa.ficheiro.size)}
                </p>
              )}
            </Field>
          )}
          <Field label="Descrição / notas da aula">
            <Textarea
              value={fa.descricao}
              className="min-h-[80px]"
              onChange={(e) => setFa({ ...fa, descricao: e.target.value })}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => setModalAula(null)}>
              Cancelar
            </Button>
            <Button onClick={guardarAula} disabled={busy}>
              {busy ? (fa.ficheiro ? "A carregar vídeo..." : "A guardar...") : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
