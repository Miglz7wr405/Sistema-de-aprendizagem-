// Pop-up "Novidades da Plataforma": aparece quando entra um curso novo (tabela `novidades`,
// criada automaticamente quando um curso é publicado).
// - Conferir: abre o curso e não volta a mostrar essa novidade.
// - Ver depois: esconde só nesta sessão.
// - Ok, não quero ver novamente: não volta a mostrar estas novidades.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "../auth";

type Novidade = {
  id: string;
  titulo: string;
  texto: string | null;
  criado_em: string;
  curso_id: string | null;
  cursos: { titulo: string; descricao: string | null; capa_url: string | null } | null;
};

const CHAVE_SESSAO = "insight-novidades-depois";
const DIAS = 30;

function lerDepois(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(CHAVE_SESSAO) ?? "[]");
  } catch {
    return [];
  }
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function NovidadesPopup() {
  const { sessao } = useAuth();
  const navigate = useNavigate();
  const [lista, setLista] = useState<Novidade[]>([]);
  const uid = sessao?.user.id;

  useEffect(() => {
    if (!uid) return;
    let vivo = true;
    (async () => {
      const desde = new Date(Date.now() - DIAS * 86400000).toISOString();
      const [{ data: novs }, { data: vistas }] = await Promise.all([
        supabase
          .from("novidades")
          .select("id, titulo, texto, criado_em, curso_id, cursos(titulo, descricao, capa_url)")
          .eq("ativo", true)
          .gte("criado_em", desde)
          .order("criado_em", { ascending: false })
          .limit(5),
        supabase.from("novidades_dispensadas").select("novidade_id").eq("user_id", uid),
      ]);
      if (!vivo) return;
      const fora = new Set([...(vistas ?? []).map((v) => v.novidade_id as string), ...lerDepois()]);
      const visiveis = ((novs ?? []) as unknown as Novidade[]).filter(
        // Sem curso visível (não publicado / sem acesso) não mostra.
        (n) => !fora.has(n.id) && (!n.curso_id || n.cursos),
      );
      // Pequena pausa para não aparecer por cima da animação de entrada.
      window.setTimeout(() => vivo && setLista(visiveis), 1800);
    })();
    return () => {
      vivo = false;
    };
  }, [uid]);

  if (!uid || lista.length === 0) return null;

  async function dispensar(ids: string[]) {
    await supabase.from("novidades_dispensadas").upsert(
      ids.map((novidade_id) => ({ user_id: uid, novidade_id })),
      { onConflict: "user_id,novidade_id", ignoreDuplicates: true },
    );
  }

  function verDepois() {
    try {
      sessionStorage.setItem(
        CHAVE_SESSAO,
        JSON.stringify([...lerDepois(), ...lista.map((n) => n.id)]),
      );
    } catch {
      /* ignora */
    }
    setLista([]);
  }

  async function naoVerMais() {
    const ids = lista.map((n) => n.id);
    setLista([]);
    await dispensar(ids);
  }

  async function conferir(n: Novidade) {
    setLista((l) => l.filter((x) => x.id !== n.id));
    void dispensar([n.id]);
    if (n.curso_id) navigate(`/curso/${n.curso_id}`);
  }

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Novidades da Plataforma"
        className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-hairline bg-bg-elevated shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-hairline bg-gradient-to-r from-accent-soft to-white px-5 py-4">
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-on-accent">
            <Sparkles className="size-5" />
          </span>
          <h2 className="flex-1 font-display text-lg font-bold text-text-hi">
            Novidades da Plataforma
          </h2>
          <button
            onClick={verDepois}
            className="text-text-low hover:text-text-hi"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          {lista.map((n) => (
            <div key={n.id} className="overflow-hidden rounded-2xl border border-hairline">
              <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-amber-100 to-amber-50 px-4 py-2.5">
                <span className="text-sm font-bold text-amber-900">Novo Curso Adicionado</span>
                <span className="text-xs text-amber-800/80">{dataCurta(n.criado_em)}</span>
              </div>
              {n.cursos?.capa_url && (
                <img src={n.cursos.capa_url} alt="" className="aspect-[16/7] w-full object-cover" />
              )}
              <div className="space-y-2 p-4">
                <span className="inline-block rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  Novo Curso
                </span>
                <h3 className="font-display text-lg font-bold text-text-hi">
                  {n.titulo || n.cursos?.titulo}
                </h3>
                {(n.texto || n.cursos?.descricao) && (
                  <p className="text-sm leading-relaxed text-text-mid">
                    {n.texto || n.cursos?.descricao}
                  </p>
                )}
                {n.curso_id && (
                  <button
                    onClick={() => conferir(n)}
                    className="mt-1 rounded-xl bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
                  >
                    Conferir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-hairline p-4">
          <button
            onClick={verDepois}
            className="w-full py-1.5 text-sm text-text-mid hover:text-text-hi"
          >
            Ver depois
          </button>
          <button
            onClick={naoVerMais}
            className="w-full rounded-xl border border-hairline bg-bg-base py-2.5 text-sm font-medium text-text-hi hover:bg-white"
          >
            Ok, não quero ver novamente
          </button>
        </div>
      </div>
    </div>
  );
}
