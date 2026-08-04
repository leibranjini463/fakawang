"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 轮询订单状态，一旦离开 pending 就刷新页面（切到发货结果视图）。 */
export function OrderStatusPoller({ orderNo, active }: { orderNo: string; active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    async function tick() {
      if (stopped || document.hidden) return;
      try {
        const r = await fetch(`/api/orders/${orderNo}/status`);
        const d = (await r.json()) as { status?: string };
        if (d.status && d.status !== "pending") {
          stopped = true;
          router.refresh();
        }
      } catch {}
    }
    const id = setInterval(tick, 4000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [orderNo, active, router]);
  return null;
}
