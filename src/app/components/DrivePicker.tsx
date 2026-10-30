import { useState } from "react";
import { HardDrive, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./primitives";
import {
  carregarGapi,
  carregarGis,
  obterTokenOAuth,
  abrirPicker,
  listarPasta,
  type FicheiroDrive,
} from "@/lib/google-picker";

const TEM_CONFIG = !!import.meta.env.VITE_GOOGLE_CLIENT_ID && !!import.meta.env.VITE_GOOGLE_API_KEY;

type Estado = "inativo" | "a_carregar" | "a_autenticar" | "a_escolher";

async function prepararEEscolher(modo: "ficheiro" | "pasta"): Promise<FicheiroDrive[]> {
  await Promise.all([carregarGapi(), carregarGis()]);
  const token = await obterTokenOAuth();
  const escolhidos = await abrirPicker(token, modo);
  if (modo === "pasta" && escolhidos.length > 0) {
    return listarPasta(token, escolhidos[0].id);
  }
  return escolhidos;
}

/** Botão "Escolher do Google Drive" para aulas individuais. */
export function BotaoDrive({
  onEscolher,
  className,
}: {
  onEscolher: (ficheiro: FicheiroDrive) => void;
  className?: string;
}) {
  const [estado, setEstado] = useState<Estado>("inativo");
  if (!TEM_CONFIG) return null;

  async function abrir() {
    setEstado("a_carregar");
    try {
      const ficheiros = await prepararEEscolher("ficheiro");
      if (ficheiros.length > 0) onEscolher(ficheiros[0]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("popup")) {
        toast.error("O browser bloqueou o popup. Permite popups para este site e tenta outra vez.");
      } else {
        toast.error(msg || "Erro ao abrir o Google Drive.");
      }
    } finally {
      setEstado("inativo");
    }
  }

  return (
    <Button variant="outline" className={className} onClick={abrir} disabled={estado !== "inativo"}>
      <HardDrive className="size-4" />
      {estado === "a_carregar" ? "A abrir o Drive..." : "Google Drive"}
    </Button>
  );
}

/** Botão "Importar pasta do Drive" — devolve vários ficheiros (aulas batch). */
export function BotaoImportarPasta({
  onImportar,
  disabled,
}: {
  onImportar: (ficheiros: FicheiroDrive[]) => void;
  disabled?: boolean;
}) {
  const [estado, setEstado] = useState<Estado>("inativo");
  if (!TEM_CONFIG) return null;

  async function abrir() {
    setEstado("a_carregar");
    try {
      const ficheiros = await prepararEEscolher("pasta");
      if (ficheiros.length > 0) onImportar(ficheiros);
      else toast("Nenhum vídeo encontrado nesta pasta.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("popup")) {
        toast.error("O browser bloqueou o popup. Permite popups para este site e tenta outra vez.");
      } else {
        toast.error(msg || "Erro ao importar do Google Drive.");
      }
    } finally {
      setEstado("inativo");
    }
  }

  return (
    <Button
      variant="outline"
      className="h-8 px-2.5"
      onClick={abrir}
      disabled={disabled || estado !== "inativo"}
      title="Importar pasta do Google Drive"
    >
      <FolderOpen className="size-4" />
      {estado === "a_carregar" ? "..." : "Drive"}
    </Button>
  );
}
