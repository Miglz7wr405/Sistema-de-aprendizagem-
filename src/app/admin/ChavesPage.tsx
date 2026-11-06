import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { chamarFuncao } from "@/lib/supabase";
import { Input } from "../components/Modal";
import { Badge, Button, Carregando, Erro, PageHeader } from "../components/primitives";
import { useData } from "../use-data";

const CHAVES = [
  {
    nome: "GEMINI_API_KEY",
    titulo: "Gemini (recomendado)",
    ajuda: "Motor principal: ouve o vídeo e escreve o título numa só vez. Cria a chave em aistudio.google.com, é grátis.",
  },
  {
    nome: "GROQ_API_KEY",
    titulo: "Groq (alternativa)",
    ajuda: "Só é usada se não houver chave do Gemini. Cria em console.groq.com.",
  },
  {
    nome: "VIMEO_ACCESS_TOKEN",
    titulo: "Vimeo (opcional)",
    ajuda: "Só para ler transcrições de vídeos do Vimeo.",
  },
];

export default function ChavesPage() {
  const { data, loading, error, refetch } = useData(
    () => chamarFuncao<{ estado: Record<string, boolean> }>("definir-chave", { acao: "estado" }),
    [],
  );
  const [valores, setValores] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return <Carregando />;
  if (error || !data) return <Erro mensagem={error ?? "Erro"} onRetry={refetch} />;

  async function guardar(nome: string) {
    setBusy(nome);
    try {
      await chamarFuncao("definir-chave", { acao: "guardar", nome, valor: valores[nome] ?? "" });
      setValores((v) => ({ ...v, [nome]: "" }));
      toast.success("Chave guardada.");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao guardar.");
    } finally {
      setBusy(null);
    }
  }

  async function remover(nome: string) {
    setBusy(nome);
    try {
      await chamarFuncao("definir-chave", { acao: "remover", nome });
      toast.success("Chave removida.");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chaves de API"
        subtitle="Cola aqui as chaves. Ficam guardadas no servidor e nunca voltam a aparecer no ecrã."
      />
      <div className="space-y-4">
        {CHAVES.map((c) => {
          const ok = data.estado[c.nome];
          return (
            <section key={c.nome} className="app-card space-y-3 p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-accent" />
                <h2 className="flex-1 font-display text-base font-semibold text-text-hi">{c.titulo}</h2>
                <Badge className={ok ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}>
                  {ok ? "Configurada" : "Em falta"}
                </Badge>
              </div>
              <p className="text-xs text-text-low">{c.ajuda}</p>
              <Input
                semVoz
                type="password"
                autoComplete="off"
                placeholder={ok ? "Colar nova chave para substituir" : "Colar a chave aqui"}
                value={valores[c.nome] ?? ""}
                onChange={(e) => setValores((v) => ({ ...v, [c.nome]: e.target.value }))}
              />
              <div className="flex justify-end gap-2">
                {ok && (
                  <Button variant="outline" disabled={busy === c.nome} onClick={() => remover(c.nome)}>
                    Remover
                  </Button>
                )}
                <Button disabled={busy === c.nome || !(valores[c.nome] ?? "").trim()} onClick={() => guardar(c.nome)}>
                  {busy === c.nome ? "A guardar..." : "Guardar"}
                </Button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
