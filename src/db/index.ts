import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type DB = ReturnType<typeof drizzle<typeof schema>>;

/** 获取绑定 D1 的 Drizzle 实例（在 next dev 下经 miniflare 提供本地 D1）。 */
export async function getDb(): Promise<DB> {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}

export { schema };
