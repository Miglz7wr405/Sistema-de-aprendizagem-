// Altera a privacidade de vídeos do Vimeo (bulk) via API do Vimeo.
// Útil para destravar vídeos importados que estão em "privado" (nobody),
// o que faz o leitor embutido pedir login ao aluno.
import { chamador, clienteAdmin, cors, json } from "../_shared/comum.ts";

type Privacidade = "anybody" | "unlisted";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem || quem.papel !== "admin" || quem.estado !== "aprovado") {
    return json({ erro: "Só administradores podem alterar a privacidade." }, 403);
  }

  const token = Deno.env.get("VIMEO_TOKEN");
  if (!token) {
    return json(
      { erro: "VIMEO_TOKEN não configurado. Vai aos Secrets no Supabase e adiciona o token." },
      503,
    );
  }

  const corpo = await req.json().catch(() => null);
  const ids = corpo?.video_ids as string[] | undefined;
  const privacidade = (corpo?.privacidade as Privacidade | undefined) ?? "anybody";
  const download = typeof corpo?.download === "boolean" ? corpo.download : true;

  if (!Array.isArray(ids) || ids.length === 0) {
    return json({ erro: "Dá uma lista de video_ids." }, 400);
  }
  if (privacidade !== "anybody" && privacidade !== "unlisted") {
    return json({ erro: "Privacidade tem de ser 'anybody' ou 'unlisted'." }, 400);
  }
  if (ids.length > 200) {
    return json({ erro: "Máximo 200 vídeos por chamada." }, 400);
  }

  const resultados: Array<{ id: string; ok: boolean; estado?: number; erro?: string }> = [];
  for (const id of ids) {
    const limpo = id.replace(/[^0-9]/g, "");
    if (!limpo) {
      resultados.push({ id, ok: false, erro: "Id inválido" });
      continue;
    }
    const r = await fetch(`https://api.vimeo.com/videos/${limpo}`, {
      method: "PATCH",
      headers: {
        Authorization: `bearer ${token}`,
        Accept: "application/vnd.vimeo.*+json;version=3.4",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        privacy: {
          view: privacidade,
          embed: "public",
          download,
        },
      }),
    });
    if (r.ok) {
      resultados.push({ id: limpo, ok: true });
    } else {
      const t = await r.text();
      console.error("vimeo", limpo, r.status, t.slice(0, 200));
      resultados.push({ id: limpo, ok: false, estado: r.status, erro: t.slice(0, 160) });
    }
  }

  const sucesso = resultados.filter((r) => r.ok).length;
  return json({ ok: true, sucesso, total: resultados.length, resultados });
});
