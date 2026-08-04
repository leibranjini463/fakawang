import { getDb } from "@/db";
import { settings } from "@/db/schema";

export type SiteSettings = {
  siteName: string;
  siteDesc: string;
  logoText: string;
  heroTitle: string;
  heroSubtitle: string;
  contactUrl: string;
  contactText: string;
  footerText: string;
  /** 1 USDT = ? CNY */
  usdtRate: number;
  orderExpireMinutes: number;
  maintenance: boolean;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  siteName: "Faka 发卡屋",
  siteDesc: "24 小时自动发货的虚拟商品小站",
  logoText: "🌸 Faka",
  heroTitle: "虚拟商品 · 即拍即发",
  heroSubtitle: "支付宝 / USDT / 币安 Pay 多渠道支付，付款后自动秒发卡密",
  contactUrl: "",
  contactText: "联系客服",
  footerText: "本站仅出售合规虚拟商品，下单即视为同意服务条款。",
  usdtRate: 7.2,
  orderExpireMinutes: 10,
  maintenance: false,
};

function coerce(defaults: SiteSettings, map: Record<string, string>): SiteSettings {
  return {
    siteName: map.siteName ?? defaults.siteName,
    siteDesc: map.siteDesc ?? defaults.siteDesc,
    logoText: map.logoText ?? defaults.logoText,
    heroTitle: map.heroTitle ?? defaults.heroTitle,
    heroSubtitle: map.heroSubtitle ?? defaults.heroSubtitle,
    contactUrl: map.contactUrl ?? defaults.contactUrl,
    contactText: map.contactText ?? defaults.contactText,
    footerText: map.footerText ?? defaults.footerText,
    usdtRate: map.usdtRate ? Number(map.usdtRate) || defaults.usdtRate : defaults.usdtRate,
    orderExpireMinutes: map.orderExpireMinutes
      ? Number(map.orderExpireMinutes) || defaults.orderExpireMinutes
      : defaults.orderExpireMinutes,
    maintenance: map.maintenance === "1" || map.maintenance === "true",
  };
}

export async function getSettings(): Promise<SiteSettings> {
  const db = await getDb();
  const rows = await db.select().from(settings);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return coerce(DEFAULT_SETTINGS, map);
}

export async function saveSettings(patch: Partial<Record<keyof SiteSettings, string>>): Promise<void> {
  const db = await getDb();
  const now = Date.now();
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    await db
      .insert(settings)
      .values({ key, value: String(value), updatedAt: now })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(value), updatedAt: now } });
  }
}
