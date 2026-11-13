// Sugere módulos e uma ordem para as aulas de um curso, usando a IA do dono
// (GEMINI_API_KEY ou GROQ_API_KEY, guardadas na tabela `segredos`).
// Devolve uma proposta — não grava nada. O admin confirma com `gravar-organizacao`.
import { chamador, clienteAdmin, cors, json, segredo } from "../_shared/comum.ts";

type Aula = { id: string; titulo: string; descricao: string | null };
type PropostaModulo = { titulo: string; descricao?: string; aulas: Array<{ id: string }> };

const REGRAS = `És um especialista em desenho de cursos online. Recebes a lista de aulas de UM curso e devolves uma proposta de módulos que agrupam as aulas por tema e as ordenam numa sequência pedagógica.

Regras:
- Agrupa em 3 a 8 módulos (cursos pequenos podem ter menos).
- Cada módulo tem um TÍTULO curto (2 a 6 palavras) e uma DESCRIÇÃO de uma frase.
- ORDEM dos módulos: do mais fundamental para o mais avançado. Fundamentos, mentalidade e CRIAÇÃO DO PRODUTO/OFERTA vêm primeiro; tráfego pago, anúncios, criação de páginas/Facebook e ESCALA vêm no fim.
- Dentro de cada módulo, ordena as aulas pela sequência lógica de aprendizagem; mantém juntas as que são claramente sequência (Parte 1, Parte 2...).
- TODAS as aulas têm de aparecer uma vez. Usa EXATAMENTE os ids dados. Não inventes aulas nem ids.
- Responde APENAS com JSON válido: {"modulos":[{"titulo":"...","descricao":"...","aulas":[{"id":"uuid"},...]},...]}`;

const PREFERIDOS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
];

async function modelosGemini(key: string): Promise<string[]> {
  let nomes: string[] = [];
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    nomes = ((await r.json()).models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        (m.supportedGenerationMethods ?? []).includes("generateContent"),
      )
      .map((m: { name: string }) => m.name.replace(/^models\//, ""))
      .filter((n: string) => !/image|tts|embedding|thinking/i.test(n));
  } catch {
    /* usa só os preferidos */
  }
  const lista = PREFERIDOS.filter((p) => nomes.length === 0 || nomes.includes(p));
  for (const n of nomes) if (!lista.includes(n)) lista.push(n);
  return lista.length ? lista : ["gemini-flash-lite-latest"];
}

function extrair(texto: string): { modulos: PropostaModulo[] } | null {
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

async function viaGemini(key: string, prompt: string): Promise<{ modulos: PropostaModulo[] } | null> {
  const modelos = await modelosGemini(key);
  let modelo = modelos[0];
  let seguinte = 1;
  for (let t = 0; t < modelos.length; t++) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: REGRAS }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192, responseMimeType: "application/json" },
        }),
      },
    );
    if (!r.ok) {
      console.error("Gemini organizar:", r.status, modelo, (await r.text()).slice(0, 200));
      if ([404, 400, 429, 503].includes(r.status) && seguinte < modelos.length) {
        modelo = modelos[seguinte++];
        continue;
      }
      return null;
    }
    const dados = await r.json();
    const texto = (dados.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    const prop = extrair(texto);
    if (prop?.modulos) return prop;
  }
  return null;
}

async function modeloGroq(key: string): Promise<string> {
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const ids: string[] = ((await r.json()).data ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) => !/whisper|guard|tts|orpheus|playai|embed|safeguard/i.test(id));
    for (const p of ["gpt-oss-120b", "llama-3.3-70b", "70b", "qwen", "gpt-oss", "llama"]) {
      const f = ids.find((id) => id.includes(p));
      if (f) return f;
    }
    if (ids[0]) return ids[0];
  } catch {
    /* valor por omissão */
  }
  return "openai/gpt-oss-120b";
}

async function viaGroq(key: string, prompt: string): Promise<{ modulos: PropostaModulo[] } | null> {
  const modelo = await modeloGroq(key);
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 8192,
      temperature: 0.2,
      messages: [
        { role: "system", content: REGRAS },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!r.ok) {
    console.error("Groq organizar:", r.status, modelo, (await r.text()).slice(0, 200));
    return null;
  }
  const texto = (await r.json()).choices?.[0]?.message?.content ?? "";
  return extrair(texto);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem || quem.papel !== "admin" || quem.estado !== "aprovado") {
    return json({ erro: "Só administradores podem organizar aulas." }, 403);
  }

  const chaveGemini = await segredo("GEMINI_API_KEY");
  const chaveGroq = await segredo("GROQ_API_KEY");
  if (!chaveGemini && !chaveGroq) {
    return json(
      { erro: "Falta a chave da IA. Cola uma em Administração > IA & Chaves (Gemini ou Groq)." },
      503,
    );
  }

  const corpo = await req.json().catch(() => null);
  const cursoId = corpo?.curso_id as string | undefined;
  if (!cursoId) return json({ erro: "curso_id é obrigatório." }, 400);

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
      motor: chaveGemini ? "Gemini" : "Groq",
      modulos: [{ titulo: "Aulas", descricao: null, aulas: lista.map((a) => ({ id: a.id })) }],
      razao: "Poucas aulas para agrupar — ficam todas num único bloco.",
    });
  }

  const linhas = lista
    .map((a, i) => `${i + 1}. [id=${a.id}] ${a.titulo}${a.descricao ? ` — ${a.descricao}` : ""}`)
    .join("\n");
  const prompt = `Aulas do curso:\n${linhas}`;

  let proposta: { modulos: PropostaModulo[] } | null = null;
  let motor = "";
  if (chaveGemini) {
    proposta = await viaGemini(chaveGemini, prompt);
    if (proposta) motor = "Gemini";
  }
  if (!proposta && chaveGroq) {
    proposta = await viaGroq(chaveGroq, prompt);
    if (proposta) motor = "Groq";
  }
  if (!proposta?.modulos?.length) {
    return json({ erro: "A IA não respondeu. Tenta outra vez dentro de instantes." }, 502);
  }

  // Validação: só ids conhecidos, sem duplicados; aulas esquecidas vão para o fim.
  const idsValidos = new Set(lista.map((a) => a.id));
  const usados = new Set<string>();
  const limpos: PropostaModulo[] = proposta.modulos
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

  const esquecidas = lista.filter((a) => !usados.has(a.id));
  if (esquecidas.length > 0) {
    limpos.push({
      titulo: "Outras aulas",
      descricao: "Aulas não encaixadas pela IA — revê antes de gravar.",
      aulas: esquecidas.map((a) => ({ id: a.id })),
    });
  }

  return json({ ok: true, motor, modulos: limpos });
});
