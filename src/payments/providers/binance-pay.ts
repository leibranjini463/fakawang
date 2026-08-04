import { createHmac, createVerify } from "node:crypto";
import { eq } from "drizzle-orm";
import { orders } from "@/db/schema";
import type { PaymentProvider, VerifiedNotification } from "../types";

const BASE = "https://bpay.binanceapi.com";

function hmac512(payload: string, secret: string): string {
  return createHmac("sha512", secret).update(payload).digest("hex").toUpperCase();
}

function randNonce(len = 32): string {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const r = crypto.getRandomValues(new Uint8Array(len));
  let s = "";
  for (let i = 0; i < len; i++) s += c[r[i] % c.length];
  return s;
}

function pubToPem(cert: string): string {
  if (cert.includes("BEGIN")) return cert;
  const body = cert.replace(/\s+/g, "").match(/.{1,64}/g)?.join("\n") ?? cert;
  return `-----BEGIN PUBLIC KEY-----\n${body}\n-----END PUBLIC KEY-----`;
}

async function signedFetch(
  path: string,
  body: Record<string, unknown>,
  env: CloudflareEnv,
): Promise<Record<string, unknown>> {
  const ts = Date.now().toString();
  const nonce = randNonce();
  const raw = JSON.stringify(body);
  const signature = hmac512(`${ts}\n${nonce}\n${raw}\n`, env.BINANCE_SECRET || "");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "BinancePay-Timestamp": ts,
      "BinancePay-Nonce": nonce,
      "BinancePay-Certificate-SN": env.BINANCE_API_KEY || "",
      "BinancePay-Signature": signature,
    },
    body: raw,
  });
  return (await res.json()) as Record<string, unknown>;
}

/** 拉取 Binance 商户 webhook 验签公钥（按 SN 缓存到 KV）。 */
async function getCertPublic(ctx: {
  env: CloudflareEnv;
  kv: KVNamespace;
}): Promise<string | null> {
  const cached = await ctx.kv.get("binance:cert");
  if (cached) return cached;
  const resp = await signedFetch("/binancepay/openapi/certificates", {}, ctx.env);
  const arr = resp["data"] as Array<{ certPublic: string }> | undefined;
  const cert = arr?.[0]?.certPublic;
  if (!cert) return null;
  await ctx.kv.put("binance:cert", cert, { expirationTtl: 6 * 3600 });
  return cert;
}

/**
 * Binance Pay 商户 API v3。
 * config: { }；secrets: env.BINANCE_API_KEY / env.BINANCE_SECRET
 * 下单时金额以 USDT 计（checkout 已按汇率把 payAmount 存为 micro）。
 */
export const binancePayProvider: PaymentProvider = {
  code: "binance_pay",

  async createPayment(ctx, order) {
    const amountUsdt = Number(order.payAmount || "0") / 1e6;
    const resp = await signedFetch(
      "/binancepay/openapi/v3/order",
      {
        env: { terminalType: "WEB" },
        merchantTradeNo: order.orderNo,
        orderAmount: Number(amountUsdt.toFixed(8)),
        currency: "USDT",
        description: order.productName.slice(0, 128) || "virtual goods",
        returnUrl: `${ctx.baseUrl}/order/${order.orderNo}`,
        cancelUrl: `${ctx.baseUrl}/order/${order.orderNo}`,
        webhookUrl: `${ctx.baseUrl}/api/pay/notify/binance_pay`,
      },
      ctx.env,
    );
    if (resp["status"] !== "SUCCESS") {
      throw new Error(`binance order failed: ${JSON.stringify(resp)}`);
    }
    const data = resp["data"] as Record<string, string>;
    return {
      kind: "checkout",
      url: data.checkoutUrl,
      qrContent: data.qrcodeLink,
      deeplink: data.deeplink || data.universalUrl,
    };
  },

  async handleNotify(ctx, req) {
    const rawBody = await req.text();
    const ts = req.headers.get("Binancepay-Timestamp") || "";
    const nonce = req.headers.get("Binancepay-Nonce") || "";
    const sig = req.headers.get("Binancepay-Signature") || "";
    const ackOk = new Response(JSON.stringify({ returnCode: "SUCCESS", returnMessage: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const ackFail = new Response(JSON.stringify({ returnCode: "FAIL", returnMessage: "invalid" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });

    // 时间戳窗口 ±5min
    if (!ts || Math.abs(Date.now() - Number(ts)) > 5 * 60 * 1000) {
      return { notification: null, ack: ackFail };
    }
    // nonce 防重放
    const nkey = `binance:nonce:${nonce}`;
    if (nonce && (await ctx.kv.get(nkey))) return { notification: null, ack: ackFail };

    const cert = await getCertPublic(ctx);
    const payload = `${ts}\n${nonce}\n${rawBody}\n`;
    const ok =
      cert &&
      (() => {
        try {
          return createVerify("RSA-SHA256").update(payload).verify(pubToPem(cert), sig, "base64");
        } catch {
          return false;
        }
      })();
    if (!ok) return { notification: null, ack: ackFail };
    if (nonce) await ctx.kv.put(nkey, "1", { expirationTtl: 600 });

    const evt = JSON.parse(rawBody) as { bizType?: string; bizStatus?: string; data?: string };
    if (evt.bizType !== "PAY" || evt.bizStatus !== "PAY_SUCCESS") {
      return { notification: null, ack: ackOk };
    }
    const inner = JSON.parse(evt.data || "{}") as {
      merchantTradeNo?: string;
      orderAmount?: string;
      transactionId?: string;
    };
    const orderNo = inner.merchantTradeNo || "";
    const order = (
      await ctx.db.select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1)
    )[0];
    if (!order) return { notification: null, ack: ackOk };

    const notification: VerifiedNotification = {
      orderNo,
      providerTradeNo: inner.transactionId || "",
      eventId: `binance:${inner.transactionId || orderNo}`,
      paidCurrency: "USDT",
      paidValue: Math.round(parseFloat(inner.orderAmount || "0") * 1e6),
      raw: rawBody,
    };
    return { notification, ack: ackOk };
  },
};
