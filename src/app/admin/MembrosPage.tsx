import { useMemo, useState } from "react";
import { Ban, Copy, KeyRound, MessageCircle, Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";

import { Perfis } from "@/lib/db";
import type { Papel, Perfil } from "@/lib/types";
import { PAPEL_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { Field, Input, Modal, Select } from "../components/Modal";
import {
  Avatar,
  Badge,
  Button,
  Carregando,
  EmptyState,
  Erro,
  PageHeader,
} from "../components/primitives";
import { useData } from "../use-data";
import { gerarPalavraPasse, linkWhatsApp, reporPalavraPasse } from "./acoes";

const PAPEL_COR: Record<Papel, string> = {
  admin: "bg-violet-50 text-violet-700",
  equipa: "bg-accent-soft text-accent",
  aluno: "bg-green-50 text-green-700",
};

export default function MembrosPage() {
  const { perfil: eu } = useAuth();
  const { data, loading, error, refetch } = useData(() => Perfis.todos(), []);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | Papel | "bloqueado">("todos");
  const [repor, setRepor] = useState<Perfil | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [aRepor, setARepor] = useState(false);
  const [senhaFeita, setSenhaFeita] = useState<string | null>(null);

  const membros = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data ?? [])
      .filter((p) => p.estado === "aprovado" || p.estado === "bloqueado")
      .filter((p) =>
        filtro === "todos"
          ? true
          : filtro === "bloqueado"
            ? p.estado === "bloqueado"
            : p.papel === filtro && p.estado === "aprovado",
      )
      .filter(
        (p) =>
          !q ||
          p.nome_completo.toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          (p.telefone ?? "").includes(q),
      );
  }, [data, busca, filtro]);

  if (loading) return <Carregando />;
  if (error || !data) return <Erro mensagem={error ?? "Erro"} onRetry={refetch} />;

  async function mudar(p: Perfil, patch: Partial<Perfil>, msg: string) {
    try {
      await Perfis.atualizar(p.id, patch);
      toast.success(msg);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function confirmarRepor() {
    if (!repor || novaSenha.length < 6) return;
    setARepor(true);
    try {
      await reporPalavraPasse(repor.id, novaSenha);
      setSenhaFeita(novaSenha);
      toast.success("Palavra-passe reposta");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setARepor(false);
    }
  }

  const contagem = (f: typeof filtro) =>
    data.filter((p) =>
      f === "todos"
        ? p.estado === "aprovado" || p.estado === "bloqueado"
        : f === "bloqueado"
          ? p.estado === "bloqueado"
          : p.papel === f && p.estado === "aprovado",
    ).length;

  return (
    <div className="page-fade-in">
      <PageHeader
        title="Membros"
        subtitle="Quem tem acesso à academia. Muda o papel, bloqueia ou repõe a palavra-passe."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-low" />
          <Input
            type="search"
            placeholder="Pesquisar nome, email ou telefone"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["todos", "admin", "equipa", "aluno", "bloqueado"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                filtro === f
                  ? "border-accent bg-accent text-white"
                  : "border-hairline bg-bg-elevated text-text-mid hover:border-accent",
              )}
            >
              {f === "todos" ? "Todos" : f === "bloqueado" ? "Bloqueados" : PAPEL_LABEL[f]} (
              {contagem(f)})
            </button>
          ))}
        </div>
      </div>

      {membros.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum membro encontrado" />
      ) : (
        <div className="app-card divide-y divide-hairline">
          {membros.map((p) => {
            const souEu = p.id === eu?.id;
            const wa = linkWhatsApp(p.telefone);
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar nome={p.nome_completo} />
                <div className="min-w-[180px] flex-1">
                  <p className="font-medium text-text-hi">
                    {p.nome_completo} {souEu && <span className="text-xs text-text-low">(tu)</span>}
                  </p>
                  <p className="truncate text-xs text-text-mid">
                    {p.email}
                    {p.telefone ? ` · ${p.telefone}` : ""}
                  </p>
                </div>
                {p.estado === "bloqueado" ? (
                  <Badge className="bg-red-50 text-red-600">Bloqueado</Badge>
                ) : (
                  <Badge className={PAPEL_COR[p.papel]}>{PAPEL_LABEL[p.papel]}</Badge>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Select
                    aria-label="Papel"
                    value={p.papel}
                    disabled={souEu}
                    onChange={(e) =>
                      mudar(
                        p,
                        { papel: e.target.value as Papel },
                        `${p.nome_completo} agora é ${PAPEL_LABEL[e.target.value as Papel]}`,
                      )
                    }
                    className="h-9 w-auto py-1 pr-8 text-xs"
                  >
                    <option value="aluno">Aluno</option>
                    <option value="equipa">Equipa Insight</option>
                    <option value="admin">Administrador</option>
                  </Select>
                  <Button
                    variant="ghost"
                    className="h-9 px-2.5"
                    title="Repor palavra-passe"
                    onClick={() => {
                      setRepor(p);
                      setNovaSenha(gerarPalavraPasse());
                      setSenhaFeita(null);
                    }}
                  >
                    <KeyRound className="size-4" />
                  </Button>
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer" title="WhatsApp">
                      <Button variant="ghost" className="h-9 px-2.5">
                        <MessageCircle className="size-4" />
                      </Button>
                    </a>
                  )}
                  {!souEu &&
                    (p.estado === "bloqueado" ? (
                      <Button
                        variant="outline"
                        className="h-9 px-2.5 text-xs"
                        onClick={() => mudar(p, { estado: "aprovado" }, "Acesso reativado")}
                      >
                        <ShieldCheck className="size-4" /> Reativar
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        className="h-9 px-2.5 text-xs"
                        onClick={() =>
                          confirm(`Bloquear o acesso de ${p.nome_completo}?`) &&
                          mudar(p, { estado: "bloqueado" }, "Acesso bloqueado")
                        }
                      >
                        <Ban className="size-4" /> Bloquear
                      </Button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!repor} onClose={() => setRepor(null)} title="Repor palavra-passe">
        {repor && !senhaFeita && (
          <div className="space-y-4">
            <p className="text-sm text-text-mid">
              Define uma palavra-passe temporária para <strong>{repor.nome_completo}</strong>.
              Depois envia-lhe por WhatsApp — ela pode mudá-la em “O meu perfil”.
            </p>
            <Field label="Nova palavra-passe">
              <Input semVoz value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRepor(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmarRepor} disabled={aRepor || novaSenha.length < 6}>
                {aRepor ? "A repor..." : "Repor"}
              </Button>
            </div>
          </div>
        )}
        {repor && senhaFeita && (
          <div className="space-y-4">
            <p className="text-sm text-text-mid">
              Feito! A nova palavra-passe de <strong>{repor.nome_completo}</strong> é:
            </p>
            <p className="rounded-lg bg-bg-base px-4 py-3 text-center font-mono text-lg font-semibold tracking-wider text-text-hi">
              {senhaFeita}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard?.writeText(senhaFeita);
                  toast.success("Copiada");
                }}
              >
                <Copy className="size-4" /> Copiar
              </Button>
              {linkWhatsApp(repor.telefone) && (
                <a
                  href={linkWhatsApp(
                    repor.telefone,
                    `Olá ${repor.nome_completo.split(" ")[0]}! A tua nova palavra-passe da Insight Academia é: ${senhaFeita}\nEntra em ${window.location.origin} e muda-a em "O meu perfil".`,
                  )!}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="success">
                    <MessageCircle className="size-4" /> Enviar por WhatsApp
                  </Button>
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
