-- Classificação do curso dada pelo admin (0 a 5 corações). Na secção, os cursos com
-- mais corações aparecem primeiro.
alter table public.cursos
  add column if not exists coracoes smallint not null default 0
  check (coracoes between 0 and 5);
