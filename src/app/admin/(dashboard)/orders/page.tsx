import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { CopyButton } from "@/components/store/copy-button";
import { Badge } from "@/components/ui";
import { getDb } from "@/db";
import { cards, orders, type Order } from "@/db/schema";
import { getEnv } from "@/lib/cf";
import { decryptSecret } from "@/lib/crypto";
import { cn, formatDateTime, formatYuan } from "@/lib/utils";
import { closeOrder, manualDeliver, resendEmail } from "../../actions";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "", label: "全部" },
  { key: "pending", label: "待支付" },
  { key: "paid", label: "已支付" },
  { key: "delivered", label: "已发货" },
  { key: "manual_review", label: "待处理" },
  { key: "expired", label: "已超时" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "待支付",
  paid: "已支付",
  delivered: "已发货",
  expired: "已超时",
  closed: "已关闭",
  manual_review: "待处理",
};

const STATUS_TONE: Record<string, "brand" | "green" | "gray" | "red" | "default"> = {
  pending: "brand",
  paid: "green",
  delivered: "green",
  expired: "gray",
  closed: "gray",
  manual_review: "red",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const db = await getDb();
  const status = sp.status || "";
  const base = db.select().from(orders).orderBy(desc(orders.id)).limit(100);
  const list: Order[] = status
    ? await db
        .select()
        .from(orders)
        .where(eq(orders.status, status as Order["status"]))
        .orderBy(desc(orders.id))
        .limit(100)
    : await base;

  // 已发货订单：批量取并解密卡密，供后台/客服直接查看
  const deliveredIds = list.filter((o) => o.status === "delivered").map((o) => o.id);
  const cardsByOrder = new Map<number, string[]>();
  if (deliveredIds.length) {
    const env = await getEnv();
    const rows = await db.select().from(cards).where(inArray(cards.orderId, deliveredIds));
    for (const c of rows) {
      if (c.orderId == null) continue;
      const arr = cardsByOrder.get(c.orderId) ?? [];
      try {
        arr.push(await decryptSecret(c.contentEnc, env.CARD_ENC_KEY));
      } catch {
        arr.push("[解密失败]");
      }
      cardsByOrder.set(c.orderId, arr);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">订单管理</h1>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key ? `/admin/orders?status=${t.key}` : "/admin/orders"}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              status === t.key ? "btn-brand border-transparent" : "hover:bg-[var(--bg-soft)]",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--fg-muted)]">
            <tr>
              <th className="p-2">订单号</th>
              <th className="p-2">商品</th>
              <th className="p-2">金额</th>
              <th className="p-2">邮箱</th>
              <th className="p-2">发货卡密</th>
              <th className="p-2">状态</th>
              <th className="p-2">时间</th>
              <th className="p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} className="border-t align-top">
                <td className="p-2 font-mono text-xs">{o.orderNo}</td>
                <td className="p-2">
                  {o.productName}
                  {o.variantName ? ` · ${o.variantName}` : ""} ×{o.quantity}
                </td>
                <td className="p-2">￥{formatYuan(o.payableCents)}</td>
                <td className="p-2 text-xs">{o.contactEmail}</td>
                <td className="p-2">
                  {cardsByOrder.get(o.id)?.length ? (
                    <div className="flex items-start gap-1">
                      <div className="max-w-[240px] space-y-0.5 break-all font-mono text-xs">
                        {cardsByOrder.get(o.id)!.map((c, i) => (
                          <div key={i}>{c}</div>
                        ))}
                      </div>
                      <CopyButton text={cardsByOrder.get(o.id)!.join("\n")} />
                    </div>
                  ) : (
                    <span className="text-[var(--fg-muted)]">—</span>
                  )}
                </td>
                <td className="p-2">
                  <Badge tone={STATUS_TONE[o.status] ?? "default"}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </Badge>
                </td>
                <td className="p-2 text-xs text-[var(--fg-muted)]">{formatDateTime(o.createdAt)}</td>
                <td className="flex flex-wrap gap-1 p-2">
                  {(o.status === "paid" || o.status === "manual_review" || o.status === "pending") && (
                    <form action={manualDeliver}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="rounded border px-2 py-1 text-xs hover:bg-[var(--bg-soft)]">
                        补发
                      </button>
                    </form>
                  )}
                  {o.status === "delivered" && (
                    <form action={resendEmail}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="rounded border px-2 py-1 text-xs hover:bg-[var(--bg-soft)]">
                        重发邮件
                      </button>
                    </form>
                  )}
                  {o.status !== "delivered" && o.status !== "closed" && (
                    <form action={closeOrder}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="rounded border px-2 py-1 text-xs text-red-500 hover:bg-red-50">
                        关单
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="p-4 text-sm text-[var(--fg-muted)]">暂无订单</div>}
      </div>
    </div>
  );
}
