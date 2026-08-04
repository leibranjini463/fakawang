import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // MVP 阶段使用默认（纯动态 SSR，无额外 ISR 缓存后端）。
  // 后续需要 ISR / use cache 时，可在此接入 R2/KV incrementalCache。
});
