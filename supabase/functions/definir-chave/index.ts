import { chamador, clienteAdmin, cors, json, segredo } from "../_shared/comum.ts";

const PERMITIDOS = ["GROQ_API_KEY", "VIMEO_ACCESS_TOKEN"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem || quem.papel !== "admin" || quem.estado !== "aprovado") {
    return json({ erro: "Só administradores podem fazer isto." }, 403);
  }

  const { acao, nome, valor } = await req.json();

  if (acao === "estado") {
    const estado: Record<string, boolean> = {};
    for (const n of PERMITIDOS) estado[n] = !!(await segredo(n));
    return json({ ok: true, estado });
  }

  if (acao === "guardar") {
    if (!PERMITIDOS.includes(nome)) return json({ erro: "Chave não permitida." }, 400);
    const v = String(valor ?? "").trim();
    if (v.length < 8) return json({ erro: "Chave inválida." }, 400);
    const { error } = await admin
      .from("segredos")
      .upsert({ nome, valor: v, atualizado_em: new Date().toISOString() });
    if (error) return json({ erro: "Não foi possível guardar." }, 500);
    return json({ ok: true });
  }

  if (acao === "remover") {
    if (!PERMITIDOS.includes(nome)) return json({ erro: "Chave não permitida." }, 400);
    await admin.from("segredos").delete().eq("nome", nome);
    return json({ ok: true });
  }

  return json({ erro: "Ação inválida." }, 400);
});
