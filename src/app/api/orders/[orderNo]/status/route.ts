import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { orders } from "@/db/schema";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  const { orderNo } = await params;
  const db = await getDb();
  const row = (
    await db.select({ status: orders.status }).from(orders).where(eq(orders.orderNo, orderNo)).limit(1)
  )[0];
  return NextResponse.json({ status: row?.status ?? "unknown" });
}
