import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDb();
  const out: Record<string, unknown> = {};
  for (const [name, table] of Object.entries(schema)) {
    if (!table || typeof table !== "object") continue;
    try {
      await db.select().from(table as never).limit(1);
      out[name] = { ok: true };
    } catch (e) {
      out[name] = { ok: false, error: String((e as { cause?: unknown })?.cause ?? e) };
    }
  }
  return NextResponse.json(out);
}
