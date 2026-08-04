import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  announcements,
  categories,
  productVariants,
  products,
  type Announcement,
  type Category,
  type Product,
  type ProductVariant,
} from "@/db/schema";

export interface ProductWithStock {
  product: Product;
  stock: number;
}

export interface VariantWithStock {
  variant: ProductVariant;
  stock: number;
}

export async function getEnabledCategories(): Promise<Category[]> {
  const db = await getDb();
  return db
    .select()
    .from(categories)
    .where(eq(categories.isEnabled, true))
    .orderBy(asc(categories.sortOrder), asc(categories.id));
}

async function stockMap(db: Awaited<ReturnType<typeof getDb>>): Promise<Map<number, number>> {
  const r = (await db.run(
    sql`SELECT product_id AS pid, COUNT(*) AS c FROM cards WHERE status = 'available' GROUP BY product_id`,
  )) as unknown as { results?: Array<{ pid: number; c: number }> };
  const m = new Map<number, number>();
  for (const row of r.results ?? []) m.set(row.pid, row.c);
  return m;
}

/** 某商品各规格的可用库存（键为 variantId，仅统计非空 variant_id 的卡）。 */
async function variantStockMap(
  db: Awaited<ReturnType<typeof getDb>>,
  productId: number,
): Promise<Map<number, number>> {
  const r = (await db.run(
    sql`SELECT variant_id AS vid, COUNT(*) AS c FROM cards WHERE status = 'available' AND product_id = ${productId} AND variant_id IS NOT NULL GROUP BY variant_id`,
  )) as unknown as { results?: Array<{ vid: number; c: number }> };
  const m = new Map<number, number>();
  for (const row of r.results ?? []) m.set(row.vid, row.c);
  return m;
}

export type ProductSort = "default" | "sales" | "price_asc" | "price_desc" | "new";

export async function getProducts(opts: {
  categorySlug?: string;
  sort?: ProductSort;
  q?: string;
}): Promise<ProductWithStock[]> {
  const db = await getDb();
  const conds = [eq(products.isEnabled, true)];
  if (opts.categorySlug) {
    const cat = (
      await db.select().from(categories).where(eq(categories.slug, opts.categorySlug)).limit(1)
    )[0];
    if (cat) conds.push(eq(products.categoryId, cat.id));
  }
  if (opts.q) conds.push(like(products.name, `%${opts.q}%`));

  const order =
    opts.sort === "sales"
      ? [desc(sql`sales_count + sales_base`)]
      : opts.sort === "price_asc"
        ? [asc(products.priceCents)]
        : opts.sort === "price_desc"
          ? [desc(products.priceCents)]
          : opts.sort === "new"
            ? [desc(products.id)]
            : [asc(products.sortOrder), desc(products.id)];

  const rows = await db
    .select()
    .from(products)
    .where(and(...conds))
    .orderBy(...order);

  const stocks = await stockMap(db);
  return rows.map((p) => ({ product: p, stock: stocks.get(p.id) ?? 0 }));
}

export async function getProductBySlug(
  slug: string,
): Promise<{
  product: Product;
  stock: number;
  variants: VariantWithStock[];
  category: Category | null;
} | null> {
  const db = await getDb();
  // 容错：CF Worker 路由可能传入未解码的 slug（中文被 %XX 编码），解码后再查
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {}
  const product = (
    await db.select().from(products).where(eq(products.slug, decoded)).limit(1)
  )[0];
  if (!product || !product.isEnabled) return null;
  const stocks = await stockMap(db);
  const category =
    (await db.select().from(categories).where(eq(categories.id, product.categoryId)).limit(1))[0] ??
    null;

  let variants: VariantWithStock[] = [];
  if (product.hasVariants) {
    const vs = await db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.productId, product.id), eq(productVariants.isEnabled, true)))
      .orderBy(asc(productVariants.sortOrder), asc(productVariants.id));
    const vStock = await variantStockMap(db, product.id);
    variants = vs.map((v) => ({ variant: v, stock: vStock.get(v.id) ?? 0 }));
  }

  return { product, stock: stocks.get(product.id) ?? 0, variants, category };
}

function activeCond() {
  const now = Date.now();
  return and(
    eq(announcements.isEnabled, true),
    or(sql`starts_at IS NULL`, sql`starts_at <= ${now}`),
    or(sql`ends_at IS NULL`, sql`ends_at >= ${now}`),
  );
}

export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const db = await getDb();
  return db
    .select()
    .from(announcements)
    .where(activeCond())
    .orderBy(desc(announcements.isPinned), asc(announcements.sortOrder), desc(announcements.id));
}

export async function listAnnouncements(): Promise<Announcement[]> {
  const db = await getDb();
  return db
    .select()
    .from(announcements)
    .where(eq(announcements.isEnabled, true))
    .orderBy(desc(announcements.isPinned), asc(announcements.sortOrder), desc(announcements.id));
}

export async function getAnnouncement(id: number): Promise<Announcement | null> {
  const db = await getDb();
  return (await db.select().from(announcements).where(eq(announcements.id, id)).limit(1))[0] ?? null;
}
