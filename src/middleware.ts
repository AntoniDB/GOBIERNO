import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { requireAuthSecret } from "@/lib/auth-secret";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/ministerios",
  "/congreso",
  "/justicia",
  "/poblacion",
  "/medios",
  "/regimen",
  "/reportes",
  "/fin",
  "/nueva-partida",
];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isProtected) {
    const token = await getToken({
      req: request,
      secret: requireAuthSecret(),
    });

    if (!token?.id) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
