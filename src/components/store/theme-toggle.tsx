"use client";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  }
  return (
    <button
      onClick={toggle}
      aria-label="切换主题"
      className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[var(--bg-soft)] transition"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
