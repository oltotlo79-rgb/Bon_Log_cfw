-- 病害虫9種の image_url を /images/pests/ のファイルに合わせて更新
-- Supabase Dashboard > SQL Editor で実行してください。

UPDATE disease_pests SET image_url = '/images/pests/kubiakatsuyakamikiri.png' WHERE slug = 'kubiaka-tsuyakamikiri';
UPDATE disease_pests SET image_url = '/images/pests/kaburahabachi.png' WHERE slug = 'kabura-habachi';
UPDATE disease_pests SET image_url = '/images/pests/kinuwaba.png' WHERE slug = 'kinuwaba';
UPDATE disease_pests SET image_url = '/images/pests/tamanayaga.png' WHERE slug = 'tamana-yaga';
UPDATE disease_pests SET image_url = '/images/pests/oonijuuyahoshitentou.png' WHERE slug = 'oonijyuuya-hoshitentou';
UPDATE disease_pests SET image_url = '/images/pests/minamikiiroazamiuma.png' WHERE slug = 'minami-kiiro-azamiuma';
UPDATE disease_pests SET image_url = '/images/pests/ringokokakumonhamaki.png' WHERE slug = 'ringo-kokaku-hamaki';
UPDATE disease_pests SET image_url = '/images/pests/mikanhamoguriga.png' WHERE slug = 'mikan-hamorigiga';
UPDATE disease_pests SET image_url = '/images/pests/koumoriga.png' WHERE slug = 'koumorigiga';
