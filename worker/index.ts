// 自定义 Worker 入口：复用 OpenNext 生成的 fetch，并追加 Cron 的 scheduled handler。
// 注意：../.open-next/worker.js 由 `opennextjs-cloudflare build` 在构建时生成，
// 因此这里用 @ts-ignore 忽略构建前的类型缺失。
// @ts-ignore - generated at build time
import handler from "../.open-next/worker.js";

export default {
  fetch: handler.fetch,
  async scheduled(controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    const url = `https://internal/api/cron/tick?cron=${encodeURIComponent(controller.cron)}`;
    const req = new Request(url, {
      headers: { "x-cron-secret": (env as unknown as { CRON_SECRET?: string }).CRON_SECRET || "" },
    });
    ctx.waitUntil(handler.fetch(req, env, ctx));
  },
} satisfies ExportedHandler<CloudflareEnv>;
