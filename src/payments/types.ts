import type { DB } from "@/db";
import type { Order } from "@/db/schema";
import type { UsdtChain } from "./money";

export type ProviderCode =
  | "mock"
  | "epay"
  | "alipay_f2f"
  | "alipay_personal"
  | "usdt"
  | "binance_pay";

export interface PaymentContext {
  db: DB;
  kv: KVNamespace;
  env: CloudflareEnv;
  /** 站点公开基础 URL，用于拼回调/回跳地址 */
  baseUrl: string;
}

/** createPayment 的多态返回，前端按 kind 渲染不同支付区。 */
export type CreatePaymentResult =
  | { kind: "redirect"; url: string }
  | {
      kind: "qrcode";
      qrContent: string;
      label?: string;
      /** 醒目警示（红色加粗渲染），如「金额需完全一致」 */
      notice?: string;
      expiresAt?: number;
    }
  | {
      kind: "crypto";
      chain: UsdtChain;
      address: string;
      amountMicro: number;
      decimals: number;
      display: string;
      expiresAt: number;
    }
  | { kind: "checkout"; url?: string; qrContent?: string; deeplink?: string }
  | { kind: "mock"; confirmUrl: string };

/** 验签后的规范化通知，交给统一结算管线。 */
export interface VerifiedNotification {
  orderNo: string;
  providerTradeNo: string;
  /** 幂等键（provider 内唯一）：链上 chain:txHash / 渠道 tradeNo / webhook bizId */
  eventId: string;
  paidCurrency: string;
  /** 整数最小单位：法币=分；USDT=micro(1e-6) 面值 */
  paidValue: number;
  raw: string;
}

export interface PaymentProvider {
  readonly code: ProviderCode;

  /** 下单后创建支付：产出跳转/二维码/收款地址等。 */
  createPayment(
    ctx: PaymentContext,
    order: Order,
    config: Record<string, unknown>,
  ): Promise<CreatePaymentResult>;

  /** Webhook 型渠道：验签+防重放，返回规范化通知与要回给渠道的 ack。 */
  handleNotify?(
    ctx: PaymentContext,
    req: Request,
    config: Record<string, unknown>,
  ): Promise<{ notification: VerifiedNotification | null; ack: Response }>;

  /** 轮询型渠道（USDT 必用；其它作对账兜底）。 */
  poll?(
    ctx: PaymentContext,
    pendingOrders: Order[],
    config: Record<string, unknown>,
  ): Promise<VerifiedNotification[]>;
}

export class VerifyError extends Error {}
