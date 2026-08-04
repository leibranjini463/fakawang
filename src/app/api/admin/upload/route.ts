import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/cf";
import { randomToken } from "@/lib/crypto";
import { getSessionAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
// 类型白名单（禁 SVG，避免存储型 XSS）；扩展名由服务端从 MIME 推导。
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** 后台图片上传：鉴权 → 校验类型/大小 → 服务端生成 key → 存入 R2。 */
export async function POST(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "未授权" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "未选择文件" }, { status: 400 });
  }

  const ext = EXT[file.type];
  if (!ext) {
    return NextResponse.json({ error: "仅支持 PNG / JPEG / WebP 图片" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "图片不能超过 5MB" }, { status: 400 });
  }

  const buf = await file.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "图片不能超过 5MB" }, { status: 400 });
  }

  // key 一律服务端生成，绝不使用客户端文件名（防路径穿越）。
  const d = new Date();
  const yyyymm = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const key = `products/${yyyymm}/${randomToken(16)}.${ext}`;

  const env = await getEnv();
  await env.ASSETS_BUCKET.put(key, buf, { httpMetadata: { contentType: file.type } });

  return NextResponse.json({ key });
}
