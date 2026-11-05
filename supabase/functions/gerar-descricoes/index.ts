import { chamador, clienteAdmin, cors, json } from "../_shared/comum.ts";

function extrairIdYouTube(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  );
  return m?.[1] ?? null;
}

function extrairIdVimeo(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m?.[1] ?? null;
}

async function buscarTranscricaoYT(videoId: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const resp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      },
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    const match = html.match(/"captionTracks":(\[[\s\S]*?\])/);
    if (!match) return null;

    let tracks: Array<{ baseUrl?: string; languageCode?: string }>;
    try {
      tracks = JSON.parse(match[1]);
    } catch {
      return null;
    }
    if (!tracks.length) return null;

    const track =
      tracks.find((t) => t.languageCode?.startsWith("pt")) ||
      tracks.find((t) => t.languageCode === "en") ||
      tracks[0];
    if (!track?.baseUrl) return null;

    const sep = track.baseUrl.includes("?") ? "&" : "?";
    const tResp = await fetch(track.baseUrl + sep + "fmt=json3", {
      signal: ctrl.signal,
    });
    if (!tResp.ok) return null;
    const data = await tResp.json();

    const linhas: string[] = [];
    for (const ev of data.events || []) {
      if ((ev.tStartMs || 0) / 1000 > 45) break;
      const txt = (ev.segs || [])
        .map((s: { utf8?: string }) => s.utf8 || "")
        .join("");
      if (txt.trim() && txt.trim() !== "\n") linhas.push(txt.trim());
    }

    return (
      linhas
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500) || null
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function buscarTranscricaoVimeo(
  videoId: string,
): Promise<string | null> {
  const token = Deno.env.get("VIMEO_ACCESS_TOKEN");
  if (!token) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const resp = await fetch(
      `https://api.vimeo.com/videos/${videoId}/texttracks`,
      {
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      },
    );
    if (!resp.ok) return null;
    const data = await resp.json();

    const track = data.data?.[0];
    if (!track?.link) return null;

    const tResp = await fetch(track.link, { signal: ctrl.signal });
    if (!tResp.ok) return null;
    const vtt = await tResp.text();

    const linhas: string[] = [];
    for (const bloco of vtt.split("\n\n")) {
      const tm = bloco.match(/(\d{2}):(\d{2}):(\d{2})/);
      if (tm) {
        const seg =
          parseInt(tm[1]) * 3600 + parseInt(tm[2]) * 60 + parseInt(tm[3]);
        if (seg > 45) break;
        const textos = bloco
          .split("\n")
          .filter(
            (l) =>
              !l.includes("-->") && !/^\d+$/.test(l.trim()) && l.trim(),
          );
        linhas.push(...textos);
      }
    }

    return (
      linhas
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500) || null
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

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
    : (todasAulas ?? []).filter(
        (a: { descricao: string | null }) => !a.descricao?.trim(),
      );

  if (aulas.length === 0) {
    return json(
      {
        erro: "Todas as aulas já têm descrição. Ativa 'Sobrescrever' para regenerar.",
      },
      400,
    );
  }

  type AulaRow = {
    id: string;
    titulo: string;
    descricao: string | null;
    tipo: string;
    url: string | null;
    modulo: string | null;
    ordem: number;
  };

  // Enriquecer aulas com título do vídeo e transcrição (best-effort, tudo em paralelo)
  const extras: Record<string, string> = {};
  const transcricoes: Record<string, string> = {};

  const aulasComUrl = (aulas as AulaRow[]).filter((a) => a.url);

  await Promise.allSettled(
    aulasComUrl.map(async (a) => {
      const ytId = extrairIdYouTube(a.url!);
      if (ytId) {
        // Buscar título via noembed + transcrição em paralelo
        const [tituloRes, transcRes] = await Promise.allSettled([
          (async () => {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 3000);
            try {
              const r = await fetch(
                `https://noembed.com/embed?url=${encodeURIComponent(a.url!)}`,
                { signal: ctrl.signal },
              );
              if (r.ok) {
                const j = await r.json();
                if (j.title) extras[a.id] = j.title;
              }
            } finally {
              clearTimeout(timer);
            }
          })(),
          (async () => {
            const t = await buscarTranscricaoYT(ytId);
            if (t) transcricoes[a.id] = t;
          })(),
        ]);
        void tituloRes;
        void transcRes;
        return;
      }

      const vimeoId = extrairIdVimeo(a.url!);
      if (vimeoId) {
        // Buscar título via noembed + transcrição Vimeo em paralelo
        const [tituloRes, transcRes] = await Promise.allSettled([
          (async () => {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 3000);
            try {
              const r = await fetch(
                `https://noembed.com/embed?url=${encodeURIComponent(a.url!)}`,
                { signal: ctrl.signal },
              );
              if (r.ok) {
                const j = await r.json();
                if (j.title) extras[a.id] = j.title;
              }
            } finally {
              clearTimeout(timer);
            }
          })(),
          (async () => {
            const t = await buscarTranscricaoVimeo(vimeoId);
            if (t) transcricoes[a.id] = t;
          })(),
        ]);
        void tituloRes;
        void transcRes;
      }
    }),
  );

  const nTranscricoes = Object.keys(transcricoes).length;

  // Construir o prompt
  const listaAulas = (aulas as AulaRow[])
    .map((a, i) => {
      let linha = `${i + 1}. [${a.id}] «${a.titulo}»`;
      if (a.modulo) linha += ` (Módulo: ${a.modulo})`;
      if (extras[a.id]) linha += ` — Vídeo original: «${extras[a.id]}»`;
      if (transcricoes[a.id])
        linha += `\n   Transcrição (início do vídeo): «${transcricoes[a.id]}»`;
      return linha;
    })
    .join("\n");

  const prompt = `Gera títulos e descrições para as aulas deste curso:

Secção: ${seccao?.titulo ?? "—"}
Curso: ${curso.titulo} (Nível: ${curso.nivel ?? "—"})
Descrição do curso: ${curso.descricao || "sem descrição"}

Aulas (por ordem):
${listaAulas}

Para cada aula, gera:
- Um título claro e curto (máximo 60 caracteres), que reflita fielmente o conteúdo real da aula. Usa a transcrição quando disponível para entender o que se ensina. Não inventes — o título deve descrever o que a aula realmente aborda.
- Uma descrição com 2 a 4 frases explicando o que o aluno vai aprender, baseada no conteúdo real.

Responde APENAS com um array JSON, sem markdown, no formato:
[{"aula_id": "...", "titulo": "...", "descricao": "..."}]`;

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
        temperature: 0.5,
        system: `És um assistente educativo que escreve títulos e descrições de aulas para uma academia online. Escreves em português europeu, de forma clara e motivadora.

REGRAS PARA TÍTULOS:
- Baseia os títulos no conteúdo real da aula. Quando tens a transcrição do início do vídeo, usa-a para perceber exatamente o que se ensina.
- Nunca inventes conteúdo que não existe na aula.
- Títulos curtos, claros e descritivos (máximo 60 caracteres).
- Não uses emojis.

REGRAS PARA DESCRIÇÕES:
- 2 a 4 frases explicando o que o aluno vai aprender.
- Baseadas no conteúdo real (transcrição quando disponível).
- Claras e motivadoras, sem exageros.`,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error("Anthropic API:", resp.status, body);
      if (resp.status === 401) {
        return json(
          {
            erro: "Chave da API Anthropic inválida. Verifica o ANTHROPIC_API_KEY nos Secrets.",
          },
          401,
        );
      }
      if (resp.status === 429) {
        return json(
          { erro: "Demasiados pedidos à IA. Tenta novamente daqui a pouco." },
          429,
        );
      }
      return json({ erro: "Erro ao comunicar com a IA." }, 502);
    }

    const data = await resp.json();
    const texto = data.content?.[0]?.text ?? "";

    const match = texto.match(/\[[\s\S]*\]/);
    if (!match) {
      console.error("Resposta inesperada da IA:", texto);
      return json(
        { erro: "A IA devolveu uma resposta inesperada. Tenta outra vez." },
        502,
      );
    }

    const gerados: Array<{
      aula_id: string;
      titulo?: string;
      descricao: string;
    }> = JSON.parse(match[0]);

    const aulaMap = new Map(
      (aulas as AulaRow[]).map((a) => [a.id, a.titulo]),
    );
    const resultado = gerados
      .filter((d) => d.aula_id && d.descricao && aulaMap.has(d.aula_id))
      .map((d) => ({
        aula_id: d.aula_id,
        titulo_original: aulaMap.get(d.aula_id)!,
        titulo_gerado: d.titulo?.trim() ?? aulaMap.get(d.aula_id)!,
        descricao_gerada: d.descricao.trim(),
      }));

    return json({
      ok: true,
      descricoes: resultado,
      transcricoes_usadas: nTranscricoes,
    });
  } catch (e) {
    console.error("gerar-descricoes:", e);
    return json({ erro: "Erro inesperado ao gerar descrições." }, 500);
  }
});
