-- Categories
INSERT INTO public.categories (slug, name, icon, description) VALUES
  ('vitals',    'Vital Medications',       '💊', 'Essential prescription medications'),
  ('vitamins',  'Vitamins & Supplements',  '🥗', 'Nutritional supplements'),
  ('fitness',   'Fitness & Recovery',      '💪', 'Sports nutrition and recovery'),
  ('cosmetics', 'Cosmetics & Skincare',    '✨', 'Skincare and beauty products'),
  ('devices',   'Medical Devices',         '🩺', 'Professional medical equipment'),
  ('hygiene',   'Hygiene & Sanitizers',    '🧴', 'Cleaning and hygiene supplies')
ON CONFLICT (slug) DO NOTHING;

-- Products
WITH cat AS (SELECT slug, id FROM public.categories)
INSERT INTO public.products (name, description, price, category_id, image_url, stock, unit, min_order) VALUES
  ('Vitamin D3 5000IU',     'Immunity & bone health support. Premium quality.',         245,  (SELECT id FROM cat WHERE slug='vitamins'),  'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800', 500,  'bottle', 10),
  ('Hydrating Serum',       'Pure hyaluronic acid formula for deep hydration.',         890,  (SELECT id FROM cat WHERE slug='cosmetics'), 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800', 200,  'box',     5),
  ('Whey Protein Isolate',  'Premium 25g protein per scoop, muscle recovery formula.', 1450,  (SELECT id FROM cat WHERE slug='fitness'),   'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=800', 150,  'tub',     3),
  ('Paracetamol 500mg',     'Fever & pain relief tablets, 100-count pack.',              35,  (SELECT id FROM cat WHERE slug='vitals'),    'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800', 2000, 'pack',   50),
  ('Omega-3 Fish Oil',      'Heart & brain health support, 120 softgels.',              320,  (SELECT id FROM cat WHERE slug='vitamins'),  'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800',  300,  'bottle', 10),
  ('Sunscreen SPF50+',      'Broad spectrum UV protection, dermatologically tested.',   560,  (SELECT id FROM cat WHERE slug='cosmetics'), 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800',  400,  'tube',   12),
  ('Amoxicillin 500mg',     'Broad-spectrum antibiotic, 21 capsules.',                   95,  (SELECT id FROM cat WHERE slug='vitals'),    'https://images.unsplash.com/photo-1550572017-edd951b55104?w=800',  800,  'box',    20),
  ('Digital Thermometer',   'Clinical accuracy, fast reading in 10 seconds.',           180,  (SELECT id FROM cat WHERE slug='devices'),   'https://images.unsplash.com/photo-1584432810601-6c7f27d2362b?w=800', 100,  'piece',   5),
  ('Hand Sanitizer 500ml',  '70% alcohol, kills 99.9% of germs.',                        75,  (SELECT id FROM cat WHERE slug='hygiene'),   'https://images.unsplash.com/photo-1584744982491-665216d95f8b?w=800', 1000, 'bottle', 24);
