import { type NextRequest } from "next/server";
import { getProvider } from "@/payments/registry";
import { buildPaymentContext, getChannelConfig } from "@/services/pay";
import { settle } from "@/services/settlement";

async function handle(req: NextRequest, code: string): Promise<Response> {
  const provider = getProvider(code);
  if (!provider?.handleNotify) {
    return new Response("unsupported", { status: 404 });
  }
  const ctx = await buildPaymentContext();
  const config = await getChannelConfig(ctx, code);

  let ack: Response;
  try {
    const result = await provider.handleNotify(ctx, req, config);
    ack = result.ack;
    if (result.notification) {
      await settle(ctx, result.notification, code, "callback");
    }
  } catch (e) {
    console.log("[notify:error]", code, e);
    return new Response("error", { status: 500 });
  }

  // Mock：回调后重定向回订单页，方便点击测试整条链路
  if (code === "mock") {
    const orderNo = new URL(req.url).searchParams.get("orderNo");
    return Response.redirect(`${ctx.baseUrl}/order/${orderNo}`, 302);
  }
  return ack;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return handle(req, provider);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  return handle(req, provider);
}
