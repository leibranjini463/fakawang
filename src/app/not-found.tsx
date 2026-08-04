import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <div className="text-6xl">🌸</div>
        <h1 className="mt-4 text-2xl font-bold">404</h1>
        <p className="mt-1 text-[var(--fg-muted)]">你要找的页面不存在或已下架</p>
        <Link href="/" className="btn-brand mt-5 inline-flex h-10 items-center rounded-xl px-5 text-sm">
          返回首页
        </Link>
      </div>
    </div>
  );
}
