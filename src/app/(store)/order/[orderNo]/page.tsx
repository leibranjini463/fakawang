import Link from "next/link";
import { notFound } from "next/navigation";
import { CardSecretList } from "@/components/store/card-secret-list";
import { PaymentPanel, type PayResult } from "@/components/store/payment-panel";
import { Badge } from "@/components/ui";
import { getDb } from "@/db";
import { getEnv } from "@/lib/cf";
import { formatDateTime, formatYuan, maskEmail } from "@/lib/utils";
import { getOrderCardContents } from "@/services/delivery";
import { getOrderByNo } from "@/services/order-query";
import { createPaymentForOrder } from "@/services/pay";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "brand" | "green" | "gray" | "red" | "default" }> = {
  pending: { label: "待支付", tone: "brand" },
  paid: { label: "已支付", tone: "green" },
  delivered: { label: "已发货", tone: "green" },
  expired: { label: "已超时", tone: "gray" },
  closed: { label: "已关闭", tone: "gray" },
  manual_review: { label: "处理中", tone: "red" },
};

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--fg-muted)]">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  );
}

export default async function OrderPage({ params }: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await params;
  const order = await getOrderByNo(orderNo);
  if (!order) notFound();

  const st = STATUS[order.status] ?? { label: order.status, tone: "default" as const };
  const head = (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs text-[var(--fg-muted)]">订单号</div>
          <div className="font-mono text-sm font-medium">{order.orderNo}</div>
        </div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Info
          label="商品"
          value={`${order.productName}${order.variantName ? ` · ${order.variantName}` : ""} ×${order.quantity}`}
        />
        <Info label="应付" value={`￥${formatYuan(order.payableCents)}`} />
        <Info label="邮箱" value={maskEmail(order.contactEmail)} />
        <Info label="下单时间" value={formatDateTime(order.createdAt)} />
      </div>
    </div>
  );

  if (order.status === "pending") {
    let result: PayResult | null = null;
    try {
      result = (await createPaymentForOrder(order)) as PayResult;
    } catch (e) {
      console.log("[order:createPayment]", e);
    }
    return (
      <div className="mx-auto max-w-lg space-y-4">
        {head}
        <PaymentPanel
          orderNo={order.orderNo}
          payableCents={order.payableCents}
          result={result}
          expiresAt={order.expiresAt}
        />
      </div>
    );
  }

  if (order.status === "delivered") {
    const db = await getDb();
    const env = await getEnv();
    const cards = await getOrderCardContents(db, order.id, env.CARD_ENC_KEY);
    return (
      <div className="mx-auto max-w-lg space-y-4">
        {head}
        <div className="card space-y-4">
          <div className="text-center">
            <div className="text-4xl">🎉</div>
            <div className="mt-1 font-semibold">支付成功，已自动发货！</div>
            <p className="text-xs text-[var(--fg-muted)]">卡密已发送至 {maskEmail(order.contactEmail)}</p>
          </div>
          <CardSecretList cards={cards} />
          <p className="text-center text-xs text-[var(--fg-muted)]">
            请妥善保存。可凭「订单号 + 邮箱」在
            <Link href="/order/query" className="text-brand-600">
              订单查询
            </Link>
            页随时找回。
          </p>
        </div>
      </div>
    );
  }

  if (order.status === "paid" || order.status === "manual_review") {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        {head}
        <div className="card text-center">
          <div className="text-4xl">⏳</div>
          <p className="mt-2 text-sm">已收到付款，正在处理中，请稍候或联系客服。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {head}
      <div className="card text-center">
        <div className="text-4xl">⌛</div>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">
          订单已{order.status === "expired" ? "超时" : "关闭"}，请重新下单。
        </p>
        <Link href="/" className="btn-brand mt-3 inline-flex h-10 items-center rounded-xl px-5 text-sm">
          重新选购
        </Link>
      </div>
    </div>
  );
}
