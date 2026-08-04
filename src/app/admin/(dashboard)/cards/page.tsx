import { asc, eq, sql } from "drizzle-orm";
import { CardImport } from "@/components/admin/card-import";
import { getDb } from "@/db";
import { productVariants, products } from "@/db/schema";
import { deleteUnsoldCards } from "../../actions";

export const dynamic = "force-dynamic";

export default async function CardsPage() {
  const db = await getDb();
  const list = await db.select().from(products).orderBy(asc(products.sortOrder));
  const allVariants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.isEnabled, true))
    .orderBy(asc(productVariants.sortOrder), asc(productVariants.id));
  const variantsByProduct = new Map<number, { id: number; name: string }[]>();
  for (const v of allVariants) {
    const arr = variantsByProduct.get(v.productId) ?? [];
    arr.push({ id: v.id, name: v.name });
    variantsByProduct.set(v.productId, arr);
  }
  const sc = (await db.run(
    sql`SELECT product_id AS pid, status, COUNT(*) AS c FROM cards GROUP BY product_id, status`,
  )) as unknown as { results?: Array<{ pid: number; status: string; c: number }> };
  const avail = new Map<number, number>();
  const sold = new Map<number, number>();
  for (const r of sc.results ?? []) {
    if (r.status === "available") avail.set(r.pid, r.c);
    else if (r.status === "sold") sold.set(r.pid, r.c);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-bold">卡密管理</h1>
      {list.length === 0 ? (
        <div className="card text-sm text-[var(--fg-muted)]">请先创建商品</div>
      ) : (
        <CardImport
          products={list.map((p) => ({
            id: p.id,
            name: p.name,
            hasVariants: p.hasVariants,
            variants: variantsByProduct.get(p.id) ?? [],
          }))}
        />
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--fg-muted)]">
            <tr>
              <th className="p-2">商品</th>
              <th className="p-2">可用</th>
              <th className="p-2">已售</th>
              <th className="p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.name}</td>
                <td className="p-2 font-medium">{avail.get(p.id) ?? 0}</td>
                <td className="p-2 text-[var(--fg-muted)]">{sold.get(p.id) ?? 0}</td>
                <td className="p-2">
                  <form action={deleteUnsoldCards}>
                    <input type="hidden" name="productId" value={p.id} />
                    <button className="rounded border px-2 py-1 text-xs text-red-500 hover:bg-red-50">
                      清空未售
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
