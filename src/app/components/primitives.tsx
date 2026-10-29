import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2, Lock } from "lucide-react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold text-text-hi md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-mid">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("app-card p-5", className)}>{children}</div>;
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function BadgePrivado({ className }: { className?: string }) {
  return (
    <Badge className={cn("bg-slate-100 text-slate-700", className)}>
      <Lock className="size-3" /> Só equipa
    </Badge>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="app-card flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Icon className="size-7" />
      </span>
      <h3 className="mt-4 font-display text-lg font-semibold text-text-hi">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-text-mid">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-hairline", className)}>
      <div
        className="h-full rounded-full bg-accent transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger" | "success";
}) {
  const variants: Record<string, string> = {
    primary: "bg-accent text-on-accent hover:bg-accent-dim shadow-sm",
    outline:
      "border border-hairline bg-bg-elevated text-text-hi hover:border-accent hover:text-accent",
    ghost: "text-text-mid hover:bg-accent-soft hover:text-accent",
    danger: "border border-red-200 bg-bg-elevated text-red-600 hover:bg-red-50",
    success: "bg-green-600 text-white hover:bg-green-700 shadow-sm",
  };
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Carregando({ texto = "A carregar..." }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-low">
      <Loader2 className="size-4 animate-spin" /> {texto}
    </div>
  );
}

export function Erro({ mensagem, onRetry }: { mensagem: string; onRetry?: () => void }) {
  return (
    <div className="app-card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="text-sm text-red-600">{mensagem}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Tentar outra vez
        </Button>
      )}
    </div>
  );
}

export function Avatar({
  nome,
  className,
  tom = "soft",
}: {
  nome: string;
  className?: string;
  tom?: "soft" | "solid";
}) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const ini =
    partes.length === 0
      ? "?"
      : partes.length === 1
        ? partes[0].slice(0, 2).toUpperCase()
        : (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold",
        tom === "solid" ? "bg-accent text-on-accent" : "bg-accent-soft text-accent",
        className,
      )}
    >
      {ini}
    </span>
  );
}
