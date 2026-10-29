-- Conteúdo migrado da Insight (treinamentos → cursos, aulas → aulas) e grupos iniciais.
-- As secções migradas ficam privadas (só equipa Insight); muda para 'academia' no painel para abrir aos alunos.

insert into public.seccoes (id, titulo, icone, visibilidade, ordem) values
  ('b4a117e9-4ee1-5d08-a81d-47cc379bd7c1', 'Vendas', '💼', 'privada', 0),
  ('0b4621c8-9d39-5315-a8f5-e707cd6b3dcd', 'Clientes', '🤝', 'privada', 1),
  ('6f061c16-1fa2-5a3e-9bb3-23ea2302edec', 'Geral', '📚', 'privada', 2);

insert into public.cursos (id, seccao_id, titulo, descricao, nivel, duracao, ordem) values
  ('6cc474a8-84f2-4a01-8fcc-2c3d1dae4519', 'b4a117e9-4ee1-5d08-a81d-47cc379bd7c1', 'Processo de Vendas Completo', null, 'iniciante', null, 0),
  ('11564589-47ee-4e00-92a8-f2b21468e4a1', '0b4621c8-9d39-5315-a8f5-e707cd6b3dcd', 'Atendimento ao Cliente', null, 'iniciante', '3h', 1),
  ('9ecf9819-edf3-4b1b-b69e-db3df5590c79', '6f061c16-1fa2-5a3e-9bb3-23ea2302edec', 'Google Ads', null, 'intermedio', null, 2);

insert into public.aulas (id, curso_id, titulo, tipo, url, ordem) values
  ('56c88ff3-d25a-489e-8731-f51d1cd9b9a2', '11564589-47ee-4e00-92a8-f2b21468e4a1', 'Atendimento ao cliente', 'youtube', 'https://youtu.be/E3qo5TXQjLU?si=eWb_16YwktJcZf_y', 0),
  ('29631e4d-cd7b-4de7-8912-9af307926eef', '11564589-47ee-4e00-92a8-f2b21468e4a1', 'Experiência do cliente', 'youtube', 'https://youtu.be/OrR9jVAhdRY?si=VE7DWzQ4SwCBLhe3', 1),
  ('ec1b0a4c-7f7e-4ae2-8650-e2de77def26a', '11564589-47ee-4e00-92a8-f2b21468e4a1', 'Evidências de serviço', 'youtube', 'https://youtu.be/cZxEzeoIeZo?si=5dgbElsZ7gq8r1Dj', 2),
  ('ce844f10-de59-4480-8566-33eb9b741cbc', '11564589-47ee-4e00-92a8-f2b21468e4a1', 'Check in semanal', 'youtube', 'https://youtu.be/oFvQAVKXxXs?si=7C9nhZFh746p6KO0', 3),
  ('22d702b5-d825-4706-a075-0a85d6432621', '11564589-47ee-4e00-92a8-f2b21468e4a1', 'Missão 1 Retenção', 'youtube', 'https://youtu.be/Wvatec12FyI?si=j122s4RAINk1p0rP', 4),
  ('e199e817-5056-4b8a-ae1b-4a4c9c38f3e3', '11564589-47ee-4e00-92a8-f2b21468e4a1', 'Missão 2 Retenção', 'youtube', 'https://youtu.be/VtaOX01Baa0?si=7N88SMbJIen2otsK', 5),
  ('013dad3e-6ec6-482b-bd25-28c303977b4d', '11564589-47ee-4e00-92a8-f2b21468e4a1', 'Principios da retenção', 'youtube', 'https://youtu.be/OYbUCk-w3iQ?si=7bC21BtFFsvse7IZ', 6),
  ('ccf03ec4-a69a-4a35-88ec-4dac74a415ac', '11564589-47ee-4e00-92a8-f2b21468e4a1', 'LifeTime Value', 'youtube', 'https://youtu.be/JExILsQlO8I?si=PSyDaPEWQ43rcLd5', 7),
  ('57576124-d64c-41a6-a30d-245443d61bcd', '11564589-47ee-4e00-92a8-f2b21468e4a1', 'Atendimento é LifeTime', 'youtube', 'https://youtu.be/aGRnyr-EDE0?si=DJkur0nHVl4V6xNj', 8),
  ('67f33671-5285-4f8d-80fa-bf5163beef85', '6cc474a8-84f2-4a01-8fcc-2c3d1dae4519', 'Comece por aqui', 'youtube', 'https://www.youtube.com/watch?v=rjMsypHJE7M', 0),
  ('a8252cc6-0f5e-40ba-9dc3-2e82194574d7', '6cc474a8-84f2-4a01-8fcc-2c3d1dae4519', 'Estrutura de time de vendas BDR', 'youtube', 'https://www.youtube.com/watch?v=CTA0GH1G-sI', 1),
  ('da2ae200-f71b-45d4-ab6a-ef886e1225e7', '6cc474a8-84f2-4a01-8fcc-2c3d1dae4519', 'Análise de ligação fria - Bdr', 'youtube', 'https://youtu.be/TX9Zz_p0_b8?si=g1TaMk-gWyrieB7e', 2),
  ('8d4ac47f-9a0c-43d9-ac8d-6114792cbd99', '6cc474a8-84f2-4a01-8fcc-2c3d1dae4519', 'Analise ligação inbound- Sdr leads do site', 'youtube', 'https://youtu.be/JgQbZ_Sn94A?si=F33HiCSCVDfHzdXh', 3),
  ('33882b1e-9684-441b-a576-feeb1268fe42', '6cc474a8-84f2-4a01-8fcc-2c3d1dae4519', 'Visão Macro Da Linha Do Tempo Do Projeto', 'youtube', 'https://www.youtube.com/watch?v=p2lPH3YK8Os', 4),
  ('0ddb4417-30d0-4a4e-bdc4-08ab5d688859', '6cc474a8-84f2-4a01-8fcc-2c3d1dae4519', 'Aula 01 Reunião De Venda Do Contrato De 3 Mil Reais Mensais', 'youtube', 'https://youtu.be/W86pxlCZKOQ?si=dRNtiw2W026PlDPl', 5),
  ('ac254a71-a732-4cc9-8e86-0af15741f281', '9ecf9819-edf3-4b1b-b69e-db3df5590c79', 'Aprenda google ads', 'youtube', 'https://youtu.be/GZZMruNH_IM?si=phMAR0TBtsnDhR7O', 0),
  ('8be1de6f-07d1-4152-a799-e0f9666a9b65', '9ecf9819-edf3-4b1b-b69e-db3df5590c79', 'Como criar conta do google ads', 'youtube', 'https://youtu.be/-cPuTEs_ADg?si=rIT8uAgvhelum1zS', 1),
  ('0f80777d-863e-4e17-af7a-e4b33a0098b7', '9ecf9819-edf3-4b1b-b69e-db3df5590c79', 'Como encontrar as melhores palavras chave', 'youtube', 'https://youtu.be/zmkXcqWAjT4?si=yHOybDnnRVe95Itz', 2),
  ('fb94ce84-17a8-4480-a721-016efc7a74bc', '9ecf9819-edf3-4b1b-b69e-db3df5590c79', 'Como otimizar campanhas google ads', 'youtube', 'https://youtu.be/VIefl7CDRxo?si=UBc4aYMf59AD1hjr', 3),
  ('aa9894d6-42e8-4a1d-9c9a-3df00998f55e', '9ecf9819-edf3-4b1b-b69e-db3df5590c79', 'Pixel do google ads', 'youtube', 'https://youtu.be/Gm8Ctyp8xzU?si=e8y3KRUZNylMe63r', 4),
  ('f541a02c-a65b-4b6b-aee2-5f7663fb3f46', '9ecf9819-edf3-4b1b-b69e-db3df5590c79', 'Como configurar conversões', 'youtube', 'https://youtu.be/muwHU8_z3As?si=Gdm6CP_7GPWemcvs', 5),
  ('fe517486-7991-4a3f-aa85-85a269c2e7dc', '9ecf9819-edf3-4b1b-b69e-db3df5590c79', 'Campanha de whatsapp google ads', 'youtube', 'https://youtu.be/Bu2oGwKj3Os?si=EmxkBFmxh9Yb6ego', 6);

insert into public.grupos (nome, descricao, icone, visibilidade, so_admins_escrevem, ordem) values
  ('Avisos', 'Novidades e anúncios da Insight Academia', '📢', 'academia', true, 0),
  ('Geral', 'Conversa livre entre todos os membros da academia', '💬', 'academia', false, 1),
  ('Prospecção', 'Dúvidas e partilhas sobre prospecção e vendas', '🎯', 'academia', false, 2),
  ('Dúvidas do sistema', 'Perguntas sobre a plataforma e as ferramentas', '🛠️', 'academia', false, 3),
  ('Equipa Insight', 'Só para quem já faz parte da agência', '🔒', 'privada', false, 4);
