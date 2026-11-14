// Importa um curso a partir de uma pasta do Google Drive partilhada por link. Admin-only.
// { acao: "ler", link }  → pré-visualização { titulo, modulos:[{titulo, aulas:[{titulo,url}]}] }
// { acao: "criar", seccao_id, titulo, modulos } → cria curso, módulos e aulas.
// Lê a vista pública da pasta (embeddedfolderview), por isso não precisa de chave de API:
// basta a pasta estar partilhada como "Qualquer pessoa com o link".
import { chamador, clienteAdmin, cors, json } from "../_shared/comum.ts";

type AulaPrev = { titulo: string; url: string };
type ModuloPrev = { titulo: string | null; aulas: AulaPrev[] };

const VIDEO = /\.(mp4|mov|m4v|mkv|webm|avi|wmv|flv|mpe?g)$/i;
const MAX_PASTAS = 80;

function idDaPasta(link: string): string | null {
  const t = link.trim();
  const m = t.match(/folders\/([A-Za-z0-9_-]{10,})/) ?? t.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(t) ? t : null;
}

function desescapar(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Lista uma pasta pública: nome da pasta, subpastas e ficheiros. */
async function lerPasta(id: string) {
  const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${id}`, {
    headers: { "Accept-Language": "pt-PT,pt;q=0.9" },
  });
  if (!r.ok) throw new Error(`pasta ${r.status}`);
  const html = await r.text();
  const nome = desescapar(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "").trim();
  const entradas: Array<{ id: string; nome: string; pasta: boolean }> = [];
  const re = /<a href="https:\/\/drive\.google\.com\/(file\/d|drive\/folders)\/([A-Za-z0-9_-]+)[^"]*"[\s\S]*?flip-entry-title">([^<]*)</g;
  for (const m of html.matchAll(re)) {
    entradas.push({ id: m[2], nome: desescapar(m[3]).trim(), pasta: m[1] !== "file/d" });
  }
  return { nome, entradas, vazia: !html.includes("flip-entry") };
}

const ordenar = <T extends { nome: string }>(xs: T[]) =>
  xs.sort((a, b) => a.nome.localeCompare(b.nome, "pt", { numeric: true, sensitivity: "base" }));

/** "01 - Boas_vindas.mp4" → "Boas vindas"; "Curso X (12).mp4" → "Aula 12". */
function limparTitulo(nome: string, n: number): string {
  let t = nome
    .replace(VIDEO, "")
    .replace(/\s*[-–]\s*\d{4}-\d{2}-\d{2}T[\d.]+$/, "") // carimbo de data no fim
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const generico = t.match(/^.{0,80}\((\d{1,4})\)$/);
  if (generico) return `Aula ${Number(generico[1])}`;
  t = t.replace(/^(aula|modulo|módulo|video|vídeo)?\s*\d{1,3}\s*[-–—.:)]\s*/i, "").trim();
  return (t || `Aula ${n}`).slice(0, 200);
}

function limparModulo(nome: string) {
  return nome.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Módulo";
}

async function montar(raizId: string) {
  const raiz = await lerPasta(raizId);
  if (raiz.vazia && raiz.entradas.length === 0) return null;
  let lidas = 1;
  const modulos: ModuloPrev[] = [];
  let n = 0;
  const videos = (es: typeof raiz.entradas) => {
    const lista = ordenar(es.filter((e) => !e.pasta && VIDEO.test(e.nome))).map((e) => ({
      titulo: limparTitulo(e.nome, ++n),
      url: `https://drive.google.com/file/d/${e.id}/view`,
    }));
    // Nomes todos iguais (ex.: exportações com o mesmo nome) → numera.
    const distintos = new Set(lista.map((a) => a.titulo)).size;
    if (lista.length >= 3 && distintos < lista.length / 2) {
      const base = n - lista.length;
      lista.forEach((a, i) => (a.titulo = `Aula ${base + i + 1}`));
    }
    return lista;
  };

  const soltas = videos(raiz.entradas);
  if (soltas.length) modulos.push({ titulo: null, aulas: soltas });

  // Subpastas = módulos; níveis mais fundos juntam-se ao módulo de cima.
  for (const sub of ordenar(raiz.entradas.filter((e) => e.pasta))) {
    if (lidas >= MAX_PASTAS) break;
    const fila = [sub.id];
    const aulas: AulaPrev[] = [];
    while (fila.length && lidas < MAX_PASTAS) {
      const p = await lerPasta(fila.shift()!);
      lidas++;
      aulas.push(...videos(p.entradas));
      fila.push(...ordenar(p.entradas.filter((e) => e.pasta)).map((e) => e.id));
    }
    if (aulas.length) modulos.push({ titulo: limparModulo(sub.nome), aulas });
  }
  return { titulo: raiz.nome.replace(/\s*[-–—]\s*Google Drive$/i, "").trim(), modulos };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem || quem.papel !== "admin" || quem.estado !== "aprovado") {
    return json({ erro: "Só administradores podem importar cursos." }, 403);
  }
  const b = await req.json().catch(() => null);

  if (b?.acao === "ler") {
    const id = idDaPasta(String(b?.link ?? ""));
    if (!id) return json({ erro: "Cola o link de uma pasta do Google Drive." }, 400);
    try {
      const prev = await montar(id);
      const total = prev?.modulos.reduce((s, m) => s + m.aulas.length, 0) ?? 0;
      if (!prev || total === 0) {
        return json(
          {
            erro:
              "Não encontrei vídeos nesta pasta. Confirma que está partilhada como “Qualquer pessoa com o link” e que tem vídeos (ou subpastas com vídeos).",
          },
          404,
        );
      }
      return json({ ok: true, ...prev, total });
    } catch (e) {
      console.error("drive", e);
      return json({ erro: "Não consegui abrir a pasta. Está partilhada por link?" }, 502);
    }
  }

  if (b?.acao === "criar") {
    const seccaoId = String(b?.seccao_id ?? "");
    const titulo = String(b?.titulo ?? "").trim().slice(0, 200);
    const modulos = (Array.isArray(b?.modulos) ? b.modulos : []) as ModuloPrev[];
    const valido = (u: unknown) => typeof u === "string" && /^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\/view$/.test(u);
    if (!/^[0-9a-f-]{36}$/i.test(seccaoId) || !titulo || modulos.length === 0) {
      return json({ erro: "Falta a secção, o título ou as aulas." }, 400);
    }
    if (modulos.some((m) => !Array.isArray(m.aulas) || m.aulas.some((a) => !valido(a.url) || !String(a.titulo ?? "").trim()))) {
      return json({ erro: "Há aulas inválidas na lista." }, 400);
    }

    const { data: ultima } = await admin
      .from("cursos").select("ordem").eq("seccao_id", seccaoId).order("ordem", { ascending: false }).limit(1).maybeSingle();
    const { data: curso, error: eC } = await admin
      .from("cursos")
      .insert({ seccao_id: seccaoId, titulo, nivel: "iniciante", publicado: b?.publicar !== false, ordem: ((ultima?.ordem as number) ?? 0) + 1 })
      .select("id")
      .single();
    if (eC || !curso) {
      console.error("curso", eC);
      return json({ erro: "Não foi possível criar o curso." }, 500);
    }

    let ordem = 0;
    let mi = 0;
    for (const m of modulos) {
      let moduloId: string | null = null;
      if (m.titulo) {
        const { data: mod, error: eM } = await admin
          .from("modulos").insert({ curso_id: curso.id, titulo: String(m.titulo).slice(0, 120), ordem: mi++ }).select("id").single();
        if (eM) console.error("modulo", eM);
        moduloId = (mod?.id as string) ?? null;
      }
      const linhas = m.aulas.map((a) => ({
        curso_id: curso.id,
        modulo_id: moduloId,
        titulo: String(a.titulo).trim().slice(0, 200),
        tipo: "link",
        url: a.url,
        ordem: ordem++,
      }));
      const { error: eA } = await admin.from("aulas").insert(linhas);
      if (eA) {
        console.error("aulas", eA);
        return json({ erro: "O curso foi criado mas falharam algumas aulas.", curso_id: curso.id }, 500);
      }
    }
    return json({ ok: true, curso_id: curso.id, aulas: ordem });
  }

  return json({ erro: "Ação desconhecida." }, 400);
});
