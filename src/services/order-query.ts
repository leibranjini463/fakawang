import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, type Order } from "@/db/schema";
import { getEnv } from "@/lib/cf";
import { verifyPassword } from "@/lib/crypto";
import { getOrderCardContents } from "./delivery";

export interface OrderView {
  order: Order;
  cards?: string[];
}

/** 双因子查单：订单号 + 邮箱（+可选查询密码）。命中且已发货则附带解密卡密。 */
export async function queryOrder(
  orderNo: string,
  email: string,
  queryPass?: string,
): Promise<OrderView | null> {
  const db = await getDb();
  const order = (
    await db
      .select()
      .from(orders)
      .where(and(eq(orders.orderNo, orderNo.trim()), eq(orders.contactEmail, email.trim())))
      .limit(1)
  )[0];
  if (!order) return null;

  if (order.queryPassHash) {
    if (!queryPass || !(await verifyPassword(queryPass, order.queryPassHash))) return null;
  }

  let cards: string[] | undefined;
  if (order.status === "delivered") {
    const env = await getEnv();
    cards = await getOrderCardContents(db, order.id, env.CARD_ENC_KEY);
  }
  return { order, cards };
}

/** 仅按订单号取订单（用于支付页 SSR，不含卡密）。 */
export async function getOrderByNo(orderNo: string): Promise<Order | null> {
  const db = await getDb();
  const order = (
    await db.select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1)
  )[0];
  return order ?? null;
}
