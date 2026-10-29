import { cn } from "@/lib/utils";

/** Marca da Insight — asterisco de 8 pontas (herda a cor). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-6", className)}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="8.5" strokeLinecap="round">
        <line x1="32" y1="7" x2="32" y2="57" />
        <line x1="7" y1="32" x2="57" y2="32" />
        <line x1="14.3" y1="14.3" x2="49.7" y2="49.7" />
        <line x1="49.7" y1="14.3" x2="14.3" y2="49.7" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="size-7 shrink-0 text-accent" />
      <div className="leading-tight">
        <p className="font-display text-[17px] font-bold tracking-tight text-text-hi">insight</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-text-low">
          Academia
        </p>
      </div>
    </div>
  );
}
