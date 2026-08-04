"use client";
import { useEffect, useState } from "react";

export function AnnouncementModal({
  id,
  title,
  html,
}: {
  id: number;
  title: string;
  html: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const key = `ann_seen_${id}_${today}`;
    try {
      if (!localStorage.getItem(key)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [id]);

  function close(dontShowToday: boolean) {
    setOpen(false);
    if (dontShowToday) {
      const today = new Date().toISOString().slice(0, 10);
      try {
        localStorage.setItem(`ann_seen_${id}_${today}`, "1");
      } catch {}
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => close(false)}>
      <div
        className="card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-lg font-bold">{title}</h3>
        <div className="prose-faka max-h-[50vh] overflow-y-auto text-sm" dangerouslySetInnerHTML={{ __html: html }} />
        <div className="mt-5 flex items-center justify-end gap-3 text-sm">
          <button className="text-[var(--fg-muted)] hover:text-[var(--fg)]" onClick={() => close(true)}>
            今日不再提示
          </button>
          <button className="btn-brand rounded-xl px-4 py-2" onClick={() => close(false)}>
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}
