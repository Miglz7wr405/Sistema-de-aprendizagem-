// Verifica se a sessão local ainda é a válida e conta o tempo de uso do dia.
// Devolve { ativa, usado, limite } — `limite` em segundos (null = sem limite diário).
// Quando `ativa` é false, o cliente faz signOut().
import { chamador, clienteAdmin, cors, json } from "../_shared/comum.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem) return json({ ativa: false });

  const corpo = await req.json().catch(() => null);
  const sessaoId = corpo?.sessao_id as string | undefined;
  const visivel = corpo?.visivel !== false;
  if (!sessaoId) return json({ ativa: false });

  const { data, error } = await admin
    .from("sessoes_ativas")
    .select("sessao_id, vista_em")
    .eq("user_id", quem.id)
    .maybeSingle();
  if (error) {
    console.error("db ler sessao", error);
    // Em caso de erro deixamos passar: um corte temporário de rede não deve expulsar o aluno.
    return json({ ativa: true, erro: true });
  }
  const linha = data as { sessao_id: string; vista_em: string | null } | null;
  const ativa = linha?.sessao_id === sessaoId;
  if (!ativa) return json({ ativa });

  const agora = Date.now();
  await admin
    .from("sessoes_ativas")
    .update({ vista_em: new Date(agora).toISOString() })
    .eq("user_id", quem.id);

  // Tempo de uso: o intervalo desde o último batimento (máx. 60 s), só com a página visível.
  const { data: perfil } = await admin
    .from("perfis")
    .select("papel, plano")
    .eq("id", quem.id)
    .maybeSingle();
  const { data: lim } = await admin.rpc("limite_diario_segundos", { p_plano: perfil?.plano ?? "legacy" });
  const limite = perfil && perfil.papel === "aluno" ? ((lim as number | null) ?? null) : null;

  let usado = 0;
  const desde = linha?.vista_em ? Math.round((agora - new Date(linha.vista_em).getTime()) / 1000) : 0;
  const delta = visivel ? Math.max(0, Math.min(desde, 60)) : 0;
  const { data: total, error: eU } = await admin.rpc("somar_uso", { p_user: quem.id, p_segundos: delta });
  if (eU) console.error("somar_uso", eU);
  else usado = (total as number) ?? 0;

  return json({ ativa, usado, limite });
});
