import { and, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { cards, type Order } from "@/db/schema";
import { decryptSecret } from "@/lib/crypto";

/**
 * 为订单分配 quantity 张卡密。
 * 先选候选，再用「仅当仍 available」的条件更新占用，最后按 order_id 计数校验，
 * 防并发抢占导致的超卖/少发（D1 写入串行化 + 条件更新 + 计数复核）。
 */
export async function allocateCards(
  db: DB,
  order: Order,
): Promise<{ ok: boolean; cardIds: number[] }> {
  const soldAt = Date.now();
  // 规格条件必须分支拼接：单规格订单锁 variant_id IS NULL 卡池，多规格订单锁同规格卡池。
  // 绝不能写成 `variant_id = ${null}`（SQL 里恒假 → 单规格订单永远发不出货）。
  const variantCond =
    order.variantId == null
      ? sql`AND variant_id IS NULL`
      : sql`AND variant_id = ${order.variantId}`;
  // 单条原子 UPDATE + RETURNING：D1 写入串行化，天然避免并发惊群/超卖，
  // RETURNING 行数即实际占用数（不依赖 meta.changes）。
  const rows = await db.all<{ id: number }>(sql`
    UPDATE cards SET status = 'sold', order_id = ${order.id}, sold_at = ${soldAt}
    WHERE id IN (
      SELECT id FROM cards
      WHERE product_id = ${order.productId} AND status = 'available' ${variantCond}
      ORDER BY id LIMIT ${order.quantity}
    ) RETURNING id`);

  if (rows.length !== order.quantity) {
    // 库存不足：回滚本次占用（以 order_id + sold_at 精确定位本单）
    await db.run(sql`
      UPDATE cards SET status = 'available', order_id = NULL, sold_at = NULL
      WHERE order_id = ${order.id} AND sold_at = ${soldAt} AND status = 'sold'`);
    return { ok: false, cardIds: [] };
  }
  return { ok: true, cardIds: rows.map((r) => r.id) };
}

/** 取订单已分配卡密的明文（AES-GCM 解密），用于展示与邮件。 */
export async function getOrderCardContents(
  db: DB,
  orderId: number,
  cardKey: string,
): Promise<string[]> {
  const rows = await db.select().from(cards).where(eq(cards.orderId, orderId));
  const out: string[] = [];
  for (const c of rows) {
    try {
      out.push(await decryptSecret(c.contentEnc, cardKey));
    } catch {
      out.push("[解密失败，请联系客服]");
    }
  }
  return out;
}

/** 可用库存计数（按规格：variantId 省略/为空时计单规格卡池 variant_id IS NULL）。 */
export async function countAvailable(
  db: DB,
  productId: number,
  variantId?: number | null,
): Promise<number> {
  const rows = await db
    .select({ id: cards.id })
    .from(cards)
    .where(
      and(
        eq(cards.productId, productId),
        eq(cards.status, "available"),
        variantId == null ? isNull(cards.variantId) : eq(cards.variantId, variantId),
      ),
    );
  return rows.length;
}
