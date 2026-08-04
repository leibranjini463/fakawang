import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { formatYuan } from "@/lib/utils";
import { findLowStock } from "@/services/stock-alert";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: string;
  tone?: string;
}) {
  return (
    <div className="card flex items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-xl">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-[var(--fg-muted)]">{label}</div>
        <div className={`text-2xl font-bold ${tone ?? ""}`}>{value}</div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const db = await getDb();
  const r = (await db.run(sql`SELECT
    (SELECT COUNT(*) FROM orders WHERE status IN ('paid','delivered')) AS paidOrders,
    (SELECT COALESCE(SUM(payable_cents),0) FROM orders WHERE status IN ('paid','delivered')) AS revenue,
    (SELECT COUNT(*) FROM orders WHERE status='manual_review') AS review,
    (SELECT COUNT(*) FROM orders WHERE status='pending') AS pending,
    (SELECT COUNT(*) FROM products WHERE is_enabled=1) AS products,
    (SELECT COUNT(*) FROM cards WHERE status='available') AS stock`)) as unknown as {
    results?: Array<Record<string, number>>;
  };
  const st = r.results?.[0] ?? {};
  const low = await findLowStock(db);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">仪表盘</h1>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat icon="🧾" label="成交订单" value={String(st.paidOrders ?? 0)} />
        <Stat icon="💰" label="累计营收" value={`￥${formatYuan(st.revenue ?? 0)}`} tone="text-brand-600" />
        <Stat icon="🛠" label="待处理(人工)" value={String(st.review ?? 0)} tone={st.review ? "text-red-500" : ""} />
        <Stat icon="⏳" label="待支付" value={String(st.pending ?? 0)} />
        <Stat icon="📦" label="在售商品" value={String(st.products ?? 0)} />
        <Stat icon="🎫" label="可用库存(卡密)" value={String(st.stock ?? 0)} />
      </div>

      <div>
        <h2 className="mb-2 font-semibold">⚠️ 低库存预警</h2>
        {low.length === 0 ? (
          <div className="card text-sm text-[var(--fg-muted)]">暂无低库存商品</div>
        ) : (
          <div className="card divide-y">
            {low.map((i) => (
              <div key={i.name} className="flex items-center justify-between py-2 text-sm">
                <span>{i.name}</span>
                <span className="font-medium text-red-500">剩 {i.stock}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
