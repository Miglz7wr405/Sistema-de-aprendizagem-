import { useRef, useState } from "react";
import { Check, Loader2, Sparkles, X as XIcon } from "lucide-react";
import { toast } from "sonner";

import type { Aula, Curso, Seccao } from "@/lib/types";
import { chamarFuncao } from "@/lib/supabase";
import { Modal } from "./Modal";
import { Button } from "./primitives";

type AulaAlvo = {
  id: string;
  titulo: string;
  descricao: string | null;
  url: string | null;
  modulo: string | null;
};

type Linha = {
  id: string;
  original: string;
  estado: "feito" | "falhou";
  titulo?: string;
  motivo?: string;
};

const MOTIVOS: Record<string, string> = {
  sem_conteudo: "não foi possível ler o vídeo",
  virus_scan: "o Drive pediu confirmação de antivírus",
  permissao: "o download está bloqueado neste ficheiro",
  audio: "o vídeo não deu para ler",
  pedido_grande: "o vídeo era grande demais para enviar",
  sobrecarga: "servidores da IA ocupados, tenta daqui a pouco",
  limite: "limite da IA atingido",
  resposta: "a IA não respondeu em condições",
};

const MB = 1024 * 1024;

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
  const [estado, setEstado] = useState<"configurar" | "a-correr" | "fim">("configurar");
  const [sobrescrever, setSobrescrever] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [feitas, setFeitas] = useState(0);
  const [total, setTotal] = useState(0);
  const [motor, setMotor] = useState("");
  const parar = useRef(false);

  const semDescricao = aulas.filter((a) => !a.descricao?.trim()).length;
  const comDescricao = aulas.length - semDescricao;
  const aGerar = sobrescrever ? aulas.length : semDescricao;

  function abrir() {
    setAberto(true);
    setEstado("configurar");
    setSobrescrever(false);
    setErro(null);
    setLinhas([]);
    setFeitas(0);
    setTotal(0);
    parar.current = false;
  }

  async function correr(so?: string[]) {
    setEstado("a-correr");
    setErro(null);
    setLinhas([]);
    setFeitas(0);
    parar.current = false;

    try {
      const lista = await chamarFuncao<{ aulas: AulaAlvo[]; motor?: string }>("gerar-descricoes", {
        acao: "listar",
        curso_id: curso.id,
        sobrescrever: sobrescrever || !!so,
      });
      setMotor(lista.motor ?? "");
      const alvo = so ? lista.aulas.filter((a) => so.includes(a.id)) : lista.aulas;
      setTotal(alvo.length);
      if (alvo.length === 0) {
        setErro("Não há aulas para tratar. Liga 'Sobrescrever' para refazer as que já têm descrição.");
        setEstado("configurar");
        return;
      }

      for (const a of alvo) {
        if (parar.current) break;

        try {
          const r = await chamarFuncao<{ ok: boolean; titulo?: string; motivo?: string }>(
            "gerar-descricoes",
            { acao: "uma", aula_id: a.id },
          );
          setLinhas((prev) => [
            ...prev,
            r.ok && r.titulo
              ? { id: a.id, original: a.titulo, estado: "feito", titulo: r.titulo }
              : { id: a.id, original: a.titulo, estado: "falhou", motivo: r.motivo },
          ]);
        } catch (e) {
          setLinhas((prev) => [
            ...prev,
            {
              id: a.id,
              original: a.titulo,
              estado: "falhou",
              motivo: e instanceof Error ? e.message : undefined,
            },
          ]);
        }

        setFeitas((n) => n + 1);
      }

      if (parar.current) {
        setErro("Parado por ti. O que já foi gravado ficou guardado.");
      }
      setEstado("fim");
      onAplicar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar.");
      setEstado("configurar");
    }
  }

  const okN = linhas.filter((l) => l.estado === "feito").length;
  const falhouN = linhas.length - okN;

  return (
    <>
      <Button
        variant="outline"
        className="h-10 w-full justify-center border-accent text-accent"
        onClick={abrir}
        disabled={disabled}
      >
        <Sparkles className="size-4" />
        Gerar títulos e descrições com IA
      </Button>

      <Modal
        open={aberto}
        onClose={() => estado !== "a-correr" && setAberto(false)}
        title="Gerar títulos e descrições com IA"
        size="lg"
      >
        {estado === "configurar" && (
          <div className="space-y-4">
            {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

            <div className="rounded-lg bg-bg-base p-4 text-sm">
              <p className="text-text-hi">
                <strong>{curso.titulo}</strong>
                {seccao && <span className="text-text-low"> · {seccao.titulo}</span>}
              </p>
              <p className="mt-2 text-text-mid">
                {aulas.length} aula{aulas.length !== 1 ? "s" : ""} no total
                {semDescricao > 0 && <span className="text-amber-600"> · {semDescricao} sem descrição</span>}
              </p>
            </div>

            {comDescricao > 0 && (
              <label className="flex items-center gap-3 rounded-lg border border-hairline px-4 py-3 text-sm hover:bg-bg-base">
                <input
                  type="checkbox"
                  checked={sobrescrever}
                  onChange={(e) => setSobrescrever(e.target.checked)}
                  className="size-4 rounded border-text-low accent-accent"
                />
                <span className="font-medium text-text-hi">
                  Refazer também as {comDescricao} que já têm descrição
                </span>
              </label>
            )}

            <p className="text-xs text-text-low">
              A IA lê o início de cada vídeo e grava o título e a descrição logo a seguir, uma aula de
              cada vez. Podes parar a meio: o que já foi gravado fica.
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={() => correr()} disabled={aGerar === 0}>
                <Sparkles className="size-4" />
                Começar ({aGerar} aula{aGerar !== 1 ? "s" : ""})
              </Button>
            </div>
          </div>
        )}

        {(estado === "a-correr" || estado === "fim") && (
          <div className="space-y-3">
            {erro && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</div>}

            <div className="flex items-center gap-3">
              {estado === "a-correr" && <Loader2 className="size-4 shrink-0 animate-spin text-accent" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-hi">
                  {estado === "a-correr" ? `A ler aula ${Math.min(feitas + 1, total)} de ${total}` : "Terminado"}
                  {motor && <span className="ml-1.5 text-xs font-normal text-text-low">· {motor}</span>}
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bg-base">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${total ? (feitas / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-xs text-text-low">
                {okN} feitas{falhouN > 0 ? ` · ${falhouN} falhadas` : ""}
              </span>
            </div>

            <div className="max-h-[320px] space-y-1 overflow-y-auto rounded-lg border border-hairline p-2">
              {[...linhas].reverse().map((l) => (
                <div key={l.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm">
                  {l.estado === "feito" ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-green-600" />
                  ) : (
                    <XIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  )}
                  <span className="min-w-0 flex-1">
                    {l.estado === "feito" ? (
                      <>
                        <span className="block text-[11px] text-text-low">{l.original}</span>
                        <span className="font-medium text-text-hi">{l.titulo}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-text-mid">{l.original}</span>
                        <span className="block text-[11px] text-amber-700">
                          {MOTIVOS[l.motivo ?? ""] ?? l.motivo ?? "não foi possível"}
                        </span>
                      </>
                    )}
                  </span>
                </div>
              ))}
              {linhas.length === 0 && (
                <p className="p-3 text-center text-xs text-text-low">A preparar...</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              {estado === "a-correr" ? (
                <Button variant="outline" onClick={() => (parar.current = true)}>
                  Parar
                </Button>
              ) : (
                <>
                  {falhouN > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => correr(linhas.filter((l) => l.estado === "falhou").map((l) => l.id))}
                    >
                      Repetir as {falhouN} falhadas
                    </Button>
                  )}
                  <Button onClick={() => setAberto(false)}>Fechar</Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
