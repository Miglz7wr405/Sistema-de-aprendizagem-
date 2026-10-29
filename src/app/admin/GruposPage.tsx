import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Lock,
  Megaphone,
  MessagesSquare,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Grupos } from "@/lib/db";
import type { Grupo, Visibilidade } from "@/lib/types";
import { Field, Input, Modal, Switch, Textarea } from "../components/Modal";
import { Badge, Button, Carregando, EmptyState, Erro, PageHeader } from "../components/primitives";
import { useData } from "../use-data";
import { EscolhaVisibilidade } from "./Visibilidade";

type FormGrupo = {
  nome: string;
  descricao: string;
  icone: string;
  visibilidade: Visibilidade;
  so_admins_escrevem: boolean;
};

const VAZIO: FormGrupo = {
  nome: "",
  descricao: "",
  icone: "💬",
  visibilidade: "academia",
  so_admins_escrevem: false,
};

export default function GruposPage() {
  const { data, loading, error, refetch } = useData(() => Grupos.listar(), []);
  const [editar, setEditar] = useState<Grupo | "novo" | null>(null);
  const [form, setForm] = useState<FormGrupo>(VAZIO);
  const [busy, setBusy] = useState(false);

  if (loading) return <Carregando />;
  if (error || !data) return <Erro mensagem={error ?? "Erro"} onRetry={refetch} />;

  function abrir(g: Grupo | "novo") {
    setEditar(g);
    setForm(
      g === "novo"
        ? VAZIO
        : {
            nome: g.nome,
            descricao: g.descricao ?? "",
            icone: g.icone ?? "💬",
            visibilidade: g.visibilidade,
            so_admins_escrevem: g.so_admins_escrevem,
          },
    );
  }

  async function guardar() {
    if (!form.nome.trim()) return toast.error("Dá um nome ao grupo.");
    setBusy(true);
    try {
      const dados = {
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        icone: form.icone.trim() || "💬",
        visibilidade: form.visibilidade,
        so_admins_escrevem: form.so_admins_escrevem,
      };
      if (editar === "novo") await Grupos.criar({ ...dados, ordem: data!.length });
      else if (editar) await Grupos.atualizar(editar.id, dados);
      toast.success("Grupo guardado");
      setEditar(null);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function apagar(g: Grupo) {
    if (!confirm(`Apagar o grupo "${g.nome}" e todas as mensagens?`)) return;
    try {
      await Grupos.apagar(g.id);
      toast.success("Grupo apagado");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function mover(i: number, d: -1 | 1) {
    const lista = [...data!];
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    await Promise.all(
      lista.map((g, k) => (g.ordem === k ? null : Grupos.atualizar(g.id, { ordem: k }))),
    );
    await refetch();
  }

  return (
    <div className="page-fade-in">
      <PageHeader
        title="Grupos da comunidade"
        subtitle="Cria grupos como no WhatsApp: Geral, Prospecção, Dúvidas... Cada grupo pode ser privado (só equipa Insight) ou da academia (todos)."
        action={
          <Button onClick={() => abrir("novo")}>
            <Plus className="size-4" /> Novo grupo
          </Button>
        }
      />
      {data.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="Ainda não há grupos" />
      ) : (
        <div className="app-card divide-y divide-hairline">
          {data.map((g, i) => (
            <div key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-lg">
                {g.icone || "💬"}
              </span>
              <div className="min-w-[160px] flex-1">
                <p className="font-medium text-text-hi">{g.nome}</p>
                {g.descricao && <p className="text-xs text-text-mid">{g.descricao}</p>}
              </div>
              {g.visibilidade === "privada" ? (
                <Badge className="bg-slate-100 text-slate-700">
                  <Lock className="size-3" /> Só equipa
                </Badge>
              ) : (
                <Badge className="bg-green-50 text-green-700">Academia</Badge>
              )}
              {g.so_admins_escrevem && (
                <Badge className="bg-amber-50 text-amber-700">
                  <Megaphone className="size-3" /> Só admins escrevem
                </Badge>
              )}
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  aria-label="Subir"
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => mover(i, 1)}
                  disabled={i === data.length - 1}
                  aria-label="Descer"
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => abrir(g)}
                  aria-label="Editar"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  className="h-8 px-2 hover:text-red-600"
                  onClick={() => apagar(g)}
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
        title={editar === "novo" ? "Novo grupo" : "Editar grupo"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <Field label="Ícone">
              <Input
                semVoz
                value={form.icone}
                onChange={(e) => setForm({ ...form, icone: e.target.value })}
                className="text-center text-lg"
                maxLength={4}
              />
            </Field>
            <Field label="Nome" required>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Prospecção"
              />
            </Field>
          </div>
          <Field label="Descrição">
            <Textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className="min-h-[70px]"
            />
          </Field>
          <EscolhaVisibilidade
            valor={form.visibilidade}
            onChange={(v) => setForm({ ...form, visibilidade: v })}
          />
          <Switch
            checked={form.so_admins_escrevem}
            onChange={(v) => setForm({ ...form, so_admins_escrevem: v })}
            label="Só os administradores escrevem (grupo de avisos)"
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
