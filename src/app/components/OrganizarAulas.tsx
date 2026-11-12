// Modal "Organizar com IA" para o painel de Conteúdo.
// Pede à IA uma proposta de módulos, deixa o admin editar, grava com um clique.
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { chamarFuncao } from "@/lib/supabase";
import type { Aula } from "@/lib/types";
import { Field, Input, Modal, Textarea } from "./Modal";
import { Button } from "./primitives";

type ModuloEdit = {
  localId: string;
  titulo: string;
  descricao: string;
  aulas: string[];
};

type RespostaProposta = {
  ok: true;
  modulos: Array<{ titulo: string; descricao?: string; aulas: Array<{ id: string }> }>;
  razao?: string;
};

export function BotaoOrganizarAulas({
  cursoId,
  aulas,
  disabled,
  onGravado,
}: {
  cursoId: string;
  aulas: Aula[];
  disabled?: boolean;
  onGravado: () => Promise<void> | void;
}) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mods, setMods] = useState<ModuloEdit[]>([]);

  const mapaAula = new Map(aulas.map((a) => [a.id, a]));

  async function abrir() {
    if (aulas.length === 0) {
      toast.error("Adiciona aulas ao curso antes de organizar.");
      return;
    }
    setAberto(true);
    setErro(null);
    setMods([]);
    await pedirProposta();
  }

  async function pedirProposta() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await chamarFuncao<RespostaProposta>("organizar-aulas", {
        curso_id: cursoId,
      });
      const edit: ModuloEdit[] = r.modulos.map((m, i) => ({
        localId: `m-${i}-${crypto.randomUUID()}`,
        titulo: m.titulo,
        descricao: m.descricao ?? "",
        aulas: m.aulas.map((a) => a.id).filter((id) => mapaAula.has(id)),
      }));
      setMods(edit);
      if (r.razao) toast.message(r.razao);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao pedir a proposta.");
    } finally {
      setCarregando(false);
    }
  }

  function moverModulo(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= mods.length) return;
    const nova = [...mods];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    setMods(nova);
  }
  function removerModulo(i: number) {
    const [removido] = mods.splice(i, 1);
    if (!removido) return;
    const extras = removido.aulas;
    const copia = [...mods];
    // Devolve as aulas desse módulo para o primeiro — para não se perderem.
    if (copia[0]) copia[0].aulas.push(...extras);
    else {
      copia.push({
        localId: `m-sobras-${crypto.randomUUID()}`,
        titulo: "Outras aulas",
        descricao: "",
        aulas: extras,
      });
    }
    setMods([...copia]);
  }
  function adicionarModulo() {
    setMods([
      ...mods,
      {
        localId: `m-novo-${crypto.randomUUID()}`,
        titulo: "Novo módulo",
        descricao: "",
        aulas: [],
      },
    ]);
  }
  function mudarTitulo(i: number, v: string) {
    const nova = [...mods];
    nova[i] = { ...nova[i], titulo: v };
    setMods(nova);
  }
  function mudarDescricao(i: number, v: string) {
    const nova = [...mods];
    nova[i] = { ...nova[i], descricao: v };
    setMods(nova);
  }
  function moverAula(mi: number, ai: number, d: -1 | 1) {
    const aj = ai + d;
    if (aj < 0 || aj >= mods[mi].aulas.length) return;
    const nova = [...mods];
    const lista = [...nova[mi].aulas];
    [lista[ai], lista[aj]] = [lista[aj], lista[ai]];
    nova[mi] = { ...nova[mi], aulas: lista };
    setMods(nova);
  }
  function moverAulaParaModulo(deOrigem: number, aulaIdx: number, paraDestino: number) {
    if (deOrigem === paraDestino) return;
    const nova = [...mods];
    const [removida] = nova[deOrigem].aulas.splice(aulaIdx, 1);
    nova[paraDestino].aulas.push(removida);
    setMods([...nova]);
  }

  async function gravar() {
    // Confirma que todas as aulas aparecem (não devem ficar órfãs).
    const vistos = new Set<string>();
    for (const m of mods) {
      if (!m.titulo.trim()) return toast.error("Dá um nome a todos os módulos.");
      for (const id of m.aulas) {
        if (vistos.has(id)) return toast.error("Há aulas repetidas entre módulos.");
        vistos.add(id);
      }
    }
    const faltam = aulas.filter((a) => !vistos.has(a.id));
    if (faltam.length > 0) {
      return toast.error(
        `Faltam ${faltam.length} aula${faltam.length === 1 ? "" : "s"} para encaixar.`,
      );
    }
    setGravando(true);
    try {
      await chamarFuncao("gravar-organizacao", {
        curso_id: cursoId,
        modulos: mods
          .filter((m) => m.aulas.length > 0)
          .map((m) => ({
            titulo: m.titulo.trim(),
            descricao: m.descricao.trim() || null,
            aulas: m.aulas.map((id) => ({ id })),
          })),
      });
      toast.success("Aulas organizadas por módulos.");
      setAberto(false);
      await onGravado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gravar.");
    } finally {
      setGravando(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        className="h-8 px-2.5"
        onClick={abrir}
        disabled={disabled}
        title="Deixa a IA agrupar as aulas em módulos e ordená-las do mais básico ao mais avançado"
      >
        <Sparkles className="size-4" />
        Organizar
      </Button>

      <Modal
        open={aberto}
        onClose={() => !gravando && !carregando && setAberto(false)}
        title="Organizar aulas com IA"
        size="lg"
      >
        {carregando ? (
          <div className="flex flex-col items-center gap-3 py-12 text-text-low">
            <Loader2 className="size-6 animate-spin" />
            <p className="text-sm">A IA está a agrupar as {aulas.length} aulas...</p>
          </div>
        ) : erro ? (
          <div className="py-8 text-center">
            <p className="text-sm text-red-600">{erro}</p>
            <Button className="mt-4" variant="outline" onClick={pedirProposta}>
              Tentar outra vez
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
              <Wand2 className="size-4 shrink-0" />
              <p>
                A IA propõe módulos e a ordem das aulas. Podes mudar títulos, mover aulas e gravar.
              </p>
            </div>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {mods.map((m, i) => (
                <article key={m.localId} className="rounded-xl border border-hairline p-3">
                  <div className="flex items-start gap-2">
                    <span className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => moverModulo(i, -1)}
                        disabled={i === 0}
                        className="rounded p-0.5 text-text-low hover:text-accent disabled:opacity-30"
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moverModulo(i, 1)}
                        disabled={i === mods.length - 1}
                        className="rounded p-0.5 text-text-low hover:text-accent disabled:opacity-30"
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                    </span>
                    <div className="flex-1 space-y-2">
                      <Field label={`Módulo ${i + 1}`}>
                        <Input
                          semVoz
                          value={m.titulo}
                          onChange={(e) => mudarTitulo(i, e.target.value)}
                        />
                      </Field>
                      <Textarea
                        value={m.descricao}
                        onChange={(e) => mudarDescricao(i, e.target.value)}
                        placeholder="Descrição curta (opcional)"
                        className="min-h-[40px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removerModulo(i)}
                      className="grid size-8 place-items-center rounded-lg text-text-low hover:bg-red-50 hover:text-red-600"
                      title="Apagar módulo (as aulas vão para o primeiro)"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <ul className="mt-2 space-y-1">
                    {m.aulas.map((id, ai) => {
                      const a = mapaAula.get(id);
                      if (!a) return null;
                      return (
                        <li
                          key={id}
                          className="flex items-center gap-2 rounded-md bg-bg-base px-2 py-1.5"
                        >
                          <span className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => moverAula(i, ai, -1)}
                              disabled={ai === 0}
                              className="rounded p-0.5 text-text-low hover:text-accent disabled:opacity-30"
                            >
                              <ArrowUp className="size-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moverAula(i, ai, 1)}
                              disabled={ai === m.aulas.length - 1}
                              className="rounded p-0.5 text-text-low hover:text-accent disabled:opacity-30"
                            >
                              <ArrowDown className="size-3" />
                            </button>
                          </span>
                          <span className="line-clamp-2 flex-1 text-sm text-text-hi">
                            {a.titulo}
                          </span>
                          <SelectMover
                            modulos={mods}
                            origem={i}
                            onMover={(destino) => moverAulaParaModulo(i, ai, destino)}
                          />
                        </li>
                      );
                    })}
                    {m.aulas.length === 0 && (
                      <li className="rounded-md border border-dashed border-hairline px-2 py-3 text-center text-xs text-text-low">
                        Sem aulas neste módulo.
                      </li>
                    )}
                  </ul>
                </article>
              ))}
              <button
                type="button"
                onClick={adicionarModulo}
                className="w-full rounded-xl border-2 border-dashed border-hairline py-3 text-sm font-medium text-text-low hover:border-accent hover:text-accent"
              >
                + Adicionar módulo
              </button>
            </div>

            <div className="flex justify-between gap-2 border-t border-hairline pt-3">
              <Button variant="outline" onClick={pedirProposta} disabled={gravando}>
                <Sparkles className="size-4" /> Nova proposta
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setAberto(false)} disabled={gravando}>
                  Cancelar
                </Button>
                <Button onClick={gravar} disabled={gravando || mods.length === 0}>
                  {gravando ? "A gravar..." : "Gravar organização"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

function SelectMover({
  modulos,
  origem,
  onMover,
}: {
  modulos: ModuloEdit[];
  origem: number;
  onMover: (destino: number) => void;
}) {
  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = "";
  }, [origem]);
  return (
    <select
      ref={ref}
      defaultValue=""
      onChange={(e) => {
        const v = Number(e.target.value);
        if (!Number.isNaN(v)) onMover(v);
        e.currentTarget.value = "";
      }}
      className="shrink-0 rounded-md border border-hairline bg-bg-elevated px-1.5 py-1 text-xs text-text-mid"
      title="Mover para outro módulo"
    >
      <option value="" disabled>
        → módulo
      </option>
      {modulos.map((m, i) =>
        i === origem ? null : (
          <option key={m.localId} value={i}>
            {i + 1}. {m.titulo || "Sem título"}
          </option>
        ),
      )}
    </select>
  );
}
