// Reserva do ditado por voz: quando o navegador não reconhece fala, o áudio vem para aqui
// e é transcrito pelo ElevenLabs (secret ELEVENLABS_API_KEY).
import { chamador, clienteAdmin, cors, json } from "../_shared/comum.ts";

const LIMITE = 15 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const quem = await chamador(req, clienteAdmin());
  if (!quem || quem.estado !== "aprovado") return json({ erro: "Entra na academia primeiro." }, 401);

  const chave = Deno.env.get("ELEVENLABS_API_KEY");
  if (!chave) {
    return json(
      { erro: "O ditado por gravação ainda não está ativo (falta a chave do ElevenLabs). Entretanto, usa o Google Chrome para ditar." },
      503,
    );
  }

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return json({ erro: "Sem áudio." }, 400);
  if (audio.size > LIMITE) return json({ erro: "Gravação demasiado longa." }, 413);

  for (const modelo of ["scribe_v2", "scribe_v1"]) {
    const fd = new FormData();
    fd.append("file", audio, audio.name || "ditado.webm");
    fd.append("model_id", modelo);
    fd.append("language_code", "por");
    fd.append("tag_audio_events", "false");
    const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": chave },
      body: fd,
    });
    if (r.ok) {
      const j = await r.json();
      return json({ texto: String(j?.text ?? "").trim() });
    }
    const corpo = await r.text();
    console.error("elevenlabs", modelo, r.status, corpo.slice(0, 300));
    // Se o modelo não existir, tenta o seguinte; outros erros param aqui.
    if (!(r.status === 400 || r.status === 422) || !/model/i.test(corpo)) break;
  }
  return json({ erro: "Não foi possível transcrever o áudio." }, 502);
});
