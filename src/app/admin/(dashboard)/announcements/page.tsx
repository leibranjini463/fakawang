import { desc } from "drizzle-orm";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/db";
import { announcements } from "@/db/schema";
import { formatDateTime } from "@/lib/utils";
import { deleteAnnouncement, saveAnnouncement, toggleAnnouncement } from "../../actions";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { popup: "弹窗", bar: "跑马灯", list: "列表" };

export default async function AnnouncementsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const sp = await searchParams;
  const db = await getDb();
  const list = await db.select().from(announcements).orderBy(desc(announcements.id));
  const editing = sp.edit
    ? (await db.select().from(announcements).where(eq(announcements.id, Number(sp.edit))).limit(1))[0]
    : null;
  const inp = "input-base w-full px-3 py-2 text-sm";

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">公告管理</h1>

      <form action={saveAnnouncement} className="card space-y-3">
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="text-sm font-semibold">
          {editing ? `编辑公告 #${editing.id}` : "新增公告"}
          {editing && (
            <Link href="/admin/announcements" className="ml-2 text-xs text-[var(--fg-muted)]">
              取消
            </Link>
          )}
        </div>
        <input name="title" required placeholder="标题" defaultValue={editing?.title ?? ""} className={inp} />
        <textarea
          name="content"
          rows={4}
          placeholder="正文（支持 Markdown）"
          defaultValue={editing?.content ?? ""}
          className={inp}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm">
            类型
            <select name="type" defaultValue={editing?.type ?? "list"} className={inp}>
              <option value="list">列表</option>
              <option value="popup">首页弹窗</option>
              <option value="bar">顶部跑马灯</option>
            </select>
          </label>
          <label className="text-sm">
            排序
            <input name="sortOrder" defaultValue={editing?.sortOrder ?? 0} className="input-base w-16 px-2 py-2 text-sm" />
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="isPinned" defaultChecked={editing?.isPinned ?? false} /> 置顶
          </label>
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="isEnabled" defaultChecked={editing ? editing.isEnabled : true} /> 启用
          </label>
        </div>
        <button className="btn-brand h-9 rounded-lg px-4 text-sm">
          {editing ? "保存" : "新增"}
        </button>
      </form>

      <div className="space-y-2">
        {list.map((a) => (
          <div key={a.id} className="card flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[var(--bg-soft)] px-1.5 py-0.5 text-xs">
                  {TYPE_LABEL[a.type]}
                </span>
                <span className="truncate font-medium">{a.title}</span>
                {!a.isEnabled && <span className="text-xs text-[var(--fg-muted)]">(停用)</span>}
              </div>
              <div className="mt-1 text-xs text-[var(--fg-muted)]">{formatDateTime(a.createdAt)}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Link
                href={`/admin/announcements?edit=${a.id}`}
                className="rounded border px-2 py-1 text-xs hover:bg-[var(--bg-soft)]"
              >
                编辑
              </Link>
              <form action={toggleAnnouncement}>
                <input type="hidden" name="id" value={a.id} />
                <button className="rounded border px-2 py-1 text-xs hover:bg-[var(--bg-soft)]">
                  {a.isEnabled ? "停用" : "启用"}
                </button>
              </form>
              <form action={deleteAnnouncement}>
                <input type="hidden" name="id" value={a.id} />
                <button className="rounded border px-2 py-1 text-xs text-red-500 hover:bg-red-50">
                  删除
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
