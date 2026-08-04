import Link from "next/link";
import type { SiteSettings } from "@/lib/settings";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader({ settings }: { settings: SiteSettings }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold">
          {settings.logoText}
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg-soft)]">
            首页
          </Link>
          <Link href="/announcements" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg-soft)]">
            公告
          </Link>
          <Link href="/order/query" className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg-soft)]">
            订单查询
          </Link>
          {settings.contactUrl && (
            <a
              href={settings.contactUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg px-3 py-1.5 hover:bg-[var(--bg-soft)]"
            >
              {settings.contactText || "客服"}
            </a>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
