import { useEffect, useState } from "react";
import { Check, KeyRound, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { chamarFuncao } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Field, Input } from "../components/Modal";
import { Button, Carregando, PageHeader } from "../components/primitives";

type NomeChave = "GEMINI_API_KEY" | "GROQ_API_KEY" | "VIMEO_ACCESS_TOKEN";
type Estado = Record<NomeChave, boolean>;

const CHAVES: {
  nome: NomeChave;
  titulo: string;
  descricao: string;
  comoObter: string;
  link: string;
}[] = [
  {
    nome: "GEMINI_API_KEY",
    titulo: "Google Gemini",
    descricao:
      "Usada para gerar títulos e descrições das aulas e para organizar os cursos em módulos. Tem um plano gratuito generoso — recomendada.",
    comoObter: "aistudio.google.com → Get API key",
    link: "https://aistudio.google.com/apikey",
  },
  {
    nome: "GROQ_API_KEY",
    titulo: "Groq",
    descricao:
      "Alternativa à Gemini (e usada para transcrever o áudio dos vídeos quando não há legendas). Muito rápida.",
    comoObter: "console.groq.com → API Keys",
    link: "https://console.groq.com/keys",
  },
  {
    nome: "VIMEO_ACCESS_TOKEN",
    titulo: "Vimeo",
    descricao:
      "Token pessoal do Vimeo. Serve para ler legendas dos vídeos e para a ferramenta de corrigir a privacidade em massa.",
    comoObter: "developer.vimeo.com → Personal Access Token",
    link: "https://developer.vimeo.com/apps",
  },
];

export default function IAPage() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function carregar() {
    try {
      const r = await chamarFuncao<{ ok: boolean; estado: Estado }>("definir-chave", {
        acao: "estado",
      });
      setEstado(r.estado);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro a carregar o estado das chaves.");
    }
  }
  useEffect(() => {
    carregar();
  }, []);

  async function guardar(nome: NomeChave) {
    const valor = (valores[nome] ?? "").trim();
    if (valor.length < 8) return toast.error("Cola a chave completa.");
    setOcupado(nome);
    try {
      await chamarFuncao("definir-chave", { acao: "guardar", nome, valor });
      toast.success("Chave guardada. As ferramentas de IA já a usam.");
      setValores((v) => ({ ...v, [nome]: "" }));
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível guardar.");
    } finally {
      setOcupado(null);
    }
  }

  async function remover(nome: NomeChave) {
    if (!confirm("Remover esta chave?")) return;
    setOcupado(nome);
    try {
      await chamarFuncao("definir-chave", { acao: "remover", nome });
      toast.success("Chave removida.");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="page-fade-in">
      <PageHeader
        title="IA & Chaves de API"
        subtitle="Cola aqui as tuas chaves. Ficam guardadas em segurança no servidor e nunca aparecem no site nem são partilhadas."
      />

      <div className="mb-5 flex items-start gap-2 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3 text-sm text-accent">
        <Sparkles className="mt-0.5 size-5 shrink-0" />
        <p>
          Com uma chave destas ligada, o painel de Conteúdo ganha 3 ferramentas:{" "}
          <strong>gerar título</strong>, <strong>gerar descrição</strong> e{" "}
          <strong>organizar as aulas em módulos</strong> — tudo automático.
        </p>
      </div>

      {!estado ? (
        <Carregando />
      ) : (
        <div className="space-y-4">
          {CHAVES.map((c) => {
            const ligada = estado[c.nome];
            const aMexer = ocupado === c.nome;
            return (
              <section key={c.nome} className="app-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-5 text-accent" />
                    <h3 className="font-display text-base font-semibold text-text-hi">
                      {c.titulo}
                    </h3>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      ligada ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {ligada ? (
                      <>
                        <Check className="size-3" /> Ligada
                      </>
                    ) : (
                      <>
                        <X className="size-3" /> Por configurar
                      </>
                    )}
                  </span>
                </div>
                <p className="mt-2 text-sm text-text-mid">{c.descricao}</p>
                <p className="mt-1 text-xs text-text-low">
                  Onde obter:{" "}
                  <a
                    href={c.link}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent hover:underline"
                  >
                    {c.comoObter}
                  </a>
                </p>

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    <Field label={ligada ? "Substituir a chave" : "Colar a chave"}>
                      <Input
                        semVoz
                        type="password"
                        autoComplete="off"
                        placeholder={ligada ? "•••••••• (já há uma guardada)" : "Cola aqui a chave"}
                        value={valores[c.nome] ?? ""}
                        onChange={(e) => setValores((v) => ({ ...v, [c.nome]: e.target.value }))}
                      />
                    </Field>
                  </div>
                  <Button onClick={() => guardar(c.nome)} disabled={aMexer}>
                    {aMexer ? <Loader2 className="size-4 animate-spin" /> : "Guardar"}
                  </Button>
                  {ligada && (
                    <Button variant="outline" onClick={() => remover(c.nome)} disabled={aMexer}>
                      <Trash2 className="size-4" /> Remover
                    </Button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
