import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Ban,
  Hourglass,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { chamarFuncao } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { LogoMark } from "../components/Logo";
import { Field, Input, Textarea } from "../components/Modal";
import { Button } from "../components/primitives";

export function Shell({ children, largo }: { children: ReactNode; largo?: boolean }) {
  return (
    <div className="app-shell flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <div className={cn("w-full", largo ? "max-w-lg" : "max-w-sm")}>
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-accent text-on-accent shadow-sm">
            <LogoMark className="size-8" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-text-hi">Insight Academia</h1>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-text-low">
            Aprender com a Insight
          </p>
        </div>
        <div className="app-card p-6">{children}</div>
      </div>
    </div>
  );
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function EntrarPage() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [esqueci, setEsqueci] = useState(false);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !senha) {
      setErro("Escreve o email e a palavra-passe.");
      return;
    }
    setBusy(true);
    setErro(null);
    const falha = await entrar(email, senha);
    setBusy(false);
    if (falha) setErro(falha);
  }

  return (
    <Shell>
      <h2 className="text-center font-display text-lg font-bold text-text-hi">Entrar</h2>
      <p className="mt-1 text-center text-sm text-text-mid">
        Entra com o email e a palavra-passe da tua conta.
      </p>

      {erro && <Aviso>{erro}</Aviso>}

      <form onSubmit={submeter} className="mt-5 space-y-3">
        <Field label="Email">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            placeholder="o.teu@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErro(null);
            }}
          />
        </Field>
        <Field label="Palavra-passe">
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value);
              setErro(null);
            }}
          />
        </Field>
        <Button type="submit" disabled={busy} className="h-11 w-full">
          <LogIn className="size-4" />
          {busy ? "A entrar..." : "Entrar"}
        </Button>
      </form>

      <button
        onClick={() => setEsqueci((v) => !v)}
        className="mt-3 w-full text-center text-xs font-medium text-text-mid hover:text-accent"
      >
        Esqueci a palavra-passe
      </button>
      {esqueci && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-xs text-text-mid">
          <KeyRound className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>
            Pede a um administrador da Insight para repor a tua palavra-passe. Ele envia-te uma nova
            por WhatsApp e depois podes mudá-la em <strong>O meu perfil</strong>.
          </span>
        </div>
      )}

      <div className="mt-6 border-t border-hairline pt-5 text-center">
        <p className="text-sm text-text-mid">Ainda não tens acesso?</p>
        <Link
          to="/pedir-acesso"
          className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-hairline text-sm font-medium text-text-hi hover:border-accent hover:text-accent"
        >
          <UserPlus className="size-4" /> Pedir acesso à academia
        </Link>
      </div>
    </Shell>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PedirAcessoPage() {
  const { entrar } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome_completo: "",
    email: "",
    telefone: "",
    motivo: "",
    senha: "",
    senha2: "",
  });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErro(null);
  };

  function validar() {
    if (form.nome_completo.trim().split(/\s+/).length < 2) return "Escreve o teu nome completo.";
    if (!EMAIL_RE.test(form.email.trim())) return "O email não parece válido.";
    if (form.telefone.replace(/\D/g, "").length < 8) return "Escreve o teu número de WhatsApp.";
    if (form.senha.length < 6) return "A palavra-passe precisa de pelo menos 6 caracteres.";
    if (form.senha !== form.senha2) return "As palavras-passe não são iguais.";
    return null;
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    const v = validar();
    if (v) {
      setErro(v);
      return;
    }
    setBusy(true);
    setErro(null);
    try {
      await chamarFuncao("pedir-acesso", {
        nome_completo: form.nome_completo.trim(),
        email: form.email.trim().toLowerCase(),
        telefone: form.telefone.trim(),
        motivo: form.motivo.trim(),
        password: form.senha,
      });
      const falha = await entrar(form.email, form.senha);
      if (falha) {
        toast.success("Pedido enviado! Entra com o teu email e palavra-passe.");
        navigate("/entrar");
      } else {
        toast.success("Pedido enviado!");
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar o pedido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell largo>
      <h2 className="text-center font-display text-lg font-bold text-text-hi">
        Pedir acesso à academia
      </h2>
      <p className="mt-1 text-center text-sm text-text-mid">
        Preenche os teus dados. A equipa da Insight vai analisar e aprovar o teu acesso.
      </p>

      {erro && <Aviso>{erro}</Aviso>}

      <form onSubmit={submeter} className="mt-5 space-y-3">
        <Field label="Nome completo" required>
          <Input
            autoComplete="name"
            placeholder="Ex.: Ana Maria Machava"
            value={form.nome_completo}
            onChange={set("nome_completo")}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email" required>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="o.teu@email.com"
              value={form.email}
              onChange={set("email")}
            />
          </Field>
          <Field label="WhatsApp" required>
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+258 84 000 0000"
              value={form.telefone}
              onChange={set("telefone")}
            />
          </Field>
        </div>
        <Field
          label="Porque queres entrar na academia?"
          hint="Opcional — ajuda-nos a aprovar mais depressa."
        >
          <Textarea
            placeholder="Conta-nos um pouco sobre ti e o que queres aprender..."
            value={form.motivo}
            onChange={set("motivo")}
            className="min-h-[80px]"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Palavra-passe" required>
            <Input
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={form.senha}
              onChange={set("senha")}
            />
          </Field>
          <Field label="Repetir palavra-passe" required>
            <Input
              type="password"
              autoComplete="new-password"
              value={form.senha2}
              onChange={set("senha2")}
            />
          </Field>
        </div>
        <Button type="submit" disabled={busy} className="h-11 w-full">
          <Send className="size-4" />
          {busy ? "A enviar..." : "Enviar pedido"}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-text-mid">
        Já tens conta?{" "}
        <Link to="/entrar" className="font-medium text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </Shell>
  );
}

/** Conta criada mas ainda não aprovada (ou recusada / bloqueada). */
export function EstadoContaPage() {
  const { perfil, sessao, sair, recarregarPerfil } = useAuth();
  const [aVerificar, setAVerificar] = useState(false);

  async function verificar() {
    setAVerificar(true);
    await recarregarPerfil();
    setAVerificar(false);
    toast.message("Ainda à espera. Assim que fores aprovado, entras automaticamente.");
  }

  const estado = perfil?.estado ?? "pendente";
  const email = perfil?.email ?? sessao?.user.email;

  const conteudo = {
    pendente: {
      icone: Hourglass,
      cor: "bg-amber-50 text-amber-600",
      titulo: "Pedido enviado — à espera de aprovação",
      texto:
        "A equipa da Insight já recebeu o teu pedido. Assim que for aprovado, esta página abre a academia sozinha.",
    },
    recusado: {
      icone: Ban,
      cor: "bg-red-50 text-red-600",
      titulo: "Pedido não aprovado",
      texto:
        "O teu pedido de acesso não foi aprovado. Se achas que foi engano, fala com a Insight.",
    },
    bloqueado: {
      icone: Ban,
      cor: "bg-red-50 text-red-600",
      titulo: "Acesso suspenso",
      texto: "O teu acesso à academia foi suspenso. Fala com um administrador da Insight.",
    },
    aprovado: {
      icone: Hourglass,
      cor: "bg-accent-soft text-accent",
      titulo: "A abrir...",
      texto: "",
    },
  }[estado];

  const Icone = conteudo.icone;
  return (
    <Shell>
      <div className="flex flex-col items-center text-center">
        <span className={cn("grid size-12 place-items-center rounded-xl", conteudo.cor)}>
          <Icone className="size-6" />
        </span>
        <h2 className="mt-3 font-display text-lg font-bold text-text-hi">{conteudo.titulo}</h2>
        {email && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-text-mid">
            <Mail className="size-3.5" /> {email}
          </p>
        )}
        <p className="mt-3 text-sm text-text-low">{conteudo.texto}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {estado === "pendente" && (
            <Button onClick={verificar} disabled={aVerificar}>
              <RefreshCw className={cn("size-4", aVerificar && "animate-spin")} /> Verificar
            </Button>
          )}
          <Button variant="outline" onClick={sair}>
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
        {estado !== "pendente" && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-text-low">
            <MessageCircle className="size-3.5" /> Contacta a Insight pelo WhatsApp.
          </p>
        )}
      </div>
    </Shell>
  );
}
