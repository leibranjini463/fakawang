# 「发卡网 faka-next」实施计划（Next.js + Cloudflare 全家桶）

> 项目目录：`/Users/a1021500667/Documents/test/faka-next`
> 参考对象：dujiaoka（独角数卡，已于 2026-03 归档并官方转向 "Dujiao-Next"）+ acg-faka（异次元/荔枝，二次元发卡）
> 前台页面详细规划见配套文档：`PLAN-FRONTEND.md`
> 计划生成日期：2026-07-19

## 0. 关键调研结论（2026-07 核实）

| 问题 | 结论 | 依据 |
|---|---|---|
| 部署方式 | **用 `@opennextjs/cloudflare` 部署到 Cloudflare Workers**。`@cloudflare/next-on-pages` 已进入维护模式/弃用，Cloudflare 官方文档明确不再推荐 Pages 承载 Next.js | Cloudflare 官方文档 + OpenNext 官网 |
| OpenNext 适配器现状 | 已 1.0 GA（2026-02），当前最新 **1.20.1**；peerDeps 要求 `next >=15.5.18 <16 || >=16.2.6`、`wrangler ^4.86`；使用 **Node.js runtime**（非 Edge），支持 App Router、SSR/SSG/ISR、PPR、Middleware、`use cache` | npm registry 实测 |
| Next.js 版本 | **Next.js 16**（2025-10-21 稳定发布，当前 16.2.x），App Router + Turbopack 默认 | nextjs.org |
| next-on-pages 为何不选 | 仅支持 Edge runtime、不支持 ISR/新缓存模型、已停止演进 | Cloudflare docs / GitHub |
| Workers 的 Node 兼容性 | `nodejs_compat` 下 `node:crypto` 已**全量原生支持**（2025-04 起），含 `createSign/createVerify`（RSA-SHA256，支付宝/Binance 验签可用）、`createHash('md5')`（易支付签名可用） | Cloudflare changelog 2025-04-08 |
| D1 + Drizzle | 成熟组合；D1 上限 10GB/库；**无交互式事务**（用 `batch()` 原子批量）；migration 流程 = `drizzle-kit generate` 产出 SQL + `wrangler d1 migrations apply` | Drizzle/Cloudflare docs |
| Cron Triggers | OpenNext 官方提供 **Custom Worker** 模式：包一层入口 re-export 生成的 `fetch`，追加 `scheduled` handler；最小粒度 1 分钟 | OpenNext howtos/custom-worker |
| TronGrid（TRC20） | 免费档：需 API Key，**100K 请求/天、15 QPS**；无 WebSocket，只能轮询；TRC20 到账查 `GET /v1/accounts/{addr}/transactions/trc20`，`only_confirmed=true` 即固化区块（≈19 块 ≈ 1 分钟终局性）。USDT 合约 `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`，**6 位小数** | TRON developers docs |
| Etherscan V2（BEP20/BSC） | **BscScan 已并入 Etherscan V2 多链 API**：统一 base `https://api.etherscan.io/v2/api`，`chainid=56` 选 BSC，一个 API key 通吃 50+ 链；**V1 已于 2025-08-15 弃用**。BEP20 转账查 `module=account&action=tokentx&contractaddress=..&address=..`，返回含 `confirmations`。BSC USDT 合约 `0x55d398326f99059fF775485246999027B3197955`，**18 位小数（关键差异！）**；出块 ~3s，建议 ≥15 确认 | Etherscan API V2 docs |
| Binance Pay | 商户 API 现行版本 v3（`POST /binancepay/openapi/v3/order`，2025 起 `description` 必填）；请求签名 HMAC-SHA512；Webhook 用 RSA-SHA256 验签（payload = `timestamp\nnonce\nbody\n`，公钥从证书接口获取），应答 `{"returnCode":"SUCCESS"}`；开通需商户 KYB | Binance 开放平台文档 |
| Workers 限制 | 免费：3MiB(gzip) 包体 / 10ms CPU——**对本项目不够**；付费 $5/月：10MiB / 默认 30s CPU（可调至 5min）→ **按付费计划设计** | Cloudflare limits |

---

## 1. 功能清单（对照 dujiaoka）

### MVP（M1–M4 必须交付）
1. 商品分类：增删改查、排序、启用/隐藏
2. 商品管理：名称/slug/描述(Markdown)/图片(R2)/价格/库存展示/限购数量/自动发货类型/上下架
3. 卡密管理：批量导入（文本框粘贴 + txt 上传）、**按内容哈希去重**、AES-GCM 加密存储、状态流转（可用/锁定/已售/禁用）、删除未售卡密
4. 下单购买：游客下单（邮箱作为联系方式）、Turnstile 人机验证、数量校验、金额计算
5. 支付：可插拔驱动 + 多渠道（易支付[默认]、**USDT 双链 TRC20/BEP20**、Binance Pay；支付宝当面付驱动同步实现、按资质启用）
6. 自动发货：支付确认后原子分配卡密、订单页展示卡密
7. 订单查询：订单号 + 邮箱双因子查询；订单过期自动关闭
8. 邮件通知：发货邮件（含卡密）、（管理员）库存告警邮件
9. 后台管理：登录（用户名密码+限流）、仪表盘（今日订单/营收/待处理）、订单管理（补单/重发邮件/关单）、商品/分类/卡密 CRUD、支付渠道配置、系统设置
10. 部署：一条命令部署到 Cloudflare Workers，Cron 定时任务在线

### 迭代阶段（MVP 后按优先级）
- P1：优惠券（满减/折扣、限品类、限次数）；批发价阶梯（数量折扣）；「我已支付」手动触发 USDT 即时核对
- P2：人工发货商品类型（工单式）；管理员 TOTP 两步验证；操作审计日志；订单查询密码
- P3：HD 钱包每单唯一地址（USDT 方案 B）；多管理员/角色；TG Bot / Bark 通知；销量统计报表
- P4：多语言（next-intl）；主题模板；API 开放（对接上游代理）；汇率自动源

---

## 2. 技术选型与整体架构

| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | **Next.js 16（App Router + TS，Turbopack）** | 硬性要求；16 为当前稳定版且是 OpenNext 主要支持目标 |
| 部署 | **@opennextjs/cloudflare 1.x → Cloudflare Workers** | 官方唯一推荐路线；Node runtime 使支付签名类代码可用 `node:crypto`；next-on-pages 已弃用 |
| 数据库 | **Cloudflare D1 + Drizzle ORM + drizzle-kit** | 原生 binding 零网络配置、免费额度充足；Drizzle 类型安全、迁移产物是纯 SQL 便于审计。替代方案对比：Turso/libSQL（功能更多但多一跳网络+额外厂商）、Neon Postgres+Hyperdrive（真事务但成本/延迟/复杂度高）。发卡站数据量（万级订单）D1 绰绰有余；Drizzle 抽象层保留未来迁移 Postgres 的退路 |
| 缓存/会话辅助 | **KV**：站点设置缓存、汇率缓存、回调 nonce 防重放、Turnstile 结果短存 | KV 最终一致 → **绝不用于锁与幂等**（那些放 D1） |
| 文件 | **R2**：商品图片（admin 上传，公开 bucket 自定义域名直出） | 免出口流量费 |
| 定时任务 | **Cron Triggers**（Custom Worker 加 `scheduled`）：`* * * * *` USDT 轮询+订单过期；`0 * * * *` 库存告警+锁清理 | 免费版每 Worker ≥3 个 cron，够用 |
| 人机验证 | **Turnstile**（下单、订单查询、后台登录三处） | 原生免费 |
| 后台认证 | **自研轻量 session**（约 200 行）：PBKDF2-SHA256（WebCrypto 原生，≥310k 迭代）密码哈希 + D1 `admin_sessions` 表 + HttpOnly/Secure/SameSite=Lax cookie + middleware 守卫 `/admin` | 单管理员、无 OAuth 需求；Auth.js/better-auth 会增加包体（Workers 10MiB gzip 上限敏感）且 Credentials 流程反而绕。备选：better-auth（有 cloudflare 集成包），若后续要多用户再换 |
| UI | **Tailwind CSS v4 + shadcn/ui**（Radix）+ lucide-react；后台表格用 TanStack Table | 无重量级 UI 库（antd 会撑爆包体）；shadcn 代码进仓库可控 |
| 校验 | **zod v4**（前后端同 schema）+ react-hook-form；所有 Server Action / Route Handler 服务端强校验 | 硬性要求 |
| 邮件 | **Resend HTTP API**（免费 100 封/天），抽象 `Mailer` 接口 | Workers 无传统 SMTP 栈（MailChannels 免费通道已于 2024-08 终止）；HTTP API 最稳。备选：worker-mailer（基于 TCP Sockets 的 SMTP）留作自建位 |
| 金额 | 一律**整数**：CNY 存「分」，USDT 存「micro（1e-6）」 | 杜绝浮点误差，唯一金额法的前提 |
| ID | 内部自增 int；对外 `order_no` 为 22 位随机（ULID 加密友好变体 / nanoid） | 防遍历 |

### 架构图（文字版）

```
浏览器 ──> Cloudflare Workers (OpenNext: Next.js 16 SSR + Route Handlers)
              │  getCloudflareContext()
              ├── D1 (fakawang-db)      ← Drizzle：全部业务数据、锁、幂等表、session
              ├── KV (FAKA_KV)     ← 设置缓存 / 汇率 / nonce / 限流计数(弱)
              ├── R2 (fakawang-assets) ← 商品图
              └── Secrets           ← 卡密主密钥、各支付渠道密钥、SESSION_SECRET
外部回调  ──> /api/pay/notify/[provider]（易支付/支付宝/Binance Webhook）
Cron 1min ──> scheduled() → 内部调用 fetch('/api/cron/tick')：USDT 轮询、过期关单
外部 API：TronGrid(轮询) / 易支付网关 / 支付宝网关 / Binance Pay / Resend / Turnstile siteverify
```

---

## 3. 核心数据模型（D1/SQLite，Drizzle schema 语义）

> 约定：时间戳 `INTEGER`（unix ms）；布尔 `INTEGER 0/1`；`id INTEGER PRIMARY KEY AUTOINCREMENT`。

**categories**
| 字段 | 类型/约束 |
|---|---|
| id | PK |
| name | TEXT NOT NULL |
| slug | TEXT NOT NULL **UNIQUE** |
| sort_order | INTEGER DEFAULT 0 |
| is_enabled | INTEGER DEFAULT 1 |
| created_at / updated_at | INTEGER |

**products**
| 字段 | 类型/约束 |
|---|---|
| id | PK |
| category_id | INTEGER NOT NULL → categories.id |
| name / slug | TEXT NOT NULL；slug UNIQUE |
| description | TEXT（Markdown） |
| image_key | TEXT NULL（R2 key） |
| price_cents | INTEGER NOT NULL |
| original_price_cents | INTEGER NULL（划线价） |
| delivery_type | TEXT CHECK IN ('auto','manual') DEFAULT 'auto' |
| buy_min / buy_max | INTEGER DEFAULT 1 / 10（限购） |
| wholesale_tiers | TEXT NULL（JSON `[{qty,price_cents}]`，迭代期启用） |
| stock_alert_threshold | INTEGER DEFAULT 10 |
| sales_count | INTEGER DEFAULT 0 |
| sort_order / is_enabled / created_at / updated_at | 同上 |
| 索引 | `(category_id, is_enabled, sort_order)` |

**cards（卡密）**
| 字段 | 类型/约束 |
|---|---|
| id | PK |
| product_id | INTEGER NOT NULL → products.id |
| content_enc | TEXT NOT NULL（`v1:` + base64(iv‖ciphertext‖tag)，AES-256-GCM） |
| content_hash | TEXT NOT NULL（SHA-256(明文规范化)，去重用） |
| status | TEXT CHECK IN ('available','sold','disabled') DEFAULT 'available' |
| order_id | INTEGER NULL → orders.id |
| batch_id | TEXT NULL（导入批次号，支持整批撤销） |
| sold_at / created_at | INTEGER |
| 索引 | **UNIQUE(product_id, content_hash)**（导入去重核心）；`(product_id, status)`（分配热路径）；`(order_id)` |

**orders**
| 字段 | 类型/约束 |
|---|---|
| id | PK |
| order_no | TEXT NOT NULL **UNIQUE**（22 位随机，对外唯一标识） |
| product_id | INTEGER NOT NULL；product_name TEXT（下单快照） |
| quantity | INTEGER NOT NULL CHECK > 0 |
| unit_price_cents / total_cents / discount_cents / payable_cents | INTEGER NOT NULL |
| coupon_id | INTEGER NULL |
| contact_email | TEXT NOT NULL |
| status | TEXT CHECK IN ('pending','paid','delivered','expired','closed','manual_review') DEFAULT 'pending' |
| payment_provider | TEXT NULL（'epay'/'alipay_f2f'/'usdt'/'binance_pay'） |
| pay_currency | TEXT NULL（法币 'CNY' 或含链的 'USDT-TRC20'/'USDT-BEP20'）；pay_amount TEXT NULL（如 USDT micro 面值） |
| provider_trade_no | TEXT NULL（渠道流水号/链上 txid） |
| paid_at / delivered_at | INTEGER NULL |
| expires_at | INTEGER NOT NULL（默认下单 +30min） |
| ip / ua | TEXT |
| created_at / updated_at | INTEGER |
| 索引 | `(contact_email, created_at)`（查询页）；`(status, expires_at)`（过期 cron）；`(status, payment_provider)`（USDT watcher）|

**payment_events（幂等/审计核心）**
| 字段 | 类型/约束 |
|---|---|
| id | PK |
| provider | TEXT NOT NULL |
| event_id | TEXT NOT NULL（链上 txid / 渠道 trade_no+status / webhook bizId） |
| order_id / order_no | 可空关联 |
| kind | TEXT（'callback'/'poll'） |
| raw_payload | TEXT（原始报文，审计） |
| result | TEXT（'processed'/'duplicate'/'ignored'/'failed'） |
| created_at | INTEGER |
| 索引 | **UNIQUE(provider, event_id)** ← 防重复入账的最终防线 |

**usdt_amount_locks（唯一金额占位池，多链）**
| 字段 | 类型/约束 |
|---|---|
| id | PK |
| chain | TEXT NOT NULL CHECK IN ('TRC20','BEP20') |
| address | TEXT NOT NULL（该链收款地址） |
| amount_micro | INTEGER NOT NULL（**面值统一按 1e-6 存**，与链上 decimals 解耦；匹配时按各链 decimals 归一后比对） |
| order_id | INTEGER NOT NULL UNIQUE |
| expires_at | INTEGER NOT NULL |
| released | INTEGER DEFAULT 0 |
| 索引 | **UNIQUE(chain, address, amount_micro) WHERE released = 0**（SQLite 部分唯一索引，INSERT 冲突即该链该金额被占，天然原子；加 chain 维度使两链金额空间独立） |

**coupons / coupon_usages**（迭代期）
- coupons：`code UNIQUE`、`type CHECK('fixed','percent')`、`value`、`product_id NULL(全场)`、`min_amount_cents`、`max_uses`、`used_count`、`starts_at/expires_at`、`is_enabled`
- coupon_usages：`UNIQUE(order_id)` 防同单重复占用；核销在「支付成功」时 `used_count = used_count + 1` 条件更新

**payment_channels**
- `provider TEXT UNIQUE`、`display_name`、`is_enabled`、`sort_order`、`config TEXT`（JSON：仅非敏感项——易支付网关地址/pid、支付宝 appid、USDT 收款地址/汇率模式、Binance merchantId 等）。**所有 secret（易支付 key、支付宝私钥、Binance secretKey）只放 Workers Secrets**，config 里存的是引用名。

**admins / admin_sessions / settings**
- admins：`username UNIQUE`、`password_hash`（格式 `pbkdf2$sha256$310000$salt$hash`）、`totp_secret NULL`、`failed_attempts`、`locked_until`
- admin_sessions：`id TEXT PK`（32B 随机 hex）、`admin_id`、`expires_at`、`ip/ua`；索引 `(expires_at)` 供清理
- settings：`key TEXT PK`、`value TEXT(JSON)`；读多写少，KV 缓存 60s + 保存时主动失效

---

## 4. 支付驱动抽象设计

### 4.1 统一接口（`src/payments/types.ts`，设计规格）

```ts
export interface PaymentContext {          // 依赖注入，Cron 与请求上下文都能用
  db: DrizzleD1Database; kv: KVNamespace; env: CloudflareEnv;
}

export type CreatePaymentResult =
  | { kind: 'redirect'; url: string }                                  // 易支付收银台
  | { kind: 'qrcode';  qrContent: string; expiresAt: number }          // 支付宝当面付
  | { kind: 'crypto';  address: string; amountMicro: number; chain: 'TRC20' | 'BEP20'; decimals: number; expiresAt: number } // USDT 双链
  | { kind: 'checkout'; url: string; qrContent?: string; deeplink?: string }; // Binance Pay

export interface VerifiedNotification {    // 验签后的规范化回调
  orderNo: string;
  providerTradeNo: string;                 // 幂等 event_id 来源
  paidAmount: { currency: string; value: number };  // 整数最小单位
  raw: string;
}

export interface PaymentProvider {
  readonly code: 'epay' | 'alipay_f2f' | 'usdt' | 'binance_pay';  // usdt 内部支持 TRC20/BEP20 多链
  createPayment(ctx: PaymentContext, order: Order, channelConfig: Json): Promise<CreatePaymentResult>;
  /** Webhook 型渠道实现：验签+防重放，返回规范化通知；抛 VerifyError 则 4xx */
  handleNotify?(ctx: PaymentContext, req: Request): Promise<{ notification: VerifiedNotification; ack: Response }>;
  /** 轮询型渠道实现（USDT 必用；支付宝/Binance 作对账兜底） */
  poll?(ctx: PaymentContext, pendingOrders: Order[]): Promise<VerifiedNotification[]>;
  /** 可选：主动关单（Binance/支付宝支持） */
  close?(ctx: PaymentContext, order: Order): Promise<void>;
}
```

**统一结算管线（所有渠道共用，`src/services/settlement.ts`）**：
1. `INSERT INTO payment_events (provider, event_id, ...)`——命中 UNIQUE 冲突 → 记 `duplicate` 直接 ack（幂等第一道门）
2. 校验金额 ≥ 应付（渠道币种各自比对，整数比较）
3. CAS 置态：`UPDATE orders SET status='paid', paid_at=?, provider_trade_no=? WHERE order_no=? AND status='pending'`——`meta.changes===0` 说明已处理/已过期 → 过期但已付款的记 `manual_review`
4. 发货 + 发邮件（失败不阻塞，进重试）
5. 返回渠道要求的 ack 报文（易支付 `success` / 支付宝 `success` / Binance `{"returnCode":"SUCCESS"}`）

统一回调入口：`POST/GET /api/pay/notify/[provider]` → registry 找 provider → `handleNotify` → 结算管线。

### 4.2 支付宝：两条路线分析与结论

| | 官方当面付/手机网站支付 | 易支付(epay)聚合 |
|---|---|---|
| 资质 | **需企业或个体工商户营业执照**签约开放平台，个人不可 | 个人可注册即用 |
| 协议 | RSA2(SHA256withRSA) 签名，`alipay.trade.precreate`(当面付出二维码)/`alipay.trade.wap.pay`；异步 notify + `alipay.trade.query` 对账 | MD5 签名：`submit.php` 页面跳转或 `mapi.php` API；`notify_url` 回调携带 `sign` |
| 稳定性/费率 | 官方直连，费率 0.38%~0.6%，最稳 | 三方平台，有跑路/掉单/费率风险 |
| Workers 兼容 | 官方 `alipay-sdk`(npm) 依赖 urllib 等 Node 栈，**不建议引入**；协议本身简单：`node:crypto` `createSign('RSA-SHA256')` 手写签名 ~100 行即可 | MD5 用 `node:crypto createHash('md5')`，nodejs_compat 下可用 |

**结论：默认实现并启用 `EpayProvider`**（个人可用、一个驱动同时覆盖支付宝+微信+QQ 通道，`type` 参数区分）；**同时交付 `AlipayF2FProvider`（当面付，手写 RSA2 签名，不用官方 SDK）**，有资质用户在后台配置密钥后启用。两者对上层完全同构。

Epay 驱动要点：创建 = 302 跳转 `{gateway}/submit.php?pid&type&out_trade_no&notify_url&return_url&name&money&sign&sign_type=MD5`（sign = 参数按 ASCII 排序拼接 + key 的 MD5）；回调 = 校验 sign、`trade_status=TRADE_SUCCESS`、`money` 与订单一致，ack 纯文本 `success`。
支付宝当面付要点：`precreate` 得 `qr_code` 前端渲染二维码；notify 为 form-POST，用支付宝公钥 `createVerify('RSA-SHA256')` 验签（注意 `sign/sign_type` 剔除后按 key 排序）、校验 `app_id/out_trade_no/total_amount/trade_status∈{TRADE_SUCCESS,TRADE_FINISHED}`；每分钟 cron 对 pending 单兜底 `alipay.trade.query`。

### 4.3 USDT 多链（TRC20 + BEP20）：方案对比与推荐

**到账识别方案（两链共用同一套「唯一金额法」）**：

| | A. 唯一金额法（推荐默认） | B. HD 派生每单唯一地址 |
|---|---|---|
| 原理 | 每条链单一收款地址；订单金额加唯一小数尾（如 10.3128 USDT），以金额区分订单 | 从 xpub 按 BIP44 派生地址（TRON `m/44'/195'/..`、EVM `m/44'/60'/..`），每单一个地址 |
| 私钥风险 | **服务器只存收款地址，零私钥**，被攻破也无资金损失 | 服务器存 xpub；归集需私钥 + 每地址预置 gas（TRX / BNB） |
| 轮询成本 | **每链 1 地址 = 每分钟 1 次调用**（TronGrid 100K/天、Etherscan V2 各有额度，均用 ~1.5%） | 每个待付订单地址各查一次或按块扫描，请求数 × N |
| 并发上限 | 4 位小数尾 ≈ 每基础金额万级并发槽位，按 (chain,address,amount) 锁池管理 | 无并发限制 |
| 用户体验 | 必须**精确转账**（少付/多付需人工处理） | 金额宽容，可容差 |
| 实现复杂度 | 低（Epusdt 同款成熟模型，dujiaoka 生态验证过） | 高（派生、归集、gas 管理） |

**推荐：MVP 用 A（唯一金额法），双链均启用，B 列入 P3 迭代。**

**双链关键差异（务必分链处理）**：

| 维度 | TRC20（TRON） | BEP20（BSC） |
|---|---|---|
| USDT 合约 | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` | `0x55d398326f99059fF775485246999027B3197955` |
| **链上小数位** | **6**（1 USDT = 1e6 最小单位） | **18**（1 USDT = 1e18 最小单位） |
| 区块浏览器 API | TronGrid `GET /v1/accounts/{addr}/transactions/trc20`，Header `TRON-PRO-API-KEY`，`only_confirmed=true` | Etherscan V2 `https://api.etherscan.io/v2/api?chainid=56&module=account&action=tokentx&contractaddress=..&address=..`，`apikey=` |
| 终局判定 | `only_confirmed=true` 即固化块（≈1 分钟） | 用返回的 `confirmations` 字段，阈值 **≥15**（≈45s，可配） |
| 收款地址 | TRON 地址（`T` 开头），单独一个 | EVM 地址（`0x`），可与未来其它 EVM 链共用同一地址 |
| 大整数处理 | value ≤ 1e6 级，Number 安全 | **value 达 1e18，超 `Number.MAX_SAFE_INTEGER`，必须用 `BigInt` 解析比较** |

> **金额归一策略**：内部 `amount_micro` 一律以 **1e-6 面值**存储（与链解耦）。匹配时：TRC20 直接 `BigInt(tx.value) === BigInt(amountMicro)`；BEP20 因 18 位小数，`BigInt(tx.value) === BigInt(amountMicro) * 10n ** 12n`（即链上 raw 除以 1e12 归一到 micro）。全程 BigInt，杜绝精度丢失。

**统一确认流程（含超时/容差/防重）**：
1. 下单选 USDT + 选链（TRC20/BEP20）→ 取汇率（settings：固定汇率，或 OKX 行情缓存 KV 5min）→ 基础面值 = ceil(payable_cents / rate, 到分)
2. 分配唯一尾数：候选 `base + rand(1..9999) * 0.0001`（micro 面值），`INSERT usdt_amount_locks(chain, address, amount_micro,...)`（部分唯一索引兜底原子性），冲突则换随机尾重试 ≤10 次
3. 支付页展示：**当前链**的地址二维码、**精确面值金额**、网络标识（避免用户转错链）、30 分钟倒计时、「金额/网络必须一致」警示
4. Cron 每分钟：分别对**每条有 pending 单的链**调用各自浏览器 API（TronGrid / Etherscan V2），只查该链收款地址近 N 分钟入账
5. 匹配：把链上 `value`（BigInt）归一到 micro 面值，精确等于某活跃 lock 的 `amount_micro` 且链匹配 → 以 `chain + txHash` 为 `event_id` 走统一结算管线（`payment_events` UNIQUE 防重复入账）；BEP20 额外校验 `confirmations ≥ 15`
6. 容差策略：默认精确匹配；可配置「多付容差 ≤ 0.5 USDT 视为成功并记差额」；少付/错链/无法匹配的转账写入 `payment_events(result='ignored')` 供后台人工核销（后台输入 chain + txHash + 订单号手动补单）
7. 超时：过期 cron 将 `pending` 且 `expires_at < now` 的单置 `expired`，对应 lock 置 `released=1`；**已过期后到账** → 结算管线 CAS 失败 → 自动转 `manual_review` 并告警邮件

**驱动结构**：单个 `UsdtProvider`（code=`usdt`）内部持有 `ChainWatcher` 接口的多实现——`TronGridWatcher`（TRC20）/ `EvmScanWatcher`（BEP20，Etherscan V2）。新增链（如 Polygon、ETH 主网）只加一个 Watcher + 一条链配置，结算管线/锁池/UI 全复用。链的启用与收款地址在后台 `payment_channels.config.chains[]` 配置。

### 4.4 Binance Pay

- **创建订单**：`POST https://bpay.binanceapi.com/binancepay/openapi/v3/order`，Headers：`BinancePay-Timestamp`、`BinancePay-Nonce`(32 随机)、`BinancePay-Certificate-SN`(=apiKey)、`BinancePay-Signature = HMAC-SHA512(ts+"\n"+nonce+"\n"+body+"\n", secret).hex.toUpperCase()`；Body：`merchantTradeNo=order_no`、`orderAmount`、`currency:'USDT'`、`description`（**v3 必填**）、`env.terminalType:'WEB'`、`returnUrl/cancelUrl`。响应含 `checkoutUrl/qrcodeLink/deeplink/prepayId` → 前端跳转或出码
- **Webhook**（在 Binance 商户平台 MMP 配置 URL）：验签 payload = `Binancepay-Timestamp + "\n" + Binancepay-Nonce + "\n" + rawBody + "\n"`，用「查询证书接口」下发的 RSA 公钥 `createVerify('RSA-SHA256')` 校验 `Binancepay-Signature`(base64)；公钥按 `Certificate-SN` 缓存 KV；校验时间戳 ±5min + nonce KV 去重（防重放）；`bizType='PAY'` 且 `bizStatus='PAY_SUCCESS'` → 解析 `data`(JSON string) 取 `merchantTradeNo` 入结算管线；ack `{"returnCode":"SUCCESS","returnMessage":null}`
- **兜底**：cron 对超 5 分钟未回调的 pending 单调 `v2/order/query` 对账；过期单调 close order
- 前置条件：Binance 商户号需 KYB 审核，**申请要提前到 M1 并行发起**

### 4.5 发货原子性（D1 无交互事务的解法）

```sql
-- 单条语句原子分配（SQLite 支持 UPDATE ... IN (SELECT ... LIMIT n)）
UPDATE cards SET status='sold', order_id=?1, sold_at=?2
WHERE id IN (SELECT id FROM cards
             WHERE product_id=?3 AND status='available'
             ORDER BY id LIMIT ?4);
```
- 校验 `meta.changes === quantity`：不足 → 订单置 `manual_review` + 告警（付款成功但超卖的兜底）
- 与 `UPDATE orders SET status='delivered'...`、`UPDATE products SET sales_count=sales_count+quantity` 放同一 `db.batch([...])`（D1 batch 整体原子）
- D1 单库单写入者串行化写入，配合条件更新，竞态窗口实际为零

---

## 5. 安全设计

1. **卡密加密**：AES-256-GCM（WebCrypto `crypto.subtle`），主密钥 `CARD_ENC_KEY`（32B base64）仅存 Workers Secrets；每卡随机 12B IV；密文格式 `v1:base64(iv‖ct‖tag)` 留版本位支持轮换；去重与后台搜索用 `content_hash`（SHA-256），避免解密扫描；卡密明文只在两处出现：导入瞬间、已付订单展示/邮件
2. **订单防遍历**：`order_no` 22 位随机（≈128bit 熵）；查询接口强制 `order_no + contact_email` 双匹配，查不到与不匹配返回同一错误文案；订单详情页 URL 含 order_no 但卡密内容需再验邮箱（或使用一次性签名 token：支付成功页种 HttpOnly cookie）
3. **Turnstile**：下单、订单查询、后台登录三处；服务端 `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` 校验，token 一次性
4. **后台认证**：PBKDF2-SHA256(WebCrypto, ≥310k 迭代, 16B salt)；登录失败计数入 D1（`failed_attempts`/`locked_until`，5 次锁 15 分钟——用 D1 而非 KV 保证强一致）；session 32B 随机 id 存 D1、7 天滑动过期、登出即删；cookie `HttpOnly+Secure+SameSite=Lax`；`middleware.ts` 拦截 `/admin/**`；写操作全走 Server Actions（Next 内置 Origin 校验）+ 二次校验 session
5. **回调安全**：各渠道验签细节见 §4；统一附加：时间戳窗口 ±5min、nonce KV(TTL 10min) 去重、`payment_events` UNIQUE 幂等、金额服务端复核（不信任回调金额少付）、回调路由不依赖任何用户态
6. **限流**：Cloudflare WAF Rate Limiting 规则（`/api/*` 与 `/admin/login`，免费计划含 1 条规则）为主；应用层对登录/查询做 D1 计数兜底；USDT「立即核对」按钮 KV 限 1 次/10s
7. **其余**：所有输入 zod 白名单校验；Drizzle 参数化查询天然防注入；商品描述 Markdown 渲染用 rehype-sanitize 防 XSS；secrets 一律 `wrangler secret put`，仓库只留 `.dev.vars.example`

---

## 6. 目录结构（App Router）

```
faka-next/
├── wrangler.jsonc                 # Workers 配置：bindings/crons/flags
├── open-next.config.ts            # OpenNext 适配器配置（缓存后端）
├── next.config.ts                 # 含 initOpenNextCloudflareForDev()
├── drizzle.config.ts
├── worker/index.ts                # ★ 自定义 Worker 入口：re-export fetch + scheduled
├── drizzle/                       # drizzle-kit 生成的 SQL migrations
├── cloudflare-env.d.ts            # wrangler types 生成
├── .dev.vars / .dev.vars.example  # 本地 secrets（前者 gitignore）
├── public/
└── src/
    ├── middleware.ts              # /admin 守卫 + 安全响应头
    ├── app/
    │   ├── layout.tsx  globals.css
    │   ├── (store)/                        # 前台
    │   │   ├── page.tsx                    # 首页：分类+商品
    │   │   ├── category/[slug]/page.tsx
    │   │   ├── product/[slug]/page.tsx     # 详情+下单表单
    │   │   └── order/
    │   │       ├── query/page.tsx          # 订单号+邮箱查询
    │   │       └── [orderNo]/page.tsx      # 状态/支付页/卡密展示（轮询）
    │   ├── admin/
    │   │   ├── login/page.tsx
    │   │   └── (dashboard)/                # 受 middleware 保护
    │   │       ├── page.tsx                # 仪表盘
    │   │       ├── categories/  products/  cards/   # CRUD + 卡密导入
    │   │       ├── orders/  coupons/
    │   │       ├── channels/               # 支付渠道配置
    │   │       └── settings/
    │   └── api/
    │       ├── health/route.ts
    │       ├── checkout/route.ts           # 下单（含 Turnstile）
    │       ├── orders/[orderNo]/status/route.ts   # 前台轮询
    │       ├── pay/notify/[provider]/route.ts     # ★ 统一回调入口
    │       └── cron/tick/route.ts          # ★ scheduled 内部调用（x-cron-secret 保护）
    ├── components/   # ui/(shadcn)  store/  admin/
    ├── db/
    │   ├── schema.ts                       # ★ 全部 Drizzle 表定义
    │   └── index.ts                        # getDb(): drizzle(getCloudflareContext().env.DB)
    ├── payments/
    │   ├── types.ts  registry.ts           # ★ PaymentProvider 接口与注册表
    │   ├── providers/epay.ts  alipay-f2f.ts  usdt.ts  binance-pay.ts
    │   └── watchers/tron-grid.ts  evm-scan.ts   # ★ USDT 多链到账监听（TRC20/BEP20）
    ├── services/
    │   ├── order.ts  delivery.ts  settlement.ts   # ★ 结算管线（幂等/CAS/发货）
    │   ├── usdt-watcher.ts  expiry.ts  stock-alert.ts
    │   └── mail/ (mailer.ts resend.ts templates.ts)
    └── lib/
        ├── crypto.ts        # AES-GCM 加解密、PBKDF2、随机 order_no
        ├── session.ts  turnstile.ts  rate-limit.ts  settings.ts  utils.ts
```

`worker/index.ts` 核心形态（cron 复用 Next 路由，避免双份模块图）：

```ts
import handler from '../.open-next/worker.js';
export default {
  fetch: handler.fetch,
  async scheduled(controller, env, ctx) {
    const req = new Request(`https://internal/api/cron/tick?cron=${encodeURIComponent(controller.cron)}`,
      { headers: { 'x-cron-secret': env.CRON_SECRET } });
    ctx.waitUntil(handler.fetch(req, env, ctx));
  },
} satisfies ExportedHandler<CloudflareEnv>;
export { DOQueueHandler } from '../.open-next/worker.js'; // 若启用 DO queue 需 re-export
```

---

## 7. 分阶段实施步骤（Milestones）

### M1 脚手架 + 部署打通（1–2 天）
任务：
1. `npm create cloudflare@latest faka-next -- --framework=next --platform=workers`（自动装好 Next 16 + @opennextjs/cloudflare + wrangler）
2. 接 Tailwind v4 + shadcn/ui 初始化；zod、drizzle-orm、drizzle-kit 安装
3. `wrangler.jsonc`：`nodejs_compat`、`compatibility_date ≥ 2025-04-01`、创建并绑定 D1(`DB`)/KV(`FAKA_KV`)/R2(`ASSETS_BUCKET`)、`triggers.crons: ["* * * * *","0 * * * *"]`、`migrations_dir: "drizzle"`
4. `worker/index.ts` 自定义入口 + `/api/cron/tick` 空实现；`open-next.config.ts` 先用默认（纯动态站）
5. `db/schema.ts` 首批表 → `drizzle-kit generate` → 本地/远程 apply；`/api/health` 读 D1
6. package.json 脚本：`dev` / `preview` / `deploy` / `cf-typegen` / `db:generate` / `db:migrate:local|remote`
7. 并行启动外部申请：Binance 商户 KYB、易支付账号、TronGrid API Key、Resend 域名验证、（如有资质）支付宝开放平台

验收：生产 workers.dev URL 可访问；`/api/health` 返回 D1 查询结果；Workers 日志每分钟出现 cron tick；`next dev` 下 `getCloudflareContext` 能拿到本地 miniflare bindings。

### M2 商品/卡密 + 最小后台（2–4 天）
任务：分类/商品 CRUD（Server Actions + zod）；卡密导入（粘贴/上传 → 规范化 → SHA-256 去重 → AES-GCM 加密入库，返回「导入 n 成功 / m 重复」）；批次撤销；R2 图片上传；前台首页/分类/详情 SSR；后台登录（PBKDF2 + session + middleware + Turnstile）；`settings` 表 + 站点设置页；seed 脚本。
验收：导入 1000 条含重复卡密，入库数与去重数准确；D1 控制台肉眼不可见明文；改密钥后旧卡解密失败报错可控；未登录访问 /admin 302；前台正常展示库存数。

### M3 下单 + 发货 + 订单查询（3–4 天）
任务：`/api/checkout`（Turnstile→zod→限购→算价→建单+expires_at）；MockProvider（仅 dev，秒过）打通结算管线（payment_events 幂等 + CAS + `db.batch` 原子发货）；订单支付页（状态轮询 `/status`）；已付订单展示解密卡密；订单查询页（order_no+email）；过期 cron；Resend 发货邮件 + 模板。
验收：mock 全流程 <5s 走完；**并发脚本 20 请求抢 10 库存不超卖不少发**；重放同一回调不重复发货（payment_events 出现 duplicate）；过期单准时关闭；邮件含卡密送达。

### M4 支付集成（4–6 天）
任务：按 §4 实现四个 Provider + 注册表 + `/api/pay/notify/[provider]`；渠道配置后台页（启停/排序/非敏感配置）；USDT watcher + 金额锁池 + 手动核销页；支付宝/Binance 对账 poll 兜底；「我已支付」即时核对按钮。
验收：易支付真实 1 分钱订单自动发货；USDT 主网小额转账 ≤2 分钟确认发货，错误金额转账落 ignored 并可后台核销；Binance sandbox 下单-回调-发货全通，篡改签名/重放均被拒（4xx + 日志）；当面付沙箱出码可支付；所有渠道掉单场景由 poll 兜底捞回。

### M5 后台管理完善（3–5 天）
任务：仪表盘（今日/7 日订单额、待处理 manual_review、低库存列表）；订单管理（筛选/详情/重发邮件/手动补单/关单）；优惠券 CRUD + 下单核销链路；库存告警 cron（阈值 + 每日汇总邮件）；商品批发价阶梯。
验收：手动补单能对 manual_review 单完成发货；优惠券超限/过期/最低消费各拦截正确且并发核销不超 max_uses；库存低于阈值 1 小时内收到告警邮件。

### M6 安全加固 + 打磨（2–4 天）
任务：WAF 限流规则；登录锁定与审计日志；TOTP（可选）；安全响应头（CSP 等）；rehype-sanitize；错误页/SEO/sitemap；`wrangler d1 export` 备份流程 + Time Travel 演练；日志观测（Workers Logs / Logpush，可选 @sentry/cloudflare）；绑定自定义域；文档（部署手册/密钥轮换手册）。
验收：暴力登录 5 次即锁；基础渗透清单（越权查单、遍历、XSS、重放）全绿；Lighthouse 前台 ≥90；备份可恢复演练通过。

---

## 8. Cloudflare 部署与配置要点

**wrangler.jsonc 关键项**：
```jsonc
{
  "name": "faka-next",
  "main": "worker/index.ts",
  "compatibility_date": "2026-06-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "d1_databases": [{ "binding": "DB", "database_name": "fakawang-db", "database_id": "...", "migrations_dir": "drizzle" }],
  "kv_namespaces": [{ "binding": "FAKA_KV", "id": "..." }],
  "r2_buckets": [{ "binding": "ASSETS_BUCKET", "bucket_name": "fakawang-assets" }],
  "triggers": { "crons": ["* * * * *", "0 * * * *"] },
  "observability": { "enabled": true }
  // 付费计划可加 "limits": { "cpu_ms": 30000 }
}
```

**流程与命令**：
- 迁移：改 `schema.ts` → `pnpm db:generate`（产出 `drizzle/000x_*.sql`）→ `wrangler d1 migrations apply DB --local`（本地验证）→ `--remote`（上线，**先于代码部署执行**，保持向后兼容式迁移）
- Secrets：本地写 `.dev.vars`；生产 `wrangler secret put CARD_ENC_KEY / SESSION_SECRET / CRON_SECRET / TURNSTILE_SECRET / RESEND_API_KEY / EPAY_KEY / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY / BINANCE_API_KEY / BINANCE_SECRET / TRONGRID_API_KEY`
- 本地开发双轨：日常 `next dev`（`initOpenNextCloudflareForDev()` 使 `getCloudflareContext()` 在 dev 拿到 miniflare 模拟 bindings，热更新快）；上线前 `opennextjs-cloudflare build && opennextjs-cloudflare preview`（workerd 真实运行时验证，**支付签名/crypto 相关必须在 preview 里过一遍**）；cron 本地用 `curl 'http://localhost:8787/cdn-cgi/handler/scheduled?cron=*+*+*+*+*'` 触发
- 部署：`opennextjs-cloudflare build && opennextjs-cloudflare deploy`；类型：`wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts`
- 回调需要公网 URL：联调支付回调用 `wrangler dev --remote` 或直接部署到 workers.dev 测试环境（建议建 `faka-next-staging` 独立 worker + 独立 D1）

**已知平台限制对设计的影响**：Workers 付费计划（$5/月）视为必选（包体 10MiB gzip / CPU 30s）；D1 每次 batch 上限与单语句 100KB 参数限制（卡密导入按 500 条/批分片）；子请求配额充足（默认 1000/次起）；所有加密路径只用 `node:crypto` + WebCrypto，不引任何带原生模块的库。

---

## 9. 风险与规避（Top 13）

| # | 风险 | 规避 |
|---|---|---|
| 1 | 官方 `alipay-sdk`/其它支付 SDK 在 workerd 跑不动（urllib/axios-node 栈） | **全部手写协议层**（每渠道 100–200 行），只依赖 fetch + node:crypto；M1 就在 preview 环境做签名冒烟测试 |
| 2 | 包体超 3MiB（免费档） | 直接按付费档规划；CI 里 `opennextjs-cloudflare build` 后检查 gzip 体积，禁用重依赖（moment/antd/官方 SDK） |
| 3 | D1 无交互事务 → 发货竞态/超卖 | 单语句子查询分配 + `batch()` 原子 + `meta.changes` 校验 + CAS 状态机（§4.5）；并发测试纳入 M3 验收 |
| 4 | KV 最终一致误用 | 明文规范：锁/幂等/限流计数 = D1；KV 仅缓存与 nonce 弱去重（幂等最终由 payment_events UNIQUE 保证） |
| 5 | TronGrid 429/宕机/免费额度 | 必配 API Key（100K/天 vs 实际 ~1.5K/天）；指数退避；provider 网关地址做成 settings 可切换（TronScan/QuickNode 备用）；唯一金额法天然单地址低耗 |
| 6 | 用户 USDT 金额转错/过期后到账 | 精确整数匹配 + ignored 落账 + 后台 txid 手动核销 + manual_review 自动告警，资金不丢单可追 |
| 7 | 易支付平台跑路/掉单 | 渠道可插拔多配置；每分钟 poll 对账兜底；不压大额余额，及时提现（运营规程写入文档） |
| 8 | 回调重放/伪造 | 验签 + ±5min 时间窗 + nonce 去重 + 金额复核 + payment_events 幂等，M4 验收含攻击用例 |
| 9 | Binance 商户 KYB 周期长 | M1 即发起申请；驱动先用 sandbox 联调，不阻塞主线 |
| 10 | 邮件送达（无 SMTP、MailChannels 免费已停） | Resend + 域名 SPF/DKIM（M1 配置）；Mailer 抽象可换 Brevo/SES；发货信息同时在订单页可查，邮件只是副通道 |
| 11 | Cron 1 分钟粒度导致 USDT 确认延迟感 | 支付页「我已支付」按钮限流触发即时核对；页面倒计时+状态轮询安抚预期 |
| 12 | 合规/风控：虚拟卡密类目易触发支付渠道风控，Cloudflare 对违规内容有政策 | 商品类目自审；渠道分散；条款页明示；不碰灰产类目 |
| 13 | **BSC USDT 18 位小数**：用 Number 解析 1e18 级 value 会精度溢出，导致金额匹配错误/漏单 | 全链路 `BigInt` 解析与比较；面值统一 1e-6 存储，按各链 decimals 归一；用户选错链的转账落 `ignored` 人工核销，支付页强标注网络 |

## 参考资料
- [Cloudflare Workers 官方 Next.js 指南](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)、[OpenNext Cloudflare](https://opennext.js.org/cloudflare)、[next-on-pages（维护模式）](https://github.com/cloudflare/next-on-pages)
- [Next.js 16 发布](https://nextjs.org/blog/next-16)、[Custom Worker（scheduled handler）](https://opennext.js.org/cloudflare/howtos/custom-worker)
- [Workers node:crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/)、[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)、[Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Drizzle × D1](https://orm.drizzle.team/docs/sqlite/connect-cloudflare-d1)、[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [TronGrid rate limits](https://developers.tron.network/reference/rate-limits)、[TRC20 交易查询](https://developers.tron.network/v4.0/docs/get-trc20-transaction-history)、[BSC USDT 合约(BscScan)](https://bscscan.com/token/0x55d398326f99059ff775485246999027b3197955)
- [Etherscan API V2 多链](https://info.etherscan.com/etherscan-api-v2-multichain/)、[tokentx 端点](https://docs.etherscan.io/api-reference/endpoint/tokentx)
- [Binance Pay 文档](https://developers.binance.com/docs/binance-pay)、[Merchant Webhooks](https://merchant.binance.com/en/docs/functionalities/webhooks)
- [dujiaoka（已归档，转向 Dujiao-Next）](https://github.com/assimon/dujiaoka)、[acg-faka（二次元发卡）](https://github.com/lizhipay/acg-faka)
