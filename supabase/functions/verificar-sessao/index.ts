// Verifica se a sessão local ainda é a válida.
// Devolve { ativa: boolean }. Quando `ativa` é false, o cliente faz signOut().
import { chamador, clienteAdmin, cors, json } from "../_shared/comum.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem) return json({ ativa: false });

  const corpo = await req.json().catch(() => null);
  const sessaoId = corpo?.sessao_id as string | undefined;
  if (!sessaoId) return json({ ativa: false });

  const { data, error } = await admin
    .from("sessoes_ativas")
    .select("sessao_id")
    .eq("user_id", quem.id)
    .maybeSingle();
  if (error) {
    console.error("db ler sessao", error);
    // Em caso de erro deixamos passar: um corte temporário de rede não deve expulsar o aluno.
    return json({ ativa: true, erro: true });
  }
  const linha = data as { sessao_id: string } | null;
  const ativa = linha?.sessao_id === sessaoId;
  if (ativa) {
    await admin
      .from("sessoes_ativas")
      .update({ vista_em: new Date().toISOString() })
      .eq("user_id", quem.id);
  }
  return json({ ativa });
});
