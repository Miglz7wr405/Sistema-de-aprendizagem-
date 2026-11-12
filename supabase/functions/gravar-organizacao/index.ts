// Grava a organização de um curso em módulos. Admin-only.
// Recebe { curso_id, modulos: [{titulo, descricao?, aulas:[{id}]}] }.
// Apaga os módulos atuais do curso, insere os novos e atualiza modulo_id/ordem em cada aula.
import { chamador, clienteAdmin, cors, json } from "../_shared/comum.ts";

type PropostaModulo = { titulo: string; descricao?: string | null; aulas: Array<{ id: string }> };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem || quem.papel !== "admin" || quem.estado !== "aprovado") {
    return json({ erro: "Só administradores podem gravar a organização." }, 403);
  }

  const corpo = await req.json().catch(() => null);
  const cursoId = corpo?.curso_id as string | undefined;
  const modulos = corpo?.modulos as PropostaModulo[] | undefined;
  if (!cursoId || !Array.isArray(modulos) || modulos.length === 0) {
    return json({ erro: "Dados inválidos (curso_id ou modulos)." }, 400);
  }

  // Confirma que todas as aulas pertencem ao curso.
  const todosOsIds = modulos.flatMap((m) => m.aulas.map((a) => a.id));
  if (new Set(todosOsIds).size !== todosOsIds.length) {
    return json({ erro: "Há aulas repetidas entre módulos." }, 400);
  }
  const { data: aulasDoCurso, error: eAulas } = await admin
    .from("aulas")
    .select("id")
    .eq("curso_id", cursoId);
  if (eAulas) {
    console.error("db aulas", eAulas);
    return json({ erro: "Erro a ler as aulas." }, 500);
  }
  const permitidos = new Set((aulasDoCurso ?? []).map((a: { id: string }) => a.id));
  for (const id of todosOsIds) {
    if (!permitidos.has(id)) return json({ erro: `Aula ${id} não é deste curso.` }, 400);
  }

  // Apaga os módulos antigos — as aulas desligam-se sozinhas (ON DELETE SET NULL).
  const { error: eDel } = await admin.from("modulos").delete().eq("curso_id", cursoId);
  if (eDel) {
    console.error("db del modulos", eDel);
    return json({ erro: "Erro a limpar módulos antigos." }, 500);
  }

  // Insere os novos módulos.
  const novosModulos = modulos.map((m, i) => ({
    curso_id: cursoId,
    titulo: m.titulo.slice(0, 120),
    descricao: m.descricao?.slice(0, 500) ?? null,
    ordem: i,
  }));
  const { data: moduloRows, error: eIns } = await admin
    .from("modulos")
    .insert(novosModulos)
    .select("id");
  if (eIns || !moduloRows) {
    console.error("db ins modulos", eIns);
    return json({ erro: "Erro a gravar módulos." }, 500);
  }

  // Atualiza as aulas: modulo_id + ordem. Ordem global entre módulos, para a playlist simples.
  let ordemGlobal = 0;
  const erros: string[] = [];
  for (let i = 0; i < modulos.length; i++) {
    const moduloId = (moduloRows[i] as { id: string }).id;
    const aulasDoModulo = modulos[i].aulas;
    for (const a of aulasDoModulo) {
      const { error } = await admin
        .from("aulas")
        .update({ modulo_id: moduloId, ordem: ordemGlobal })
        .eq("id", a.id)
        .eq("curso_id", cursoId);
      if (error) erros.push(`${a.id}: ${error.message}`);
      ordemGlobal++;
    }
  }

  if (erros.length > 0) {
    console.error("db upd aulas", erros);
    return json({ erro: "Erro a atualizar algumas aulas.", detalhes: erros.slice(0, 5) }, 500);
  }

  return json({ ok: true, modulos: moduloRows.length, aulas: ordemGlobal });
});
