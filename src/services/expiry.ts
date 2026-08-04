import { sql } from "drizzle-orm";
import type { DB } from "@/db";

interface D1Meta {
  meta?: { changes?: number };
}

/** 关闭过期未支付订单，并释放其 USDT / 支付宝金额锁。返回关闭数量。 */
export async function closeExpiredOrders(db: DB): Promise<number> {
  const now = Date.now();
  const upd = (await db.run(sql`
    UPDATE orders SET status = 'expired', updated_at = ${now}
    WHERE status = 'pending' AND expires_at < ${now}`)) as unknown as D1Meta;
  await db.run(sql`
    UPDATE usdt_amount_locks SET released = 1
    WHERE released = 0 AND expires_at < ${now}`);
  await db.run(sql`
    UPDATE alipay_amount_locks SET released = 1
    WHERE released = 0 AND expires_at < ${now}`);
  return upd.meta?.changes ?? 0;
}
