import { CategoryTabs } from "@/components/store/category-tabs";
import { ProductCard } from "@/components/store/product-card";
import { SortSearch } from "@/components/store/sort-search";
import { getSettings } from "@/lib/settings";
import { getEnabledCategories, getProducts, type ProductSort } from "@/services/storefront";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; sort?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const [settings, categories, items] = await Promise.all([
    getSettings(),
    getEnabledCategories(),
    getProducts({ categorySlug: sp.cat, sort: (sp.sort as ProductSort) || "default", q: sp.q }),
  ]);

  return (
    <div className="space-y-6">
      <section className="card relative overflow-hidden p-8">
        <div className="relative z-10 max-w-xl">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{settings.heroTitle}</h1>
          <p className="mt-2 text-[var(--fg-muted)]">{settings.heroSubtitle}</p>
          <div className="mt-4 flex gap-2 text-xs text-[var(--fg-muted)]">
            <span className="rounded-full bg-[var(--bg-soft)] px-3 py-1">⚡ 自动秒发</span>
            <span className="rounded-full bg-[var(--bg-soft)] px-3 py-1">🔒 加密存储</span>
            <span className="rounded-full bg-[var(--bg-soft)] px-3 py-1">💱 多渠道支付</span>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-6 -top-6 text-[120px] opacity-20 select-none">
          🌸
        </div>
      </section>

      <CategoryTabs categories={categories} current={sp.cat} />
      <SortSearch cat={sp.cat} sort={sp.sort} q={sp.q} />

      {items.length === 0 ? (
        <div className="card grid place-items-center py-16 text-[var(--fg-muted)]">
          暂无商品
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <ProductCard key={item.product.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
