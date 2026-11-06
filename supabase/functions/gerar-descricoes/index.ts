import { chamador, clienteAdmin, cors, json, segredo } from "../_shared/comum.ts";

const TRECHO = 6 * 1024 * 1024;

function idYouTube(url: string): string | null {
  return url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
}

function idVimeo(url: string): string | null {
  return url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1] ?? null;
}

function idDrive(url: string): string | null {
  return url.match(/\/d\/([a-zA-Z0-9_-]{20,})/)?.[1] ?? url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/)?.[1] ?? null;
}

async function faixa(url: string, de: number, ate?: number): Promise<Uint8Array | "bloqueado" | null> {
  const r = await fetch(url, { headers: { Range: `bytes=${de}-${ate ?? ""}` }, redirect: "follow" });
  const ct = r.headers.get("content-type") ?? "";
  if (ct.includes("text/html")) {
    await r.body?.cancel();
    return "bloqueado";
  }
  if (!r.ok && r.status !== 206) {
    await r.body?.cancel();
    return null;
  }
  return new Uint8Array(await r.arrayBuffer());
}

/**
 * Os MP4 do Drive têm o índice (moov) no fim, por isso um pedaço do início
 * sozinho não é um ficheiro válido. Juntamos o índice e corrigimos o tamanho
 * declarado do mdat, para não descarregar o vídeo inteiro.
 */
async function trechoDrive(fileId: string): Promise<Uint8Array | "bloqueado" | null> {
  const url = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;

  const inicio = await faixa(url, 0, TRECHO - 1);
  if (inicio === "bloqueado" || inicio === null) return inicio;
  if (inicio.byteLength < 100000) return null;

  const dv = new DataView(inicio.buffer);
  let off = 0;
  let mdatOff = -1;
  let mdatFim = -1;
  while (off + 8 <= inicio.byteLength) {
    let size = dv.getUint32(off);
    const tipo = String.fromCharCode(...inicio.slice(off + 4, off + 8));
    if (size === 1) size = dv.getUint32(off + 8) * 4294967296 + dv.getUint32(off + 12);
    if (tipo === "moov") return inicio;
    if (tipo === "mdat") {
      mdatOff = off;
      mdatFim = off + size;
      break;
    }
    if (size < 8) break;
    off += size;
  }

  if (mdatOff < 0 || mdatFim <= inicio.byteLength) return inicio;

  const moov = await faixa(url, mdatFim);
  if (moov === "bloqueado" || moov === null) return moov === "bloqueado" ? "bloqueado" : inicio;

  dv.setUint32(mdatOff, inicio.byteLength - mdatOff);
  const juntos = new Uint8Array(inicio.byteLength + moov.byteLength);
  juntos.set(inicio, 0);
  juntos.set(moov, inicio.byteLength);
  return juntos;
}

async function whisper(bytes: Uint8Array, key: string): Promise<string | "limite" | null> {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "video/mp4" }), "trecho.mp4");
  form.append("model", "whisper-large-v3-turbo");
  form.append("language", "pt");
  form.append("response_format", "text");
  const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (r.status === 429) return "limite";
  if (!r.ok) {
    console.error("Whisper:", r.status, (await r.text()).slice(0, 200));
    return null;
  }
  return (await r.text()).trim().slice(0, 1200) || null;
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
    const linhas: string[] = [];
    for (const ev of (await tr.json()).events ?? []) {
      if ((ev.tStartMs || 0) / 1000 > 60) break;
      const txt = (ev.segs ?? []).map((s: { utf8?: string }) => s.utf8 ?? "").join("");
      if (txt.trim()) linhas.push(txt.trim());
    }
    return linhas.join(" ").replace(/\s+/g, " ").trim().slice(0, 1200) || null;
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
    return linhas.join(" ").replace(/\s+/g, " ").trim().slice(0, 1200) || null;
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
  } catch { /* fica com o valor por omissão */ }
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

  const corpo = await req.json();

  if (corpo.acao === "listar") {
    const { data } = await admin
      .from("aulas")
      .select("id, titulo, descricao, url, modulo, ordem")
      .eq("curso_id", corpo.curso_id)
      .order("ordem")
      .order("created_at");
    const todas = data ?? [];
    return json({ ok: true, aulas: corpo.sobrescrever ? todas : todas.filter((a) => !a.descricao?.trim()) });
  }

  if (corpo.acao !== "uma") return json({ erro: "Ação inválida." }, 400);

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
  const { data: seccao } = curso?.seccao_id
    ? await admin.from("seccoes").select("titulo").eq("id", curso.seccao_id).maybeSingle()
    : { data: null };

  let transcricao: string | null = null;
  let motivo: string | null = null;

  if (aula.url) {
    const yt = idYouTube(aula.url);
    const vi = idVimeo(aula.url);
    const dr = idDrive(aula.url);
    if (yt) {
      transcricao = await transcricaoYouTube(yt);
    } else if (vi) {
      transcricao = await transcricaoVimeo(vi);
    } else if (dr) {
      const bytes = await trechoDrive(dr);
      if (bytes === "bloqueado") motivo = "permissao";
      else if (bytes === null) motivo = "audio";
      else {
        const t = await whisper(bytes, apiKey);
        if (t === "limite") return json({ ok: false, motivo: "limite" });
        if (t) transcricao = t;
        else motivo = "audio";
      }
    }
  }

  if (!transcricao && /^\s*aula\s*\d+\s*$/i.test(aula.titulo)) {
    return json({ ok: false, motivo: motivo ?? "sem_conteudo" });
  }

  const prompt = `Curso: ${curso?.titulo ?? "—"}${seccao ? ` (secção ${seccao.titulo})` : ""}
Nível: ${curso?.nivel ?? "—"}
${curso?.descricao ? `Sobre o curso: ${curso.descricao}` : ""}
${aula.modulo ? `Módulo: ${aula.modulo}` : ""}
Título atual da aula: «${aula.titulo}»
${transcricao ? `Transcrição do início do vídeo: «${transcricao}»` : "Sem transcrição disponível."}

Escreve o título e a descrição desta aula.`;

  const modelo = await modeloTexto(apiKey);
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: modelo,
      max_tokens: 500,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SISTEMA }, { role: "user", content: prompt }],
    }),
  });

  if (!r.ok) {
    console.error("Groq:", r.status, modelo, (await r.text()).slice(0, 200));
    if (r.status === 401) return json({ erro: "Chave Groq inválida. Verifica-a em Chaves de API." }, 401);
    if (r.status === 429) return json({ ok: false, motivo: "limite" });
    return json({ erro: `Erro da IA (${r.status}).` }, 502);
  }

  const m = ((await r.json()).choices?.[0]?.message?.content ?? "").match(/\{[\s\S]*\}/);
  if (!m) return json({ ok: false, motivo: "resposta" });

  let gerado: { titulo?: string; descricao?: string };
  try {
    gerado = JSON.parse(m[0]);
  } catch {
    return json({ ok: false, motivo: "resposta" });
  }
  if (!gerado.titulo?.trim() || !gerado.descricao?.trim()) return json({ ok: false, motivo: "resposta" });

  const titulo = gerado.titulo.trim().slice(0, 80);
  const descricao = gerado.descricao.trim();
  const { error } = await admin.from("aulas").update({ titulo, descricao }).eq("id", aula.id);
  if (error) return json({ erro: "Não foi possível gravar a aula." }, 500);

  return json({ ok: true, titulo, descricao, com_transcricao: !!transcricao });
});
