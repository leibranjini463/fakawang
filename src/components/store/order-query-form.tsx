"use client";
import Link from "next/link";
import { useState } from "react";
import { formatYuan } from "@/lib/utils";
import { CardSecretList } from "./card-secret-list";
import { TurnstileWidget } from "./turnstile-widget";

interface QueryResult {
  order: {
    orderNo: string;
    status: string;
    productName: string;
    variantName: string | null;
    quantity: number;
    payableCents: number;
    createdAt: number;
  };
  cards: string[] | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "待支付",
  paid: "已支付（处理中）",
  delivered: "已发货",
  expired: "已超时",
  closed: "已关闭",
  manual_review: "处理中",
};

export function OrderQueryForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const [orderNo, setOrderNo] = useState("");
  const [email, setEmail] = useState("");
  const [queryPass, setQueryPass] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/orders/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderNo, email, queryPass: queryPass || undefined, turnstileToken: token || undefined }),
      });
      const data = (await res.json()) as QueryResult & { error?: string };
      if (!res.ok) {
        setError(data.error || "查询失败");
      } else {
        setResult(data);
      }
    } catch {
      setError("网络错误，请重试");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card space-y-3">
        <div>
          <div className="mb-1.5 text-sm font-medium">订单号</div>
          <input
            className="input-base w-full px-3 py-2 text-sm"
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            placeholder="20260720XXXXXXXXXX"
          />
        </div>
        <div>
          <div className="mb-1.5 text-sm font-medium">下单邮箱</div>
          <input
            className="input-base w-full px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <div className="mb-1.5 text-sm font-medium">
            查询密码 <span className="text-[var(--fg-muted)]">（若下单时设置过）</span>
          </div>
          <input
            className="input-base w-full px-3 py-2 text-sm"
            value={queryPass}
            onChange={(e) => setQueryPass(e.target.value)}
          />
        </div>
        {turnstileSiteKey ? <TurnstileWidget siteKey={turnstileSiteKey} onToken={setToken} /> : null}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={loading} className="btn-brand h-11 w-full rounded-xl font-semibold">
          {loading ? "查询中…" : "查询订单"}
        </button>
      </form>

      {result && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between border-b pb-2 text-sm">
            <span className="font-mono">{result.order.orderNo}</span>
            <span className="font-medium text-brand-600">
              {STATUS_LABEL[result.order.status] || result.order.status}
            </span>
          </div>
          <div className="text-sm text-[var(--fg-muted)]">
            {result.order.productName}
            {result.order.variantName ? ` · ${result.order.variantName}` : ""} ×
            {result.order.quantity} · 应付 ￥{formatYuan(result.order.payableCents)}
          </div>
          {result.cards ? (
            <CardSecretList cards={result.cards} />
          ) : result.order.status === "pending" ? (
            <Link
              href={`/order/${result.order.orderNo}`}
              className="btn-brand inline-flex h-10 items-center rounded-xl px-5 text-sm"
            >
              去支付
            </Link>
          ) : (
            <p className="text-sm text-[var(--fg-muted)]">该订单暂无可展示的卡密。</p>
          )}
        </div>
      )}
    </div>
  );
}
