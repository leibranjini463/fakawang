import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** 分 → 元字符串（两位小数）。 */
export function formatYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** 统一用北京时间(UTC+8)格式化，避免 SSR/CSR 时区不一致导致 hydration mismatch。 */
export function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return "-";
  const d = new Date(ts + 8 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** 邮箱脱敏：ab****@domain.com */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const user = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = user.slice(0, Math.min(2, user.length));
  return `${head}${"*".repeat(Math.max(1, user.length - head.length))}@${domain}`;
}

export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/** 安全解析 JSON，失败返回默认值。 */
export function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 商品图片地址：外链(http/https) 直连，否则视为 R2 object key 走读取路由。 */
export function imageUrl(key: string): string {
  return /^https?:\/\//.test(key) ? key : `/api/assets/${key}`;
}
