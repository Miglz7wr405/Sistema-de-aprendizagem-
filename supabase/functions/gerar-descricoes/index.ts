import { chamador, clienteAdmin, cors, json, segredo } from "../_shared/comum.ts";

const TRECHO = 4 * 1024 * 1024;

const REGRAS = `Escreves em português europeu, para uma academia online.

REGRAS:
- Baseia-te só no conteúdo real da aula. Nunca inventes.
- Título: curto, claro, descritivo, máximo 60 caracteres, sem emojis e sem a palavra "Aula".
- Descrição: 2 a 3 frases sobre o que o aluno vai aprender.
- Responde APENAS com JSON: {"titulo":"...","descricao":"..."}`;

function idYouTube(url: string): string | null {
  return url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? null;
}

function idVimeo(url: string): string | null {
  return url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1] ?? null;
}

function idDrive(url: string): string | null {
  return url.match(/\/d\/([a-zA-Z0-9_-]{20,})/)?.[1] ?? url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/)?.[1] ?? null;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extrairJson(texto: string): { titulo?: string; descricao?: string } | null {
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

type Falha = "virus_scan" | "permissao" | "audio" | "limite" | "resposta";

async function faixa(url: string, de: number, ate?: number): Promise<Uint8Array | Falha> {
  const r = await fetch(url, { headers: { Range: `bytes=${de}-${ate ?? ""}` }, redirect: "follow" });
  const ct = r.headers.get("content-type") ?? "";
  if (r.status === 403 || r.status === 401) {
    await r.body?.cancel();
    return "permissao";
  }
  if (ct.includes("text/html")) {
    const html = (await r.text()).slice(0, 400);
    return /virus/i.test(html) ? "virus_scan" : "permissao";
  }
  if (!r.ok && r.status !== 206) {
    await r.body?.cancel();
    return "audio";
  }
  return new Uint8Array(await r.arrayBuffer());
}

/**
 * Os MP4 do Drive têm o índice (moov) no fim, por isso um pedaço do início
 * sozinho não é um ficheiro válido. Juntamos o índice e corrigimos o tamanho
 * declarado do mdat, para não descarregar o vídeo inteiro.
 */
async function trechoDrive(fileId: string): Promise<Uint8Array | Falha> {
  const url = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;

  const inicio = await faixa(url, 0, TRECHO - 1);
  if (typeof inicio === "string") return inicio;
  if (inicio.byteLength < 100000) return "audio";

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
  if (typeof moov === "string") return inicio;

  dv.setUint32(mdatOff, inicio.byteLength - mdatOff);
  const juntos = new Uint8Array(inicio.byteLength + moov.byteLength);
  juntos.set(inicio, 0);
  juntos.set(moov, inicio.byteLength);
  return juntos;
}

function base64(bytes: Uint8Array): string {
  let bin = "";
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    bin += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return btoa(bin);
}

// ---------- Gemini ----------

const PREFERIDOS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
];

/** Lista de modelos a tentar, do melhor para o pior. A Google vai reformando
 *  modelos, por isso guardamos vários e saltamos para o seguinte em 404. */
async function modelosGemini(key: string): Promise<string[]> {
  let nomes: string[] = [];
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    nomes = ((await r.json()).models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) =>
        (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m: { name: string }) => m.name.replace(/^models\//, ""))
      .filter((n: string) => !/image|tts|lite|preview|omni|embedding|thinking/i.test(n));
  } catch { /* usa só os preferidos */ }

  const lista = PREFERIDOS.filter((p) => nomes.length === 0 || nomes.includes(p));
  for (const n of nomes) if (!lista.includes(n)) lista.push(n);
  return lista.length > 0 ? lista.slice(0, 5) : ["gemini-flash-latest"];
}

async function pedirGemini(
  key: string,
  modelos: string[],
  partes: unknown[],
): Promise<{ titulo: string; descricao: string } | Falha> {
  let modelo = modelos[0];
  let seguinte = 1;
  for (let tentativa = 0; tentativa < 6; tentativa++) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: REGRAS }] },
          contents: [{ role: "user", parts: partes }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1200,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    // Modelo sobrecarregado, reformado ou recusado: passa ao seguinte da lista.
    if ([404, 400, 503].includes(r.status) && seguinte < modelos.length) {
      console.error("Gemini:", r.status, modelo);
      modelo = modelos[seguinte++];
      continue;
    }
    if (r.status === 429 || r.status === 503) {
      if (tentativa === 0) {
        await dormir(20000);
        continue;
      }
      return "limite";
    }
    if (!r.ok) {
      console.error("Gemini:", r.status, modelo, (await r.text()).slice(0, 300));
      return "resposta";
    }

    const dados = await r.json();
    const texto = (dados.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    const g = extrairJson(texto);
    if (g?.titulo?.trim() && g?.descricao?.trim()) {
      return { titulo: g.titulo.trim().slice(0, 80), descricao: g.descricao.trim() };
    }
    console.error("Gemini JSON:", texto.slice(0, 300));
  }
  return "resposta";
}

// ---------- Groq (alternativa) ----------

async function modeloGroq(key: string): Promise<string> {
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

async function whisper(bytes: Uint8Array, key: string): Promise<string | Falha> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
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
    if (r.status === 429) {
      if (tentativa === 0) {
        await dormir(20000);
        continue;
      }
      return "limite";
    }
    if (!r.ok) {
      console.error("Whisper:", r.status, (await r.text()).slice(0, 200));
      return "audio";
    }
    const t = (await r.text()).trim().slice(0, 1500);
    return t || "audio";
  }
  return "limite";
}

async function pedirGroq(key: string, modelo: string, prompt: string): Promise<{ titulo: string; descricao: string } | Falha> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        max_tokens: 1200,
        temperature: 0.4,
        messages: [{ role: "system", content: REGRAS }, { role: "user", content: prompt }],
      }),
    });
    if (r.status === 429) {
      if (tentativa === 0) {
        await dormir(20000);
        continue;
      }
      return "limite";
    }
    if (!r.ok) {
      console.error("Groq:", r.status, modelo, (await r.text()).slice(0, 300));
      if (tentativa === 0) continue;
      return "resposta";
    }
    const texto = (await r.json()).choices?.[0]?.message?.content ?? "";
    const g = extrairJson(texto);
    if (g?.titulo?.trim() && g?.descricao?.trim()) {
      return { titulo: g.titulo.trim().slice(0, 80), descricao: g.descricao.trim() };
    }
    console.error("Groq JSON:", texto.slice(0, 300));
  }
  return "resposta";
}

// ---------- Legendas YouTube / Vimeo ----------

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
    return linhas.join(" ").replace(/\s+/g, " ").trim().slice(0, 1500) || null;
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
    return linhas.join(" ").replace(/\s+/g, " ").trim().slice(0, 1500) || null;
  } catch {
    return null;
  }
}

// ---------- Pedido ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem || quem.papel !== "admin" || quem.estado !== "aprovado") {
    return json({ erro: "Só administradores podem fazer isto." }, 403);
  }

  const chaveGemini = await segredo("GEMINI_API_KEY");
  const chaveGroq = await segredo("GROQ_API_KEY");
  if (!chaveGemini && !chaveGroq) {
    return json({ erro: "Falta a chave da IA. Cola uma em Administração > Chaves de API." }, 503);
  }

  const corpo = await req.json();

  if (corpo.acao === "listar") {
    const { data } = await admin
      .from("aulas")
      .select("id, titulo, descricao, url, modulo, ordem")
      .eq("curso_id", corpo.curso_id)
      .order("ordem")
      .order("created_at");
    const todas = data ?? [];
    return json({
      ok: true,
      motor: chaveGemini ? "Gemini" : "Groq",
      aulas: corpo.sobrescrever ? todas : todas.filter((a) => !a.descricao?.trim()),
    });
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

  const contexto = `Curso: ${curso?.titulo ?? "—"}${seccao ? ` (secção ${seccao.titulo})` : ""}
Nível: ${curso?.nivel ?? "—"}
${curso?.descricao ? `Sobre o curso: ${curso.descricao}` : ""}
${aula.modulo ? `Módulo: ${aula.modulo}` : ""}
Título atual da aula: «${aula.titulo}»`;

  const generico = /^\s*aula\s*\d+\s*$/i.test(aula.titulo);
  let resultado: { titulo: string; descricao: string } | Falha | null = null;

  const yt = aula.url ? idYouTube(aula.url) : null;
  const vi = aula.url ? idVimeo(aula.url) : null;
  const dr = aula.url ? idDrive(aula.url) : null;

  if (dr) {
    const bytes = await trechoDrive(dr);
    if (typeof bytes === "string") {
      resultado = bytes;
    } else if (chaveGemini) {
      // O Gemini ouve o vídeo e escreve o título numa só chamada.
      resultado = await pedirGemini(chaveGemini, await modelosGemini(chaveGemini), [
        { text: `${contexto}\n\nOuve o início desta aula e escreve o título e a descrição.` },
        { inline_data: { mime_type: "video/mp4", data: base64(bytes) } },
      ]);
    } else {
      const t = await whisper(bytes, chaveGroq!);
      if (typeof t === "string" && (t === "limite" || t === "audio")) resultado = t as Falha;
      else {
        resultado = await pedirGroq(
          chaveGroq!,
          corpo.modelo || (await modeloGroq(chaveGroq!)),
          `${contexto}\nTranscrição do início do vídeo: «${t}»\n\nEscreve o título e a descrição.`,
        );
      }
    }
  } else {
    const legenda = yt ? await transcricaoYouTube(yt) : vi ? await transcricaoVimeo(vi) : null;
    if (!legenda && generico) {
      resultado = "audio";
    } else {
      const prompt = `${contexto}\n${legenda ? `Transcrição do início do vídeo: «${legenda}»` : "Sem transcrição disponível."}\n\nEscreve o título e a descrição.`;
      resultado = chaveGemini
        ? await pedirGemini(chaveGemini, await modelosGemini(chaveGemini), [{ text: prompt }])
        : await pedirGroq(chaveGroq!, corpo.modelo || (await modeloGroq(chaveGroq!)), prompt);
    }
  }

  if (typeof resultado === "string") return json({ ok: false, motivo: resultado });
  if (!resultado) return json({ ok: false, motivo: "resposta" });

  const { error } = await admin
    .from("aulas")
    .update({ titulo: resultado.titulo, descricao: resultado.descricao })
    .eq("id", aula.id);
  if (error) return json({ erro: "Não foi possível gravar a aula." }, 500);

  return json({ ok: true, ...resultado });
});
