import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = () => Date.now();

/* ============================ 分类 ============================ */
export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug)],
);

/* ============================ 商品 ============================ */
export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description").notNull().default(""),
    imageKey: text("image_key"),
    priceCents: integer("price_cents").notNull(),
    originalPriceCents: integer("original_price_cents"),
    deliveryType: text("delivery_type", { enum: ["auto", "manual"] })
      .notNull()
      .default("auto"),
    buyMin: integer("buy_min").notNull().default(1),
    buyMax: integer("buy_max").notNull().default(10),
    /** JSON: [{qty:number, priceCents:number}]，批发阶梯价（可空；多规格商品忽略） */
    wholesaleTiers: text("wholesale_tiers"),
    /** 是否多规格：true 时 priceCents 表示「起价」(启用规格最小价)，实际售价按所选规格 */
    hasVariants: integer("has_variants", { mode: "boolean" }).notNull().default(false),
    stockAlertThreshold: integer("stock_alert_threshold").notNull().default(10),
    salesCount: integer("sales_count").notNull().default(0),
    /** 展示销量基数（虚拟偏移，运营用） */
    salesBase: integer("sales_base").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex("products_slug_uq").on(t.slug),
    index("products_cat_idx").on(t.categoryId, t.isEnabled, t.sortOrder),
  ],
);

/* ======================= 商品规格（单维度 SKU）======================= */
export const productVariants = sqliteTable(
  "product_variants",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    /** 规格名，如「月卡」「100 元档」 */
    name: text("name").notNull(),
    priceCents: integer("price_cents").notNull(),
    originalPriceCents: integer("original_price_cents"),
    sortOrder: integer("sort_order").notNull().default(0),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("product_variants_idx").on(t.productId, t.isEnabled, t.sortOrder)],
);

/* ============================ 卡密 ============================ */
export const cards = sqliteTable(
  "cards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id),
    /** 所属规格：多规格商品的卡非空，单规格商品为 NULL */
    variantId: integer("variant_id"),
    /** AES-256-GCM 密文：v1:base64(iv‖ct‖tag) */
    contentEnc: text("content_enc").notNull(),
    /** SHA-256(明文规范化) 去重用 */
    contentHash: text("content_hash").notNull(),
    /** 脱敏预览（卡密预选展示，可空） */
    preview: text("preview"),
    status: text("status", { enum: ["available", "sold", "disabled"] })
      .notNull()
      .default("available"),
    orderId: integer("order_id"),
    batchId: text("batch_id"),
    soldAt: integer("sold_at"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex("cards_dedupe_uq").on(t.productId, t.contentHash),
    index("cards_alloc_idx").on(t.productId, t.variantId, t.status),
    index("cards_order_idx").on(t.orderId),
  ],
);

/* ============================ 订单 ============================ */
export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    orderNo: text("order_no").notNull(),
    productId: integer("product_id").notNull(),
    productName: text("product_name").notNull(),
    /** 规格快照：多规格订单非空，单规格订单为 NULL */
    variantId: integer("variant_id"),
    variantName: text("variant_name"),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    payableCents: integer("payable_cents").notNull(),
    couponId: integer("coupon_id"),
    contactEmail: text("contact_email").notNull(),
    /** 用户自设查询密码的哈希（可空） */
    queryPassHash: text("query_pass_hash"),
    status: text("status", {
      enum: ["pending", "paid", "delivered", "expired", "closed", "manual_review"],
    })
      .notNull()
      .default("pending"),
    paymentProvider: text("payment_provider"),
    /** 'CNY' | 'USDT-TRC20' | 'USDT-POLYGON' | 'USDT-ARBITRUM' 等 */
    payCurrency: text("pay_currency"),
    /** 应付的渠道金额（如 USDT micro 面值，字符串存大数） */
    payAmount: text("pay_amount"),
    providerTradeNo: text("provider_trade_no"),
    paidAt: integer("paid_at"),
    deliveredAt: integer("delivered_at"),
    expiresAt: integer("expires_at").notNull(),
    ip: text("ip"),
    ua: text("ua"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex("orders_no_uq").on(t.orderNo),
    index("orders_email_idx").on(t.contactEmail, t.createdAt),
    index("orders_expiry_idx").on(t.status, t.expiresAt),
    index("orders_provider_idx").on(t.status, t.paymentProvider),
  ],
);

/* ==================== 支付事件（幂等/审计）==================== */
export const paymentEvents = sqliteTable(
  "payment_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").notNull(),
    /** 幂等键：链上 chain+txHash / 渠道 tradeNo+status / webhook bizId */
    eventId: text("event_id").notNull(),
    orderId: integer("order_id"),
    orderNo: text("order_no"),
    kind: text("kind", { enum: ["callback", "poll"] }).notNull(),
    rawPayload: text("raw_payload"),
    result: text("result", {
      enum: ["processed", "duplicate", "ignored", "failed"],
    }).notNull(),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("payment_events_uq").on(t.provider, t.eventId)],
);

/* ============== USDT 唯一金额占位池（多链）============== */
export const usdtAmountLocks = sqliteTable(
  "usdt_amount_locks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    chain: text("chain", { enum: ["TRC20", "POLYGON", "ARBITRUM"] }).notNull(),
    address: text("address").notNull(),
    /** 面值统一按 1e-6 存（与链上 decimals 解耦） */
    amountMicro: integer("amount_micro").notNull(),
    orderId: integer("order_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
    released: integer("released", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex("usdt_lock_order_uq").on(t.orderId),
    // 部分唯一索引：同链同地址下，未释放的金额唯一 → INSERT 冲突即占位失败
    uniqueIndex("usdt_lock_amount_uq")
      .on(t.chain, t.address, t.amountMicro)
      .where(sql`released = 0`),
  ],
);

/* ========= 支付宝个人码 唯一金额占位池（安卓通知监听）========= */
export const alipayAmountLocks = sqliteTable(
  "alipay_amount_locks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** 收款账号标识：支持多收款码/多台监听手机并存 */
    account: text("account").notNull(),
    /** 实际应付金额（分）= 订单金额 + 唯一尾数 */
    amountCents: integer("amount_cents").notNull(),
    orderId: integer("order_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
    released: integer("released", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [
    uniqueIndex("alipay_lock_order_uq").on(t.orderId),
    // 部分唯一索引：同收款账号下，未释放的金额唯一 → INSERT 冲突即占位失败
    uniqueIndex("alipay_lock_amount_uq")
      .on(t.account, t.amountCents)
      .where(sql`released = 0`),
  ],
);

/* ============================ 优惠券 ============================ */
export const coupons = sqliteTable(
  "coupons",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    code: text("code").notNull(),
    type: text("type", { enum: ["fixed", "percent"] }).notNull(),
    /** fixed=抵扣分；percent=百分比(0-100) */
    value: integer("value").notNull(),
    /** 限定商品（空=全场） */
    productId: integer("product_id"),
    minAmountCents: integer("min_amount_cents").notNull().default(0),
    maxUses: integer("max_uses").notNull().default(0),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: integer("starts_at"),
    expiresAt: integer("expires_at"),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("coupons_code_uq").on(t.code)],
);

export const couponUsages = sqliteTable(
  "coupon_usages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    couponId: integer("coupon_id").notNull(),
    orderId: integer("order_id").notNull(),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("coupon_usages_order_uq").on(t.orderId)],
);

/* ==================== 支付渠道配置 ==================== */
export const paymentChannels = sqliteTable(
  "payment_channels",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider").notNull(),
    displayName: text("display_name").notNull(),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    /** JSON：仅非敏感配置（网关地址、pid、收款地址、汇率、启用链等） */
    config: text("config").notNull().default("{}"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("payment_channels_uq").on(t.provider)],
);

/* ============================ 管理员 ============================ */
export const admins = sqliteTable(
  "admins",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    /** pbkdf2$sha256$<iters>$<saltB64>$<hashB64> */
    passwordHash: text("password_hash").notNull(),
    totpSecret: text("totp_secret"),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: integer("locked_until"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [uniqueIndex("admins_username_uq").on(t.username)],
);

export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    adminId: integer("admin_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
    ip: text("ip"),
    ua: text("ua"),
    createdAt: integer("created_at").notNull().$defaultFn(now),
  },
  (t) => [index("admin_sessions_exp_idx").on(t.expiresAt)],
);

/* ============================ 系统设置 ============================ */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull().$defaultFn(now),
});

/* ============================ 公告 ============================ */
export const announcements = sqliteTable(
  "announcements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    type: text("type", { enum: ["popup", "bar", "list"] })
      .notNull()
      .default("list"),
    isPinned: integer("is_pinned", { mode: "boolean" }).notNull().default(false),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    startsAt: integer("starts_at"),
    endsAt: integer("ends_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at").notNull().$defaultFn(now),
    updatedAt: integer("updated_at").notNull().$defaultFn(now),
  },
  (t) => [index("announcements_enabled_idx").on(t.isEnabled, t.sortOrder)],
);

/* ============================ 类型导出 ============================ */
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type UsdtAmountLock = typeof usdtAmountLocks.$inferSelect;
export type AlipayAmountLock = typeof alipayAmountLocks.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type PaymentChannel = typeof paymentChannels.$inferSelect;
export type Admin = typeof admins.$inferSelect;
export type AdminSession = typeof adminSessions.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
