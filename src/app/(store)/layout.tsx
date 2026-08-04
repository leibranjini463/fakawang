import type { Metadata } from "next";
import { AnnouncementBar } from "@/components/store/announcement-bar";
import { AnnouncementModal } from "@/components/store/announcement-modal";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";
import { renderMarkdown } from "@/lib/markdown";
import { getSettings } from "@/lib/settings";
import { getActiveAnnouncements } from "@/services/storefront";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return { title: s.siteName, description: s.siteDesc };
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, anns] = await Promise.all([getSettings(), getActiveAnnouncements()]);
  const bar = anns.find((a) => a.type === "bar");
  const popup = anns.find((a) => a.type === "popup");
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader settings={settings} />
      {bar && <AnnouncementBar text={bar.title} />}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <SiteFooter settings={settings} />
      {popup && (
        <AnnouncementModal id={popup.id} title={popup.title} html={renderMarkdown(popup.content)} />
      )}
    </div>
  );
}
