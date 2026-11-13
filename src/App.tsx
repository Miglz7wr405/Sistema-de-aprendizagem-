import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { supabaseConfigurado } from "@/lib/supabase";
import { AuthProvider, useAuth } from "./app/auth";
import Layout from "./app/Layout";
import { IntroBoasVindas } from "./app/components/IntroBoasVindas";
import { Carregando } from "./app/components/primitives";
import { EntrarPage, EstadoContaPage, PedirAcessoPage, Shell } from "./app/pages/Publico";

const InicioPage = lazy(() => import("./app/pages/InicioPage"));
const SeccaoPage = lazy(() => import("./app/pages/SeccaoPage"));
const CursoPage = lazy(() => import("./app/pages/CursoPage"));
const ComunidadePage = lazy(() => import("./app/pages/ComunidadePage"));
const RankingPage = lazy(() => import("./app/pages/RankingPage"));
const PerfilPage = lazy(() => import("./app/pages/PerfilPage"));
const PedidosPage = lazy(() => import("./app/admin/PedidosPage"));
const MembrosPage = lazy(() => import("./app/admin/MembrosPage"));
const ConteudoPage = lazy(() => import("./app/admin/ConteudoPage"));
const GruposPage = lazy(() => import("./app/admin/GruposPage"));
const IAPage = lazy(() => import("./app/admin/IAPage"));

function SoAdmin({ children }: { children: ReactNode }) {
  const { eAdmin } = useAuth();
  return eAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

function Rotas() {
  const { sessao, perfil, carregando, acessoExpirado } = useAuth();

  if (carregando) {
    return (
      <div className="app-shell grid min-h-[100dvh] place-items-center">
        <Carregando />
      </div>
    );
  }

  if (!sessao) {
    return (
      <Routes>
        <Route path="/entrar" element={<EntrarPage />} />
        <Route path="/pedir-acesso" element={<PedirAcessoPage />} />
        <Route path="*" element={<Navigate to="/entrar" replace />} />
      </Routes>
    );
  }

  if (perfil?.estado !== "aprovado" || acessoExpirado) return <EstadoContaPage />;

  return (
    <Suspense
      fallback={
        <div className="app-shell grid min-h-[100dvh] place-items-center">
          <Carregando />
        </div>
      }
    >
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<InicioPage />} />
          <Route path="seccao/:id" element={<SeccaoPage />} />
          <Route path="curso/:id" element={<CursoPage />} />
          <Route path="comunidade" element={<ComunidadePage />} />
          <Route path="comunidade/:grupoId" element={<ComunidadePage />} />
          <Route path="ranking" element={<RankingPage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route
            path="admin/pedidos"
            element={
              <SoAdmin>
                <PedidosPage />
              </SoAdmin>
            }
          />
          <Route
            path="admin/membros"
            element={
              <SoAdmin>
                <MembrosPage />
              </SoAdmin>
            }
          />
          <Route
            path="admin/conteudo"
            element={
              <SoAdmin>
                <ConteudoPage />
              </SoAdmin>
            }
          />
          <Route
            path="admin/grupos"
            element={
              <SoAdmin>
                <GruposPage />
              </SoAdmin>
            }
          />
          <Route
            path="admin/ia"
            element={
              <SoAdmin>
                <IAPage />
              </SoAdmin>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

/** Intro com falhas sempre que se abre a app; só a saudação logo após o login. */
function ComIntro({ children }: { children: ReactNode }) {
  const { sessao, perfil, carregando } = useAuth();
  const [modo, setModo] = useState<"completa" | "saudacao" | null>("completa");
  const tinhaSessao = useRef<boolean | null>(null);

  useEffect(() => {
    if (carregando) return;
    const tem = Boolean(sessao);
    if (tinhaSessao.current === false && tem) setModo("saudacao");
    tinhaSessao.current = tem;
  }, [sessao, carregando]);

  const fim = () => setModo(null);

  return (
    <>
      {children}
      {modo === "completa" && <IntroBoasVindas nome={perfil?.nome_completo} onFim={fim} />}
      {modo === "saudacao" && perfil && (
        <IntroBoasVindas nome={perfil.nome_completo} soSaudacao onFim={fim} />
      )}
    </>
  );
}

export default function App() {
  if (!supabaseConfigurado) {
    return (
      <Shell>
        <p className="text-center text-sm text-text-mid">
          Falta configurar <code>VITE_SUPABASE_URL</code> e{" "}
          <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>.
        </p>
      </Shell>
    );
  }
  return (
    <BrowserRouter>
      <AuthProvider>
        <ComIntro>
          <Rotas />
        </ComIntro>
        <Toaster richColors position="top-center" />
      </AuthProvider>
    </BrowserRouter>
  );
}
