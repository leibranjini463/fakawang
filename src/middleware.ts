import { NextResponse, type NextRequest } from "next/server";

/** 轻量守卫：/admin/** 无会话 cookie 直接重定向到登录页（真正校验在 dashboard layout）。 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const hasCookie = req.cookies.get("faka_admin");
    if (!hasCookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
