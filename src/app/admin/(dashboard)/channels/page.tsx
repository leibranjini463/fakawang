import { getDb } from "@/db";
import { paymentChannels } from "@/db/schema";
import { saveChannel } from "../../actions";

export const dynamic = "force-dynamic";

const PROVIDERS = [
  {
    provider: "epay",
    name: "易支付",
    tpl: '{\n  "gateway": "https://pay.example.com",\n  "pid": "1000",\n  "type": "alipay"\n}',
    secretHint: "商户密钥请配 wrangler secret：EPAY_KEY",
  },
  {
    provider: "alipay_f2f",
    name: "支付宝当面付",
    tpl: '{\n  "appId": "2021..."\n}',
    secretHint: "密钥：ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY",
  },
  {
    provider: "alipay_personal",
    name: "支付宝个人码（安卓通知监听）",
    tpl: '{\n  "account": "main",\n  "qrContent": "https://qr.alipay.com/..."\n}',
    secretHint: "共享密钥：ALIPAY_PUSH_SECRET（安卓端上报签名用，须与 App 内一致）",
  },
  {
    provider: "usdt",
    name: "USDT（TRC20 / Polygon / Arbitrum）",
    tpl: '{\n  "chains": [\n    { "chain": "TRC20", "address": "T...", "enabled": true },\n    { "chain": "POLYGON", "address": "0x...", "enabled": true },\n    { "chain": "ARBITRUM", "address": "0x...", "enabled": true }\n  ]\n}',
    secretHint: "API Key：TRONGRID_API_KEY（TRON）/ ETHERSCAN_API_KEY（Polygon+Arbitrum）",
  },
  {
    provider: "binance_pay",
    name: "Binance Pay",
    tpl: "{}",
    secretHint: "密钥：BINANCE_API_KEY / BINANCE_SECRET",
  },
];

export default async function ChannelsPage() {
  const db = await getDb();
  const rows = await db.select().from(paymentChannels);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">支付渠道配置</h1>
      <p className="text-sm text-[var(--fg-muted)]">
        敏感密钥请用 <code className="rounded bg-[var(--bg-soft)] px-1">wrangler secret put</code>{" "}
        配置，此处仅存非敏感配置。
      </p>
      {PROVIDERS.map((p) => {
        const ch = byProvider.get(p.provider);
        return (
          <form key={p.provider} action={saveChannel} className="card space-y-3">
            <input type="hidden" name="provider" value={p.provider} />
            <div className="flex items-center justify-between">
              <div className="font-semibold">{p.name}</div>
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="isEnabled" defaultChecked={ch?.isEnabled ?? false} /> 启用
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                显示名称
                <input
                  name="displayName"
                  defaultValue={ch?.displayName ?? p.name}
                  className="input-base w-full px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                排序
                <input
                  name="sortOrder"
                  defaultValue={ch?.sortOrder ?? 0}
                  className="input-base w-full px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="text-sm">
              配置 JSON
              <textarea
                name="config"
                rows={p.provider === "usdt" ? 7 : 3}
                defaultValue={ch?.config && ch.config !== "{}" ? ch.config : p.tpl}
                className="input-base w-full px-3 py-2 font-mono text-xs"
              />
            </label>
            <p className="text-xs text-[var(--fg-muted)]">🔑 {p.secretHint}</p>
            <button className="btn-brand h-9 rounded-lg px-4 text-sm">保存</button>
          </form>
        );
      })}
    </div>
  );
}
