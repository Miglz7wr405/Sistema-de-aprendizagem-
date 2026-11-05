import { useState } from "react";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Aulas } from "@/lib/db";
import type { Aula, Curso, Seccao } from "@/lib/types";
import { chamarFuncao } from "@/lib/supabase";
import { Modal, Textarea } from "./Modal";
import { Button } from "./primitives";

type DescricaoGerada = {
  aula_id: string;
  titulo: string;
  descricao_gerada: string;
};

type Estado = "configurar" | "a-gerar" | "rever";

export function BotaoGerarDescricoes({
  curso,
  seccao,
  aulas,
  onAplicar,
  disabled,
}: {
  curso: Curso;
  seccao: Seccao;
  aulas: Aula[];
  onAplicar: () => void;
  disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<Estado>("configurar");
  const [sobrescrever, setSobrescrever] = useState(false);
  const [resultados, setResultados] = useState<DescricaoGerada[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const semDescricao = aulas.filter((a) => !a.descricao?.trim()).length;
  const comDescricao = aulas.length - semDescricao;

  function abrir() {
    setAberto(true);
    setEstado("configurar");
    setSobrescrever(false);
    setResultados([]);
    setSelecionados(new Set());
    setTextos({});
    setErro(null);
  }

  async function gerar() {
    setEstado("a-gerar");
    setErro(null);
    try {
      const resp = await chamarFuncao<{ ok: boolean; descricoes: DescricaoGerada[] }>(
        "gerar-descricoes",
        { curso_id: curso.id, sobrescrever },
      );
      setResultados(resp.descricoes);
      setSelecionados(new Set(resp.descricoes.map((d) => d.aula_id)));
      const t: Record<string, string> = {};
      for (const d of resp.descricoes) t[d.aula_id] = d.descricao_gerada;
      setTextos(t);
      setEstado("rever");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar descrições.";
      setErro(msg);
      setEstado("configurar");
    }
  }

  function alternar(id: string) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function selecionarTodos() {
    if (selecionados.size === resultados.length) setSelecionados(new Set());
    else setSelecionados(new Set(resultados.map((d) => d.aula_id)));
  }

  async function aplicar() {
    const escolhidos = resultados.filter((d) => selecionados.has(d.aula_id));
    if (escolhidos.length === 0) return toast.error("Seleciona pelo menos uma aula.");
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        escolhidos.map((d) => Aulas.atualizar(d.aula_id, { descricao: textos[d.aula_id] ?? d.descricao_gerada })),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const falhou = results.length - ok;
      if (falhou > 0) {
        toast.error(`${ok} descrições guardadas, ${falhou} falharam.`);
      } else {
        toast.success(`${ok} descrição${ok !== 1 ? "ões" : ""} guardada${ok !== 1 ? "s" : ""}`);
      }
      setAberto(false);
      onAplicar();
    } catch {
      toast.error("Erro ao guardar descrições.");
    } finally {
      setBusy(false);
    }
  }

  const nSel = selecionados.size;

  return (
    <>
      <Button
        variant="outline"
        className="h-8 px-2.5"
        onClick={abrir}
        disabled={disabled}
        title="Gerar descrições com IA"
      >
        <Sparkles className="size-4" />
        IA
      </Button>

      <Modal
        open={aberto}
        onClose={() => estado !== "a-gerar" && !busy && setAberto(false)}
        title="Gerar descrições com IA"
        size="lg"
      >
        {estado === "configurar" && (
          <div className="space-y-4">
            {erro && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>
            )}
            <div className="rounded-lg bg-bg-base p-4 text-sm">
              <p className="text-text-hi">
                <strong>{curso.titulo}</strong>
                {seccao && <span className="text-text-low"> · {seccao.titulo}</span>}
              </p>
              <p className="mt-2 text-text-mid">
                {aulas.length} aula{aulas.length !== 1 ? "s" : ""} no total
                {semDescricao > 0 && (
                  <span className="text-amber-600"> · {semDescricao} sem descrição</span>
                )}
                {comDescricao > 0 && (
                  <span className="text-green-600"> · {comDescricao} já com descrição</span>
                )}
              </p>
            </div>

            {comDescricao > 0 && (
              <label className="flex items-center gap-3 rounded-lg border border-hairline px-4 py-3 text-sm transition hover:bg-bg-base">
                <input
                  type="checkbox"
                  checked={sobrescrever}
                  onChange={(e) => setSobrescrever(e.target.checked)}
                  className="size-4 rounded border-text-low accent-accent"
                />
                <span>
                  <span className="font-medium text-text-hi">Sobrescrever descrições existentes</span>
                  <span className="block text-xs text-text-low">
                    {comDescricao} aula{comDescricao !== 1 ? "s" : ""} já {comDescricao !== 1 ? "têm" : "tem"} descrição
                  </span>
                </span>
              </label>
            )}

            <p className="text-xs text-text-low">
              A IA vai analisar os títulos, módulos e contexto do curso para escrever descrições
              em português. Podes rever e editar antes de guardar.
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={gerar}>
                <Sparkles className="size-4" />
                Gerar {sobrescrever ? aulas.length : semDescricao} descrição{(sobrescrever ? aulas.length : semDescricao) !== 1 ? "ões" : ""}
              </Button>
            </div>
          </div>
        )}

        {estado === "a-gerar" && (
          <div className="flex flex-col items-center gap-3 py-12 text-text-low">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">A gerar descrições com IA...</p>
            <p className="text-xs">Pode demorar até 30 segundos.</p>
          </div>
        )}

        {estado === "rever" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={selecionarTodos}
                className="text-sm font-medium text-accent hover:underline"
              >
                {selecionados.size === resultados.length ? "Desselecionar tudo" : "Selecionar tudo"}
              </button>
              <span className="text-xs text-text-low">
                {nSel} de {resultados.length} selecionada{nSel !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="max-h-[400px] space-y-2 overflow-y-auto rounded-lg border border-hairline p-2">
              {resultados.map((d, i) => (
                <div
                  key={d.aula_id}
                  className={`rounded-lg border p-3 transition ${
                    selecionados.has(d.aula_id)
                      ? "border-accent bg-accent-soft/30"
                      : "border-hairline opacity-60"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => alternar(d.aula_id)}
                      className={`grid size-5 shrink-0 place-items-center rounded border ${
                        selecionados.has(d.aula_id)
                          ? "border-accent bg-accent text-white"
                          : "border-text-low"
                      }`}
                    >
                      {selecionados.has(d.aula_id) && <Check className="size-3.5" />}
                    </button>
                    <span className="text-sm font-medium text-text-hi">
                      {i + 1}. {d.titulo}
                    </span>
                  </div>
                  <Textarea
                    value={textos[d.aula_id] ?? d.descricao_gerada}
                    onChange={(e) =>
                      setTextos((prev) => ({ ...prev, [d.aula_id]: e.target.value }))
                    }
                    className="min-h-[60px] text-sm"
                    disabled={!selecionados.has(d.aula_id)}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                className="text-xs"
                onClick={() => {
                  setEstado("configurar");
                  setErro(null);
                }}
              >
                Voltar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAberto(false)}>
                  Cancelar
                </Button>
                <Button onClick={aplicar} disabled={nSel === 0 || busy}>
                  {busy ? "A guardar..." : `Aplicar ${nSel} descrição${nSel !== 1 ? "ões" : ""}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
