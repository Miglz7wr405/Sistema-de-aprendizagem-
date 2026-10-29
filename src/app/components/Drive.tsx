import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { driveId, miniaturaDoLink } from "@/lib/video";
import { cn } from "@/lib/utils";

export type EstadoDrive = "nao_drive" | "a_verificar" | "publico" | "talvez_privado";

/**
 * Verifica se um vídeo do Drive está partilhado como "Qualquer pessoa com o link":
 * o Drive só devolve a miniatura de ficheiros públicos. (Vídeos acabados de carregar
 * podem ainda não ter miniatura — por isso o aviso fala em "parece".)
 */
export function useEstadoDrive(url: string | null | undefined): EstadoDrive {
  const ehDrive = Boolean(driveId(url));
  const [estado, setEstado] = useState<EstadoDrive>(ehDrive ? "a_verificar" : "nao_drive");

  useEffect(() => {
    if (!ehDrive) {
      setEstado("nao_drive");
      return;
    }
    setEstado("a_verificar");
    const img = new Image();
    let ativo = true;
    img.onload = () => ativo && setEstado("publico");
    img.onerror = () => ativo && setEstado("talvez_privado");
    img.src = miniaturaDoLink(url)!;
    return () => {
      ativo = false;
    };
  }, [url, ehDrive]);

  return estado;
}

export function PassosPartilhaDrive({ className }: { className?: string }) {
  return (
    <ol className={cn("ml-4 list-decimal space-y-0.5 text-xs", className)}>
      <li>Abre o vídeo (ou a pasta do curso) no Google Drive.</li>
      <li>
        Carrega em <strong>Partilhar</strong> → <strong>Acesso geral</strong>.
      </li>
      <li>
        Escolhe <strong>Qualquer pessoa com o link</strong> → <strong>Leitor</strong>.
      </li>
    </ol>
  );
}

/** Aviso mostrado quando o Drive não confirma que o vídeo é público. */
export function AvisoDrivePrivado({ admin, className }: { admin?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">
          {admin
            ? "Este vídeo parece estar privado no Google Drive — os alunos não o vão conseguir ver."
            : "Se o vídeo não abrir, é porque ainda está privado no Google Drive. Avisa um administrador."}
        </p>
        {admin && <PassosPartilhaDrive className="mt-1.5" />}
      </div>
    </div>
  );
}
