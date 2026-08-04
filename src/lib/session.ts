import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { adminSessions, admins, type Admin } from "@/db/schema";
import { randomToken } from "./crypto";

const COOKIE = "faka_admin";
const TTL_MS = 7 * 24 * 3600 * 1000;

export async function createSession(
  adminId: number,
  ip?: string,
  ua?: string,
): Promise<void> {
  const db = await getDb();
  const id = randomToken(32);
  const expiresAt = Date.now() + TTL_MS;
  await db.insert(adminSessions).values({ id, adminId, expiresAt, ip, ua });
  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function getSessionAdmin(): Promise<Admin | null> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  const db = await getDb();
  const s = (
    await db
      .select()
      .from(adminSessions)
      .where(and(eq(adminSessions.id, id), gt(adminSessions.expiresAt, Date.now())))
      .limit(1)
  )[0];
  if (!s) return null;
  const a = (await db.select().from(admins).where(eq(admins.id, s.adminId)).limit(1))[0];
  return a ?? null;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) {
    const db = await getDb();
    await db.delete(adminSessions).where(eq(adminSessions.id, id));
    jar.delete(COOKIE);
  }
}

/** 在 Server Action 中强制要求登录，未登录抛错。 */
export async function requireAdmin(): Promise<Admin> {
  const a = await getSessionAdmin();
  if (!a) throw new Error("UNAUTHORIZED");
  return a;
}
