import { useEffect, useState } from "react";
import { KeyRound, LogOut, Save } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";
import { Perfis } from "@/lib/db";
import { PAPEL_LABEL } from "@/lib/types";
import { useAuth } from "../auth";
import { Field, Input } from "../components/Modal";
import { Avatar, Badge, Button, Card, PageHeader } from "../components/primitives";

export default function PerfilPage() {
  const { perfil, recarregarPerfil, sair } = useAuth();
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [busy, setBusy] = useState(false);
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [busySenha, setBusySenha] = useState(false);

  useEffect(() => {
    setNome(perfil?.nome_completo ?? "");
    setTelefone(perfil?.telefone ?? "");
  }, [perfil]);

  if (!perfil) return null;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!perfil || nome.trim().length < 3) {
      toast.error("Escreve o teu nome completo.");
      return;
    }
    setBusy(true);
    try {
      await Perfis.atualizar(perfil.id, {
        nome_completo: nome.trim(),
        telefone: telefone.trim() || null,
      });
      await recarregarPerfil();
      toast.success("Perfil guardado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao guardar");
    } finally {
      setBusy(false);
    }
  }

  async function mudarSenha(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 6) return toast.error("A palavra-passe precisa de pelo menos 6 caracteres.");
    if (senha !== senha2) return toast.error("As palavras-passe não são iguais.");
    setBusySenha(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setBusySenha(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Palavra-passe alterada");
      setSenha("");
      setSenha2("");
    }
  }

  return (
    <div className="page-fade-in max-w-2xl">
      <PageHeader title="O meu perfil" />
      <Card className="mb-5 flex items-center gap-4">
        <Avatar nome={perfil.nome_completo} className="size-14 text-lg" tom="solid" />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-text-hi">
            {perfil.nome_completo}
          </p>
          <p className="truncate text-sm text-text-mid">{perfil.email}</p>
          <Badge className="mt-1 bg-accent-soft text-accent">{PAPEL_LABEL[perfil.papel]}</Badge>
        </div>
      </Card>

      <Card className="mb-5">
        <h2 className="mb-4 font-display text-base font-semibold">Os meus dados</h2>
        <form onSubmit={guardar} className="space-y-3">
          <Field label="Nome completo">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="WhatsApp">
            <Input type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </Field>
          <Button type="submit" disabled={busy}>
            <Save className="size-4" /> {busy ? "A guardar..." : "Guardar"}
          </Button>
        </form>
      </Card>

      <Card className="mb-5">
        <h2 className="mb-4 font-display text-base font-semibold">Mudar palavra-passe</h2>
        <form onSubmit={mudarSenha} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nova palavra-passe">
              <Input
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </Field>
            <Field label="Repetir">
              <Input
                type="password"
                autoComplete="new-password"
                value={senha2}
                onChange={(e) => setSenha2(e.target.value)}
              />
            </Field>
          </div>
          <Button type="submit" variant="outline" disabled={busySenha}>
            <KeyRound className="size-4" /> {busySenha ? "A mudar..." : "Mudar palavra-passe"}
          </Button>
        </form>
      </Card>

      <Button variant="danger" onClick={sair}>
        <LogOut className="size-4" /> Sair da conta
      </Button>
    </div>
  );
}
