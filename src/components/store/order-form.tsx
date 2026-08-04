"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CHAINS, type UsdtChain } from "@/payments/money";
import { cn } from "@/lib/utils";
import { TurnstileWidget } from "./turnstile-widget";

export interface OrderFormChannel {
  provider: string;
  displayName: string;
  usdtChains?: UsdtChain[];
}

export interface OrderFormProduct {
  id: number;
  name: string;
  priceCents: number;
  originalPriceCents: number | null;
  wholesaleTiers: string | null;
  buyMin: number;
  buyMax: number;
  deliveryType: "auto" | "manual";
  hasVariants: boolean;
}

export interface OrderFormVariant {
  id: number;
  name: string;
  priceCents: number;
  originalPriceCents: number | null;
  stock: number;
}

function yuan(cents: number) {
  return (cents / 100).toFixed(2);
}

function unitPriceFor(product: OrderFormProduct, qty: number): number {
  let best = product.priceCents;
  try {
    const tiers = product.wholesaleTiers
      ? (JSON.parse(product.wholesaleTiers) as Array<{ qty: number; priceCents: number }>)
      : [];
    for (const t of tiers) if (qty >= t.qty && t.priceCents < best) best = t.priceCents;
  } catch {}
  return best;
}

export function OrderForm({
  product,
  variants,
  stock,
  channels,
  usdtRate,
  turnstileSiteKey,
}: {
  product: OrderFormProduct;
  variants: OrderFormVariant[];
  stock: number;
  channels: OrderFormChannel[];
  usdtRate: number;
  turnstileSiteKey: string;
}) {
  const router = useRouter();
  const isAuto = product.deliveryType === "auto";
  const hasVariants = product.hasVariants && variants.length > 0;

  // 默认选中首个有货规格，否则首个
  const [variantId, setVariantId] = useState<number | null>(
    hasVariants ? (variants.find((v) => v.stock > 0)?.id ?? variants[0].id) : null,
  );
  const selectedVariant = hasVariants ? variants.find((v) => v.id === variantId) ?? null : null;

  // 有效库存/价格：多规格取所选规格，单规格取商品
  const effectiveStock = hasVariants ? selectedVariant?.stock ?? 0 : stock;
  const currentSoldOut = isAuto && effectiveStock <= 0;

  const [qty, setQty] = useState(product.buyMin);
  const [email, setEmail] = useState("");
  const [queryPass, setQueryPass] = useState("");
  const [provider, setProvider] = useState(channels[0]?.provider ?? "");
  const [usdtChain, setUsdtChain] = useState<UsdtChain>("TRC20");
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const maxQty = isAuto ? Math.min(product.buyMax, Math.max(effectiveStock, 0)) : product.buyMax;

  const unit = hasVariants
    ? selectedVariant?.priceCents ?? product.priceCents
    : unitPriceFor(product, qty);
  const payable = unit * qty;
  const selectedChannel = channels.find((c) => c.provider === provider);
  const isUsdt = provider === "usdt";
  const usdtApprox = (payable / 100 / usdtRate).toFixed(2);
  // 当前所选链兜底：若默认链不在该渠道启用列表，取第一个可用链
  const usdtChains = selectedChannel?.usdtChains ?? [];
  const effectiveChain: UsdtChain = usdtChains.includes(usdtChain)
    ? usdtChain
    : usdtChains[0] ?? usdtChain;

  function changeQty(delta: number) {
    setQty((q) => Math.max(product.buyMin, Math.min(maxQty || product.buyMin, q + delta)));
  }

  function selectVariant(v: OrderFormVariant) {
    setVariantId(v.id);
    // 切换规格后把数量收敛到新规格库存范围内
    const newMax = isAuto ? Math.min(product.buyMax, Math.max(v.stock, 0)) : product.buyMax;
    setQty((q) => Math.max(product.buyMin, Math.min(newMax || product.buyMin, q)));
  }

  async function submit() {
    setError("");
    if (hasVariants && !variantId) return setError("请选择规格");
    if (currentSoldOut) return setError("该规格暂时售罄");
    if (!/.+@.+\..+/.test(email)) return setError("请输入正确的邮箱");
    if (!provider) return setError("请选择支付方式");
    if (qty < product.buyMin || qty > maxQty) return setError("购买数量超出范围");
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          variantId: hasVariants ? variantId : undefined,
          quantity: qty,
          email,
          provider,
          usdtChain: isUsdt ? effectiveChain : undefined,
          queryPass: queryPass || undefined,
          turnstileToken: token || undefined,
        }),
      });
      const data = (await res.json()) as { orderNo?: string; error?: string };
      if (!res.ok || !data.orderNo) {
        setError(data.error || "下单失败，请重试");
        setSubmitting(false);
        return;
      }
      router.push(`/order/${data.orderNo}`);
    } catch {
      setError("网络错误，请重试");
      setSubmitting(false);
    }
  }

  // 单规格售罄：整体替换为售罄卡片。多规格保留表单以便切换到有货规格。
  if (currentSoldOut && !hasVariants) {
    return (
      <div className="card grid place-items-center py-10 text-[var(--fg-muted)]">
        😢 该商品暂时售罄
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      {/* 规格选择 */}
      {hasVariants && (
        <div>
          <div className="mb-1.5 text-sm font-medium">选择规格</div>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const vSold = isAuto && v.stock <= 0;
              return (
                <button
                  key={v.id}
                  onClick={() => selectVariant(v)}
                  disabled={vSold}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-sm transition",
                    variantId === v.id
                      ? "border-brand-400 bg-brand-50 font-medium text-brand-700"
                      : "hover:bg-[var(--bg-soft)]",
                    vSold && "cursor-not-allowed opacity-40",
                  )}
                >
                  <div>{v.name}</div>
                  <div className="text-xs text-brand-600">
                    ￥{yuan(v.priceCents)}
                    {vSold ? " · 售罄" : isAuto ? ` · 剩 ${v.stock}` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 数量 */}
      <div>
        <div className="mb-1.5 text-sm font-medium">购买数量</div>
        <div className="flex items-center gap-3">
          <div className="flex items-center overflow-hidden rounded-lg border">
            <button className="h-9 w-9 hover:bg-[var(--bg-soft)]" onClick={() => changeQty(-1)}>
              −
            </button>
            <input
              className="h-9 w-14 border-x bg-transparent text-center text-sm"
              value={qty}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isFinite(n)) setQty(Math.max(product.buyMin, Math.min(maxQty, n)));
              }}
            />
            <button className="h-9 w-9 hover:bg-[var(--bg-soft)]" onClick={() => changeQty(1)}>
              ＋
            </button>
          </div>
          <span className="text-xs text-[var(--fg-muted)]">
            {isAuto ? `库存 ${effectiveStock}` : "人工发货"} · 单次限购 {product.buyMax}
          </span>
        </div>
      </div>

      {/* 联系邮箱 */}
      <div>
        <div className="mb-1.5 text-sm font-medium">联系邮箱（用于接收卡密）</div>
        <input
          className="input-base w-full px-3 py-2 text-sm"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          inputMode="email"
        />
      </div>

      {/* 查询密码（可选） */}
      <div>
        <div className="mb-1.5 text-sm font-medium">
          查询密码 <span className="text-[var(--fg-muted)]">（可选，用于日后查单）</span>
        </div>
        <input
          className="input-base w-full px-3 py-2 text-sm"
          placeholder="留空则仅凭订单号+邮箱查单"
          value={queryPass}
          onChange={(e) => setQueryPass(e.target.value)}
        />
      </div>

      {/* 支付方式 */}
      <div>
        <div className="mb-1.5 text-sm font-medium">支付方式</div>
        {channels.length === 0 ? (
          <p className="text-xs text-red-500">暂未配置支付渠道</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {channels.map((c) => (
              <button
                key={c.provider}
                onClick={() => setProvider(c.provider)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm transition",
                  provider === c.provider
                    ? "border-brand-400 bg-brand-50 font-medium text-brand-700"
                    : "hover:bg-[var(--bg-soft)]",
                )}
              >
                {c.displayName}
                {/* 个人码靠「唯一金额」对账，实付会比标价多几分钱。
                    以手续费话术说明，避免客户误以为被多收。 */}
                {c.provider === "alipay_personal" && (
                  <span className="mt-0.5 block text-[10px] font-normal leading-tight text-[var(--fg-muted)]">
                    含 2% 手续费
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {isUsdt && usdtChains.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {usdtChains.map((ch) => (
              <button
                key={ch}
                onClick={() => setUsdtChain(ch)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs transition",
                  effectiveChain === ch ? "border-brand-400 bg-brand-50 text-brand-700" : "hover:bg-[var(--bg-soft)]",
                )}
              >
                {CHAINS[ch].label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Turnstile */}
      {turnstileSiteKey ? <TurnstileWidget siteKey={turnstileSiteKey} onToken={setToken} /> : null}

      {/* 金额 */}
      <div className="rounded-xl bg-[var(--bg-soft)] p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--fg-muted)]">
            单价 ￥{yuan(unit)} × {qty}
            {hasVariants && selectedVariant ? `（${selectedVariant.name}）` : ""}
          </span>
          <span>￥{yuan(payable)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between border-t pt-1">
          <span className="font-medium">应付</span>
          <span className="text-lg font-bold text-brand-600">
            ￥{yuan(payable)}
            {(isUsdt || provider === "binance_pay") && (
              <span className="ml-1 text-xs font-normal text-[var(--fg-muted)]">≈ {usdtApprox} USDT</span>
            )}
          </span>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting || channels.length === 0 || currentSoldOut}
        className="btn-brand h-12 w-full rounded-xl text-base font-semibold disabled:opacity-50"
      >
        {currentSoldOut ? "该规格售罄" : submitting ? "提交中…" : "立即购买"}
      </button>
    </div>
  );
}
