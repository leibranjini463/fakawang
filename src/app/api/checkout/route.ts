import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/cf";
import { verifyTurnstile } from "@/lib/turnstile";
import { createOrder } from "@/services/order";

const schema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().optional(),
  quantity: z.number().int().positive(),
  email: z.string().min(3).max(120).refine((v) => /.+@.+\..+/.test(v), "邮箱格式不正确"),
  provider: z.string().min(1),
  usdtChain: z.enum(["TRC20", "POLYGON", "ARBITRUM"]).optional(),
  queryPass: z.string().max(32).optional(),
  turnstileToken: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "参数错误" }, { status: 400 });
  }
  const env = await getEnv();
  const ip = req.headers.get("cf-connecting-ip") || undefined;
  const ok = await verifyTurnstile(parsed.data.turnstileToken ?? null, env.TURNSTILE_SECRET, ip);
  if (!ok) return NextResponse.json({ error: "人机验证失败，请重试" }, { status: 400 });

  const res = await createOrder({
    productId: parsed.data.productId,
    variantId: parsed.data.variantId,
    quantity: parsed.data.quantity,
    email: parsed.data.email,
    provider: parsed.data.provider,
    usdtChain: parsed.data.usdtChain,
    queryPass: parsed.data.queryPass || undefined,
    ip,
    ua: req.headers.get("user-agent") || undefined,
  });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ orderNo: res.order.orderNo });
}
