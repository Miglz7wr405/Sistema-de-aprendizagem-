-- Módulo opcional de cada aula. As aulas continuam ordenadas por "ordem";
-- aulas seguidas com o mesmo módulo aparecem agrupadas no curso.
alter table public.aulas add column if not exists modulo text;
