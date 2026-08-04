export function SortSearch({
  cat,
  sort,
  q,
}: {
  cat?: string;
  sort?: string;
  q?: string;
}) {
  return (
    <form action="/" className="flex flex-wrap items-center gap-2">
      {cat ? <input type="hidden" name="cat" value={cat} /> : null}
      <input
        name="q"
        defaultValue={q ?? ""}
        placeholder="🔍 搜索商品…"
        className="input-base flex-1 px-3 py-1.5 text-sm sm:flex-none"
      />
      <select name="sort" defaultValue={sort ?? "default"} className="input-base px-2 py-1.5 text-sm">
        <option value="default">综合</option>
        <option value="sales">销量</option>
        <option value="price_asc">价格 ↑</option>
        <option value="price_desc">价格 ↓</option>
        <option value="new">最新</option>
      </select>
      <button className="btn-brand rounded-lg px-4 py-1.5 text-sm">筛选</button>
    </form>
  );
}
