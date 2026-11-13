export type Papel = "admin" | "equipa" | "aluno";
export type EstadoPerfil = "pendente" | "aprovado" | "recusado" | "bloqueado";
export type Visibilidade = "privada" | "academia";
export type TipoAula = "youtube" | "link" | "upload";
export type Nivel = "iniciante" | "intermedio" | "avancado";
export type Plano = "semana" | "mes" | "ano" | "legacy";

export type Perfil = {
  id: string;
  nome_completo: string;
  email: string;
  telefone: string | null;
  motivo: string | null;
  avatar_url: string | null;
  papel: Papel;
  estado: EstadoPerfil;
  plano: Plano;
  acesso_expira_em: string | null;
  aprovado_por: string | null;
  aprovado_em: string | null;
  created_at: string;
};

export type Membro = Pick<Perfil, "id" | "nome_completo" | "papel" | "avatar_url">;

export type Seccao = {
  id: string;
  titulo: string;
  descricao: string | null;
  icone: string | null;
  capa_url: string | null;
  visibilidade: Visibilidade;
  ordem: number;
  created_at: string;
};

export type Curso = {
  id: string;
  seccao_id: string;
  titulo: string;
  descricao: string | null;
  nivel: Nivel;
  duracao: string | null;
  capa_url: string | null;
  coracoes: number;
  ordem: number;
  publicado: boolean;
  created_at: string;
};

export type Aula = {
  id: string;
  curso_id: string;
  modulo_id: string | null;
  titulo: string;
  descricao: string | null;
  tipo: TipoAula;
  url: string | null;
  storage_path: string | null;
  duracao: string | null;
  modulo: string | null;
  ordem: number;
  created_at: string;
};

export type Modulo = {
  id: string;
  curso_id: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  created_at: string;
};

export type Progresso = {
  user_id: string;
  aula_id: string;
  concluida: boolean;
  vista_em: string;
  concluida_em: string | null;
};

export type Pergunta = {
  id: string;
  aula_id: string;
  autor_id: string | null;
  autor_nome: string;
  autor_papel: Papel | null;
  texto: string;
  responde_a: string | null;
  created_at: string;
};

export type Grupo = {
  id: string;
  nome: string;
  descricao: string | null;
  icone: string | null;
  visibilidade: Visibilidade;
  so_admins_escrevem: boolean;
  ordem: number;
  created_at: string;
};

export type ResumoGrupo = {
  grupo_id: string;
  por_ler: number;
  ultima_em: string | null;
  ultima_texto: string | null;
  ultima_autor: string | null;
};

export type Mensagem = {
  id: string;
  grupo_id: string;
  autor_id: string | null;
  autor_nome: string;
  autor_papel: Papel | null;
  texto: string;
  responde_a: string | null;
  ficheiro_path: string | null;
  ficheiro_nome: string | null;
  ficheiro_tipo: string | null;
  tamanho: number | null;
  duracao: number | null;
  created_at: string;
};

export type Notificacao = {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
};

export type Espectador = {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  papel: Papel;
  concluida: boolean;
  vista_em: string;
};

export type PosicaoRanking = {
  user_id: string;
  nome: string;
  avatar_url: string | null;
  papel: Papel;
  total: number;
  concluidas: number;
  posicao: number;
};

export type MembroPlano = { user_id: string; plano: Plano };

export type PeriodoRanking = "semana" | "mes" | "geral";

export const PAPEL_LABEL: Record<Papel, string> = {
  admin: "Administrador",
  equipa: "Equipa Insight",
  aluno: "Aluno",
};

export type InfoPlano = {
  selo: string; // nome do selo
  dias: number | null; // duração; null = permanente
};

/** semana→Bronze, mes→Prata, ano→Ouro, legacy→Diamante. */
export const PLANO: Record<Plano, InfoPlano> = {
  semana: { selo: "Bronze", dias: 7 },
  mes: { selo: "Prata", dias: 30 },
  ano: { selo: "Ouro", dias: 365 },
  legacy: { selo: "Diamante", dias: null },
};

export const PLANO_LABEL: Record<Plano, string> = {
  semana: "1 semana",
  mes: "1 mês",
  ano: "1 ano",
  legacy: "Legacy (permanente)",
};

export const NIVEL_LABEL: Record<Nivel, string> = {
  iniciante: "Iniciante",
  intermedio: "Intermédio",
  avancado: "Avançado",
};

export const NIVEL_STYLE: Record<Nivel, string> = {
  iniciante: "bg-green-50 text-green-700",
  intermedio: "bg-amber-50 text-amber-700",
  avancado: "bg-red-50 text-red-700",
};
