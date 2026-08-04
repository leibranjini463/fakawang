import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { alipayAmountLocks, orders } from "@/db/schema";
import { formatYuan } from "@/lib/utils";
import type { PaymentProvider } from "../types";

/** 上报请求体：安卓通知监听端 POST 的字段。 */
interface PushBody {
  /** 收款账号标识，与渠道配置的 account 对应（多码/多手机时区分） */
  account?: string;
  /** 到账金额（分）。安卓端解析「12.03元」后换算上报 */
  amountCents?: number;
  /** 端上生成的稳定幂等键（同一条通知重推必须一致） */
  bizId?: string;
  /** 毫秒时间戳，用于防重放 */
  ts?: number;
  /** HMAC-SHA256 签名 */
  sign?: string;
  /** 原始通知文本，仅存档便于排查 */
  rawText?: string;
}

/** 上报签名允许的时钟偏差：±5 分钟。 */
const TS_TOLERANCE_MS = 5 * 60 * 1000;

/** 待签名串：字段顺序固定，安卓端须完全一致。 */
export function pushSignPayload(account: string, amountCents: number, bizId: string, ts: number) {
  return `${account}|${amountCents}|${bizId}|${ts}`;
}

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** 定长常量时间比较，避免签名被计时侧信道逐字节爆破。 */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * 支付宝个人收款码（安卓通知监听）。
 *
 * 与官方当面付（alipay_f2f）不同：这里没有商户号，靠「唯一金额法」把到账
 * 金额反查回订单——下单时在 alipay_amount_locks 占一个未被使用的分位，
 * 安卓端把支付宝到账通知里的金额推上来，按金额命中活跃锁即结算。
 *
 * config: { account, qrContent }
 * secret: env.ALIPAY_PUSH_SECRET（与安卓端共享）
 */
export const alipayPersonalProvider: PaymentProvider = {
  code: "alipay_personal",

  async createPayment(ctx, order, config) {
    const qrContent = String(config.qrContent || "");
    if (!qrContent) throw new Error("支付宝个人收款码未配置");
    // payAmount 由下单时的金额占位写入（分），缺失则回退到订单应付额
    const cents = Number(order.payAmount || order.payableCents);
    return {
      kind: "qrcode",
      qrContent,
      label: `请使用支付宝扫码支付 ¥${formatYuan(cents)}`,
      // 唯一金额是自动对账的唯一依据，改一分钱就匹配不上，必须显著提示
      notice: `金额必须完全一致：¥${formatYuan(cents)}，多付或少付都无法自动到账`,
      expiresAt: order.expiresAt,
    };
  },

  async handleNotify(ctx, req, config) {
    const ackOk = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const ackFail = (msg: string) =>
      new Response(JSON.stringify({ ok: false, msg }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });

    const secret = ctx.env.ALIPAY_PUSH_SECRET || "";
    if (!secret) return { notification: null, ack: ackFail("secret not configured") };

    let body: PushBody;
    try {
      body = (await req.json()) as PushBody;
    } catch {
      return { notification: null, ack: ackFail("bad json") };
    }

    const account = String(body.account || "");
    const amountCents = Number(body.amountCents);
    const bizId = String(body.bizId || "");
    const ts = Number(body.ts);
    const sign = String(body.sign || "");

    if (!account || !bizId || !sign || !Number.isFinite(ts)) {
      return { notification: null, ack: ackFail("missing fields") };
    }
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return { notification: null, ack: ackFail("bad amount") };
    }
    // 防重放：签名串含 ts，超出容差的旧请求一律拒绝
    if (Math.abs(Date.now() - ts) > TS_TOLERANCE_MS) {
      return { notification: null, ack: ackFail("timestamp expired") };
    }
    const expect = hmacHex(secret, pushSignPayload(account, amountCents, bizId, ts));
    if (!safeEqualHex(sign.toLowerCase(), expect)) {
      return { notification: null, ack: ackFail("bad signature") };
    }
    // 账号必须与渠道配置一致，避免用别的 account 绕开金额锁命名空间
    const expectAccount = String(config.account || "");
    if (expectAccount && account !== expectAccount) {
      return { notification: null, ack: ackFail("unknown account") };
    }

    // 按金额命中未释放且未过期的占位 → 反查订单
    const lock = (
      await ctx.db
        .select()
        .from(alipayAmountLocks)
        .where(
          and(
            eq(alipayAmountLocks.account, account),
            eq(alipayAmountLocks.amountCents, amountCents),
            eq(alipayAmountLocks.released, false),
            gt(alipayAmountLocks.expiresAt, Date.now()),
          ),
        )
        .limit(1)
    )[0];
    // 没命中：可能是他人转账/已过期订单补款，交由人工对账，不报错以免安卓端无限重推
    if (!lock) return { notification: null, ack: ackOk };

    const order = (
      await ctx.db.select().from(orders).where(eq(orders.id, lock.orderId)).limit(1)
    )[0];
    if (!order) return { notification: null, ack: ackOk };

    return {
      notification: {
        orderNo: order.orderNo,
        providerTradeNo: bizId,
        eventId: `alipay_personal:${bizId}`,
        paidCurrency: "CNY",
        paidValue: amountCents,
        raw: JSON.stringify({ account, amountCents, bizId, rawText: body.rawText ?? "" }),
      },
      ack: ackOk,
    };
  },
};
