import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { paymentChannels, type Order } from "@/db/schema";
import { getEnv } from "@/lib/cf";
import { safeJson } from "@/lib/utils";
import { getProvider } from "@/payments/registry";
import type { CreatePaymentResult, PaymentContext } from "@/payments/types";

export function siteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

export async function buildPaymentContext(): Promise<PaymentContext> {
  const db = await getDb();
  const env = await getEnv();
  return { db, kv: env.FAKA_KV, env, baseUrl: siteBaseUrl() };
}

export async function getChannelConfig(
  ctx: PaymentContext,
  code: string,
): Promise<Record<string, unknown>> {
  const ch = (
    await ctx.db.select().from(paymentChannels).where(eq(paymentChannels.provider, code)).limit(1)
  )[0];
  return safeJson<Record<string, unknown>>(ch?.config ?? null, {});
}

export async function createPaymentForOrder(order: Order): Promise<CreatePaymentResult> {
  const ctx = await buildPaymentContext();
  const code = order.paymentProvider || "";
  const provider = getProvider(code);
  if (!provider) throw new Error("支付方式不可用");

  // 缓存支付创建结果，避免订单页刷新时对外部渠道重复建单（如 Binance）
  const cacheKey = `pay:${order.orderNo}`;
  const cached = await ctx.kv.get(cacheKey);
  if (cached) return JSON.parse(cached) as CreatePaymentResult;

  const config = await getChannelConfig(ctx, code);
  const result = await provider.createPayment(ctx, order, config);
  const ttl = Math.max(60, Math.ceil((order.expiresAt - Date.now()) / 1000));
  try {
    await ctx.kv.put(cacheKey, JSON.stringify(result), { expirationTtl: ttl });
  } catch {}
  return result;
}
