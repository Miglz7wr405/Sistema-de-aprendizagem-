// Acesso de teste de 5 minutos, uma única vez por IP e por email. Público (sem sessão).
// Cria uma conta temporária (marcada em app_metadata, que só a chave de serviço escreve)
// e devolve email + palavra-passe para o cliente entrar logo.
import { clienteAdmin, cors, json } from "../_shared/comum.ts";

async function sha256(texto: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function palavraPasse() {
  const b = new Uint8Array(18);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/[^A-Za-z0-9]/g, "") + "!9a";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const b = await req.json().catch(() => null);
  const email = String(b?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) {
    return json({ erro: "Escreve um email válido." }, 400);
  }

  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    "";
  if (!ip) return json({ erro: "Não foi possível confirmar a tua ligação. Tenta outra vez." }, 400);
  const ipHash = await sha256(`insight-teste:${ip}`);

  const admin = clienteAdmin();
  const [{ data: porIp }, { data: porEmail }] = await Promise.all([
    admin.from("acessos_teste").select("id").eq("ip_hash", ipHash).limit(1),
    admin.from("acessos_teste").select("id").eq("email", email).limit(1),
  ]);
  if ((porIp?.length ?? 0) > 0 || (porEmail?.length ?? 0) > 0) {
    return json(
      { erro: "O teste de 5 minutos só pode ser usado uma vez. Pede acesso para continuares na academia." },
      409,
    );
  }
  const { data: jaTemConta } = await admin.from("perfis").select("id").eq("email", email).maybeSingle();
  if (jaTemConta) {
    return json({ erro: "Este email já tem conta. Entra com a tua palavra-passe." }, 409);
  }

  // Reserva primeiro (a restrição UNIQUE impede dois testes em simultâneo do mesmo IP/email).
  const { data: reserva, error: eR } = await admin
    .from("acessos_teste")
    .insert({ ip_hash: ipHash, email })
    .select("id")
    .single();
  if (eR || !reserva) {
    return json({ erro: "O teste de 5 minutos só pode ser usado uma vez." }, 409);
  }

  const senha = palavraPasse();
  const { data: criado, error: eU } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    app_metadata: { teste: true },
    user_metadata: { nome_completo: "Visitante", origem: "teste" },
  });
  if (eU || !criado.user) {
    console.error("criar teste", eU);
    await admin.from("acessos_teste").delete().eq("id", reserva.id);
    return json({ erro: "Não foi possível criar o acesso de teste agora. Tenta daqui a pouco." }, 500);
  }
  // O gatilho cria o perfil como pendente; aqui (chave de serviço) passa a teste aprovado por 5 min.
  const { error: eP } = await admin
    .from("perfis")
    .update({
      estado: "aprovado",
      plano: "semana",
      teste: true,
      acesso_expira_em: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      aprovado_em: new Date().toISOString(),
    })
    .eq("id", criado.user.id);
  if (eP) {
    console.error("aprovar teste", eP);
    return json({ erro: "Não foi possível abrir o acesso de teste agora. Tenta daqui a pouco." }, 500);
  }
  await admin.from("acessos_teste").update({ user_id: criado.user.id }).eq("id", reserva.id);

  return json({ ok: true, email, senha });
});
