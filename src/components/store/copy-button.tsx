"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function CopyButton({
  text,
  label = "复制",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [ok, setOk] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      setTimeout(() => setOk(false), 1500);
    } catch {}
  }
  return (
    <button
      onClick={copy}
      className={cn(
        "shrink-0 rounded-lg border px-2.5 py-1 text-xs hover:bg-[var(--bg-soft)]",
        ok && "border-emerald-400 text-emerald-600",
        className,
      )}
    >
      {ok ? "已复制 ✓" : label}
    </button>
  );
}
