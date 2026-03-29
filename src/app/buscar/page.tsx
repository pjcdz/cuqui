"use client";

import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { BuscarContent } from "./buscar-content";

export default function BuscarPage() {
  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <Suspense
        fallback={
          <div className="container mx-auto py-8 px-4">
            <div className="mb-8">
              <div className="h-10 w-64 bg-muted rounded animate-pulse" />
              <div className="h-5 w-96 bg-muted rounded animate-pulse mt-2" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2 mb-6">
              <div className="h-64 bg-muted rounded-lg animate-pulse" />
              <div className="h-64 bg-muted rounded-lg animate-pulse" />
            </div>
            <div className="h-96 bg-muted rounded-lg animate-pulse" />
          </div>
        }
      >
        <BuscarContent />
      </Suspense>
    </div>
  );
}
