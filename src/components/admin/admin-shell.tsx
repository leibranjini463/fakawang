"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { logoutAction } from "@/app/admin/login/actions";
import { NavLink } from "./nav-link";

const NAV = [
  { href: "/admin", label: "📊 仪表盘" },
  { href: "/admin/categories", label: "🗂 分类" },
  { href: "/admin/products", label: "📦 商品" },
  { href: "/admin/cards", label: "🎫 卡密" },
  { href: "/admin/orders", label: "🧾 订单" },
  { href: "/admin/channels", label: "💳 支付渠道" },
  { href: "/admin/announcements", label: "📢 公告" },
  { href: "/admin/settings", label: "⚙️ 设置" },
];

function SidebarBody({ username }: { username: string }) {
  return (
    <>
      <div className="px-2 py-3 text-lg font-bold">🌸 管理后台</div>
      <nav className="flex-1 space-y-1">
        {NAV.map((n) => (
          <NavLink key={n.href} href={n.href} label={n.label} />
        ))}
      </nav>
      <div className="border-t pt-2 text-xs text-[var(--fg-muted)]">
        <div className="px-2 py-1">👤 {username}</div>
        <Link href="/" className="block rounded-lg px-2 py-1.5 hover:bg-[var(--bg-soft)]">
          ← 返回前台
        </Link>
        <form action={logoutAction}>
          <button className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-[var(--bg-soft)]">
            退出登录
          </button>
        </form>
      </div>
    </>
  );
}

export function AdminShell({ username, children }: { username: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // 切换页面时自动收起移动端抽屉
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex min-h-dvh">
      {/* 桌面固定侧边栏 */}
      <aside className="hidden w-52 shrink-0 flex-col border-r bg-[var(--bg-card)] p-3 md:flex">
        <SidebarBody username={username} />
      </aside>

      {/* 移动端抽屉 */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r bg-[var(--bg-card)] p-3 shadow-xl">
            <SidebarBody username={username} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 移动端顶部栏 */}
        <header className="flex items-center gap-3 border-b bg-[var(--bg-card)] p-3 md:hidden">
          <button
            onClick={() => setOpen(true)}
            aria-label="菜单"
            className="grid h-9 w-9 place-items-center rounded-lg border text-lg hover:bg-[var(--bg-soft)]"
          >
            ☰
          </button>
          <span className="font-bold">🌸 管理后台</span>
        </header>
        <main className="min-w-0 flex-1 bg-[var(--bg)] p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
