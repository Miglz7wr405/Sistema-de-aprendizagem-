// Sugere módulos e uma ordem para as aulas de um curso, usando o Claude Haiku.
// Devolve uma proposta — não grava nada. O admin confirma com `gravar-organizacao`.
import { chamador, clienteAdmin, cors, json } from "../_shared/comum.ts";

type Aula = { id: string; titulo: string; descricao: string | null };
type PropostaAula = { id: string };
type PropostaModulo = { titulo: string; descricao?: string; aulas: PropostaAula[] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem || quem.papel !== "admin" || quem.estado !== "aprovado") {
    return json({ erro: "Só administradores podem organizar aulas." }, 403);
  }

  const chave = Deno.env.get("ANTHROPIC_API_KEY");
  if (!chave) {
    return json(
      { erro: "A IA ainda não está ativa (falta ANTHROPIC_API_KEY nos secrets)." },
      503,
    );
  }

  const corpo = await req.json().catch(() => null);
  const cursoId = corpo?.curso_id as string | undefined;
  if (!cursoId) return json({ erro: "curso_id é obrigatório." }, 400);

  // Lê as aulas do curso.
  const { data: aulas, error } = await admin
    .from("aulas")
    .select("id, titulo, descricao")
    .eq("curso_id", cursoId)
    .order("ordem");
  if (error) {
    console.error("db aulas", error);
    return json({ erro: "Erro a ler as aulas." }, 500);
  }
  const lista = (aulas ?? []) as Aula[];
  if (lista.length === 0) return json({ erro: "O curso ainda não tem aulas." }, 400);
  if (lista.length < 3) {
    return json({
      ok: true,
      modulos: [{ titulo: "Aulas", descricao: null, aulas: lista.map((a) => ({ id: a.id })) }],
      razao: "Poucas aulas para agrupar — ficam todas num único bloco.",
    });
  }

  // Prompt ao modelo: devolve JSON estrito.
  const linhasAulas = lista
    .map((a, i) => `${i + 1}. [id=${a.id}] ${a.titulo}${a.descricao ? ` — ${a.descricao}` : ""}`)
    .join("\n");

  const prompt = `És um especialista em desenho de cursos online. Recebes a lista de aulas de UM curso e devolves uma proposta de módulos (secções do curso) que agrupam as aulas por tema e as ordenam da mais básica para a mais avançada.

Regras:
- Agrupa em 3 a 8 módulos, consoante o tamanho do curso.
- Cada módulo tem um TÍTULO curto (2 a 5 palavras) e uma DESCRIÇÃO de uma frase.
- A ORDEM dos módulos vai do mais fundamental (introdução, mentalidade, fundamentos) até ao mais avançado/prático.
- Dentro de cada módulo, ordena as aulas pela sequência lógica de aprendizagem.
- TODAS as aulas têm de aparecer uma vez. Usa EXATAMENTE os ids que te dei.
- Não inventes aulas nem ids.
- Devolve APENAS JSON válido, sem texto antes ou depois, com esta forma:
  {"modulos":[{"titulo":"...","descricao":"...","aulas":[{"id":"uuid-da-aula"},...]},...]}

Aulas:
${linhasAulas}`;

  const resposta = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": chave,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!resposta.ok) {
    const t = await resposta.text();
    console.error("anthropic", resposta.status, t.slice(0, 400));
    // Tenta o modelo anterior como fallback.
    const r2 = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r2.ok) {
      const t2 = await r2.text();
      console.error("anthropic fallback", r2.status, t2.slice(0, 400));
      return json({ erro: "A IA não respondeu. Tenta outra vez dentro de instantes." }, 502);
    }
    return processarResposta(await r2.json(), lista);
  }

  return processarResposta(await resposta.json(), lista);
});

function processarResposta(
  resp: { content?: Array<{ type?: string; text?: string }> },
  todas: Aula[],
) {
  const texto = (resp.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");

  // Extrai o JSON (o modelo às vezes mete-o em ```json ... ```).
  let jsonBruto = texto.trim();
  const dentroCode = jsonBruto.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (dentroCode) jsonBruto = dentroCode[1].trim();

  let proposta: { modulos: PropostaModulo[] } | null = null;
  try {
    proposta = JSON.parse(jsonBruto);
  } catch (e) {
    console.error("parse", e, jsonBruto.slice(0, 400));
    return json({ erro: "A IA deu uma resposta que não conseguimos ler. Tenta outra vez." }, 502);
  }

  const modulos = proposta?.modulos ?? [];
  if (!Array.isArray(modulos) || modulos.length === 0) {
    return json({ erro: "A IA não propôs módulos." }, 502);
  }

  // Validação: só ids conhecidos, sem duplicados; adiciona ao fim quaisquer aulas esquecidas.
  const idsValidos = new Set(todas.map((a) => a.id));
  const usados = new Set<string>();
  const limpos: PropostaModulo[] = modulos
    .filter((m): m is PropostaModulo => Boolean(m?.titulo))
    .map((m) => ({
      titulo: String(m.titulo).slice(0, 120),
      descricao: m.descricao ? String(m.descricao).slice(0, 500) : undefined,
      aulas: (m.aulas ?? [])
        .map((a) => ({ id: String(a.id) }))
        .filter((a) => idsValidos.has(a.id) && !usados.has(a.id))
        .map((a) => {
          usados.add(a.id);
          return a;
        }),
    }))
    .filter((m) => m.aulas.length > 0);

  const esquecidas = todas.filter((a) => !usados.has(a.id));
  if (esquecidas.length > 0) {
    limpos.push({
      titulo: "Outras aulas",
      descricao: "Aulas não encaixadas pela IA — revê antes de gravar.",
      aulas: esquecidas.map((a) => ({ id: a.id })),
    });
  }

  return json({ ok: true, modulos: limpos });
}
