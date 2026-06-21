import NextAuth from "next-auth";
import { authConfig } from "./lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname === "/en") {
    const url = req.nextUrl.clone();
    url.pathname = "/";

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-next-intl-locale", "en");

    const response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
    response.cookies.set("NEXT_LOCALE", "en", { path: "/" });
    return response;
  }

  if (pathname === "/fr") {
    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.set("NEXT_LOCALE", "fr", { path: "/" });
    return response;
  }

  if (!req.auth) {
    return NextResponse.redirect(new URL("/", req.url));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon\\.ico).+)"],
};
