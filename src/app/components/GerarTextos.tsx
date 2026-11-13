// Gera títulos e descrições das aulas com a IA do dono (Gemini/Groq), via a
// Edge Function `gerar-descricoes`. Botão de lote (cabeçalho) e ajudante por aula.
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { chamarFuncao } from "@/lib/supabase";
import { Modal } from "./Modal";
import { Button } from "./primitives";

type AulaLista = { id: string; titulo: string };
type RespUma = { ok: boolean; titulo?: string; descricao?: string; motivo?: string };

const MOTIVO: Record<string, string> = {
  audio: "sem áudio/legenda para analisar",
  permissao: "vídeo privado (partilha necessária)",
  virus_scan: "o Drive bloqueou o download (ficheiro grande)",
  limite: "limite da API atingido — tenta mais tarde",
  sobrecarga: "a IA está sobrecarregada — tenta mais tarde",
  pedido_grande: "vídeo demasiado grande",
  resposta: "a IA não devolveu um resultado válido",
};

/** Gera título+descrição de UMA aula. Devolve o resultado ou lança com mensagem. */
export async function gerarUmaAula(aulaId: string): Promise<{ titulo: string; descricao: string }> {
  const r = await chamarFuncao<RespUma>("gerar-descricoes", { acao: "uma", aula_id: aulaId });
  if (!r.ok || !r.titulo || !r.descricao) {
    throw new Error(MOTIVO[r.motivo ?? ""] ?? "não foi possível gerar");
  }
  return { titulo: r.titulo, descricao: r.descricao };
}

export function BotaoGerarTextos({
  cursoId,
  disabled,
  onConcluido,
}: {
  cursoId: string;
  disabled?: boolean;
  onConcluido: () => Promise<void> | void;
}) {
  const [aberto, setAberto] = useState(false);
  const [sobrescrever, setSobrescrever] = useState(false);
  const [a_correr, setACorrer] = useState(false);
  const [progresso, setProgresso] = useState({ feitas: 0, total: 0, falhas: 0 });

  async function correr() {
    setACorrer(true);
    setProgresso({ feitas: 0, total: 0, falhas: 0 });
    try {
      const lista = await chamarFuncao<{ ok: boolean; motor: string; aulas: AulaLista[] }>(
        "gerar-descricoes",
        { acao: "listar", curso_id: cursoId, sobrescrever },
      );
      const aulas = lista.aulas ?? [];
      if (aulas.length === 0) {
        toast.success("Todas as aulas já têm descrição.");
        setACorrer(false);
        setAberto(false);
        return;
      }
      setProgresso({ feitas: 0, total: aulas.length, falhas: 0 });
      let falhas = 0;
      for (let i = 0; i < aulas.length; i++) {
        try {
          await gerarUmaAula(aulas[i].id);
        } catch {
          falhas++;
        }
        setProgresso({ feitas: i + 1, total: aulas.length, falhas });
      }
      await onConcluido();
      if (falhas === 0) toast.success(`${aulas.length} aulas feitas com ${lista.motor}.`);
      else
        toast.warning(
          `${aulas.length - falhas} feitas, ${falhas} falharam (vídeos privados ou sem áudio).`,
        );
      setAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar.");
    } finally {
      setACorrer(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-8 px-2.5"
        onClick={() => setAberto(true)}
        disabled={disabled}
        title="Gerar título e descrição das aulas com IA"
      >
        <Sparkles className="size-4" />
        Textos
      </Button>

      <Modal
        open={aberto}
        onClose={() => !a_correr && setAberto(false)}
        title="Gerar títulos e descrições"
      >
        {a_correr ? (
          <div className="space-y-3 py-4 text-center">
            <Loader2 className="mx-auto size-6 animate-spin text-accent" />
            <p className="text-sm text-text-mid">
              {progresso.total === 0
                ? "A preparar..."
                : `Aula ${progresso.feitas} de ${progresso.total}...`}
            </p>
            {progresso.total > 0 && (
              <div className="h-2 overflow-hidden rounded-full bg-bg-base">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${(progresso.feitas / progresso.total) * 100}%` }}
                />
              </div>
            )}
            <p className="text-xs text-text-low">
              Cada vídeo é analisado pela IA — pode demorar. Não feches esta janela.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-text-mid">
              A IA ouve o início de cada vídeo e escreve um título claro e uma descrição. Usa a tua
              chave Gemini ou Groq (em IA & Chaves).
            </p>
            <label className="flex items-start gap-2 rounded-lg border border-hairline p-3">
              <input
                type="checkbox"
                checked={sobrescrever}
                onChange={(e) => setSobrescrever(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium text-text-hi">
                  Refazer todas as aulas
                </span>
                <span className="block text-xs text-text-mid">
                  Desligado: só as aulas que ainda não têm descrição. Ligado: refaz todas.
                </span>
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={correr}>
                <Sparkles className="size-4" /> Começar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
