import { type NextRequest } from "next/server";
import { getEnv } from "@/lib/cf";

export const dynamic = "force-dynamic";

// 仅在白名单内的类型才原样下发，其余降级为八位字节流，避免被当成可执行内容。
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

/** 读取 R2 中的图片对象（catch-all 允许 key 含 `/`）。 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: parts } = await params;
  const key = (parts ?? []).join("/");
  if (!key) return new Response("Not found", { status: 404 });

  const env = await getEnv();
  const obj = await env.ASSETS_BUCKET.get(key);
  if (!obj) return new Response("Not found", { status: 404 });

  // 条件请求：命中 ETag 直接 304。
  if (req.headers.get("if-none-match") === obj.httpEtag) {
    return new Response(null, { status: 304, headers: { ETag: obj.httpEtag } });
  }

  const rawType = obj.httpMetadata?.contentType ?? "application/octet-stream";
  const contentType = ALLOWED.has(rawType) ? rawType : "application/octet-stream";

  return new Response(obj.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      ETag: obj.httpEtag,
    },
  });
}
