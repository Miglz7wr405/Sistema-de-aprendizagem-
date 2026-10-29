// Cria a conta de quem pede acesso, já confirmada (sem email de confirmação).
// O perfil fica "pendente" (gatilho na base de dados) e os admins são avisados.
import { clienteAdmin, cors, enviarEmail, json, urlDaApp } from "../_shared/comum.ts";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const b = await req.json().catch(() => null);
  const nome = String(b?.nome_completo ?? "").trim().slice(0, 120);
  const email = String(b?.email ?? "").trim().toLowerCase();
  const telefone = String(b?.telefone ?? "").trim().slice(0, 40);
  const motivo = String(b?.motivo ?? "").trim().slice(0, 1000);
  const password = String(b?.password ?? "");

  if (nome.length < 3) return json({ erro: "Escreve o teu nome completo." }, 400);
  if (!EMAIL_RE.test(email) || email.length > 200) return json({ erro: "O email não parece válido." }, 400);
  if (password.length < 6 || password.length > 72) {
    return json({ erro: "A palavra-passe precisa de 6 a 72 caracteres." }, 400);
  }

  const admin = clienteAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome_completo: nome, telefone, motivo },
  });

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      return json({ erro: "Este email já tem conta. Entra com a tua palavra-passe." }, 409);
    }
    console.error("createUser", error);
    return json({ erro: "Não foi possível criar a conta. Tenta outra vez." }, 500);
  }

  // Email aos admins (opcional — só se o Gmail estiver configurado).
  const { data: perfil } = await admin.from("perfis").select("estado").eq("id", data.user.id).single();
  if (perfil?.estado === "pendente") {
    const { data: admins } = await admin
      .from("perfis")
      .select("email")
      .eq("papel", "admin")
      .eq("estado", "aprovado");
    const app = urlDaApp(req);
    await enviarEmail(
      (admins ?? []).map((a) => a.email).filter(Boolean),
      "Novo pedido de acesso",
      `${nome} (${email}${telefone ? `, ${telefone}` : ""}) pediu para entrar na academia.${motivo ? `\n\n“${motivo}”` : ""}`,
      app ? `${app}/admin/pedidos` : undefined,
    );
  }

  return json({ ok: true, estado: perfil?.estado ?? "pendente" });
});
