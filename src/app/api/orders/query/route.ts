import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/cf";
import { verifyTurnstile } from "@/lib/turnstile";
import { queryOrder } from "@/services/order-query";

const schema = z.object({
  orderNo: z.string().min(4).max(64),
  email: z.string().min(3).max(120),
  queryPass: z.string().max(32).optional(),
  turnstileToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const p = schema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "参数错误" }, { status: 400 });

  const env = await getEnv();
  const ip = req.headers.get("cf-connecting-ip") || undefined;
  const ok = await verifyTurnstile(p.data.turnstileToken ?? null, env.TURNSTILE_SECRET, ip);
  if (!ok) return NextResponse.json({ error: "人机验证失败，请重试" }, { status: 400 });

  const res = await queryOrder(p.data.orderNo, p.data.email, p.data.queryPass);
  if (!res) return NextResponse.json({ error: "未找到订单，请核对订单号与邮箱" }, { status: 404 });

  const o = res.order;
  return NextResponse.json({
    order: {
      orderNo: o.orderNo,
      status: o.status,
      productName: o.productName,
      variantName: o.variantName,
      quantity: o.quantity,
      payableCents: o.payableCents,
      createdAt: o.createdAt,
    },
    cards: res.cards ?? null,
  });
}
