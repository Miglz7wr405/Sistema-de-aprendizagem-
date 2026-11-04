-- Imagem de capa opcional de cada secção, mostrada no cartão da secção no início.
alter table public.seccoes add column if not exists capa_url text;
