import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Cliente com a chave de serviço (só existe no servidor, nunca no browser). */
export function clienteAdmin(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Chamador = { id: string; papel: string; estado: string; nome_completo: string };

/** Quem está a chamar (a partir do JWT do pedido) e o seu perfil. */
export async function chamador(req: Request, admin: SupabaseClient): Promise<Chamador | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: perfil } = await admin
    .from("perfis")
    .select("id, papel, estado, nome_completo")
    .eq("id", data.user.id)
    .maybeSingle();
  return (perfil as Chamador | null) ?? null;
}

function escapar(t: string) {
  return t.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * Email opcional pelo Gmail (secrets GMAIL_USER e GMAIL_APP_PASSWORD nas Edge Functions).
 * Sem os secrets não faz nada — a notificação dentro da plataforma continua a funcionar.
 */
export async function enviarEmail(para: string[], assunto: string, texto: string, link?: string) {
  const user = Deno.env.get("GMAIL_USER");
  const pass = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s+/g, "");
  if (!user || !pass || para.length === 0) return { enviado: false };

  const botao = link
    ? `<p style="margin:24px 0"><a href="${escapar(link)}" style="background:#0033ff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Abrir a academia</a></p>`
    : "";
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#0f1e37">
    <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#97a1b5">Insight Academia</p>
    <h2 style="margin:8px 0 16px">${escapar(assunto)}</h2>
    <p style="line-height:1.6;white-space:pre-line">${escapar(texto)}</p>${botao}
  </div>`;

  const smtp = new SMTPClient({
    connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: user, password: pass } },
  });
  try {
    for (const to of para) {
      await smtp.send({ from: `Insight Academia <${user}>`, to, subject: assunto, content: texto, html });
    }
    return { enviado: true };
  } catch (e) {
    console.error("email", e);
    return { enviado: false };
  } finally {
    try {
      await smtp.close();
    } catch {
      /* ignora */
    }
  }
}

/** Endereço público da academia (secret ACADEMIA_URL). Nunca vem do pedido, para não haver links falsos nos emails. */
export function urlDaApp(_req?: Request) {
  return (Deno.env.get("ACADEMIA_URL") || "https://insight-academia.vercel.app").replace(/\/+$/, "");
}
