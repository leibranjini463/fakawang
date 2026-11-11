import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { getActiveAnnouncements, getEnabledCategories, getProducts } from "@/services/storefront";

export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, unknown> = {};
  const tests: Record<string, () => Promise<unknown>> = {
    settings: () => getSettings(),
    categories: () => getEnabledCategories(),
    products: () => getProducts({}),
    announcements: () => getActiveAnnouncements(),
  };
  for (const [name, fn] of Object.entries(tests)) {
    try {
      const r = await fn();
      out[name] = { ok: true, n: Array.isArray(r) ? r.length : typeof r };
    } catch (e) {
      out[name] = { ok: false, error: String(e), cause: String((e as { cause?: unknown })?.cause ?? ""), stack: (e as Error)?.stack?.slice(0, 600) };
    }
  }
  return NextResponse.json(out);
}
