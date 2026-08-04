import { createSign, createVerify } from "node:crypto";
import { eq } from "drizzle-orm";
import { orders } from "@/db/schema";
import { formatYuan } from "@/lib/utils";
import type { PaymentProvider, VerifiedNotification } from "../types";

const GATEWAY = "https://openapi.alipay.com/gateway.do";

/** 把裸 base64 密钥包装成 PEM。 */
function toPem(key: string, kind: "PRIVATE" | "PUBLIC"): string {
  const clean = key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const body = clean.match(/.{1,64}/g)?.join("\n") ?? clean;
  const label = kind === "PRIVATE" ? "PRIVATE KEY" : "PUBLIC KEY";
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----`;
}

function bjTimestamp(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

function signContent(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== "" && params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

function rsa2Sign(content: string, privateKey: string): string {
  return createSign("RSA-SHA256").update(content, "utf8").sign(toPem(privateKey, "PRIVATE"), "base64");
}

function rsa2Verify(content: string, sign: string, publicKey: string): boolean {
  try {
    return createVerify("RSA-SHA256").update(content, "utf8").verify(toPem(publicKey, "PUBLIC"), sign, "base64");
  } catch {
    return false;
  }
}

async function callAlipay(
  method: string,
  bizContent: Record<string, unknown>,
  config: Record<string, unknown>,
  privateKey: string,
  notifyUrl?: string,
): Promise<Record<string, unknown>> {
  const params: Record<string, string> = {
    app_id: String(config.appId || ""),
    method,
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: bjTimestamp(),
    version: "1.0",
    biz_content: JSON.stringify(bizContent),
  };
  if (notifyUrl) params.notify_url = notifyUrl;
  params.sign = rsa2Sign(signContent(params), privateKey);

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams(params).toString(),
  });
  return (await res.json()) as Record<string, unknown>;
}

/**
 * 支付宝当面付（alipay.trade.precreate）：需企业/个体资质，手写 RSA2 签名（不引官方 SDK）。
 * config: { appId }；secrets: env.ALIPAY_PRIVATE_KEY / env.ALIPAY_PUBLIC_KEY
 */
export const alipayF2FProvider: PaymentProvider = {
  code: "alipay_f2f",

  async createPayment(ctx, order, config) {
    const priv = ctx.env.ALIPAY_PRIVATE_KEY || "";
    const resp = await callAlipay(
      "alipay.trade.precreate",
      {
        out_trade_no: order.orderNo,
        total_amount: formatYuan(order.payableCents),
        subject: order.productName.slice(0, 100),
      },
      config,
      priv,
      `${ctx.baseUrl}/api/pay/notify/alipay_f2f`,
    );
    const body = resp["alipay_trade_precreate_response"] as Record<string, unknown> | undefined;
    const qr = body?.["qr_code"];
    if (!qr || body?.["code"] !== "10000") {
      throw new Error(`alipay precreate failed: ${JSON.stringify(body ?? resp)}`);
    }
    return { kind: "qrcode", qrContent: String(qr), label: "请用支付宝扫码支付" };
  },

  async handleNotify(ctx, req, config) {
    const form = await req.formData();
    const params: Record<string, string> = {};
    form.forEach((v, k) => {
      params[k] = String(v);
    });
    const ackOk = new Response("success", { status: 200 });
    const ackFail = new Response("fail", { status: 200 });

    const sign = params.sign;
    const content = signContent(params);
    if (!sign || !rsa2Verify(content, sign, ctx.env.ALIPAY_PUBLIC_KEY || "")) {
      return { notification: null, ack: ackFail };
    }
    if (params.app_id !== String(config.appId || "")) {
      return { notification: null, ack: ackFail };
    }
    if (!["TRADE_SUCCESS", "TRADE_FINISHED"].includes(params.trade_status)) {
      return { notification: null, ack: ackOk };
    }
    const orderNo = params.out_trade_no;
    const order = (
      await ctx.db.select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1)
    )[0];
    if (!order) return { notification: null, ack: ackOk };

    const notification: VerifiedNotification = {
      orderNo,
      providerTradeNo: params.trade_no || "",
      eventId: `alipay:${params.trade_no || orderNo}`,
      paidCurrency: "CNY",
      paidValue: Math.round(parseFloat(params.total_amount || "0") * 100),
      raw: JSON.stringify(params),
    };
    return { notification, ack: ackOk };
  },

  async poll(ctx, pendingOrders, config) {
    const priv = ctx.env.ALIPAY_PRIVATE_KEY || "";
    const out: VerifiedNotification[] = [];
    for (const order of pendingOrders) {
      try {
        const resp = await callAlipay(
          "alipay.trade.query",
          { out_trade_no: order.orderNo },
          config,
          priv,
        );
        const body = resp["alipay_trade_query_response"] as Record<string, unknown> | undefined;
        const status = body?.["trade_status"];
        if (status === "TRADE_SUCCESS" || status === "TRADE_FINISHED") {
          out.push({
            orderNo: order.orderNo,
            providerTradeNo: String(body?.["trade_no"] || ""),
            eventId: `alipay:${body?.["trade_no"] || order.orderNo}`,
            paidCurrency: "CNY",
            paidValue: Math.round(parseFloat(String(body?.["total_amount"] || "0")) * 100),
            raw: JSON.stringify(body),
          });
        }
      } catch {
        // 单单失败不影响其它
      }
    }
    return out;
  },
};
