// Descobre como mostrar um vídeo a partir do link que o admin colou.

export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const padroes = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtube\.com\/live\/)([\w-]{11})/,
  ];
  for (const p of padroes) {
    const m = url.match(p);
    if (m) return m[1];
  }
  const solto = url.trim().match(/^[\w-]{11}$/);
  return solto ? solto[0] : null;
}

export function youtubeThumb(url: string | null | undefined): string | null {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

/** Id de um ficheiro do Google Drive (file/d/ID, open?id=ID, uc?id=ID). */
export function driveId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[\w=&]*&)?id=)([\w-]{20,})/,
  );
  return m ? m[1] : null;
}

/** Miniatura da aula: YouTube ou Google Drive (o Drive só a dá se o vídeo for público). */
export function miniaturaDoLink(url: string | null | undefined): string | null {
  const yt = youtubeThumb(url);
  if (yt) return yt;
  const drive = driveId(url);
  return drive ? `https://drive.google.com/thumbnail?id=${drive}&sz=w480` : null;
}

export type Leitor =
  | { tipo: "iframe"; src: string }
  | { tipo: "video"; src: string }
  | { tipo: "externo"; src: string };

/** Converte um link (YouTube, Vimeo, Loom, Google Drive, .mp4) no leitor certo. */
export function leitorDoLink(url: string): Leitor {
  const yt = youtubeId(url);
  if (yt) return { tipo: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt}?rel=0` };

  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { tipo: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };

  const loom = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  if (loom) return { tipo: "iframe", src: `https://www.loom.com/embed/${loom[1]}` };

  const drive = driveId(url);
  if (drive) return { tipo: "iframe", src: `https://drive.google.com/file/d/${drive}/preview` };

  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return { tipo: "video", src: url };

  return { tipo: "externo", src: url };
}

export function tipoDoLink(url: string): "youtube" | "link" {
  return youtubeId(url) ? "youtube" : "link";
}

export function linkValido(url: string) {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return Boolean(youtubeId(url));
  }
}
