import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { admins, adminSessions } from "@/db/schema";
import { hashPassword } from "@/lib/crypto";
import { findLowStock } from "@/services/stock-alert";

export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, unknown> = {};
  const db = await getDb();
  try {
    const r = (await db.run(sql`SELECT COUNT(*) AS c FROM admins`)) as unknown as { results?: Array<{ c: number }> };
    out.adminCount = r.results?.[0]?.c;
  } catch (e) { out.adminCount = { error: String(e) }; }
  try {
    const t0 = Date.now();
    const h = await hashPassword("probe-password-123");
    out.hash = { ok: true, ms: Date.now() - t0, prefix: h.slice(0, 24) };
  } catch (e) { out.hash = { ok: false, error: String(e) }; }
  try {
    const [a] = await db.insert(admins).values({ username: "__probe__", passwordHash: "x" }).returning();
    await db.insert(adminSessions).values({ id: "probe-session-id", adminId: a.id, expiresAt: Date.now() + 1000 });
    out.probeInsert = { ok: true, adminId: a.id };
    await db.delete(adminSessions).where(sql`id = 'probe-session-id'`);
    await db.delete(admins).where(sql`id = ${a.id}`);
    out.probeCleanup = { ok: true };
  } catch (e) { out.probeInsert = { ok: false, error: String(e), cause: String((e as { cause?: unknown })?.cause ?? "") }; }
  try {
    const r = (await db.run(sql`SELECT (SELECT COUNT(*) FROM orders WHERE status IN ('paid','delivered')) AS paidOrders, (SELECT COUNT(*) FROM products WHERE is_enabled=1) AS products, (SELECT COUNT(*) FROM cards WHERE status='available') AS stock`)) as unknown as { results?: unknown };
    out.dashboardSql = { ok: true, results: r.results };
  } catch (e) { out.dashboardSql = { ok: false, error: String(e) }; }
  try {
    const low = await findLowStock(db);
    out.lowStock = { ok: true, n: low.length };
  } catch (e) { out.lowStock = { ok: false, error: String(e), cause: String((e as { cause?: unknown })?.cause ?? "") }; }
  return NextResponse.json(out);
}
