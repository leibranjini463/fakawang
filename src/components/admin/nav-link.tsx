"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** 后台侧边栏导航项：当前页高亮（/admin 精确匹配，其余按前缀）。 */
export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg px-3 py-2 text-sm transition",
        active
          ? "bg-brand-100 font-medium text-brand-700"
          : "text-[var(--fg)] hover:bg-[var(--bg-soft)]",
      )}
    >
      {label}
    </Link>
  );
}
