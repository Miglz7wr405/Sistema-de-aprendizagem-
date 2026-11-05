import { chamador, clienteAdmin, cors, json, segredo } from "../_shared/comum.ts";

function idYouTube(url: string): string | null {
  return url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
}

function idVimeo(url: string): string | null {
  return url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1] ?? null;
}

async function transcricaoYouTube(videoId: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const resp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
      },
    });
    if (!resp.ok) return null;
    const m = (await resp.text()).match(/"captionTracks":(\[[\s\S]*?\])/);
    if (!m) return null;
    const tracks: Array<{ baseUrl?: string; languageCode?: string }> = JSON.parse(m[1]);
    const track = tracks.find((t) => t.languageCode?.startsWith("pt")) ?? tracks[0];
    if (!track?.baseUrl) return null;
    const tr = await fetch(track.baseUrl + (track.baseUrl.includes("?") ? "&" : "?") + "fmt=json3", { signal: ctrl.signal });
    if (!tr.ok) return null;
    const data = await tr.json();
    const linhas: string[] = [];
    for (const ev of data.events ?? []) {
      if ((ev.tStartMs || 0) / 1000 > 60) break;
      const txt = (ev.segs ?? []).map((s: { utf8?: string }) => s.utf8 ?? "").join("");
      if (txt.trim()) linhas.push(txt.trim());
    }
    return linhas.join(" ").replace(/\s+/g, " ").trim().slice(0, 900) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function transcricaoVimeo(videoId: string): Promise<string | null> {
  const token = await segredo("VIMEO_ACCESS_TOKEN");
  if (!token) return null;
  try {
    const r = await fetch(`https://api.vimeo.com/videos/${videoId}/texttracks`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!r.ok) return null;
    const link = (await r.json()).data?.[0]?.link;
    if (!link) return null;
    const vtt = await (await fetch(link)).text();
    const linhas: string[] = [];
    for (const bloco of vtt.split("\n\n")) {
      const tm = bloco.match(/(\d{2}):(\d{2}):(\d{2})/);
      if (!tm) continue;
      if (+tm[1] * 3600 + +tm[2] * 60 + +tm[3] > 60) break;
      linhas.push(...bloco.split("\n").filter((l) => !l.includes("-->") && !/^\d+$/.test(l.trim()) && l.trim()));
    }
    return linhas.join(" ").replace(/\s+/g, " ").trim().slice(0, 900) || null;
  } catch {
    return null;
  }
}

async function modeloTexto(key: string): Promise<string> {
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    const ids: string[] = ((await r.json()).data ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) => !/whisper|guard|tts|orpheus|playai|embed|safeguard/i.test(id));
    for (const p of ["gpt-oss-120b", "llama-3.3-70b", "70b", "qwen", "gpt-oss", "llama"]) {
      const f = ids.find((id) => id.includes(p));
      if (f) return f;
    }
    if (ids[0]) return ids[0];
  } catch { /* ignora */ }
  return "openai/gpt-oss-120b";
}

const SISTEMA = `És um assistente educativo que escreve títulos e descrições de aulas para uma academia online, em português europeu.

REGRAS:
- Baseia-te no conteúdo real da aula. Quando tens a transcrição do início do vídeo, usa-a para perceber exatamente o que se ensina.
- Nunca inventes conteúdo que não existe na aula.
- Título: curto, claro, descritivo, máximo 60 caracteres, sem emojis e sem a palavra "Aula".
- Descrição: 2 a 3 frases sobre o que o aluno vai aprender.
- Responde SEMPRE e APENAS com JSON: {"titulo":"...","descricao":"..."}
- Nunca peças mais informação nem escrevas texto fora do JSON.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem || quem.papel !== "admin" || quem.estado !== "aprovado") {
    return json({ erro: "Só administradores podem fazer isto." }, 403);
  }

  const apiKey = await segredo("GROQ_API_KEY");
  if (!apiKey) return json({ erro: "Falta a chave Groq. Cola-a em Administração > Chaves de API." }, 503);

  // 1) Transcrever um pedaço de vídeo enviado pelo browser (Google Drive).
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const f = (await req.formData()).get("ficheiro");
    if (!(f instanceof File)) return json({ erro: "Ficheiro em falta." }, 400);
    const form = new FormData();
    form.append("file", f, "trecho.mp4");
    form.append("model", "whisper-large-v3-turbo");
    form.append("language", "pt");
    form.append("response_format", "text");
    const wr = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!wr.ok) {
      const detalhe = (await wr.text()).slice(0, 200);
      console.error("Whisper:", wr.status, detalhe);
      return json({ ok: false, motivo: wr.status === 429 ? "limite" : "audio", detalhe }, 200);
    }
    return json({ ok: true, texto: (await wr.text()).trim().slice(0, 900) });
  }

  const corpo = await req.json();

  // 2) Listar as aulas a tratar.
  if (corpo.acao === "listar") {
    const { data } = await admin
      .from("aulas")
      .select("id, titulo, descricao, url, modulo, ordem")
      .eq("curso_id", corpo.curso_id)
      .order("ordem")
      .order("created_at");
    const todas = data ?? [];
    const aulas = corpo.sobrescrever ? todas : todas.filter((a) => !a.descricao?.trim());
    return json({ ok: true, aulas });
  }

  // 3) Gerar e gravar o título/descrição de UMA aula.
  if (corpo.acao === "uma") {
    const { data: aula } = await admin
      .from("aulas")
      .select("id, titulo, url, modulo, curso_id")
      .eq("id", corpo.aula_id)
      .maybeSingle();
    if (!aula) return json({ erro: "Aula não encontrada." }, 404);

    const { data: curso } = await admin
      .from("cursos")
      .select("titulo, descricao, nivel, seccao_id")
      .eq("id", aula.curso_id)
      .maybeSingle();
    const { data: seccao } = await admin
      .from("seccoes")
      .select("titulo")
      .eq("id", curso?.seccao_id)
      .maybeSingle();

    let transcricao: string | null = typeof corpo.transcricao === "string" && corpo.transcricao.trim()
      ? corpo.transcricao.trim().slice(0, 900)
      : null;

    if (!transcricao && aula.url) {
      const yt = idYouTube(aula.url);
      const vi = idVimeo(aula.url);
      if (yt) transcricao = await transcricaoYouTube(yt);
      else if (vi) transcricao = await transcricaoVimeo(vi);
    }

    const generico = /^\s*aula\s*\d+\s*$/i.test(aula.titulo);
    if (!transcricao && generico) {
      return json({ ok: false, motivo: "sem_conteudo" }, 200);
    }

    const prompt = `Curso: ${curso?.titulo ?? "—"}${seccao ? ` (secção ${seccao.titulo})` : ""}
Nível: ${curso?.nivel ?? "—"}
${curso?.descricao ? `Sobre o curso: ${curso.descricao}` : ""}
${aula.modulo ? `Módulo: ${aula.modulo}` : ""}
Título atual da aula: «${aula.titulo}»
${transcricao ? `Transcrição do início do vídeo: «${transcricao}»` : "Sem transcrição disponível."}

Escreve o título e a descrição desta aula.`;

    const modelo = corpo.modelo || (await modeloTexto(apiKey));
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        max_tokens: 500,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SISTEMA },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!r.ok) {
      const detalhe = (await r.text()).slice(0, 200);
      console.error("Groq:", r.status, modelo, detalhe);
      if (r.status === 401) return json({ erro: "Chave Groq inválida. Verifica-a em Chaves de API." }, 401);
      if (r.status === 429) return json({ ok: false, motivo: "limite" }, 200);
      return json({ erro: `Erro da IA (${r.status}).` }, 502);
    }

    const texto = (await r.json()).choices?.[0]?.message?.content ?? "";
    const m = texto.match(/\{[\s\S]*\}/);
    if (!m) {
      console.error("Resposta inesperada:", texto.slice(0, 300));
      return json({ ok: false, motivo: "resposta" }, 200);
    }

    let gerado: { titulo?: string; descricao?: string };
    try {
      gerado = JSON.parse(m[0]);
    } catch {
      return json({ ok: false, motivo: "resposta" }, 200);
    }
    if (!gerado.titulo?.trim() || !gerado.descricao?.trim()) {
      return json({ ok: false, motivo: "resposta" }, 200);
    }

    const titulo = gerado.titulo.trim().slice(0, 80);
    const descricao = gerado.descricao.trim();
    const { error } = await admin.from("aulas").update({ titulo, descricao }).eq("id", aula.id);
    if (error) return json({ erro: "Não foi possível gravar a aula." }, 500);

    return json({ ok: true, titulo, descricao, modelo, com_transcricao: !!transcricao });
  }

  return json({ erro: "Ação inválida." }, 400);
});
