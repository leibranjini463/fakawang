import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { getSessionAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getSessionAdmin();
  if (!admin) redirect("/admin/login");

  return <AdminShell username={admin.username}>{children}</AdminShell>;
}
