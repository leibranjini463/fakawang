import { sql } from "drizzle-orm";
import type { DB } from "@/db";

/** 找出可用库存低于阈值的自动发货商品。 */
export async function findLowStock(db: DB): Promise<{ name: string; stock: number }[]> {
  const r = (await db.run(sql`
    SELECT p.name AS name, p.stock_alert_threshold AS threshold,
      (SELECT COUNT(*) FROM cards c WHERE c.product_id = p.id AND c.status = 'available') AS stock
    FROM products p
    WHERE p.is_enabled = 1 AND p.delivery_type = 'auto'`)) as unknown as {
    results?: Array<{ name: string; threshold: number; stock: number }>;
  };
  return (r.results ?? [])
    .filter((x) => x.stock <= x.threshold)
    .map((x) => ({ name: x.name, stock: x.stock }));
}
