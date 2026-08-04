import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { paymentChannels } from "@/db/schema";
import { OrderForm, type OrderFormChannel } from "@/components/store/order-form";
import { Badge } from "@/components/ui";
import { renderMarkdown } from "@/lib/markdown";
import { getSettings } from "@/lib/settings";
import { type UsdtChain } from "@/payments/money";
import { formatYuan, imageUrl, safeJson } from "@/lib/utils";
import { getProductBySlug } from "@/services/storefront";

export const dynamic = "force-dynamic";

type ChainCfg = { chain: UsdtChain; address: string; enabled?: boolean };

async function loadChannels(): Promise<OrderFormChannel[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(paymentChannels)
    .where(eq(paymentChannels.isEnabled, true))
    .orderBy(asc(paymentChannels.sortOrder));
  const channels: OrderFormChannel[] = rows.map((c) => ({
    provider: c.provider,
    displayName: c.displayName,
    usdtChains:
      c.provider === "usdt"
        ? safeJson<{ chains?: ChainCfg[] }>(c.config, {})
            .chains?.filter((x) => x.enabled !== false && x.address)
            .map((x) => x.chain)
        : undefined,
  }));
  if (process.env.NODE_ENV !== "production") {
    channels.unshift({ provider: "mock", displayName: "🧪 模拟支付(测试)" });
  }
  return channels;
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, settings, channels] = await Promise.all([
    getProductBySlug(slug),
    getSettings(),
    loadChannels(),
  ]);
  if (!data) notFound();
  const { product, stock, variants, category } = data;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-[var(--fg-muted)]">
        <Link href="/" className="hover:text-[var(--fg)]">
          首页
        </Link>
        {category && (
          <>
            {" / "}
            <Link href={`/?cat=${category.slug}`} className="hover:text-[var(--fg)]">
              {category.name}
            </Link>
          </>
        )}
        {" / "}
        <span className="text-[var(--fg)]">{product.name}</span>
      </nav>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="card aspect-[4/3] overflow-hidden !p-0">
            {product.imageKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl(product.imageKey)} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-6xl">🎁</div>
            )}
          </div>
          <div className="hidden md:block">
            <h2 className="mb-2 font-semibold">商品详情</h2>
            <div
              className="prose-faka card text-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(product.description) }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold">{product.name}</h1>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-2xl font-extrabold text-brand-600">
                ￥{formatYuan(product.priceCents)}
                {product.hasVariants ? <span className="text-sm font-normal"> 起</span> : null}
              </span>
              {product.originalPriceCents ? (
                <span className="text-sm text-[var(--fg-muted)] line-through">
                  ￥{formatYuan(product.originalPriceCents)}
                </span>
              ) : null}
              {product.deliveryType === "auto" ? (
                stock > 0 ? (
                  <Badge tone="green">库存 {stock}</Badge>
                ) : (
                  <Badge tone="gray">售罄</Badge>
                )
              ) : (
                <Badge tone="brand">人工发货</Badge>
              )}
            </div>
            <div className="mt-1 text-xs text-[var(--fg-muted)]">
              已售 {product.salesCount + product.salesBase} 件
            </div>
          </div>

          <OrderForm
            product={{
              id: product.id,
              name: product.name,
              priceCents: product.priceCents,
              originalPriceCents: product.originalPriceCents,
              wholesaleTiers: product.wholesaleTiers,
              buyMin: product.buyMin,
              buyMax: product.buyMax,
              deliveryType: product.deliveryType,
              hasVariants: product.hasVariants,
            }}
            variants={variants.map((v) => ({
              id: v.variant.id,
              name: v.variant.name,
              priceCents: v.variant.priceCents,
              originalPriceCents: v.variant.originalPriceCents,
              stock: v.stock,
            }))}
            stock={stock}
            channels={channels}
            usdtRate={settings.usdtRate}
            turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
          />
        </div>
      </div>

      <div className="md:hidden">
        <h2 className="mb-2 font-semibold">商品详情</h2>
        <div
          className="prose-faka card text-sm"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(product.description) }}
        />
      </div>
    </div>
  );
}
