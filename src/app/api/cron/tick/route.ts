import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/cf";
import { runCronTick } from "@/services/cron";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const env = await getEnv();
  const secret = req.headers.get("x-cron-secret");
  // 生产环境强制校验；开发环境允许手动 curl 触发
  if (process.env.NODE_ENV === "production" && env.CRON_SECRET && secret !== env.CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const cron = new URL(req.url).searchParams.get("cron") || undefined;
  try {
    const out = await runCronTick(cron);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    console.log("[cron:error]", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
