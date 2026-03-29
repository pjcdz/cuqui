"use client";

import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Home page redirects based on user role:
 * - proveedor → /proveedor/dashboard
 * - comercio (or any other role) → /buscar
 * - not signed in → /buscar (public browse page)
 */
export default function Home() {
  const { isSignedIn, isLoaded, sessionClaims } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      const role = (sessionClaims?.publicMetadata as Record<string, unknown>)?.role;
      if (role === "proveedor") {
        router.replace("/proveedor/dashboard");
      } else {
        router.replace("/buscar");
      }
    } else {
      router.replace("/buscar");
    }
  }, [isLoaded, isSignedIn, sessionClaims, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Redirigiendo...</p>
    </div>
  );
}
