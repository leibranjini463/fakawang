"use client";
import { CopyButton } from "./copy-button";

export function CardSecretList({ cards }: { cards: string[] }) {
  const all = cards.join("\n");
  function download() {
    const blob = new Blob([all], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cards.txt";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">你的卡密（共 {cards.length} 条）</span>
        <div className="flex gap-2">
          <CopyButton text={all} label="复制全部" />
          <button
            onClick={download}
            className="shrink-0 rounded-lg border px-2.5 py-1 text-xs hover:bg-[var(--bg-soft)]"
          >
            下载 txt
          </button>
        </div>
      </div>
      <ol className="space-y-2">
        {cards.map((c, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-soft)] p-3 font-mono text-sm"
          >
            <span className="break-all">{c}</span>
            <CopyButton text={c} />
          </li>
        ))}
      </ol>
    </div>
  );
}
