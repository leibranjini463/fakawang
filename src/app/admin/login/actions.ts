"use server";
import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { admins } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { createSession, destroySession } from "@/lib/session";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!username || !password) return { error: "请输入账号和密码" };

  const db = await getDb();
  const h = await headers();
  const ip = h.get("cf-connecting-ip") || undefined;

  const countRow = (await db.run(sql`SELECT COUNT(*) AS c FROM admins`)) as unknown as {
    results?: Array<{ c: number }>;
  };
  const count = countRow.results?.[0]?.c ?? 0;

  // 首次登录即初始化管理员账号
  if (count === 0) {
    const passwordHash = await hashPassword(password);
    const [a] = await db.insert(admins).values({ username, passwordHash }).returning();
    await createSession(a.id, ip);
    redirect("/admin");
  }

  const admin = (await db.select().from(admins).where(eq(admins.username, username)).limit(1))[0];
  if (!admin) return { error: "账号或密码错误" };
  if (admin.lockedUntil && admin.lockedUntil > Date.now()) {
    return { error: "账号已锁定，请 15 分钟后再试" };
  }

  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) {
    const fails = admin.failedAttempts + 1;
    const lockedUntil = fails >= 5 ? Date.now() + 15 * 60 * 1000 : null;
    await db.update(admins).set({ failedAttempts: fails, lockedUntil }).where(eq(admins.id, admin.id));
    return { error: "账号或密码错误" };
  }

  await db.update(admins).set({ failedAttempts: 0, lockedUntil: null }).where(eq(admins.id, admin.id));
  await createSession(admin.id, ip);
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}
