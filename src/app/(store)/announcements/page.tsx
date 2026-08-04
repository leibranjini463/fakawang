import Link from "next/link";
import { Badge } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { listAnnouncements } from "@/services/storefront";

export const dynamic = "force-dynamic";
export const metadata = { title: "公告" };

export default async function AnnouncementsPage() {
  const list = await listAnnouncements();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">📢 站点公告</h1>
      {list.length === 0 ? (
        <div className="card text-[var(--fg-muted)]">暂无公告</div>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <Link key={a.id} href={`/announcements/${a.id}`} className="card block hover:shadow-md">
              <div className="flex items-center gap-2">
                {a.isPinned && <Badge tone="brand">置顶</Badge>}
                <span className="font-medium">{a.title}</span>
              </div>
              <div className="mt-1 text-xs text-[var(--fg-muted)]">
                {formatDateTime(a.createdAt)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
