#!/usr/bin/env node
/**
 * 支付宝个人码：模拟安卓端上报到账通知（联调 / 自测用）。
 *
 * 用法：
 *   node scripts/alipay-push-test.mjs <金额元> [--url http://localhost:3000] [--account main]
 *
 * 环境变量：
 *   ALIPAY_PUSH_SECRET  与服务端 wrangler secret 一致（默认读 .dev.vars）
 *
 * 例：node scripts/alipay-push-test.mjs 12.03
 */
import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

function loadSecret() {
  if (process.env.ALIPAY_PUSH_SECRET) return process.env.ALIPAY_PUSH_SECRET;
  try {
    const txt = readFileSync(new URL("../.dev.vars", import.meta.url), "utf8");
    const m = txt.match(/^ALIPAY_PUSH_SECRET\s*=\s*"?([^"\n\r]+)"?/m);
    if (m) return m[1];
  } catch {}
  return "";
}

const args = process.argv.slice(2);
const yuan = args.find((a) => !a.startsWith("--"));
const getFlag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

if (!yuan) {
  console.error("用法: node scripts/alipay-push-test.mjs <金额元> [--url ...] [--account main]");
  process.exit(1);
}

const baseUrl = getFlag("url", "http://localhost:3000").replace(/\/+$/, "");
const account = getFlag("account", "main");
const secret = loadSecret();
if (!secret) {
  console.error("缺少 ALIPAY_PUSH_SECRET（设环境变量，或写进 .dev.vars）");
  process.exit(1);
}

const amountCents = Math.round(parseFloat(yuan) * 100);
const bizId = randomUUID();
const ts = Date.now();

// 待签名串：必须与 src/payments/providers/alipay-personal.ts 的 pushSignPayload 完全一致
const payload = `${account}|${amountCents}|${bizId}|${ts}`;
const sign = createHmac("sha256", secret).update(payload, "utf8").digest("hex");

const body = {
  account,
  amountCents,
  bizId,
  ts,
  sign,
  rawText: `你有一笔${(amountCents / 100).toFixed(2)}元的收款`,
};

console.log("→ 待签名串:", payload);
console.log("→ 请求体  :", JSON.stringify(body, null, 2));

const res = await fetch(`${baseUrl}/api/pay/notify/alipay_personal`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
console.log("← HTTP", res.status, await res.text());
