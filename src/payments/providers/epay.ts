import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { orders } from "@/db/schema";
import { formatYuan } from "@/lib/utils";
import type { PaymentProvider } from "../types";

function md5(s: string): string {
  return createHash("md5").update(s, "utf8").digest("hex");
}

/** 易支付 MD5 签名：参数按 ASCII 排序拼接 + 商户 key。 */
function epaySign(params: Record<string, string>, key: string): string {
  const str = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type" && params[k] !== "" && params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return md5(str + key);
}

/**
 * 易支付（epay）聚合：个人可用，一个驱动覆盖支付宝/微信/QQ 通道（type 区分）。
 * config: { gateway, pid, type }；secret: env.EPAY_KEY
 */
export const epayProvider: PaymentProvider = {
  code: "epay",

  async createPayment(ctx, order, config) {
    const gateway = String(config.gateway || "").replace(/\/+$/, "");
    const params: Record<string, string> = {
      pid: String(config.pid || ""),
      type: String(config.type || "alipay"),
      out_trade_no: order.orderNo,
      notify_url: `${ctx.baseUrl}/api/pay/notify/epay`,
      return_url: `${ctx.baseUrl}/order/${order.orderNo}`,
      name: order.productName.slice(0, 100),
      money: formatYuan(order.payableCents),
    };
    params.sign = epaySign(params, ctx.env.EPAY_KEY || "");
    params.sign_type = "MD5";
    const qs = new URLSearchParams(params).toString();
    return { kind: "redirect", url: `${gateway}/submit.php?${qs}` };
  },

  async handleNotify(ctx, req) {
    const url = new URL(req.url);
    const params: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      params[k] = v;
    });
    const ackOk = new Response("success", { status: 200 });
    const ackFail = new Response("fail", { status: 200 });

    const expect = epaySign(params, ctx.env.EPAY_KEY || "");
    if (!params.sign || params.sign !== expect) {
      return { notification: null, ack: ackFail };
    }
    if (params.trade_status !== "TRADE_SUCCESS") {
      return { notification: null, ack: ackOk };
    }
    const orderNo = params.out_trade_no;
    const order = (
      await ctx.db.select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1)
    )[0];
    if (!order) return { notification: null, ack: ackOk };

    return {
      notification: {
        orderNo,
        providerTradeNo: params.trade_no || "",
        eventId: `epay:${params.trade_no || orderNo}`,
        paidCurrency: "CNY",
        paidValue: Math.round(parseFloat(params.money || "0") * 100),
        raw: url.search,
      },
      ack: ackOk,
    };
  },
};
