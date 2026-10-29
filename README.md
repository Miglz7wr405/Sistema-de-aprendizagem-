# Insight Academia

A academia da Insight — separada do sistema da agência. Projeto **Vite + React** (site estático), com **Supabase** para login, base de dados, ficheiros, tempo real e Edge Functions.

## O que tem

- **Pedir acesso** (`/pedir-acesso`): a pessoa preenche nome, email, WhatsApp e palavra-passe. A conta fica pendente e os admins recebem notificação.
- **Papéis**: Administrador, Equipa Insight e Aluno. Os 7 emails fundadores entram logo como admin.
- **Secções → Cursos → Aulas**. Cada secção é **Privada** (só equipa Insight) ou **Academia** (todos os aprovados). Aulas com link (YouTube, Vimeo, Loom, Drive) ou vídeo carregado (até 50 MB).
- Progresso por pessoa, "continuar a ver" e **perguntas e respostas** em cada aula.
- **Comunidade** tipo WhatsApp: grupos (privados ou da academia, ou só para avisos), respostas, anexos, notas de voz e mensagens por ler, em tempo real.
- **Ditado por voz** em todos os campos de texto (reconhecimento do navegador; reserva com ElevenLabs).
- **Admin**: pedidos, membros (papel, bloquear, repor palavra-passe), conteúdo e grupos.

## Correr localmente

```bash
npm install
cp .env.example .env.local   # URL e chave publicável do Supabase
npm run dev
```

`npm run build` faz typecheck e gera `dist/` (site estático). Deploy no Vercel com o preset **Vite** (`vercel.json`).

## Supabase (`blpicfheoohtvrjotdut`)

- `supabase/migrations/` — esquema, RLS, storage, realtime e o conteúdo migrado da Insight.
- `supabase/functions/` — Edge Functions (Deno):
  - `pedir-acesso` — cria a conta já confirmada e avisa os admins.
  - `admin-utilizadores` — só admins: repor palavra-passe, apagar conta, avisar por email.
  - `transcrever` — reserva do ditado por voz (ElevenLabs).

### Secrets opcionais (Dashboard → Edge Functions → Secrets)

| Secret | Para quê |
|---|---|
| `ELEVENLABS_API_KEY` | ditado por voz em navegadores sem reconhecimento (iPhone na app instalada, Firefox) |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | emails de "novo pedido" e "acesso aprovado" |
| `ACADEMIA_URL` | link da academia nos emails |

Sem estes secrets tudo funciona — os avisos ficam só no sino de notificações.

## Ideias para a fase 2

Ver `docs/prompt-ideias-academia.md`.
