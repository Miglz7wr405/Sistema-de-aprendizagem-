import { useState } from "react";
import {
  Check,
  GraduationCap,
  Mail,
  MessageCircle,
  Phone,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Perfis } from "@/lib/db";
import type { Papel, Perfil } from "@/lib/types";
import { cn, tempoRelativo } from "@/lib/utils";
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
import { apagarConta, avisarDecisao, linkWhatsApp } from "./acoes";

export default function PedidosPage() {
  const { data, loading, error, refetch } = useData(() => Perfis.todos(), []);
  const [aba, setAba] = useState<"pendente" | "recusado">("pendente");
  const [aTratar, setATratar] = useState<string | null>(null);

  if (loading) return <Carregando />;
  if (error || !data) return <Erro mensagem={error ?? "Erro"} onRetry={refetch} />;

  const lista = data.filter((p) => p.estado === aba);
  const nPendentes = data.filter((p) => p.estado === "pendente").length;
  const nRecusados = data.filter((p) => p.estado === "recusado").length;

  async function decidir(p: Perfil, estado: "aprovado" | "recusado", papel?: Papel) {
    setATratar(p.id);
    try {
      await Perfis.atualizar(p.id, { estado, ...(papel ? { papel } : {}) });
      avisarDecisao(p.id);
      toast.success(
        estado === "aprovado"
          ? `${p.nome_completo} entrou como ${papel === "equipa" ? "Equipa Insight" : "Aluno"}`
          : `Pedido de ${p.nome_completo} recusado`,
      );
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setATratar(null);
    }
  }

  async function apagar(p: Perfil) {
    if (!confirm(`Apagar a conta de ${p.nome_completo}? Esta ação não se desfaz.`)) return;
    setATratar(p.id);
    try {
      await apagarConta(p.id);
      toast.success("Conta apagada");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setATratar(null);
    }
  }

  return (
    <div className="page-fade-in">
      <PageHeader
        title="Pedidos de acesso"
        subtitle="Quem pediu para entrar na academia. Aceita como Aluno (vê o conteúdo da academia) ou como Equipa Insight (vê também o conteúdo privado)."
      />
      <div className="mb-4 inline-flex rounded-lg border border-hairline bg-bg-elevated p-1">
        {(
          [
            ["pendente", `Por aprovar (${nPendentes})`],
            ["recusado", `Recusados (${nRecusados})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setAba(k)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              aba === k ? "bg-accent text-white" : "text-text-mid hover:text-accent",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title={aba === "pendente" ? "Nenhum pedido por aprovar" : "Nenhum pedido recusado"}
          description={
            aba === "pendente"
              ? "Quando alguém pedir acesso em /pedir-acesso, aparece aqui e recebes uma notificação."
              : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lista.map((p) => {
            const wa = linkWhatsApp(
              p.telefone,
              `Olá ${p.nome_completo.split(" ")[0]}! Aqui é da Insight Academia.`,
            );
            const ocupado = aTratar === p.id;
            return (
              <div key={p.id} className="app-card flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <Avatar nome={p.nome_completo} className="size-11" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text-hi">{p.nome_completo}</p>
                    <p className="flex items-center gap-1.5 truncate text-sm text-text-mid">
                      <Mail className="size-3.5 shrink-0" /> {p.email}
                    </p>
                    {p.telefone && (
                      <p className="flex items-center gap-1.5 text-sm text-text-mid">
                        <Phone className="size-3.5 shrink-0" /> {p.telefone}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-text-low">
                    {tempoRelativo(p.created_at)}
                  </span>
                </div>
                {p.motivo && (
                  <p className="mt-3 rounded-lg bg-bg-base px-3 py-2 text-sm text-text-mid">
                    “{p.motivo}”
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="success"
                    disabled={ocupado}
                    onClick={() => decidir(p, "aprovado", "aluno")}
                  >
                    <GraduationCap className="size-4" /> Aceitar como aluno
                  </Button>
                  <Button disabled={ocupado} onClick={() => decidir(p, "aprovado", "equipa")}>
                    <Check className="size-4" /> Equipa Insight
                  </Button>
                  {aba === "pendente" ? (
                    <Button
                      variant="danger"
                      disabled={ocupado}
                      onClick={() => decidir(p, "recusado")}
                    >
                      <X className="size-4" /> Recusar
                    </Button>
                  ) : (
                    <Button variant="danger" disabled={ocupado} onClick={() => apagar(p)}>
                      <Trash2 className="size-4" /> Apagar conta
                    </Button>
                  )}
                  {wa && (
                    <a href={wa} target="_blank" rel="noreferrer">
                      <Button variant="ghost">
                        <MessageCircle className="size-4" /> WhatsApp
                      </Button>
                    </a>
                  )}
                </div>
                {p.estado === "recusado" && (
                  <Badge className="mt-3 w-fit bg-red-50 text-red-600">Recusado</Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
