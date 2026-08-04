"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, type DB } from "@/db";
import {
  announcements,
  cards,
  categories,
  orders,
  paymentChannels,
  productVariants,
  products,
} from "@/db/schema";
import { getEnv } from "@/lib/cf";
import { encryptSecret, randomToken, sha256Hex } from "@/lib/crypto";
import { requireAdmin } from "@/lib/session";
import { saveSettings, type SiteSettings } from "@/lib/settings";
import { allocateCards, getOrderCardContents } from "@/services/delivery";
import { sendDeliveryEmail } from "@/services/mail/mailer";
import { getSettings } from "@/lib/settings";

function s(fd: FormData, k: string): string {
  return String(fd.get(k) || "").trim();
}
function num(fd: FormData, k: string, def = 0): number {
  const n = parseInt(s(fd, k), 10);
  return Number.isFinite(n) ? n : def;
}
function cents(fd: FormData, k: string): number {
  const n = parseFloat(s(fd, k));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
function bool(fd: FormData, k: string): boolean {
  const v = s(fd, k);
  return v === "on" || v === "1" || v === "true";
}
function slugify(input: string): string {
  // slug 只保留 ASCII：中文等非 ASCII 会导致 Cloudflare Worker 路由解码不匹配而 404。
  // 纯非 ASCII 名称（如全中文）回退到随机 token，保证 URL 始终可用。
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || randomToken(6)
  );
}
function maskCard(line: string): string {
  if (line.length <= 8) return "****";
  return `${line.slice(0, 4)}****${line.slice(-2)}`;
}

/**
 * 规格增删改后重算商品的多规格标志与「起价」冗余。
 * hasVariants 以「是否存在任意规格行」为准（非「是否存在启用规格」）——
 * 否则全部下架时会静默退回单规格模式去卖不存在的 variant_id IS NULL 卡。
 * 起价取启用规格最小价；无启用规格时保留原 priceCents 不变（商品会因无库存售罄）。
 */
async function syncProductVariantState(db: DB, productId: number): Promise<void> {
  const vs = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId));
  const enabledPrices = vs.filter((v) => v.isEnabled).map((v) => v.priceCents);
  const patch: { hasVariants: boolean; priceCents?: number; updatedAt: number } = {
    hasVariants: vs.length > 0,
    updatedAt: Date.now(),
  };
  if (enabledPrices.length > 0) patch.priceCents = Math.min(...enabledPrices);
  await db.update(products).set(patch).where(eq(products.id, productId));
}

/* ---------------- 分类 ---------------- */
export async function saveCategory(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  const id = num(fd, "id");
  const name = s(fd, "name");
  const slug = s(fd, "slug") || slugify(name);
  const sortOrder = num(fd, "sortOrder");
  const isEnabled = bool(fd, "isEnabled");
  if (id) {
    await db
      .update(categories)
      .set({ name, slug, sortOrder, isEnabled, updatedAt: Date.now() })
      .where(eq(categories.id, id));
  } else {
    await db.insert(categories).values({ name, slug, sortOrder, isEnabled });
  }
  revalidatePath("/admin/categories");
}
export async function deleteCategory(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  await db.delete(categories).where(eq(categories.id, num(fd, "id")));
  revalidatePath("/admin/categories");
}

/* ---------------- 商品 ---------------- */
export async function saveProduct(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  const id = num(fd, "id");
  const name = s(fd, "name");
  const values = {
    categoryId: num(fd, "categoryId"),
    name,
    slug: s(fd, "slug") || slugify(name),
    description: s(fd, "description"),
    imageKey: s(fd, "imageKey") || null,
    priceCents: cents(fd, "price"),
    originalPriceCents: s(fd, "originalPrice") ? cents(fd, "originalPrice") : null,
    deliveryType: (s(fd, "deliveryType") === "manual" ? "manual" : "auto") as "auto" | "manual",
    buyMin: num(fd, "buyMin", 1),
    buyMax: num(fd, "buyMax", 10),
    stockAlertThreshold: num(fd, "stockAlertThreshold", 10),
    salesBase: num(fd, "salesBase", 0),
    sortOrder: num(fd, "sortOrder", 0),
    isEnabled: bool(fd, "isEnabled"),
  };
  if (id) {
    await db.update(products).set({ ...values, updatedAt: Date.now() }).where(eq(products.id, id));
  } else {
    await db.insert(products).values(values);
  }
  revalidatePath("/admin/products");
  redirect("/admin/products");
}
export async function deleteProduct(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  const id = num(fd, "id");
  // 连带删规格，避免留下悬挂的 product_variants。
  await db.delete(productVariants).where(eq(productVariants.productId, id));
  await db.delete(products).where(eq(products.id, id));
  revalidatePath("/admin/products");
}

/* ---------------- 商品规格（单维度 SKU） ---------------- */
export async function saveVariant(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  const id = num(fd, "id");
  const productId = num(fd, "productId");
  if (!productId) return;
  const values = {
    productId,
    name: s(fd, "name"),
    priceCents: cents(fd, "price"),
    originalPriceCents: s(fd, "originalPrice") ? cents(fd, "originalPrice") : null,
    sortOrder: num(fd, "sortOrder", 0),
    isEnabled: bool(fd, "isEnabled"),
  };
  if (id) {
    await db
      .update(productVariants)
      .set({ ...values, updatedAt: Date.now() })
      .where(eq(productVariants.id, id));
  } else {
    await db.insert(productVariants).values(values);
  }
  await syncProductVariantState(db, productId);
  revalidatePath("/admin/products");
}

export async function deleteVariant(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  const id = num(fd, "id");
  const productId = num(fd, "productId");
  if (!id || !productId) return;
  // 有卡密或订单引用则只软删，保住卡密归属与历史订单快照。
  const refCard = (
    await db.select({ id: cards.id }).from(cards).where(eq(cards.variantId, id)).limit(1)
  )[0];
  const refOrder = (
    await db.select({ id: orders.id }).from(orders).where(eq(orders.variantId, id)).limit(1)
  )[0];
  if (refCard || refOrder) {
    await db
      .update(productVariants)
      .set({ isEnabled: false, updatedAt: Date.now() })
      .where(eq(productVariants.id, id));
  } else {
    await db.delete(productVariants).where(eq(productVariants.id, id));
  }
  await syncProductVariantState(db, productId);
  revalidatePath("/admin/products");
}

export async function toggleVariant(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  const id = num(fd, "id");
  const productId = num(fd, "productId");
  if (!id || !productId) return;
  await db
    .update(productVariants)
    .set({ isEnabled: sql`NOT is_enabled`, updatedAt: Date.now() })
    .where(eq(productVariants.id, id));
  await syncProductVariantState(db, productId);
  revalidatePath("/admin/products");
}

/* ---------------- 卡密导入 ---------------- */
export async function importCards(
  _prev: { added?: number; dup?: number; error?: string },
  fd: FormData,
): Promise<{ added?: number; dup?: number; error?: string }> {
  await requireAdmin();
  const db = await getDb();
  const env = await getEnv();
  const productId = num(fd, "productId");
  const variantId = num(fd, "variantId") || null;
  const text = String(fd.get("content") || "");
  if (!productId) return { error: "请选择商品" };

  // 多规格商品必须指定规格，否则会导入 variant_id 为空、永远卖不掉的死库存。
  const product = (
    await db.select().from(products).where(eq(products.id, productId)).limit(1)
  )[0];
  if (!product) return { error: "商品不存在" };
  let useVariantId: number | null = null;
  if (product.hasVariants) {
    if (!variantId) return { error: "该商品为多规格，请选择规格" };
    const v = (
      await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
        .limit(1)
    )[0];
    if (!v) return { error: "所选规格不存在" };
    useVariantId = variantId;
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return { error: "没有可导入的卡密" };

  const batchId = randomToken(6);
  let added = 0;
  let dup = 0;
  for (const line of lines) {
    const hash = await sha256Hex(line);
    const enc = await encryptSecret(line, env.CARD_ENC_KEY);
    const res = await db
      .insert(cards)
      .values({
        productId,
        variantId: useVariantId,
        contentEnc: enc,
        contentHash: hash,
        preview: maskCard(line),
        batchId,
      })
      .onConflictDoNothing()
      .returning({ id: cards.id });
    if (res.length) added++;
    else dup++;
  }
  revalidatePath("/admin/cards");
  return { added, dup };
}
export async function deleteUnsoldCards(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  await db
    .delete(cards)
    .where(and(eq(cards.productId, num(fd, "productId")), eq(cards.status, "available")));
  revalidatePath("/admin/cards");
}

/* ---------------- 支付渠道 ---------------- */
export async function saveChannel(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  const provider = s(fd, "provider");
  const displayName = s(fd, "displayName");
  const isEnabled = bool(fd, "isEnabled");
  const sortOrder = num(fd, "sortOrder");
  let config = s(fd, "config") || "{}";
  try {
    JSON.parse(config);
  } catch {
    config = "{}";
  }
  const existing = (
    await db.select().from(paymentChannels).where(eq(paymentChannels.provider, provider)).limit(1)
  )[0];
  if (existing) {
    await db
      .update(paymentChannels)
      .set({ displayName, isEnabled, sortOrder, config, updatedAt: Date.now() })
      .where(eq(paymentChannels.provider, provider));
  } else {
    await db.insert(paymentChannels).values({ provider, displayName, isEnabled, sortOrder, config });
  }
  revalidatePath("/admin/channels");
}

/* ---------------- 系统设置 ---------------- */
export async function saveSettingsAction(fd: FormData) {
  await requireAdmin();
  const keys: (keyof SiteSettings)[] = [
    "siteName",
    "siteDesc",
    "logoText",
    "heroTitle",
    "heroSubtitle",
    "contactUrl",
    "contactText",
    "footerText",
    "usdtRate",
    "orderExpireMinutes",
  ];
  const patch: Record<string, string> = {};
  for (const k of keys) patch[k] = s(fd, k);
  patch.maintenance = bool(fd, "maintenance") ? "1" : "0";
  await saveSettings(patch);
  revalidatePath("/admin/settings");
  revalidatePath("/");
}

/* ---------------- 公告 ---------------- */
export async function saveAnnouncement(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  const id = num(fd, "id");
  const values = {
    title: s(fd, "title"),
    content: s(fd, "content"),
    type: (["popup", "bar", "list"].includes(s(fd, "type")) ? s(fd, "type") : "list") as
      | "popup"
      | "bar"
      | "list",
    isPinned: bool(fd, "isPinned"),
    isEnabled: bool(fd, "isEnabled"),
    sortOrder: num(fd, "sortOrder"),
  };
  if (id) {
    await db.update(announcements).set({ ...values, updatedAt: Date.now() }).where(eq(announcements.id, id));
  } else {
    await db.insert(announcements).values(values);
  }
  revalidatePath("/admin/announcements");
  revalidatePath("/");
}
export async function deleteAnnouncement(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  await db.delete(announcements).where(eq(announcements.id, num(fd, "id")));
  revalidatePath("/admin/announcements");
}

/* ---------------- 订单：人工发货 / 关单 / 重发 ---------------- */
export async function manualDeliver(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  const env = await getEnv();
  const id = num(fd, "id");
  const order = (await db.select().from(orders).where(eq(orders.id, id)).limit(1))[0];
  if (!order) return;
  const prod = (
    await db.select({ deliveryType: products.deliveryType }).from(products).where(eq(products.id, order.productId)).limit(1)
  )[0];
  if ((prod?.deliveryType ?? "auto") === "auto") {
    const alloc = await allocateCards(db, order);
    if (!alloc.ok) return;
  }
  await db.batch([
    db
      .update(orders)
      .set({ status: "delivered", deliveredAt: Date.now(), updatedAt: Date.now() })
      .where(eq(orders.id, id)),
    db
      .update(products)
      .set({ salesCount: sql`sales_count + ${order.quantity}` })
      .where(eq(products.id, order.productId)),
  ]);
  try {
    const contents = await getOrderCardContents(db, order.id, env.CARD_ENC_KEY);
    const st = await getSettings();
    await sendDeliveryEmail(env, { ...order, status: "delivered" }, contents, st.siteName);
  } catch {}
  revalidatePath("/admin/orders");
}
export async function closeOrder(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  await db
    .update(orders)
    .set({ status: "closed", updatedAt: Date.now() })
    .where(eq(orders.id, num(fd, "id")));
  revalidatePath("/admin/orders");
}
export async function resendEmail(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  const env = await getEnv();
  const order = (await db.select().from(orders).where(eq(orders.id, num(fd, "id"))).limit(1))[0];
  if (!order || order.status !== "delivered") return;
  const contents = await getOrderCardContents(db, order.id, env.CARD_ENC_KEY);
  const st = await getSettings();
  await sendDeliveryEmail(env, order, contents, st.siteName);
  revalidatePath("/admin/orders");
}

/* ---------------- 启用/停用切换 ---------------- */
export async function toggleCategory(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  await db
    .update(categories)
    .set({ isEnabled: sql`NOT is_enabled`, updatedAt: Date.now() })
    .where(eq(categories.id, num(fd, "id")));
  revalidatePath("/admin/categories");
}
export async function toggleProduct(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  await db
    .update(products)
    .set({ isEnabled: sql`NOT is_enabled`, updatedAt: Date.now() })
    .where(eq(products.id, num(fd, "id")));
  revalidatePath("/admin/products");
}
export async function toggleAnnouncement(fd: FormData) {
  await requireAdmin();
  const db = await getDb();
  await db
    .update(announcements)
    .set({ isEnabled: sql`NOT is_enabled`, updatedAt: Date.now() })
    .where(eq(announcements.id, num(fd, "id")));
  revalidatePath("/admin/announcements");
  revalidatePath("/");
}
