import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Category } from "@/db/schema";

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 rounded-full border px-4 py-1.5 text-sm transition",
        active
          ? "btn-brand border-transparent"
          : "bg-[var(--bg-card)] hover:bg-[var(--bg-soft)]",
      )}
    >
      {children}
    </Link>
  );
}

export function CategoryTabs({
  categories,
  current,
}: {
  categories: Category[];
  current?: string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <Tab href="/" active={!current}>
        🔥 全部
      </Tab>
      {categories.map((c) => (
        <Tab key={c.id} href={`/?cat=${c.slug}`} active={current === c.slug}>
          {c.name}
        </Tab>
      ))}
    </div>
  );
}
