import { chamador, clienteAdmin, cors, json } from "../_shared/comum.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem || quem.papel !== "admin" || quem.estado !== "aprovado") {
    return json({ erro: "Só administradores podem fazer isto." }, 403);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return json(
      {
        erro: "ANTHROPIC_API_KEY não configurado. Vai ao Supabase Dashboard > Edge Functions > Secrets e adiciona a tua chave da API Anthropic.",
      },
      503,
    );
  }

  const { curso_id, sobrescrever } = await req.json();
  if (!curso_id) return json({ erro: "curso_id é obrigatório." }, 400);

  const { data: curso, error: errCurso } = await admin
    .from("cursos")
    .select("id, titulo, descricao, nivel, seccao_id")
    .eq("id", curso_id)
    .maybeSingle();
  if (errCurso || !curso) return json({ erro: "Curso não encontrado." }, 404);

  const { data: seccao } = await admin
    .from("seccoes")
    .select("titulo")
    .eq("id", curso.seccao_id)
    .maybeSingle();

  const { data: todasAulas, error: errAulas } = await admin
    .from("aulas")
    .select("id, titulo, descricao, tipo, url, modulo, ordem")
    .eq("curso_id", curso_id)
    .order("ordem")
    .order("created_at");
  if (errAulas) return json({ erro: "Erro ao buscar aulas." }, 500);

  const aulas = sobrescrever
    ? (todasAulas ?? [])
    : (todasAulas ?? []).filter((a: { descricao: string | null }) => !a.descricao?.trim());

  if (aulas.length === 0) {
    return json({ erro: "Todas as aulas já têm descrição. Ativa 'Sobrescrever' para regenerar." }, 400);
  }

  // Enriquecer aulas YouTube com título original do vídeo (best-effort)
  type AulaRow = { id: string; titulo: string; descricao: string | null; tipo: string; url: string | null; modulo: string | null; ordem: number };
  const extras: Record<string, string> = {};

  const ytAulas = (aulas as AulaRow[]).filter(
    (a) => a.url && (a.url.includes("youtube.com") || a.url.includes("youtu.be")),
  );

  if (ytAulas.length > 0) {
    const resultados = await Promise.allSettled(
      ytAulas.map(async (a) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        try {
          const resp = await fetch(
            `https://noembed.com/embed?url=${encodeURIComponent(a.url!)}`,
            { signal: ctrl.signal },
          );
          if (resp.ok) {
            const j = await resp.json();
            if (j.title) extras[a.id] = j.title;
          }
        } finally {
          clearTimeout(timer);
        }
      }),
    );
    // Falhas silenciosas — extras pode ficar vazio
    void resultados;
  }

  // Construir o prompt
  const listaAulas = (aulas as AulaRow[])
    .map((a, i) => {
      let linha = `${i + 1}. [${a.id}] «${a.titulo}»`;
      if (a.modulo) linha += ` (Módulo: ${a.modulo})`;
      if (extras[a.id]) linha += ` — Vídeo original: «${extras[a.id]}»`;
      return linha;
    })
    .join("\n");

  const prompt = `Gera descrições para as aulas deste curso:

Secção: ${seccao?.titulo ?? "—"}
Curso: ${curso.titulo} (Nível: ${curso.nivel ?? "—"})
Descrição do curso: ${curso.descricao || "sem descrição"}

Aulas (por ordem):
${listaAulas}

Responde APENAS com um array JSON, sem markdown, no formato:
[{"aula_id": "...", "descricao": "..."}]`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0.7,
        system:
          "És um assistente educativo que escreve descrições de aulas para uma academia online. Escreves em português europeu, de forma clara e motivadora. As descrições devem ter 2 a 4 frases e explicar o que o aluno vai aprender na aula. Não uses emojis.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error("Anthropic API:", resp.status, body);
      if (resp.status === 401) {
        return json({ erro: "Chave da API Anthropic inválida. Verifica o ANTHROPIC_API_KEY nos Secrets." }, 401);
      }
      if (resp.status === 429) {
        return json({ erro: "Demasiados pedidos à IA. Tenta novamente daqui a pouco." }, 429);
      }
      return json({ erro: "Erro ao comunicar com a IA." }, 502);
    }

    const data = await resp.json();
    const texto = data.content?.[0]?.text ?? "";

    // Extrair o JSON do texto (pode vir entre ```json ... ``` ou puro)
    const match = texto.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error("Resposta inesperada da IA:", texto);
      return json({ erro: "A IA devolveu uma resposta inesperada. Tenta outra vez." }, 502);
    }

    const descricoes: Array<{ aula_id: string; descricao: string }> = JSON.parse(match[0]);

    // Validar e mapear com os títulos
    const aulaMap = new Map((aulas as AulaRow[]).map((a) => [a.id, a.titulo]));
    const resultado = descricoes
      .filter((d) => d.aula_id && d.descricao && aulaMap.has(d.aula_id))
      .map((d) => ({
        aula_id: d.aula_id,
        titulo: aulaMap.get(d.aula_id)!,
        descricao_gerada: d.descricao.trim(),
      }));

    return json({ ok: true, descricoes: resultado });
  } catch (e) {
    console.error("gerar-descricoes:", e);
    return json({ erro: "Erro inesperado ao gerar descrições." }, 500);
  }
});
