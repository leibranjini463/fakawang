/// <reference types="@cloudflare/workers-types" />

// Cloudflare 运行时绑定与 Secrets 的类型声明。
// 可用 `npm run cf-typegen` 从 wrangler.jsonc 重新生成覆盖本文件。
declare global {
  interface CloudflareEnv {
    // ---- bindings ----
    DB: D1Database;
    FAKA_KV: KVNamespace;
    ASSETS_BUCKET: R2Bucket;
    ASSETS: Fetcher;

    // ---- secrets / vars ----
    /** 卡密加密主密钥（任意长度字符串，运行时 SHA-256 派生 32B AES-GCM key） */
    CARD_ENC_KEY: string;
    /** 会话签名密钥 */
    SESSION_SECRET: string;
    /** Cron 内部调用鉴权密钥 */
    CRON_SECRET: string;
    /** Cloudflare Turnstile 服务端密钥 */
    TURNSTILE_SECRET: string;
    /** Turnstile 站点公钥（也可走 NEXT_PUBLIC_ 前缀在前端读） */
    NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
    /** Resend 邮件 API Key（可空，空则跳过发信） */
    RESEND_API_KEY?: string;
    /** 发件人地址，如 "Faka <noreply@yourdomain.com>" */
    MAIL_FROM?: string;
    /** 站点公开基础 URL，用于生成支付回调/回跳地址 */
    NEXT_PUBLIC_SITE_URL?: string;

    // ---- 支付渠道 secrets（按需配置）----
    EPAY_KEY?: string;
    ALIPAY_PRIVATE_KEY?: string;
    ALIPAY_PUBLIC_KEY?: string;
    /** 支付宝个人码：安卓通知监听端上报的 HMAC 共享密钥 */
    ALIPAY_PUSH_SECRET?: string;
    BINANCE_API_KEY?: string;
    BINANCE_SECRET?: string;
    TRONGRID_API_KEY?: string;
    ETHERSCAN_API_KEY?: string;

    [key: string]: unknown;
  }
}

export {};
