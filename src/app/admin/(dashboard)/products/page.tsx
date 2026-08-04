import { asc, desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { ImageUpload } from "@/components/admin/image-upload";
import { getDb } from "@/db";
import { categories, productVariants, products } from "@/db/schema";
import { formatYuan } from "@/lib/utils";
import {
  deleteProduct,
  deleteVariant,
  saveProduct,
  saveVariant,
  toggleProduct,
  toggleVariant,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const db = await getDb();
  const editing = sp.edit
    ? (await db.select().from(products).where(eq(products.id, Number(sp.edit))).limit(1))[0]
    : null;
  const showForm = sp.new === "1" || !!editing;

  // 列表视图数据
  const list = showForm
    ? []
    : await db.select().from(products).orderBy(asc(products.sortOrder), desc(products.id));
  const stock = new Map<number, number>();
  if (!showForm) {
    const sc = (await db.run(
      sql`SELECT product_id AS pid, COUNT(*) AS c FROM cards WHERE status='available' GROUP BY product_id`,
    )) as unknown as { results?: Array<{ pid: number; c: number }> };
    for (const r of sc.results ?? []) stock.set(r.pid, r.c);
  }

  // 表单视图数据
  const cats = showForm ? await db.select().from(categories).orderBy(asc(categories.sortOrder)) : [];
  const variants = editing
    ? await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.productId, editing.id))
        .orderBy(asc(productVariants.sortOrder), asc(productVariants.id))
    : [];
  const vstock = new Map<number, number>();
  if (editing) {
    const vs = (await db.run(
      sql`SELECT variant_id AS vid, COUNT(*) AS c FROM cards WHERE status='available' AND product_id=${editing.id} AND variant_id IS NOT NULL GROUP BY variant_id`,
    )) as unknown as { results?: Array<{ vid: number; c: number }> };
    for (const r of vs.results ?? []) vstock.set(r.vid, r.c);
  }

  const inp = "input-base w-full px-3 py-2 text-sm";
  const vinp = "input-base w-24 px-2 py-1 text-sm";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">商品管理</h1>
        {!showForm && (
          <Link
            href="/admin/products?new=1"
            className="btn-brand inline-flex h-9 items-center rounded-xl px-4 text-sm font-semibold"
          >
            ＋ 新增商品
          </Link>
        )}
      </div>

      {showForm ? (
        <>
          <Link
            href="/admin/products"
            className="inline-flex items-center text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            ← 返回商品列表
          </Link>

          <form action={saveProduct} className="card grid grid-cols-1 gap-3 sm:grid-cols-2">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="sm:col-span-2 text-sm font-semibold">
              {editing ? `编辑商品 #${editing.id}` : "新增商品"}
            </div>
            <label className="text-sm">
              分类
              <select name="categoryId" defaultValue={editing?.categoryId ?? cats[0]?.id} className={inp}>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              商品名称
              <input name="name" required defaultValue={editing?.name ?? ""} className={inp} />
            </label>
            <label className="text-sm">
              slug（可空自动生成，建议填英文）
              <input name="slug" defaultValue={editing?.slug ?? ""} placeholder="如 steam-card" className={inp} />
            </label>
            <label className="text-sm sm:col-span-2">
              商品图片
              <ImageUpload name="imageKey" defaultValue={editing?.imageKey} />
            </label>
            <label className="text-sm">
              {editing?.hasVariants ? "起价（元，由规格自动维护）" : "售价（元）"}
              <input
                name="price"
                required
                defaultValue={editing ? formatYuan(editing.priceCents) : ""}
                className={inp}
              />
            </label>
            <label className="text-sm">
              划线原价（元，可空）
              <input
                name="originalPrice"
                defaultValue={editing?.originalPriceCents ? formatYuan(editing.originalPriceCents) : ""}
                className={inp}
              />
            </label>
            <label className="text-sm">
              发货方式
              <select name="deliveryType" defaultValue={editing?.deliveryType ?? "auto"} className={inp}>
                <option value="auto">自动发货</option>
                <option value="manual">人工发货</option>
              </select>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-sm">
                最小购买
                <input name="buyMin" defaultValue={editing?.buyMin ?? 1} className={inp} />
              </label>
              <label className="text-sm">
                最大购买
                <input name="buyMax" defaultValue={editing?.buyMax ?? 10} className={inp} />
              </label>
              <label className="text-sm">
                库存预警
                <input
                  name="stockAlertThreshold"
                  defaultValue={editing?.stockAlertThreshold ?? 10}
                  className={inp}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                销量基数
                <input name="salesBase" defaultValue={editing?.salesBase ?? 0} className={inp} />
              </label>
              <label className="text-sm">
                排序
                <input name="sortOrder" defaultValue={editing?.sortOrder ?? 0} className={inp} />
              </label>
            </div>
            <label className="text-sm sm:col-span-2">
              商品详情（Markdown）
              <textarea name="description" rows={4} defaultValue={editing?.description ?? ""} className={inp} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="isEnabled" defaultChecked={editing ? editing.isEnabled : true} /> 上架
            </label>
            <div className="sm:col-span-2">
              <button className="btn-brand h-10 rounded-xl px-6 text-sm font-semibold">
                {editing ? "保存修改" : "新增商品"}
              </button>
              {!editing && (
                <span className="ml-3 text-xs text-[var(--fg-muted)]">
                  如需多规格，先保存商品，再回来编辑、在下方「规格管理」中添加
                </span>
              )}
            </div>
          </form>

          {editing && (
            <div className="card space-y-3">
              <div className="text-sm font-semibold">
                规格管理（商品 #{editing.id}）
                <span className="ml-2 text-xs font-normal text-[var(--fg-muted)]">
                  添加任意规格后该商品即变为多规格：前台按规格售卖、卡密需按规格导入；停用全部规格则商品售罄
                </span>
              </div>

              {variants.length > 0 && (
                <div className="space-y-2">
                  {variants.map((v) => (
                    <div key={v.id} className="flex flex-wrap items-end gap-2 border-t pt-2">
                      <form action={saveVariant} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="productId" value={editing.id} />
                        <input type="hidden" name="isEnabled" value={v.isEnabled ? "on" : ""} />
                        <label className="text-xs">
                          规格名
                          <input name="name" defaultValue={v.name} className={vinp} />
                        </label>
                        <label className="text-xs">
                          价格
                          <input name="price" defaultValue={formatYuan(v.priceCents)} className={vinp} />
                        </label>
                        <label className="text-xs">
                          原价
                          <input
                            name="originalPrice"
                            defaultValue={v.originalPriceCents ? formatYuan(v.originalPriceCents) : ""}
                            className={vinp}
                          />
                        </label>
                        <label className="text-xs">
                          排序
                          <input
                            name="sortOrder"
                            defaultValue={v.sortOrder}
                            className="input-base w-16 px-2 py-1 text-sm"
                          />
                        </label>
                        <span className="pb-1 text-xs text-[var(--fg-muted)]">
                          库存 {vstock.get(v.id) ?? 0}
                        </span>
                        <button className="rounded border px-2 py-1 text-xs hover:bg-[var(--bg-soft)]">
                          保存
                        </button>
                      </form>
                      <form action={toggleVariant}>
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="productId" value={editing.id} />
                        <button className="rounded border px-2 py-1 text-xs hover:bg-[var(--bg-soft)]">
                          {v.isEnabled ? "停用" : "启用"}
                        </button>
                      </form>
                      <form action={deleteVariant}>
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="productId" value={editing.id} />
                        <button className="rounded border px-2 py-1 text-xs text-red-500 hover:bg-red-50">
                          删除
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}

              <form action={saveVariant} className="flex flex-wrap items-end gap-2 border-t pt-3">
                <input type="hidden" name="productId" value={editing.id} />
                <div className="w-full text-xs font-medium text-[var(--fg-muted)]">添加规格</div>
                <label className="text-xs">
                  规格名
                  <input name="name" required placeholder="如 月卡" className={vinp} />
                </label>
                <label className="text-xs">
                  价格
                  <input name="price" required placeholder="15.00" className={vinp} />
                </label>
                <label className="text-xs">
                  原价
                  <input name="originalPrice" placeholder="可空" className={vinp} />
                </label>
                <label className="text-xs">
                  排序
                  <input name="sortOrder" defaultValue={0} className="input-base w-16 px-2 py-1 text-sm" />
                </label>
                <label className="flex items-center gap-1 pb-1 text-xs">
                  <input type="checkbox" name="isEnabled" defaultChecked /> 启用
                </label>
                <button className="btn-brand rounded-lg px-4 py-1.5 text-xs font-medium">添加</button>
              </form>
            </div>
          )}
        </>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--fg-muted)]">
              <tr>
                <th className="p-2">商品</th>
                <th className="p-2">价格</th>
                <th className="p-2">库存</th>
                <th className="p-2">状态</th>
                <th className="p-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="p-2">{p.name}</td>
                  <td className="p-2">￥{formatYuan(p.priceCents)}</td>
                  <td className="p-2">{p.deliveryType === "auto" ? (stock.get(p.id) ?? 0) : "—"}</td>
                  <td className="p-2">{p.isEnabled ? "上架" : "下架"}</td>
                  <td className="flex gap-1 p-2">
                    <Link
                      href={`/admin/products?edit=${p.id}`}
                      className="rounded border px-2 py-1 text-xs hover:bg-[var(--bg-soft)]"
                    >
                      编辑
                    </Link>
                    <form action={toggleProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="rounded border px-2 py-1 text-xs hover:bg-[var(--bg-soft)]">
                        {p.isEnabled ? "下架" : "上架"}
                      </button>
                    </form>
                    <form action={deleteProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="rounded border px-2 py-1 text-xs text-red-500 hover:bg-red-50">
                        删除
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && (
            <div className="p-4 text-sm text-[var(--fg-muted)]">
              暂无商品，点击右上角「＋ 新增商品」开始
            </div>
          )}
        </div>
      )}
    </div>
  );
}
