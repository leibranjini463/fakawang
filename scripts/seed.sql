-- 本地开发种子数据（幂等：INSERT OR IGNORE）
-- 卡密此处用明文演示（decryptSecret 对非 v1 前缀按明文处理）；生产请用后台加密导入。

INSERT OR IGNORE INTO categories (name, slug, sort_order, is_enabled, created_at, updated_at) VALUES
 ('游戏充值','game',1,1,strftime('%s','now')*1000,strftime('%s','now')*1000),
 ('会员账号','vip',2,1,strftime('%s','now')*1000,strftime('%s','now')*1000);

INSERT OR IGNORE INTO products (category_id,name,slug,description,price_cents,delivery_type,buy_min,buy_max,stock_alert_threshold,sales_count,sales_base,sort_order,is_enabled,created_at,updated_at) VALUES
 ((SELECT id FROM categories WHERE slug='game'),'Steam 充值卡 100 元','steam-100','## 商品说明' || char(10) || '- 自动发货，一卡一密' || char(10) || '- 请及时充值',9800,'auto',1,5,5,0,1200,1,1,strftime('%s','now')*1000,strftime('%s','now')*1000),
 ((SELECT id FROM categories WHERE slug='vip'),'视频会员月卡','video-vip','热销会员，秒发账号密码',1500,'auto',1,10,10,0,3400,2,1,strftime('%s','now')*1000,strftime('%s','now')*1000),
 ((SELECT id FROM categories WHERE slug='vip'),'人工发货示例','manual-demo','下单后由客服人工处理',500,'manual',1,3,0,0,0,3,1,strftime('%s','now')*1000,strftime('%s','now')*1000);

INSERT OR IGNORE INTO cards (product_id,content_enc,content_hash,preview,status,created_at) VALUES
 ((SELECT id FROM products WHERE slug='steam-100'),'STEAM-AAAA-1111-2222','h-steam-1','STEA****22','available',strftime('%s','now')*1000),
 ((SELECT id FROM products WHERE slug='steam-100'),'STEAM-BBBB-3333-4444','h-steam-2','STEA****44','available',strftime('%s','now')*1000),
 ((SELECT id FROM products WHERE slug='steam-100'),'STEAM-CCCC-5555-6666','h-steam-3','STEA****66','available',strftime('%s','now')*1000),
 ((SELECT id FROM products WHERE slug='steam-100'),'STEAM-DDDD-7777-8888','h-steam-4','STEA****88','available',strftime('%s','now')*1000),
 ((SELECT id FROM products WHERE slug='video-vip'),'vipuser01@mail.com----pass1234','h-vip-1','vipu****34','available',strftime('%s','now')*1000),
 ((SELECT id FROM products WHERE slug='video-vip'),'vipuser02@mail.com----pass5678','h-vip-2','vipu****78','available',strftime('%s','now')*1000),
 ((SELECT id FROM products WHERE slug='video-vip'),'vipuser03@mail.com----pass9012','h-vip-3','vipu****12','available',strftime('%s','now')*1000);

-- 多规格演示商品（video-multi）：月卡/季卡各自独立价格与卡池；has_variants=1，price_cents 为起价
INSERT OR IGNORE INTO products (category_id,name,slug,description,image_key,price_cents,delivery_type,buy_min,buy_max,has_variants,stock_alert_threshold,sales_count,sales_base,sort_order,is_enabled,created_at,updated_at) VALUES
 ((SELECT id FROM categories WHERE slug='vip'),'某视频平台会员（多档）','video-multi','## 多规格演示' || char(10) || '- 不同时长套餐价格与库存各自独立' || char(10) || '- 付款后自动秒发',NULL,1500,'auto',1,10,1,10,0,800,4,1,strftime('%s','now')*1000,strftime('%s','now')*1000);

-- 规格用固定 id 保证 seed 幂等（全新库 product_variants 为空）
INSERT OR IGNORE INTO product_variants (id,product_id,name,price_cents,original_price_cents,sort_order,is_enabled,created_at,updated_at) VALUES
 (1,(SELECT id FROM products WHERE slug='video-multi'),'月卡',1500,2000,1,1,strftime('%s','now')*1000,strftime('%s','now')*1000),
 (2,(SELECT id FROM products WHERE slug='video-multi'),'季卡',4000,5000,2,1,strftime('%s','now')*1000,strftime('%s','now')*1000);

-- 卡密按规格归属（variant_id 由 name 子查询关联；月卡 3 张 / 季卡 2 张）
INSERT OR IGNORE INTO cards (product_id,variant_id,content_enc,content_hash,preview,status,created_at) VALUES
 ((SELECT id FROM products WHERE slug='video-multi'),(SELECT id FROM product_variants WHERE product_id=(SELECT id FROM products WHERE slug='video-multi') AND name='月卡'),'month-acct01@mail.com----mpass01','h-vm-m1','mont****01','available',strftime('%s','now')*1000),
 ((SELECT id FROM products WHERE slug='video-multi'),(SELECT id FROM product_variants WHERE product_id=(SELECT id FROM products WHERE slug='video-multi') AND name='月卡'),'month-acct02@mail.com----mpass02','h-vm-m2','mont****02','available',strftime('%s','now')*1000),
 ((SELECT id FROM products WHERE slug='video-multi'),(SELECT id FROM product_variants WHERE product_id=(SELECT id FROM products WHERE slug='video-multi') AND name='月卡'),'month-acct03@mail.com----mpass03','h-vm-m3','mont****03','available',strftime('%s','now')*1000),
 ((SELECT id FROM products WHERE slug='video-multi'),(SELECT id FROM product_variants WHERE product_id=(SELECT id FROM products WHERE slug='video-multi') AND name='季卡'),'quarter-acct01@mail.com----qpass01','h-vm-q1','quar****01','available',strftime('%s','now')*1000),
 ((SELECT id FROM products WHERE slug='video-multi'),(SELECT id FROM product_variants WHERE product_id=(SELECT id FROM products WHERE slug='video-multi') AND name='季卡'),'quarter-acct02@mail.com----qpass02','h-vm-q2','quar****02','available',strftime('%s','now')*1000);

INSERT OR IGNORE INTO announcements (title,content,type,is_pinned,is_enabled,sort_order,created_at,updated_at) VALUES
 ('欢迎光临 🌸','## 欢迎' || char(10) || '本站为演示环境，可用 **Mock 模拟支付** 体验完整下单→发货流程。','popup',0,1,1,strftime('%s','now')*1000,strftime('%s','now')*1000),
 ('全场自动秒发，7×24 小时营业中','','bar',0,1,1,strftime('%s','now')*1000,strftime('%s','now')*1000);

INSERT OR IGNORE INTO payment_channels (provider,display_name,is_enabled,sort_order,config,created_at,updated_at) VALUES
 ('usdt','USDT (TRC20/Polygon/Arbitrum)',1,1,'{"chains":[{"chain":"TRC20","address":"TXExampleTronAddress1111111111111","enabled":true},{"chain":"POLYGON","address":"0xExamplePolygonAddr00000000000000000000","enabled":true},{"chain":"ARBITRUM","address":"0xExampleArbitrumAddr0000000000000000000","enabled":true}]}',strftime('%s','now')*1000,strftime('%s','now')*1000),
 ('epay','支付宝 / 微信',0,2,'{"gateway":"https://pay.example.com","pid":"1000","type":"alipay"}',strftime('%s','now')*1000,strftime('%s','now')*1000);
