import { supabase } from "./supabase";
import { nomeFicheiroSeguro } from "./utils";
import type {
  Aula,
  Curso,
  Grupo,
  Membro,
  Mensagem,
  Notificacao,
  Perfil,
  Pergunta,
  Progresso,
  ResumoGrupo,
  Seccao,
} from "./types";

const BUCKET = "academia";

function falhar(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

// ─── Perfis ──────────────────────────────────────────────────────────────

export const Perfis = {
  async meu(id: string) {
    const { data, error } = await supabase.from("perfis").select("*").eq("id", id).maybeSingle();
    falhar(error);
    return data as Perfil | null;
  },
  async todos() {
    const { data, error } = await supabase
      .from("perfis")
      .select("*")
      .order("created_at", { ascending: false });
    falhar(error);
    return (data ?? []) as Perfil[];
  },
  async atualizar(id: string, patch: Partial<Perfil>) {
    const { error } = await supabase.from("perfis").update(patch).eq("id", id);
    falhar(error);
  },
  async membros() {
    const { data, error } = await supabase.rpc("listar_membros");
    falhar(error);
    return (data ?? []) as Membro[];
  },
};

// ─── Conteúdo ────────────────────────────────────────────────────────────

export const Seccoes = {
  async listar() {
    const { data, error } = await supabase
      .from("seccoes")
      .select("*")
      .order("ordem")
      .order("created_at");
    falhar(error);
    return (data ?? []) as Seccao[];
  },
  async obter(id: string) {
    const { data, error } = await supabase.from("seccoes").select("*").eq("id", id).maybeSingle();
    falhar(error);
    return data as Seccao | null;
  },
  async criar(s: Partial<Seccao>) {
    const { data, error } = await supabase.from("seccoes").insert(s).select().single();
    falhar(error);
    return data as Seccao;
  },
  async atualizar(id: string, s: Partial<Seccao>) {
    const { error } = await supabase.from("seccoes").update(s).eq("id", id);
    falhar(error);
  },
  async apagar(id: string) {
    const { error } = await supabase.from("seccoes").delete().eq("id", id);
    falhar(error);
  },
};

export const Cursos = {
  async listar() {
    const { data, error } = await supabase
      .from("cursos")
      .select("*")
      .order("ordem")
      .order("created_at");
    falhar(error);
    return (data ?? []) as Curso[];
  },
  async daSeccao(seccaoId: string) {
    const { data, error } = await supabase
      .from("cursos")
      .select("*")
      .eq("seccao_id", seccaoId)
      .order("ordem")
      .order("created_at");
    falhar(error);
    return (data ?? []) as Curso[];
  },
  async obter(id: string) {
    const { data, error } = await supabase.from("cursos").select("*").eq("id", id).maybeSingle();
    falhar(error);
    return data as Curso | null;
  },
  async criar(c: Partial<Curso>) {
    const { data, error } = await supabase.from("cursos").insert(c).select().single();
    falhar(error);
    return data as Curso;
  },
  async atualizar(id: string, c: Partial<Curso>) {
    const { error } = await supabase.from("cursos").update(c).eq("id", id);
    falhar(error);
  },
  async apagar(id: string) {
    const { error } = await supabase.from("cursos").delete().eq("id", id);
    falhar(error);
  },
};

export const Aulas = {
  async listar() {
    const { data, error } = await supabase
      .from("aulas")
      .select("*")
      .order("ordem")
      .order("created_at");
    falhar(error);
    return (data ?? []) as Aula[];
  },
  async doCurso(cursoId: string) {
    const { data, error } = await supabase
      .from("aulas")
      .select("*")
      .eq("curso_id", cursoId)
      .order("ordem")
      .order("created_at");
    falhar(error);
    return (data ?? []) as Aula[];
  },
  async criar(a: Partial<Aula>) {
    const { data, error } = await supabase.from("aulas").insert(a).select().single();
    falhar(error);
    return data as Aula;
  },
  async atualizar(id: string, a: Partial<Aula>) {
    const { error } = await supabase.from("aulas").update(a).eq("id", id);
    falhar(error);
  },
  async apagar(aula: Aula) {
    const { error } = await supabase.from("aulas").delete().eq("id", aula.id);
    falhar(error);
    if (aula.storage_path) await supabase.storage.from(BUCKET).remove([aula.storage_path]);
  },
  /** Grava a nova ordem (só as que mudaram). */
  async reordenar(aulas: Aula[]) {
    await Promise.all(
      aulas.map((a, i) => (a.ordem === i ? null : Aulas.atualizar(a.id, { ordem: i }))),
    );
  },
};

// ─── Progresso ───────────────────────────────────────────────────────────

export const ProgressoDb = {
  async meu(userId: string) {
    const { data, error } = await supabase
      .from("progresso")
      .select("*")
      .eq("user_id", userId)
      .order("vista_em", { ascending: false });
    falhar(error);
    return (data ?? []) as Progresso[];
  },
  /** Regista que a pessoa abriu a aula (para o "continuar a ver"). */
  async marcarVista(userId: string, aulaId: string) {
    const { error } = await supabase
      .from("progresso")
      .upsert(
        { user_id: userId, aula_id: aulaId, vista_em: new Date().toISOString() },
        { onConflict: "user_id,aula_id", ignoreDuplicates: false },
      );
    falhar(error);
  },
  async definirConcluida(userId: string, aulaId: string, concluida: boolean) {
    const { error } = await supabase.from("progresso").upsert(
      {
        user_id: userId,
        aula_id: aulaId,
        concluida,
        concluida_em: concluida ? new Date().toISOString() : null,
        vista_em: new Date().toISOString(),
      },
      { onConflict: "user_id,aula_id" },
    );
    falhar(error);
  },
};

// ─── Perguntas por aula ──────────────────────────────────────────────────

export const Perguntas = {
  async daAula(aulaId: string) {
    const { data, error } = await supabase
      .from("perguntas")
      .select("*")
      .eq("aula_id", aulaId)
      .order("created_at");
    falhar(error);
    return (data ?? []) as Pergunta[];
  },
  async criar(aulaId: string, texto: string, respondeA?: string | null) {
    const { error } = await supabase
      .from("perguntas")
      .insert({ aula_id: aulaId, texto: texto.trim(), responde_a: respondeA ?? null });
    falhar(error);
  },
  async apagar(id: string) {
    const { error } = await supabase.from("perguntas").delete().eq("id", id);
    falhar(error);
  },
};

// ─── Comunidade ──────────────────────────────────────────────────────────

export const Grupos = {
  async listar() {
    const { data, error } = await supabase
      .from("grupos")
      .select("*")
      .order("ordem")
      .order("created_at");
    falhar(error);
    return (data ?? []) as Grupo[];
  },
  async resumo() {
    const { data, error } = await supabase.rpc("resumo_grupos");
    falhar(error);
    return (data ?? []) as ResumoGrupo[];
  },
  async criar(g: Partial<Grupo>) {
    const { data, error } = await supabase.from("grupos").insert(g).select().single();
    falhar(error);
    return data as Grupo;
  },
  async atualizar(id: string, g: Partial<Grupo>) {
    const { error } = await supabase.from("grupos").update(g).eq("id", id);
    falhar(error);
  },
  async apagar(id: string) {
    const { error } = await supabase.from("grupos").delete().eq("id", id);
    falhar(error);
  },
  async marcarLido(userId: string, grupoId: string) {
    await supabase
      .from("leituras")
      .upsert(
        { user_id: userId, grupo_id: grupoId, lida_em: new Date().toISOString() },
        { onConflict: "user_id,grupo_id" },
      );
  },
};

export const Mensagens = {
  async doGrupo(grupoId: string, limite = 200) {
    const { data, error } = await supabase
      .from("mensagens")
      .select("*")
      .eq("grupo_id", grupoId)
      .order("created_at", { ascending: false })
      .limit(limite);
    falhar(error);
    return ((data ?? []) as Mensagem[]).reverse();
  },
  async enviar(m: Partial<Mensagem>) {
    const { data, error } = await supabase.from("mensagens").insert(m).select().single();
    falhar(error);
    return data as Mensagem;
  },
  async apagar(m: Mensagem) {
    const { error } = await supabase.from("mensagens").delete().eq("id", m.id);
    falhar(error);
    if (m.ficheiro_path) await supabase.storage.from(BUCKET).remove([m.ficheiro_path]);
  },
};

// ─── Notificações ────────────────────────────────────────────────────────

export const Notificacoes = {
  async minhas() {
    const { data, error } = await supabase
      .from("notificacoes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    falhar(error);
    return (data ?? []) as Notificacao[];
  },
  async marcarTodasLidas(userId: string) {
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("user_id", userId)
      .eq("lida", false);
  },
  async marcarLida(id: string) {
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
  },
};

// ─── Ficheiros (bucket privado, servidos por URL assinado) ───────────────

export const Ficheiros = {
  async enviar(pasta: string, file: File) {
    const caminho = `${pasta}/${crypto.randomUUID()}-${nomeFicheiroSeguro(file.name)}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, file, { contentType: file.type || undefined, upsert: false });
    falhar(error);
    return caminho;
  },
  async apagar(caminho: string) {
    await supabase.storage.from(BUCKET).remove([caminho]);
  },
  async urlAssinado(caminho: string, segundos = 60 * 60) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, segundos);
    falhar(error);
    return data.signedUrl;
  },
  async urlsAssinados(caminhos: string[], segundos = 60 * 60) {
    if (caminhos.length === 0) return {} as Record<string, string>;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(caminhos, segundos);
    falhar(error);
    const mapa: Record<string, string> = {};
    for (const d of data ?? []) if (d.path && d.signedUrl) mapa[d.path] = d.signedUrl;
    return mapa;
  },
};

export const LIMITE_UPLOAD = 50 * 1024 * 1024;

// ─── Capas dos cursos (bucket público, URL fixo guardado em cursos.capa_url) ─

export const LIMITE_CAPA = 5 * 1024 * 1024;

export const Capas = {
  async enviar(file: File) {
    const caminho = `${crypto.randomUUID()}-${nomeFicheiroSeguro(file.name)}`;
    const { error } = await supabase.storage
      .from("capas")
      .upload(caminho, file, { contentType: file.type || undefined, upsert: false });
    falhar(error);
    return supabase.storage.from("capas").getPublicUrl(caminho).data.publicUrl;
  },
};
