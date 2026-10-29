import { useEffect, useRef, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { MicButton } from "./Voz";

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  // Portal no body: as animações das páginas (transform) prenderiam o "fixed" dentro da página.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 my-8 w-full rounded-2xl border border-hairline bg-bg-card shadow-2xl",
          size === "lg" ? "max-w-2xl" : "max-w-md",
        )}
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 className="font-display text-lg font-bold text-text-hi">{title}</h2>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-lg text-text-mid hover:bg-accent-soft"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text-hi">
        {label} {required && <span className="text-accent">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-text-low">{hint}</span>}
    </label>
  );
}

const controlClass =
  "w-full rounded-lg border border-hairline bg-bg-elevated px-3 py-2.5 text-sm text-text-hi outline-none transition-colors placeholder:text-text-low focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60";

// Campos de texto livre ganham microfone; email, números, datas, links e senhas não.
const TIPOS_COM_VOZ = new Set(["text", "search"]);

function juntarRefs<T>(...refs: (Ref<T> | undefined)[]) {
  return (el: T | null) => {
    for (const r of refs) {
      if (typeof r === "function") r(el);
      else if (r) (r as { current: T | null }).current = el;
    }
  };
}

type ComVoz = { semVoz?: boolean };

export function Input({
  semVoz,
  className,
  ref,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & ComVoz & { ref?: Ref<HTMLInputElement> }) {
  const interno = useRef<HTMLInputElement>(null);
  const comVoz =
    !semVoz && TIPOS_COM_VOZ.has(props.type ?? "text") && !props.disabled && !props.readOnly;
  const campo = (
    <input
      {...props}
      ref={juntarRefs(ref, interno)}
      className={cn(controlClass, comVoz && "pr-11", className)}
    />
  );
  if (!comVoz) return campo;
  return (
    <div className="relative w-full">
      {campo}
      <MicButton alvo={interno} className="absolute right-1.5 top-1/2 -translate-y-1/2" />
    </div>
  );
}

export function Textarea({
  semVoz,
  className,
  ref,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  ComVoz & { ref?: Ref<HTMLTextAreaElement> }) {
  const interno = useRef<HTMLTextAreaElement>(null);
  const comVoz = !semVoz && !props.disabled && !props.readOnly;
  const campo = (
    <textarea
      {...props}
      ref={juntarRefs(ref, interno)}
      className={cn(controlClass, "min-h-[90px] resize-y", comVoz && "pr-11", className)}
    />
  );
  if (!comVoz) return campo;
  return (
    <div className="relative w-full">
      {campo}
      <MicButton alvo={interno} className="absolute right-1.5 top-1.5" />
    </div>
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, "appearance-none", props.className)} />;
}

/** Interruptor simples (sim/não). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-sm text-text-hi disabled:opacity-50"
    >
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-accent" : "bg-hairline",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
      {label}
    </button>
  );
}
