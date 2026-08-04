"use client";
import { useEffect, useState } from "react";

export function Countdown({ expiresAt }: { expiresAt: number }) {
  const [left, setLeft] = useState(() => Math.max(0, expiresAt - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, expiresAt - Date.now())), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (left <= 0) return <span className="text-red-500">已超时</span>;
  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className="tabular-nums">
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}
