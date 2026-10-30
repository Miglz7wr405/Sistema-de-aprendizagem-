// Google Drive Picker API + Drive API (client-side).
// Só carrega os scripts quando o admin clica no botão — sem impacto no bundle.

const SCOPES = "https://www.googleapis.com/auth/drive.readonly";
const DISCOVERY = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

let gapiPronto = false;
let gisPronto = false;

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(s);
  });
}

export async function carregarGapi(): Promise<void> {
  if (gapiPronto) return;
  await injectScript("https://apis.google.com/js/api.js");
  await new Promise<void>((resolve) => gapi.load("client:picker", () => resolve()));
  await gapi.client.init({
    apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
    discoveryDocs: [DISCOVERY],
  });
  gapiPronto = true;
}

export async function carregarGis(): Promise<void> {
  if (gisPronto) return;
  await injectScript("https://accounts.google.com/gsi/client");
  gisPronto = true;
}

export function obterTokenOAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return reject(new Error("VITE_GOOGLE_CLIENT_ID não está definido."));
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp: google.accounts.oauth2.TokenResponse) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken();
  });
}

export type FicheiroDrive = {
  id: string;
  nome: string;
  mimeType: string;
  url: string;
};

export function abrirPicker(token: string, modo: "ficheiro" | "pasta"): Promise<FicheiroDrive[]> {
  return new Promise((resolve) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY!;

    const view =
      modo === "pasta"
        ? new google.picker.DocsView(google.picker.ViewId.FOLDERS).setSelectFolderEnabled(true)
        : new google.picker.DocsView().setMimeTypes(
            "video/mp4,video/webm,video/quicktime,video/x-msvideo,video/mpeg,video/x-matroska,video/ogg",
          );

    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .setTitle(modo === "pasta" ? "Escolher pasta do curso" : "Escolher vídeo")
      .setLocale("pt")
      .setCallback((data: google.picker.ResponseObject) => {
        if (data.action === google.picker.Action.PICKED) {
          const docs =
            data.docs ??
            (data as unknown as Record<string, google.picker.DocumentObject[]>)[
              google.picker.Response.DOCUMENTS
            ] ??
            [];
          resolve(
            docs.map((d: google.picker.DocumentObject) => ({
              id: d.id,
              nome: d.name ?? d.id,
              mimeType: d.mimeType ?? "",
              url: `https://drive.google.com/file/d/${d.id}/view`,
            })),
          );
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve([]);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

export async function listarPasta(token: string, pastaId: string): Promise<FicheiroDrive[]> {
  const ficheiros: FicheiroDrive[] = [];
  let pageToken: string | undefined;

  do {
    const resp = await gapi.client.drive.files.list({
      q: `'${pastaId}' in parents and mimeType contains 'video/' and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      orderBy: "name",
      pageSize: 100,
      pageToken,
    });

    const items = resp.result.files ?? [];
    for (const f of items) {
      ficheiros.push({
        id: f.id!,
        nome: f.name ?? f.id!,
        mimeType: f.mimeType ?? "",
        url: `https://drive.google.com/file/d/${f.id}/view`,
      });
    }
    pageToken = resp.result.nextPageToken ?? undefined;
  } while (pageToken);

  return ficheiros;
}

export function limparNomeFicheiro(nome: string): string {
  return nome
    .replace(/\.\w{2,5}$/, "") // extensão
    .replace(/^\d+[\s._-]+/, "") // prefixo numérico (01 - , 02. )
    .trim();
}
