import { eq } from "drizzle-orm";
import { orders } from "@/db/schema";
import type { PaymentProvider } from "../types";

/**
 * 开发/联调用 Mock 驱动：createPayment 给出一个「确认支付」链接，
 * 点击即触发 notify 结算，用来端到端验证下单→发货全链路，无需真实渠道。
 */
export const mockProvider: PaymentProvider = {
  code: "mock",

  async createPayment(ctx, order) {
    const confirmUrl = `${ctx.baseUrl}/api/pay/notify/mock?orderNo=${encodeURIComponent(order.orderNo)}`;
    return { kind: "mock", confirmUrl };
  },

  async handleNotify(ctx, req) {
    const url = new URL(req.url);
    const orderNo = url.searchParams.get("orderNo");
    const ack = new Response("success", { status: 200 });
    if (!orderNo) return { notification: null, ack };
    const order = (
      await ctx.db.select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1)
    )[0];
    if (!order) return { notification: null, ack };
    return {
      notification: {
        orderNo,
        providerTradeNo: "MOCK-" + orderNo,
        eventId: "mock:" + orderNo,
        paidCurrency: "CNY",
        paidValue: order.payableCents,
        raw: "mock-confirm",
      },
      ack,
    };
  },
};
