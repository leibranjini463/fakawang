/**
 * 基于 KV 的轻量限流（最终一致，用于弱防刷）。
 * 强一致场景（登录锁定/幂等）走 D1，不要用这个。
 * @returns true=允许；false=超过限额
 */
export async function rateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  const k = `rl:${key}`;
  const cur = await kv.get(k);
  const n = cur ? parseInt(cur, 10) : 0;
  if (n >= limit) return false;
  await kv.put(k, String(n + 1), { expirationTtl: windowSec });
  return true;
}
