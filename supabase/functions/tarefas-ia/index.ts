// Tarefas de IA em SEGUNDO PLANO: o admin carrega no botão e pode sair da página.
// Cada tarefa tem passos por ordem:
//   'textos'     → título e descrição de cada aula (usa a função gerar-descricoes)
//   'organizar'  → agrupa as aulas em módulos (organizar-aulas + gravar-organizacao)
//   'descricoes' → descrição do curso e dos módulos
// O trabalho corre em blocos de ~1–2 min; no fim de cada bloco a função chama-se a si própria
// para continuar. Se algo a parar, o painel do admin volta a pô-la a andar ("listar").
import { chamador, clienteAdmin, cors, eChamadaInterna, json, segredo } from "../_shared/comum.ts";

type Tarefa = {
  id: string;
  curso_id: string | null;
  passos: string[];
  passo_atual: number;
  opcoes: { sobrescrever?: boolean; tentativas?: number; preparado?: boolean };
  itens: string[];
  feitos: number;
  falhas: number;
  estado: string;
  criado_por: string | null;
  automatica: boolean;
};

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const URL_BASE = Deno.env.get("SUPABASE_URL")!;
const CHAVE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
/** Não começa trabalho novo depois disto (o limite do servidor é ~150 s por bloco). */
const ORCAMENTO_MS = 50_000;
const BLOQUEIO_S = 170;

const NOME_PASSO: Record<string, string> = {
  textos: "Textos das aulas",
  organizar: "Organizar em módulos",
  descricoes: "Descrição do curso e módulos",
};

async function chamarInterna<T>(fn: string, corpo: unknown, timeoutMs: number): Promise<{ status: number; dados: T | null }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${URL_BASE}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-tarefa-chave": CHAVE },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
    const dados = (await r.json().catch(() => null)) as T | null;
    return { status: r.status, dados };
  } catch (e) {
    console.error("chamada", fn, e);
    return { status: 0, dados: null };
  } finally {
    clearTimeout(t);
  }
}

function emSegundoPlano(p: Promise<unknown>) {
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p);
  else p.catch((e) => console.error(e));
}

/** Pede ao próprio servidor para continuar a tarefa num novo bloco. */
async function continuarDepois(id: string) {
  await chamarInterna("tarefas-ia", { acao: "continuar", id }, 15_000);
}

// ---------- IA de texto (descrições do curso e dos módulos) ----------

async function modelosGemini(key: string): Promise<string[]> {
  const preferidos = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"];
  let nomes: string[] = [];
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    nomes = ((await r.json()).models ?? [])
      .filter((m: { supportedGenerationMethods?: string[] }) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m: { name: string }) => m.name.replace(/^models\//, ""))
      .filter((n: string) => !/image|tts|embedding|thinking/i.test(n));
  } catch { /* usa os preferidos */ }
  const lista = preferidos.filter((p) => nomes.length === 0 || nomes.includes(p));
  for (const n of nomes) if (!lista.includes(n)) lista.push(n);
  return lista.length ? lista : ["gemini-flash-lite-latest"];
}

function extrairJson<T>(texto: string): T | null {
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

async function pedirTexto<T>(regras: string, prompt: string): Promise<T | null> {
  const gemini = await segredo("GEMINI_API_KEY");
  if (gemini) {
    const modelos = await modelosGemini(gemini);
    for (const modelo of modelos.slice(0, 5)) {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${gemini}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: regras }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.5, maxOutputTokens: 4096, responseMimeType: "application/json" },
          }),
        },
      );
      if (!r.ok) {
        console.error("Gemini", r.status, modelo);
        continue;
      }
      const d = await r.json();
      const texto = (d.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      const j = extrairJson<T>(texto);
      if (j) return j;
    }
  }
  const groq = await segredo("GROQ_API_KEY");
  if (groq) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groq}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0.5,
        max_tokens: 4096,
        messages: [{ role: "system", content: regras }, { role: "user", content: prompt }],
      }),
    });
    if (r.ok) {
      const texto = (await r.json()).choices?.[0]?.message?.content ?? "";
      return extrairJson<T>(texto);
    }
    console.error("Groq", r.status);
  }
  return null;
}

const REGRAS_DESCRICOES = `Escreves em português europeu para uma academia online (Insight Academia).
Recebes um curso, os seus módulos e as aulas de cada módulo.
- "curso": descrição do curso em 2 a 3 frases, apelativa e concreta: o que o aluno aprende e o resultado que pode ter. Sem promessas de ganhos garantidos, sem emojis.
- "modulos": para cada módulo dado, UMA frase curta (máx. 140 caracteres) a dizer o que se aprende nele. Usa exatamente os ids dados.
Responde APENAS com JSON: {"curso":"...","modulos":[{"id":"...","descricao":"..."}]}`;

async function passoDescricoes(admin: ReturnType<typeof clienteAdmin>, t: Tarefa): Promise<string | null> {
  const { data: curso } = await admin.from("cursos").select("id, titulo, descricao").eq("id", t.curso_id).maybeSingle();
  if (!curso) return "Curso não encontrado.";
  const { data: modulos } = await admin
    .from("modulos")
    .select("id, titulo, descricao, ordem")
    .eq("curso_id", curso.id)
    .order("ordem");
  const { data: aulas } = await admin
    .from("aulas")
    .select("titulo, modulo_id, ordem")
    .eq("curso_id", curso.id)
    .order("ordem")
    .limit(400);
  const sobrescrever = Boolean(t.opcoes.sobrescrever);
  const precisaCurso = sobrescrever || !curso.descricao?.trim();
  const modsAlvo = (modulos ?? []).filter((m) => sobrescrever || !m.descricao?.trim());
  if (!precisaCurso && modsAlvo.length === 0) return null;

  const blocos = (modulos ?? []).length
    ? (modulos ?? [])
        .map((m) => {
          const titulos = (aulas ?? []).filter((a) => a.modulo_id === m.id).map((a) => `  - ${a.titulo}`).slice(0, 25);
          return `Módulo [id=${m.id}] ${m.titulo}\n${titulos.join("\n")}`;
        })
        .join("\n")
    : (aulas ?? []).slice(0, 80).map((a) => `- ${a.titulo}`).join("\n");

  const prompt = `Curso: ${curso.titulo}\n${modsAlvo.length ? `Módulos que precisam de descrição: ${modsAlvo.map((m) => m.id).join(", ")}\n` : "Não há módulos para descrever (devolve \"modulos\": []).\n"}\n${blocos}`;
  const r = await pedirTexto<{ curso?: string; modulos?: Array<{ id: string; descricao: string }> }>(REGRAS_DESCRICOES, prompt);
  if (!r) return "A IA não respondeu.";

  if (precisaCurso && r.curso?.trim()) {
    await admin.from("cursos").update({ descricao: r.curso.trim().slice(0, 600) }).eq("id", curso.id);
  }
  const alvo = new Set(modsAlvo.map((m) => m.id));
  for (const m of r.modulos ?? []) {
    if (alvo.has(m.id) && m.descricao?.trim()) {
      await admin.from("modulos").update({ descricao: m.descricao.trim().slice(0, 300) }).eq("id", m.id);
    }
  }
  return null;
}

// ---------- Motor ----------

async function notificar(admin: ReturnType<typeof clienteAdmin>, t: Tarefa, titulo: string, corpo: string) {
  if (!t.criado_por) return;
  await admin.from("notificacoes").insert({
    user_id: t.criado_por,
    tipo: "ia",
    titulo,
    corpo,
    link: "/admin/conteudo",
  });
}

async function atualizar(admin: ReturnType<typeof clienteAdmin>, id: string, campos: Record<string, unknown>) {
  await admin.from("tarefas_ia").update({ ...campos, atualizado_em: new Date().toISOString() }).eq("id", id);
}

async function processar(id: string) {
  const admin = clienteAdmin();
  const agora = new Date();
  // Fica com a tarefa (só um bloco de cada vez).
  const { data: presa } = await admin
    .from("tarefas_ia")
    .update({
      estado: "a_correr",
      bloqueado_ate: new Date(agora.getTime() + BLOQUEIO_S * 1000).toISOString(),
      atualizado_em: agora.toISOString(),
    })
    .eq("id", id)
    .in("estado", ["pendente", "a_correr"])
    .or(`bloqueado_ate.is.null,bloqueado_ate.lt.${agora.toISOString()}`)
    .select("*")
    .maybeSingle();
  if (!presa) return;
  const t = presa as Tarefa;
  const inicio = Date.now();
  let continuar = false;

  try {
    while (t.passo_atual < t.passos.length) {
      const passo = t.passos[t.passo_atual];

      if (passo === "textos") {
        if (!t.opcoes.preparado) {
          const r = await chamarInterna<{ aulas?: Array<{ id: string }>; erro?: string }>(
            "gerar-descricoes",
            { acao: "listar", curso_id: t.curso_id, sobrescrever: Boolean(t.opcoes.sobrescrever) },
            30_000,
          );
          if (!r.dados?.aulas) throw new Error(r.dados?.erro ?? "Não consegui ler as aulas.");
          t.itens = r.dados.aulas.map((a) => a.id);
          t.feitos = 0;
          t.opcoes = { ...t.opcoes, preparado: true };
          await atualizar(admin, t.id, { itens: t.itens, feitos: 0, opcoes: t.opcoes });
        }
        while (t.feitos < t.itens.length) {
          if (Date.now() - inicio > ORCAMENTO_MS) {
            continuar = true;
            break;
          }
          const r = await chamarInterna<{ ok?: boolean }>("gerar-descricoes", { acao: "uma", aula_id: t.itens[t.feitos] }, 80_000);
          if (!r.dados?.ok) t.falhas++;
          t.feitos++;
          await atualizar(admin, t.id, { feitos: t.feitos, falhas: t.falhas });
        }
        if (continuar) break;
      } else if (passo === "organizar") {
        // A IA pode demorar ~1 min: só começa no início de um bloco.
        if (Date.now() - inicio > 5_000) {
          continuar = true;
          break;
        }
        const prop = await chamarInterna<{ modulos?: unknown[]; erro?: string }>("organizar-aulas", { curso_id: t.curso_id }, 120_000);
        if (!prop.dados?.modulos?.length) throw new Error(prop.dados?.erro ?? "A IA não conseguiu organizar.");
        const g = await chamarInterna<{ ok?: boolean; erro?: string }>(
          "gravar-organizacao",
          { curso_id: t.curso_id, modulos: prop.dados.modulos },
          25_000,
        );
        if (!g.dados?.ok) throw new Error(g.dados?.erro ?? "Não consegui gravar os módulos.");
      } else if (passo === "descricoes") {
        if (Date.now() - inicio > 60_000) {
          continuar = true;
          break;
        }
        const erro = await passoDescricoes(admin, t);
        if (erro) throw new Error(erro);
      }

      // Passo seguinte.
      t.passo_atual++;
      t.itens = [];
      t.feitos = 0;
      t.opcoes = { ...t.opcoes, preparado: false, tentativas: 0 };
      await atualizar(admin, t.id, { passo_atual: t.passo_atual, itens: [], feitos: 0, opcoes: t.opcoes });
    }

    if (!continuar) {
      const msg = t.falhas > 0 ? `Concluída (${t.falhas} aulas sem texto: vídeo privado ou sem áudio).` : "Concluída.";
      await atualizar(admin, t.id, { estado: "concluida", mensagem: msg, bloqueado_ate: null });
      const { data: c } = await admin.from("cursos").select("titulo").eq("id", t.curso_id).maybeSingle();
      await notificar(admin, t, `IA terminou: ${c?.titulo ?? "curso"}`, `${t.passos.map((p) => NOME_PASSO[p] ?? p).join(" · ")} — ${msg}`);
      return;
    }
  } catch (e) {
    const tentativas = (t.opcoes.tentativas ?? 0) + 1;
    const mensagem = e instanceof Error ? e.message : String(e);
    console.error("tarefa", t.id, mensagem);
    if (tentativas >= 3) {
      await atualizar(admin, t.id, { estado: "erro", mensagem, bloqueado_ate: null, opcoes: { ...t.opcoes, tentativas } });
      await notificar(admin, t, "A tarefa de IA parou", mensagem);
      return;
    }
    t.opcoes = { ...t.opcoes, tentativas };
    await atualizar(admin, t.id, { opcoes: t.opcoes, mensagem: `Nova tentativa (${tentativas}/3): ${mensagem}` });
    continuar = true;
  }

  // Liberta e agenda o bloco seguinte.
  await atualizar(admin, t.id, { bloqueado_ate: null });
  const { data: ainda } = await admin.from("tarefas_ia").select("estado").eq("id", t.id).maybeSingle();
  if (ainda?.estado === "a_correr") await continuarDepois(t.id);
}

/** Cursos publicados com aulas mas sem descrição (ou com módulos sem descrição) → tarefa automática. */
async function enfileirarDescricoesEmFalta(admin: ReturnType<typeof clienteAdmin>, quem: string) {
  const { data: cursos } = await admin.from("cursos").select("id, descricao").eq("publicado", true);
  const { data: mods } = await admin.from("modulos").select("curso_id, descricao");
  const { data: comAulas } = await admin.from("aulas").select("curso_id").limit(10000);
  const temAulas = new Set((comAulas ?? []).map((a) => a.curso_id));
  const desde = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: recentes } = await admin.from("tarefas_ia").select("curso_id, passos").gte("criado_em", desde);
  const jaTem = new Set((recentes ?? []).filter((r) => (r.passos as string[]).includes("descricoes")).map((r) => r.curso_id));
  const novas: string[] = [];
  for (const c of cursos ?? []) {
    if (!temAulas.has(c.id) || jaTem.has(c.id)) continue;
    const modSem = (mods ?? []).some((m) => m.curso_id === c.id && !m.descricao?.trim());
    if (!c.descricao?.trim() || modSem) novas.push(c.id);
  }
  if (novas.length === 0) return [];
  const { data } = await admin
    .from("tarefas_ia")
    .insert(novas.map((curso_id) => ({ curso_id, passos: ["descricoes"], automatica: true, criado_por: quem })))
    .select("id");
  return (data ?? []).map((d) => d.id as string);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const corpo = await req.json().catch(() => ({}));
  const interna = eChamadaInterna(req);

  if (corpo.acao === "continuar") {
    if (!interna) return json({ erro: "Proibido." }, 403);
    emSegundoPlano(processar(String(corpo.id)));
    return json({ ok: true });
  }

  const quem = await chamador(req, admin);
  if (!quem || quem.papel !== "admin" || quem.estado !== "aprovado") {
    return json({ erro: "Só administradores podem fazer isto." }, 403);
  }

  if (corpo.acao === "criar") {
    const passos = (Array.isArray(corpo.passos) ? corpo.passos : []).filter((p: string) => p in NOME_PASSO);
    if (!corpo.curso_id || passos.length === 0) return json({ erro: "Escolhe o curso e pelo menos uma opção." }, 400);
    const { data: ativa } = await admin
      .from("tarefas_ia")
      .select("id")
      .eq("curso_id", corpo.curso_id)
      .in("estado", ["pendente", "a_correr"])
      .maybeSingle();
    if (ativa) return json({ erro: "Este curso já tem uma tarefa de IA a correr." }, 409);
    const { data, error } = await admin
      .from("tarefas_ia")
      .insert({ curso_id: corpo.curso_id, passos, opcoes: { sobrescrever: Boolean(corpo.sobrescrever) }, criado_por: quem.id })
      .select("*")
      .single();
    if (error) return json({ erro: "Não consegui criar a tarefa." }, 500);
    emSegundoPlano(processar(data.id));
    return json({ ok: true, tarefa: data });
  }

  if (corpo.acao === "cancelar") {
    await admin
      .from("tarefas_ia")
      .update({ estado: "cancelada", mensagem: "Cancelada.", atualizado_em: new Date().toISOString() })
      .eq("id", corpo.id)
      .in("estado", ["pendente", "a_correr"]);
    return json({ ok: true });
  }

  if (corpo.acao === "listar") {
    // Descrições automáticas para cursos/módulos que ainda não têm.
    const auto = corpo.auto ? await enfileirarDescricoesEmFalta(admin, quem.id) : [];
    // Retoma tarefas paradas (servidor reiniciado, etc.).
    const limite = new Date(Date.now() - 45_000).toISOString();
    const { data: paradas } = await admin
      .from("tarefas_ia")
      .select("id, bloqueado_ate")
      .in("estado", ["pendente", "a_correr"])
      .lt("atualizado_em", limite);
    const agoraIso = new Date().toISOString();
    for (const p of paradas ?? []) {
      if (!p.bloqueado_ate || p.bloqueado_ate < agoraIso) emSegundoPlano(processar(p.id));
    }
    for (const id of auto) emSegundoPlano(processar(id));

    const desde = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const { data } = await admin
      .from("tarefas_ia")
      .select("id, curso_id, passos, passo_atual, itens, feitos, falhas, estado, mensagem, automatica, criado_em, atualizado_em, cursos(titulo)")
      .gte("criado_em", desde)
      .order("criado_em", { ascending: false })
      .limit(30);
    const tarefas = (data ?? []).map((t) => ({
      ...t,
      total: Array.isArray(t.itens) ? t.itens.length : 0,
      itens: undefined,
      curso_titulo: (t.cursos as { titulo?: string } | null)?.titulo ?? null,
      cursos: undefined,
    }));
    return json({ ok: true, tarefas });
  }

  return json({ erro: "Ação inválida." }, 400);
});
