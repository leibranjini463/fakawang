export function AnnouncementBar({ text }: { text: string }) {
  return (
    <div className="border-b bg-brand-50 text-brand-800 dark:bg-[color-mix(in_srgb,var(--color-brand-900)_30%,transparent)]">
      <div className="mx-auto max-w-6xl overflow-hidden px-4 py-1.5 text-sm">
        <div className="flex whitespace-nowrap">
          <span className="animate-marquee shrink-0">
            📢 {text}　　　　📢 {text}
          </span>
        </div>
      </div>
    </div>
  );
}
