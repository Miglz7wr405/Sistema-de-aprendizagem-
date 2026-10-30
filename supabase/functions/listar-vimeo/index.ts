import { chamador, clienteAdmin, cors, json } from "../_shared/comum.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "Metodo nao permitido" }, 405);

  const admin = clienteAdmin();
  const quem = await chamador(req, admin);
  if (!quem || quem.papel !== "admin" || quem.estado !== "aprovado") {
    return json({ erro: "So administradores podem fazer isto." }, 403);
  }

  const token = Deno.env.get("VIMEO_TOKEN");
  if (!token) {
    return json(
      {
        erro: "VIMEO_TOKEN nao configurado. Vai ao Supabase Dashboard > Edge Functions > Secrets e adiciona o teu token pessoal do Vimeo.",
      },
      503,
    );
  }

  type VimeoPicSize = { width: number; link: string };
  type VimeoVideo = {
    uri: string;
    name: string;
    link: string;
    duration: number;
    pictures?: { sizes?: VimeoPicSize[] };
    privacy?: { view?: string };
  };

  const videos: Array<{
    id: string;
    nome: string;
    url: string;
    duracao: number;
    miniatura: string | null;
    privacidade: string;
  }> = [];

  let page = 1;
  let totalPages = 1;

  do {
    const resp = await fetch(
      `https://api.vimeo.com/me/videos?page=${page}&per_page=100&fields=uri,name,link,duration,pictures.sizes,privacy&sort=date&direction=desc`,
      {
        headers: {
          Authorization: `bearer ${token}`,
          Accept: "application/vnd.vimeo.*+json;version=3.4",
        },
      },
    );

    if (!resp.ok) {
      const body = await resp.text();
      console.error("Vimeo API:", resp.status, body);
      if (resp.status === 401) {
        return json(
          { erro: "Token do Vimeo invalido ou expirado. Verifica o VIMEO_TOKEN nos Secrets." },
          401,
        );
      }
      return json({ erro: "Erro ao listar videos do Vimeo." }, 502);
    }

    const data = await resp.json();
    totalPages = Math.ceil((data.total ?? 0) / (data.per_page ?? 100));

    for (const v of data.data as VimeoVideo[]) {
      const id = v.uri.split("/").pop() ?? "";
      const sorted = [...(v.pictures?.sizes ?? [])].sort((a, b) => a.width - b.width);
      const miniatura = sorted.find((s) => s.width >= 295)?.link ?? sorted.at(-1)?.link ?? null;

      videos.push({
        id,
        nome: v.name,
        url: v.link,
        duracao: v.duration,
        miniatura,
        privacidade: v.privacy?.view ?? "desconhecido",
      });
    }

    page++;
  } while (page <= totalPages);

  return json({ ok: true, videos, total: videos.length });
});
