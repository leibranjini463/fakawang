import Link from "next/link";
import { Badge } from "@/components/ui";
import { cn, formatYuan, imageUrl } from "@/lib/utils";
import type { ProductWithStock } from "@/services/storefront";

export function ProductCard({ item }: { item: ProductWithStock }) {
  const { product: p, stock } = item;
  const soldOut = stock <= 0 && p.deliveryType === "auto";
  return (
    <Link
      href={`/product/${p.slug}`}
      className={cn(
        "card group overflow-hidden !p-0 transition hover:-translate-y-0.5 hover:shadow-lg",
        soldOut && "opacity-60",
      )}
    >
      <div className="aspect-[4/3] overflow-hidden bg-[var(--bg-soft)]">
        {p.imageKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(p.imageKey)}
            alt={p.name}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-4xl">🎁</div>
        )}
      </div>
      <div className="p-3">
        <div className="line-clamp-2 min-h-[2.5rem] text-sm font-medium">{p.name}</div>
        <div className="mt-2 flex items-center justify-between">
          <div className="font-bold text-brand-600">
            ￥{formatYuan(p.priceCents)}
            {p.hasVariants ? <span className="text-xs font-normal">起</span> : null}
            {p.originalPriceCents ? (
              <span className="ml-1 text-xs font-normal text-[var(--fg-muted)] line-through">
                ￥{formatYuan(p.originalPriceCents)}
              </span>
            ) : null}
          </div>
          {soldOut ? (
            <Badge tone="gray">售罄</Badge>
          ) : (
            <Badge tone="green">{stock > 99 ? "充足" : `剩 ${stock}`}</Badge>
          )}
        </div>
        <div className="mt-1 text-xs text-[var(--fg-muted)]">
          已售 {p.salesCount + p.salesBase}
        </div>
      </div>
    </Link>
  );
}
