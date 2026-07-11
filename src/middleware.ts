import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

/**
 * Protects app routes using the Edge-safe Auth.js config.
 */
export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isLoggedIn = !!request.auth?.user;
  const isPublic = pathname === "/login" || pathname === "/register";
  const isAuthApi =
    pathname.startsWith("/api/auth") || pathname.startsWith("/api/register");
  const isCronApi = pathname.startsWith("/api/cron");

  if (pathname.startsWith("/api/") && !isAuthApi && !isCronApi && !isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isLoggedIn && !isPublic && !pathname.startsWith("/api/")) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/", request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
