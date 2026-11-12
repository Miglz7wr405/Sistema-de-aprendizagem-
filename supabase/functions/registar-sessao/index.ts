// Regista a sessão ativa desta conta. Qualquer sessão anterior é invalidada:
// a mesma conta só pode estar aberta num sítio ao mesmo tempo.
import { chamador, clienteAdmin, cors, json } from "../_shared/comum.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem) return json({ erro: "Sessão inválida." }, 401);

  const sessaoId = crypto.randomUUID();
  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    null;
  const agente = (req.headers.get("user-agent") ?? "").slice(0, 300) || null;

  // Upsert por user_id — substitui o que lá estava.
  const { error } = await admin.from("sessoes_ativas").upsert(
    {
      user_id: quem.id,
      sessao_id: sessaoId,
      ip,
      agente,
      criada_em: new Date().toISOString(),
      vista_em: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("db upsert sessao", error);
    return json({ erro: "Erro a registar a sessão." }, 500);
  }

  return json({ ok: true, sessao_id: sessaoId });
});
