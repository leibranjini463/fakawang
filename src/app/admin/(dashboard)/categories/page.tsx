import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { categories } from "@/db/schema";
import { deleteCategory, saveCategory } from "../../actions";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const db = await getDb();
  const list = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-bold">分类管理</h1>

      <form action={saveCategory} className="card flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-[var(--fg-muted)]">名称</label>
          <input name="name" required className="input-base w-full px-3 py-2 text-sm" placeholder="如：游戏充值" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--fg-muted)]">slug（可空）</label>
          <input name="slug" className="input-base w-32 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--fg-muted)]">排序</label>
          <input name="sortOrder" defaultValue={0} className="input-base w-16 px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="isEnabled" defaultChecked /> 启用
        </label>
        <button className="btn-brand h-9 rounded-lg px-4 text-sm">新增</button>
      </form>

      <div className="space-y-2">
        {list.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-center gap-2">
            <form action={saveCategory} className="flex flex-1 flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={c.id} />
              <input name="name" defaultValue={c.name} className="input-base flex-1 px-2 py-1.5 text-sm" />
              <input name="slug" defaultValue={c.slug} className="input-base w-28 px-2 py-1.5 text-sm" />
              <input name="sortOrder" defaultValue={c.sortOrder} className="input-base w-14 px-2 py-1.5 text-sm" />
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" name="isEnabled" defaultChecked={c.isEnabled} /> 启用
              </label>
              <button className="rounded-lg border px-3 py-1.5 text-xs hover:bg-[var(--bg-soft)]">保存</button>
            </form>
            <form action={deleteCategory}>
              <input type="hidden" name="id" value={c.id} />
              <button className="rounded-lg border px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">删除</button>
            </form>
          </div>
        ))}
        {list.length === 0 && <div className="card text-sm text-[var(--fg-muted)]">暂无分类</div>}
      </div>
    </div>
  );
}
