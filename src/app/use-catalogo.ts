import { Aulas, Cursos, ProgressoDb, Seccoes } from "@/lib/db";
import { useAuth } from "./auth";
import type { Catalogo } from "./components/Catalogo";
import { useData } from "./use-data";

/** Secções, cursos, aulas e o meu progresso — o RLS já filtra o que cada pessoa pode ver. */
export function useCatalogo() {
  const { sessao } = useAuth();
  const userId = sessao?.user.id ?? "";
  return useData<Catalogo>(async () => {
    const [seccoes, cursos, aulas, progresso] = await Promise.all([
      Seccoes.listar(),
      Cursos.listar(),
      Aulas.listar(),
      ProgressoDb.meu(userId),
    ]);
    return { seccoes, cursos, aulas, progresso };
  }, [userId]);
}
