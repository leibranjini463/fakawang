import Link from "next/link";
import { notFound } from "next/navigation";
import { renderMarkdown } from "@/lib/markdown";
import { formatDateTime } from "@/lib/utils";
import { getAnnouncement } from "@/services/storefront";

export const dynamic = "force-dynamic";

export default async function AnnouncementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getAnnouncement(Number(id));
  if (!a || !a.isEnabled) notFound();

  return (
    <article className="mx-auto max-w-2xl space-y-3">
      <Link href="/announcements" className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        ← 返回公告列表
      </Link>
      <h1 className="text-xl font-bold">{a.title}</h1>
      <div className="text-xs text-[var(--fg-muted)]">{formatDateTime(a.createdAt)}</div>
      <div
        className="prose-faka card"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(a.content) }}
      />
    </article>
  );
}
