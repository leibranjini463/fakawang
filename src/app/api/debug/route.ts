import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const out: Record<string, unknown> = {};
  const tables = (await db.run(sql`SELECT name, sql AS ddl FROM sqlite_master WHERE type='table' ORDER BY name`)) as unknown as { results?: Array<{ name: string; ddl: string }> };
  out.tables = tables.results ?? [];
  const admins = (await db.run(sql`SELECT id, username FROM admins ORDER BY id`)) as unknown as { results?: unknown };
  out.admins = admins.results ?? [];
  return NextResponse.json(out);
}
