import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // R2 图片直出，MVP 阶段关闭 Next 图片优化（Workers 上更省心）
    unoptimized: true,
  },
  // 商品/公告用 Markdown，允许一定的服务端渲染缓存能力
  experimental: {},
};

export default nextConfig;

// OpenNext Cloudflare 本地开发桥接：使 getCloudflareContext() 在 `next dev` 下
// 也能拿到 miniflare 模拟的 D1 / KV / R2 / secrets 绑定。
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
void initOpenNextCloudflareForDev();
