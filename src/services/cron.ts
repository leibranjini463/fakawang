import { eq } from "drizzle-orm";
import { orders, type Order } from "@/db/schema";
import { getSettings } from "@/lib/settings";
import { getProvider } from "@/payments/registry";
import { closeExpiredOrders } from "./expiry";
import { sendStockAlert } from "./mail/mailer";
import { buildPaymentContext, getChannelConfig } from "./pay";
import { settle } from "./settlement";
import { findLowStock } from "./stock-alert";

/** 对所有 pending 订单按渠道分组轮询到账（USDT 必用，其它兜底对账）。 */
export async function runPaymentPolls(): Promise<{ provider: string; settled: number }[]> {
  const ctx = await buildPaymentContext();
  const pending = await ctx.db.select().from(orders).where(eq(orders.status, "pending"));
  const byProvider: Record<string, Order[]> = {};
  for (const o of pending) {
    if (o.paymentProvider) (byProvider[o.paymentProvider] ??= []).push(o);
  }
  const summary: { provider: string; settled: number }[] = [];
  for (const code of Object.keys(byProvider)) {
    const provider = getProvider(code);
    if (!provider?.poll) continue;
    const config = await getChannelConfig(ctx, code);
    try {
      const notifs = await provider.poll(ctx, byProvider[code], config);
      let settled = 0;
      for (const n of notifs) {
        const r = await settle(ctx, n, code, "poll");
        if (r === "processed" || r === "manual_review") settled++;
      }
      summary.push({ provider: code, settled });
    } catch (e) {
      console.log("[poll:error]", code, e);
    }
  }
  return summary;
}

function extractEmail(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1] : from.trim();
}

/** Cron 入口：每分钟轮询+过期；整点附加库存告警。 */
export async function runCronTick(cron?: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const ctx = await buildPaymentContext();

  out.polls = await runPaymentPolls();
  out.expired = await closeExpiredOrders(ctx.db);

  if (cron === "0 * * * *") {
    const low = await findLowStock(ctx.db);
    out.lowStock = low.length;
    if (low.length && ctx.env.MAIL_FROM) {
      const s = await getSettings();
      await sendStockAlert(ctx.env, extractEmail(ctx.env.MAIL_FROM), low, s.siteName);
    }
  }
  return out;
}
