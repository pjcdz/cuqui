import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Route matchers
const isProviderRoute = createRouteMatcher([
  "/proveedor(.*)",
]);

const isPublicRoute = createRouteMatcher([
  "/",
  "/buscar(.*)",
  "/producto(.*)",
  "/api/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Provider routes require authentication AND proveedor role
  if (isProviderRoute(req)) {
    const { userId, sessionClaims } = await auth();

    // Not authenticated → redirect to sign-in
    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", pathname);
      return NextResponse.redirect(signInUrl);
    }

    // Check role from publicMetadata (Clerk stores role here)
    const role = (sessionClaims?.publicMetadata as Record<string, unknown>)?.role
      ?? (sessionClaims?.unsafeMetadata as Record<string, unknown>)?.role;

    // Not a proveedor → redirect to /buscar
    if (role !== "proveedor") {
      const buscarUrl = new URL("/buscar", req.url);
      return NextResponse.redirect(buscarUrl);
    }
  }

  // Public routes are accessible to everyone (including unauthenticated)
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // All other routes: allow through (Clerk handles auth)
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
