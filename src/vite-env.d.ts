/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GOOGLE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/* Google APIs (loaded dynamically by google-picker.ts) */
declare namespace google {
  namespace accounts.oauth2 {
    interface TokenResponse {
      access_token: string;
      error?: string;
      error_description?: string;
    }
    interface TokenClient {
      requestAccessToken(): void;
    }
    function initTokenClient(config: {
      client_id: string;
      scope: string;
      callback: (resp: TokenResponse) => void;
    }): TokenClient;
  }
  namespace picker {
    interface DocumentObject {
      id: string;
      name?: string;
      mimeType?: string;
      url?: string;
    }
    interface ResponseObject {
      action: string;
      docs?: DocumentObject[];
    }
    class PickerBuilder {
      addView(view: DocsView): this;
      setOAuthToken(token: string): this;
      setDeveloperKey(key: string): this;
      setTitle(title: string): this;
      setLocale(locale: string): this;
      setCallback(cb: (data: ResponseObject) => void): this;
      build(): { setVisible(v: boolean): void };
    }
    class DocsView {
      constructor(viewId?: string);
      setMimeTypes(mimes: string): this;
      setSelectFolderEnabled(v: boolean): this;
      setIncludeFolders(v: boolean): this;
    }
    const Action: { PICKED: string; CANCEL: string };
    const Response: { DOCUMENTS: string };
    const ViewId: { DOCS: string; FOLDERS: string };
  }
}

declare namespace gapi {
  function load(api: string, cb: () => void): void;
  namespace client {
    function init(config: { apiKey?: string; discoveryDocs?: string[] }): Promise<void>;
    function setToken(token: { access_token: string }): void;
    function load(api: string, version: string): Promise<void>;
    namespace drive.files {
      function list(params: {
        q: string;
        fields: string;
        pageSize: number;
        orderBy: string;
        pageToken?: string;
      }): Promise<{
        result: {
          files?: Array<{ id: string; name?: string; mimeType?: string }>;
          nextPageToken?: string;
        };
      }>;
    }
  }
}
