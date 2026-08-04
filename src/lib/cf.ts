import { getCloudflareContext } from "@opennextjs/cloudflare";

/** 获取 Cloudflare 运行时 env（bindings + secrets）。 */
export async function getEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as CloudflareEnv;
}

/** 同时拿 env 与 ctx（如需 waitUntil）。 */
export async function getCtx() {
  return getCloudflareContext({ async: true });
}
