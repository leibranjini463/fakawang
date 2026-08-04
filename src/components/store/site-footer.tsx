import Link from "next/link";
import type { SiteSettings } from "@/lib/settings";

export function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="border-t mt-10">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-[var(--fg-muted)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-semibold text-[var(--fg)]">{settings.siteName}</div>
            <p className="mt-1 max-w-md">{settings.footerText}</p>
          </div>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-[var(--fg)]">
              服务条款
            </Link>
            <Link href="/privacy" className="hover:text-[var(--fg)]">
              隐私政策
            </Link>
            <Link href="/order/query" className="hover:text-[var(--fg)]">
              订单查询
            </Link>
          </div>
        </div>
        <p className="mt-6 text-xs">
          © {new Date().getUTCFullYear()} {settings.siteName}. Powered by Next.js on Cloudflare.
        </p>
      </div>
    </footer>
  );
}
