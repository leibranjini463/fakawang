import { getSettings } from "@/lib/settings";
import { saveSettingsAction } from "../../actions";

export const dynamic = "force-dynamic";

function Row({
  name,
  label,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  defaultValue: string | number;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <input name={name} defaultValue={defaultValue} className="input-base w-full px-3 py-2 text-sm" />
      {hint && <p className="mt-1 text-xs text-[var(--fg-muted)]">{hint}</p>}
    </div>
  );
}

export default async function SettingsPage() {
  const s = await getSettings();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">系统设置</h1>
      <form action={saveSettingsAction} className="card space-y-4">
        <Row name="siteName" label="站点名称" defaultValue={s.siteName} />
        <Row name="siteDesc" label="站点描述" defaultValue={s.siteDesc} />
        <Row name="logoText" label="Logo 文字" defaultValue={s.logoText} />
        <Row name="heroTitle" label="首页大标题" defaultValue={s.heroTitle} />
        <Row name="heroSubtitle" label="首页副标题" defaultValue={s.heroSubtitle} />
        <Row name="contactText" label="客服文字" defaultValue={s.contactText} />
        <Row name="contactUrl" label="客服链接" defaultValue={s.contactUrl} hint="留空则不显示客服入口" />
        <Row name="footerText" label="页脚文案" defaultValue={s.footerText} />
        <Row name="usdtRate" label="USDT 汇率 (1 USDT = ? CNY)" defaultValue={s.usdtRate} />
        <Row name="orderExpireMinutes" label="订单超时(分钟)" defaultValue={s.orderExpireMinutes} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="maintenance" defaultChecked={s.maintenance} /> 维护模式
        </label>
        <button className="btn-brand h-10 rounded-xl px-6 text-sm font-semibold">保存设置</button>
      </form>
    </div>
  );
}
