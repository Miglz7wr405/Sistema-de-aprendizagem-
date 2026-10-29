// Ações que precisam da chave de serviço — só para administradores.
import { chamador, clienteAdmin, cors, enviarEmail, json, urlDaApp } from "../_shared/comum.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem || quem.papel !== "admin" || quem.estado !== "aprovado") {
    return json({ erro: "Só administradores podem fazer isto." }, 403);
  }

  const b = await req.json().catch(() => null);
  const acao = String(b?.acao ?? "");
  const userId = String(b?.user_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ erro: "Utilizador inválido." }, 400);

  const { data: alvo } = await admin
    .from("perfis")
    .select("id, email, nome_completo, papel, estado")
    .eq("id", userId)
    .maybeSingle();
  if (!alvo) return json({ erro: "Utilizador não encontrado." }, 404);

  if (acao === "repor_palavra_passe") {
    const nova = String(b?.nova ?? "");
    if (nova.length < 6 || nova.length > 72) {
      return json({ erro: "A palavra-passe precisa de 6 a 72 caracteres." }, 400);
    }
    const { error } = await admin.auth.admin.updateUserById(userId, { password: nova });
    if (error) return json({ erro: error.message }, 500);
    return json({ ok: true });
  }

  if (acao === "apagar") {
    if (userId === quem.id) return json({ erro: "Não podes apagar a tua própria conta." }, 400);
    if (alvo.papel === "admin" && alvo.estado === "aprovado") {
      return json({ erro: "Tira primeiro o papel de administrador a esta pessoa." }, 400);
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return json({ erro: error.message }, 500);
    return json({ ok: true });
  }

  if (acao === "avisar_decisao") {
    const app = urlDaApp(req);
    const nome = alvo.nome_completo.split(" ")[0];
    const r =
      alvo.estado === "aprovado"
        ? await enviarEmail(
            [alvo.email],
            "O teu acesso foi aprovado 🎉",
            `Olá ${nome}! Já podes entrar na Insight Academia com o teu email e palavra-passe.`,
            app,
          )
        : alvo.estado === "recusado"
          ? await enviarEmail(
              [alvo.email],
              "Pedido de acesso",
              `Olá ${nome}. Por agora o teu pedido de acesso à Insight Academia não foi aprovado.`,
            )
          : { enviado: false };
    return json({ ok: true, ...r });
  }

  return json({ erro: "Ação desconhecida." }, 400);
});
