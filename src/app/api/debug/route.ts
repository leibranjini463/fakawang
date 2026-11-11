import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { adminSessions } from "@/db/schema";
import { findLowStock } from "@/services/stock-alert";

export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, unknown> = {};
  const db = await getDb();
  const tables: Record<string, unknown> = {};
  for (const [name, table] of Object.entries(schema)) {
    if (table && typeof table === "object" && (table as { _?: unknown })._ !== undefined || name.endsWith("Relations")) {
      // only drizzle tables have the "_" marker via getTableConfig check below
    }
    try {
      await db.select().from(table as never).limit(1);
      tables[name] = { ok: true };
    } catch (e) {
      tables[name] = { ok: false, error: String(e), cause: String((e as { cause?: unknown })?.cause ?? "") };
    }
  }
  out.tables = tables;
  try {
    const r = (await db.run(sql`SELECT
      (SELECT COUNT(*) FROM orders WHERE status IN ('paid','delivered')) AS paidOrders,
      (SELECT COALESCE(SUM(payable_cents),0) FROM orders WHERE status IN ('paid','delivered')) AS revenue,
      (SELECT COUNT(*) FROM orders WHERE status='manual_review') AS review,
      (SELECT COUNT(*) FROM orders WHERE status='pending') AS pending,
      (SELECT COUNT(*) FROM products WHERE is_enabled=1) AS products,
      (SELECT COUNT(*) FROM cards WHERE status='available') AS stock`)) as unknown as { results?: unknown };
    out.dashboardSql = { ok: true, results: r.results };
  } catch (e) { out.dashboardSql = { ok: false, error: String(e) }; }
  try {
    const low = await findLowStock(db);
    out.lowStock = { ok: true, n: low.length };
  } catch (e) { out.lowStock = { ok: false, error: String(e) }; }
  try {
    await db.insert(adminSessions).values({ id: "verify-probe", adminId: 1, expiresAt: Date.now() + 60000, ip: "127.0.0.1", ua: "probe" });
    const rows = await db.select().from(adminSessions);
    await db.delete(adminSessions).where(sql`id = 'verify-probe'`);
    out.sessionProbe = { ok: true, rowsSeen: rows.length };
  } catch (e) { out.sessionProbe = { ok: false, error: String(e), cause: String((e as { cause?: unknown })?.cause ?? "") }; }
  try {
    const r = (await db.run(sql`SELECT COUNT(*) AS c FROM admins`)) as unknown as { results?: Array<{ c: number }> };
    out.adminCount = r.results?.[0]?.c;
  } catch (e) { out.adminCount = { error: String(e) }; }
  return NextResponse.json(out);
}
