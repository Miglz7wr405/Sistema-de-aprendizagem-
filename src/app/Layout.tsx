import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen,
  FolderKanban,
  Home,
  LogOut,
  Menu,
  MessagesSquare,
  UserCheck,
  UserCircle,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import { Perfis } from "@/lib/db";
import { PAPEL_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "./auth";
import { Logo } from "./components/Logo";
import { NotificacoesSino } from "./components/NotificacoesSino";
import { Avatar } from "./components/primitives";

type ItemNav = { label: string; to: string; icon: LucideIcon; end?: boolean };

const NAV: ItemNav[] = [
  { label: "Início", to: "/", icon: Home, end: true },
  { label: "Comunidade", to: "/comunidade", icon: MessagesSquare },
  { label: "O meu perfil", to: "/perfil", icon: UserCircle },
];

const NAV_ADMIN: ItemNav[] = [
  { label: "Pedidos de acesso", to: "/admin/pedidos", icon: UserCheck },
  { label: "Membros", to: "/admin/membros", icon: Users },
  { label: "Conteúdo", to: "/admin/conteudo", icon: FolderKanban },
  { label: "Grupos", to: "/admin/grupos", icon: BookOpen },
];

function usePedidosPendentes(ativo: boolean) {
  const [n, setN] = useState(0);
  const location = useLocation();
  useEffect(() => {
    if (!ativo) return;
    Perfis.todos()
      .then((ps) => setN(ps.filter((p) => p.estado === "pendente").length))
      .catch(() => undefined);
  }, [ativo, location.pathname]);
  return n;
}

function Ligacao({
  item,
  onClick,
  extra,
}: {
  item: ItemNav;
  onClick?: () => void;
  extra?: number;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-accent text-on-accent shadow-sm"
            : "text-text-mid hover:bg-accent-soft hover:text-accent",
        )
      }
    >
      <item.icon className="size-[18px] shrink-0" />
      <span className="flex-1">{item.label}</span>
      {extra ? (
        <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
          {extra}
        </span>
      ) : null}
    </NavLink>
  );
}

function Navegacao({ onNavigate, pendentes }: { onNavigate?: () => void; pendentes: number }) {
  const { eAdmin } = useAuth();
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((i) => (
        <Ligacao key={i.to} item={i} onClick={onNavigate} />
      ))}
      {eAdmin && (
        <>
          <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-low">
            Administração
          </p>
          {NAV_ADMIN.map((i) => (
            <Ligacao
              key={i.to}
              item={i}
              onClick={onNavigate}
              extra={i.to === "/admin/pedidos" ? pendentes : undefined}
            />
          ))}
        </>
      )}
    </nav>
  );
}

function Rodape() {
  const { perfil, sair } = useAuth();
  if (!perfil) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2">
      <Avatar nome={perfil.nome_completo} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium text-text-hi">{perfil.nome_completo}</p>
        <p className="truncate text-[11px] text-text-low">{PAPEL_LABEL[perfil.papel]}</p>
      </div>
      <button
        onClick={sair}
        title="Sair"
        aria-label="Sair"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-text-low hover:bg-red-50 hover:text-red-600"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

function titulo(pathname: string) {
  const todos = [...NAV, ...NAV_ADMIN];
  if (pathname.startsWith("/curso")) return "Curso";
  if (pathname.startsWith("/seccao")) return "Secção";
  const m = todos.find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));
  return m?.label ?? "Início";
}

export default function Layout() {
  const [menu, setMenu] = useState(false);
  const { perfil, eAdmin } = useAuth();
  const location = useLocation();
  const pendentes = usePedidosPendentes(eAdmin);
  const modoChat = location.pathname.startsWith("/comunidade");
  const emConversa = /^\/comunidade\/.+/.test(location.pathname);

  useEffect(() => setMenu(false), [location.pathname]);

  return (
    <div className="app-shell flex min-h-screen">
      <aside className="sticky top-0 hidden h-[100dvh] w-[260px] shrink-0 flex-col border-r border-hairline bg-bg-elevated lg:flex">
        <div className="flex h-16 items-center border-b border-hairline px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <Navegacao pendentes={pendentes} />
        </div>
        <div className="border-t border-hairline p-3">
          <Rodape />
        </div>
      </aside>

      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMenu(false)}
          />
          <aside className="absolute left-0 top-0 flex h-[100dvh] w-[280px] flex-col bg-bg-elevated shadow-xl">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-hairline px-5">
              <Logo />
              <button
                onClick={() => setMenu(false)}
                className="grid size-9 place-items-center rounded-lg text-text-mid hover:bg-accent-soft"
                aria-label="Fechar menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              <Navegacao onNavigate={() => setMenu(false)} pendentes={pendentes} />
            </div>
            <div
              className="shrink-0 border-t border-hairline p-3"
              style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
            >
              <Rodape />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-30 h-16 items-center gap-3 border-b border-hairline bg-bg-elevated/90 px-4 backdrop-blur md:px-6",
            emConversa ? "hidden lg:flex" : "flex",
          )}
        >
          <button
            onClick={() => setMenu(true)}
            className="relative grid size-9 place-items-center rounded-lg text-text-mid hover:bg-accent-soft lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="size-5" />
            {pendentes > 0 && (
              <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500" />
            )}
          </button>
          <p className="font-display text-base font-semibold text-text-hi">
            {titulo(location.pathname)}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <NotificacoesSino />
            {perfil && <Avatar nome={perfil.nome_completo} tom="solid" />}
          </div>
        </header>

        <main
          className={cn(
            "flex-1",
            modoChat ? "lg:px-6 lg:py-6" : "px-4 pb-24 pt-6 md:px-6 lg:px-8 lg:pb-8",
          )}
        >
          <div className={cn("mx-auto w-full", !modoChat && "max-w-[1200px]")}>
            <Outlet />
          </div>
        </main>

        {/* Barra de baixo no telemóvel */}
        {!emConversa && (
          <nav
            className="fixed inset-x-0 bottom-0 z-40 flex border-t border-hairline bg-bg-elevated/95 backdrop-blur lg:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {[...NAV, ...(eAdmin ? [NAV_ADMIN[0]] : [])].map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
                    isActive ? "text-accent" : "text-text-low",
                  )
                }
              >
                <i.icon className="size-5" />
                {i.to === "/admin/pedidos" ? "Pedidos" : i.label.replace("O meu perfil", "Perfil")}
                {i.to === "/admin/pedidos" && pendentes > 0 && (
                  <span className="absolute right-[28%] top-1.5 rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {pendentes}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
