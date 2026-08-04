import { OrderQueryForm } from "@/components/store/order-query-form";

export const metadata = { title: "订单查询" };

export default function OrderQueryPage() {
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-xl font-bold">订单查询</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          输入下单时的订单号与邮箱，即可查看订单状态并找回卡密。
        </p>
      </div>
      <OrderQueryForm turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""} />
    </div>
  );
}
