"use client";
import { CHAINS, type UsdtChain } from "@/payments/money";
import { formatYuan } from "@/lib/utils";
import { Countdown } from "./countdown";
import { CopyButton } from "./copy-button";
import { OrderStatusPoller } from "./order-status-poller";
import { QrImage } from "./qr-image";

export type PayResult =
  | { kind: "redirect"; url: string }
  | { kind: "qrcode"; qrContent: string; label?: string; notice?: string }
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

export function PaymentPanel({
  orderNo,
  payableCents,
  result,
  expiresAt,
}: {
  orderNo: string;
  payableCents: number;
  result: PayResult | null;
  expiresAt: number;
}) {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="text-sm text-[var(--fg-muted)]">
          应付 <span className="font-bold text-brand-600">￥{formatYuan(payableCents)}</span>
        </div>
        <div className="text-sm">
          ⏳ 剩余 <Countdown expiresAt={expiresAt} />
        </div>
      </div>

      {!result && <p className="text-sm text-red-500">支付信息生成失败，请刷新或联系客服。</p>}

      {result?.kind === "mock" && (
        <div className="space-y-3 text-center">
          <p className="text-sm text-[var(--fg-muted)]">开发测试：点击下方按钮模拟支付成功并自动发货</p>
          <a href={result.confirmUrl} className="btn-brand inline-flex h-11 items-center rounded-xl px-6 font-semibold">
            ✅ 模拟支付并发货
          </a>
        </div>
      )}

      {result?.kind === "redirect" && (
        <div className="space-y-3 text-center">
          <a href={result.url} className="btn-brand inline-flex h-11 items-center rounded-xl px-6 font-semibold">
            前往支付
          </a>
          <p className="text-xs text-[var(--fg-muted)]">支付完成后请返回本页，将自动确认。</p>
        </div>
      )}

      {result?.kind === "qrcode" && (
        <div className="flex flex-col items-center gap-3">
          <QrImage content={result.qrContent} />
          <p className="text-sm">{result.label || "请扫码支付"}</p>
          {result.notice && (
            <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-center text-sm font-bold text-red-600">
              ⚠️ {result.notice}
            </p>
          )}
        </div>
      )}

      {result?.kind === "crypto" && (
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <QrImage content={result.address} size={160} />
            <div className="flex-1 space-y-2 text-sm">
              <div>
                <div className="text-xs text-[var(--fg-muted)]">网络</div>
                <div className="font-medium">{CHAINS[result.chain].label}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--fg-muted)]">转账金额（必须精确一致）</div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-brand-600">{result.display} USDT</span>
                  <CopyButton text={result.display} />
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--fg-muted)]">收款地址</div>
                <div className="flex items-center gap-2">
                  <span className="break-all font-mono text-xs">{result.address}</span>
                  <CopyButton text={result.address} />
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            ⚠️ 请务必按<strong>精确金额</strong>、通过 <strong>{result.chain}</strong> 网络转账。金额或网络不一致将无法自动到账，需联系客服人工处理。到账后约 1~2 分钟自动发货。
          </div>
        </div>
      )}

      {result?.kind === "checkout" && (
        <div className="flex flex-col items-center gap-3">
          {result.qrContent && <QrImage content={result.qrContent} />}
          <p className="text-sm">请用币安 App 扫码支付</p>
          {result.url && (
            <a href={result.url} className="btn-brand inline-flex h-10 items-center rounded-xl px-5 text-sm">
              打开币安支付
            </a>
          )}
        </div>
      )}

      <div className="border-t pt-3 text-center text-xs text-[var(--fg-muted)]">
        支付完成后本页会自动刷新　·　可凭订单号 + 邮箱随时查单
      </div>
      <OrderStatusPoller orderNo={orderNo} active />
    </div>
  );
}
