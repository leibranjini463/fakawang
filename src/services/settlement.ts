import { and, eq, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { alipayAmountLocks, orders, paymentEvents, products, usdtAmountLocks } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import type { PaymentContext, VerifiedNotification } from "@/payments/types";
import { allocateCards, getOrderCardContents } from "./delivery";
import { sendDeliveryEmail } from "./mail/mailer";

interface D1Meta {
  meta?: { changes?: number };
}

export type SettleResult =
  | "processed"
  | "duplicate"
  | "ignored"
  | "manual_review"
  | "failed";

type EventResult = "processed" | "duplicate" | "ignored" | "failed";

async function markEvent(
  db: DB,
  provider: string,
  eventId: string,
  result: EventResult,
): Promise<void> {
  await db
    .update(paymentEvents)
    .set({ result })
    .where(and(eq(paymentEvents.provider, provider), eq(paymentEvents.eventId, eventId)));
}

/**
 * 统一结算管线（所有渠道共用）：
 * 幂等门(payment_events UNIQUE) → 金额校验 → CAS 置 paid → 原子发货 → 发信。
 */
export async function settle(
  ctx: PaymentContext,
  n: VerifiedNotification,
  provider: string,
  kind: "callback" | "poll",
): Promise<SettleResult> {
  const db = ctx.db;
  const now = Date.now();

  // 1) 幂等门：命中 UNIQUE(provider,event_id) 即重复入账
  try {
    await db.insert(paymentEvents).values({
      provider,
      eventId: n.eventId,
      orderNo: n.orderNo,
      kind,
      rawPayload: n.raw?.slice(0, 4000),
      result: "processed",
    });
  } catch {
    return "duplicate";
  }

  const order = (
    await db.select().from(orders).where(eq(orders.orderNo, n.orderNo)).limit(1)
  )[0];
  if (!order) {
    await markEvent(db, provider, n.eventId, "ignored");
    return "ignored";
  }

  // 2) 金额校验（整数比较，少付即忽略）
  const expected = n.paidCurrency.startsWith("USDT")
    ? Number(order.payAmount || "0")
    : order.payableCents;
  if (expected > 0 && n.paidValue < expected) {
    await markEvent(db, provider, n.eventId, "ignored");
    return "ignored";
  }

  // 3) CAS：仅 pending → paid
  const upd = (await db.run(sql`
    UPDATE orders SET status = 'paid', paid_at = ${now}, payment_provider = ${provider},
      provider_trade_no = ${n.providerTradeNo}, updated_at = ${now}
    WHERE order_no = ${n.orderNo} AND status = 'pending'`)) as unknown as D1Meta;

  if ((upd.meta?.changes ?? 0) === 0) {
    // 非 pending：已过期后到账 → 人工复核；否则视为重复
    if (order.status === "expired" || order.status === "closed") {
      await db
        .update(orders)
        .set({ status: "manual_review", updatedAt: now })
        .where(eq(orders.orderNo, n.orderNo));
      await releaseLock(db, order.id);
      await markEvent(db, provider, n.eventId, "ignored");
      return "manual_review";
    }
    await markEvent(db, provider, n.eventId, "duplicate");
    return "duplicate";
  }

  await releaseLock(db, order.id);

  // 4) 发货（发货类型以商品为准）
  const prod = (
    await db
      .select({ deliveryType: products.deliveryType })
      .from(products)
      .where(eq(products.id, order.productId))
      .limit(1)
  )[0];
  if ((prod?.deliveryType ?? "auto") === "auto") {
    const alloc = await allocateCards(db, order);
    if (!alloc.ok) {
      // 付款成功但库存不足 → 人工补单
      await db
        .update(orders)
        .set({ status: "manual_review", updatedAt: now })
        .where(eq(orders.orderNo, n.orderNo));
      return "manual_review";
    }
    await db.batch([
      db
        .update(orders)
        .set({ status: "delivered", deliveredAt: now, updatedAt: now })
        .where(eq(orders.orderNo, n.orderNo)),
      db
        .update(products)
        .set({ salesCount: sql`sales_count + ${order.quantity}` })
        .where(eq(products.id, order.productId)),
    ]);

    // 发货邮件（失败不阻塞）
    try {
      const contents = await getOrderCardContents(db, order.id, ctx.env.CARD_ENC_KEY);
      const s = await getSettings();
      await sendDeliveryEmail(ctx.env, { ...order, status: "delivered" }, contents, s.siteName);
    } catch (e) {
      console.log("[settle:mail]", e);
    }
    return "processed";
  }

  // 人工发货类型：转人工
  await db
    .update(orders)
    .set({ status: "manual_review", updatedAt: now })
    .where(eq(orders.orderNo, n.orderNo));
  return "manual_review";
}

async function releaseLock(db: DB, orderId: number): Promise<void> {
  await db
    .update(usdtAmountLocks)
    .set({ released: true })
    .where(eq(usdtAmountLocks.orderId, orderId));
  await db
    .update(alipayAmountLocks)
    .set({ released: true })
    .where(eq(alipayAmountLocks.orderId, orderId));
}
