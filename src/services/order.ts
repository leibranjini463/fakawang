import { and, eq } from "drizzle-orm";
import { getDb, type DB } from "@/db";
import {
  alipayAmountLocks,
  orders,
  paymentChannels,
  productVariants,
  products,
  usdtAmountLocks,
  type Order,
  type ProductVariant,
} from "@/db/schema";
import { genOrderNo, hashPassword } from "@/lib/crypto";
import { getSettings } from "@/lib/settings";
import { safeJson } from "@/lib/utils";
import { cnyCentsToUsdtMicro, type UsdtChain } from "@/payments/money";
import { countAvailable } from "./delivery";

export interface CreateOrderInput {
  productId: number;
  variantId?: number;
  quantity: number;
  email: string;
  provider: string;
  usdtChain?: UsdtChain;
  queryPass?: string;
  ip?: string;
  ua?: string;
}

type ChainConfig = { chain: UsdtChain; address: string; enabled?: boolean };

function computeUnitPrice(priceCents: number, tiersJson: string | null, qty: number): number {
  const tiers = safeJson<Array<{ qty: number; priceCents: number }>>(tiersJson, []);
  let best = priceCents;
  for (const t of tiers) {
    if (qty >= t.qty && t.priceCents < best) best = t.priceCents;
  }
  return best;
}

/** 为 USDT 订单分配唯一收款金额（部分唯一索引兜底原子性）。 */
async function allocateUsdtAmount(
  db: DB,
  chain: UsdtChain,
  address: string,
  baseMicro: number,
  orderId: number,
  expiresAt: number,
): Promise<number> {
  for (let i = 0; i < 12; i++) {
    const tail = i === 0 ? 0 : Math.floor(Math.random() * 9999) + 1;
    const amount = baseMicro + tail;
    try {
      await db.insert(usdtAmountLocks).values({ chain, address, amountMicro: amount, orderId, expiresAt });
      return amount;
    } catch {
      // 金额被占，换尾数重试
    }
  }
  throw new Error("暂时无法分配唯一收款金额，请稍后重试");
}

/**
 * 支付宝唯一金额的最大加价尾数（分）。同价并发订单超过这个数才会分配失败，
 * 对小店远远够用；调大会抬高最坏情况下的超收金额。
 */
const ALIPAY_MAX_TAIL_CENTS = 30;

/**
 * 为支付宝个人码订单分配唯一收款金额（分）。
 *
 * 从 0 开始「逐分递增」探测，而不是随机取尾数——随机尾数会让 ¥1.00 的订单
 * 变成 ¥1.69，客户观感极差。递增探测下绝大多数订单就是原价，只有同价订单
 * 并发时才依次 +1 分、+2 分…，超收金额始终是几分钱级别。
 * 原子性由部分唯一索引 (account, amount_cents) WHERE released=0 保证。
 */
async function allocateAlipayAmount(
  db: DB,
  account: string,
  baseCents: number,
  orderId: number,
  expiresAt: number,
): Promise<number> {
  for (let i = 0; i < ALIPAY_MAX_TAIL_CENTS; i++) {
    const amountCents = baseCents + i;
    try {
      await db.insert(alipayAmountLocks).values({ account, amountCents, orderId, expiresAt });
      return amountCents;
    } catch {
      // 该金额已被其它未结订单占用，加 1 分继续探测
    }
  }
  throw new Error("暂时无法分配唯一收款金额，请稍后重试");
}

export type CreateOrderResult = { order: Order } | { error: string };

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const db = await getDb();
  const settings = await getSettings();

  const product = (
    await db.select().from(products).where(eq(products.id, input.productId)).limit(1)
  )[0];
  if (!product || !product.isEnabled) return { error: "商品不存在或已下架" };

  // 规格解析：多规格商品必须选规格并以规格定价；单规格商品忽略传入的 variantId。
  let variant: ProductVariant | null = null;
  if (product.hasVariants) {
    if (!input.variantId) return { error: "请选择商品规格" };
    variant =
      (
        await db
          .select()
          .from(productVariants)
          .where(eq(productVariants.id, input.variantId))
          .limit(1)
      )[0] ?? null;
    if (!variant || variant.productId !== product.id || !variant.isEnabled) {
      return { error: "所选规格不存在或已下架" };
    }
  }
  const variantId = variant ? variant.id : null;

  const qty = Math.trunc(input.quantity);
  if (!Number.isFinite(qty) || qty < product.buyMin || qty > product.buyMax) {
    return { error: `购买数量需在 ${product.buyMin}~${product.buyMax} 之间` };
  }

  if (product.deliveryType === "auto") {
    const stock = await countAvailable(db, product.id, variantId);
    if (stock < qty) return { error: `库存不足，仅剩 ${stock} 件` };
  }

  // 渠道校验（mock 在开发环境始终可用）
  if (input.provider !== "mock") {
    const ch = (
      await db
        .select()
        .from(paymentChannels)
        .where(and(eq(paymentChannels.provider, input.provider), eq(paymentChannels.isEnabled, true)))
        .limit(1)
    )[0];
    if (!ch) return { error: "支付方式不可用" };
  }

  // 多规格取规格价（不叠加批发阶梯价）；单规格走商品价 + 阶梯价。
  const unitPrice = variant
    ? variant.priceCents
    : computeUnitPrice(product.priceCents, product.wholesaleTiers, qty);
  const totalCents = unitPrice * qty;
  const discountCents = 0;
  const payableCents = Math.max(0, totalCents - discountCents);

  const orderNo = genOrderNo();
  const expiresAt = Date.now() + settings.orderExpireMinutes * 60 * 1000;
  const queryPassHash = input.queryPass ? await hashPassword(input.queryPass) : null;

  // 支付币种/金额
  let payCurrency: string | null = "CNY";
  let payAmount: string | null = null;
  if (input.provider === "usdt") {
    if (!input.usdtChain) return { error: "请选择 USDT 网络" };
    payCurrency = `USDT-${input.usdtChain}`;
    payAmount = String(cnyCentsToUsdtMicro(payableCents, settings.usdtRate));
  } else if (input.provider === "binance_pay") {
    payCurrency = "USDT";
    payAmount = String(cnyCentsToUsdtMicro(payableCents, settings.usdtRate));
  }

  const [order] = await db
    .insert(orders)
    .values({
      orderNo,
      productId: product.id,
      productName: product.name,
      variantId,
      variantName: variant ? variant.name : null,
      quantity: qty,
      unitPriceCents: unitPrice,
      totalCents,
      discountCents,
      payableCents,
      contactEmail: input.email,
      queryPassHash,
      status: "pending",
      paymentProvider: input.provider,
      payCurrency,
      payAmount,
      expiresAt,
      ip: input.ip,
      ua: input.ua,
    })
    .returning();

  // USDT：分配唯一收款金额并回填 payAmount
  if (input.provider === "usdt" && input.usdtChain) {
    const ch = (
      await db.select().from(paymentChannels).where(eq(paymentChannels.provider, "usdt")).limit(1)
    )[0];
    const cfg = safeJson<{ chains?: ChainConfig[] }>(ch?.config ?? null, {});
    const cc = (cfg.chains ?? []).find((c) => c.chain === input.usdtChain);
    if (!cc?.address) return { error: `${input.usdtChain} 收款地址未配置` };
    const baseMicro = Number(payAmount);
    try {
      const amount = await allocateUsdtAmount(db, input.usdtChain, cc.address, baseMicro, order.id, expiresAt);
      await db.update(orders).set({ payAmount: String(amount) }).where(eq(orders.id, order.id));
      order.payAmount = String(amount);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  // 支付宝个人码：分配唯一收款金额（分）并回填 payAmount，安卓端按此金额反查订单
  if (input.provider === "alipay_personal") {
    const ch = (
      await db
        .select()
        .from(paymentChannels)
        .where(eq(paymentChannels.provider, "alipay_personal"))
        .limit(1)
    )[0];
    const cfg = safeJson<{ account?: string }>(ch?.config ?? null, {});
    const account = cfg.account || "default";
    try {
      const amount = await allocateAlipayAmount(db, account, payableCents, order.id, expiresAt);
      await db.update(orders).set({ payAmount: String(amount) }).where(eq(orders.id, order.id));
      order.payAmount = String(amount);
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  return { order };
}
