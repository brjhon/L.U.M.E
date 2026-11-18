-- Categorias iniciais (PDF, pág. 5)
INSERT INTO categories (slug, name, icon, sensitive, sort_order) VALUES
  ('alimentacao',    'Alimentação',    'restaurant',  false, 10),
  ('mercado',        'Mercado',        'shopping_cart', false, 20),
  ('farmacia',       'Farmácia',       'local_pharmacy', false, 30),
  ('pets',           'Pets',           'pets',        false, 40),
  ('cuidados',       'Cuidados',       'favorite',    true,  50),
  ('tecnologia',     'Tecnologia',     'computer',    false, 60),
  ('casa',           'Casa',           'home',        false, 70),
  ('servicos-gerais','Serviços gerais','build',       false, 80);

INSERT INTO categories (parent_id, slug, name, sensitive, sort_order)
SELECT c.id, v.slug, v.name, v.sensitive, v.sort_order
FROM (VALUES
  ('cuidados',        'cuidador-de-idosos',   'Cuidador de idosos',   true,  1),
  ('cuidados',        'diarista',             'Diarista',             true,  2),
  ('pets',            'passeador-de-caes',    'Passeador de cães',    false, 1),
  ('tecnologia',      'tecnico-informatica',  'Técnico de informática', false, 1),
  ('servicos-gerais', 'eletricista',          'Eletricista',          false, 1),
  ('servicos-gerais', 'encanador',            'Encanador',            false, 2)
) AS v(parent_slug, slug, name, sensitive, sort_order)
JOIN categories c ON c.slug = v.parent_slug;
