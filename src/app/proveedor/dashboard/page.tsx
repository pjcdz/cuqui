"use client";

import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Package, Upload, BarChart3, AlertCircle } from "lucide-react";
import { useEffect } from "react";

type Product = Doc<"products">;

export default function ProveedorDashboard() {
  const { isSignedIn, isLoaded } = useAuth();
  const provider = useQuery(api.providers.getCurrent);
  const products = useQuery(api.products.listOwn, {}) as Product[] | undefined;
  const syncProvider = useMutation(api.providers.createOrUpdateProvider);

  // Auto-sync provider on first load
  useEffect(() => {
    if (isSignedIn && syncProvider) {
      syncProvider({}).catch(() => {
        // Provider sync may already exist, ignore errors
      });
    }
  }, [isSignedIn, syncProvider]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  const productCount = products?.length ?? 0;
  const needsReview = products?.filter((p: Product) => p.reviewStatus === "needs_review").length ?? 0;
  const businessName = provider?.businessName || provider?.name || "Proveedor";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Bienvenido, {businessName}</h1>
        <p className="text-muted-foreground mt-1">
          Panel de control de tu catálogo de productos
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Productos</p>
              <p className="text-2xl font-bold">{productCount}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${needsReview > 0 ? "bg-yellow-100" : "bg-green-100"}`}>
              <AlertCircle className={`h-6 w-6 ${needsReview > 0 ? "text-yellow-600" : "text-green-600"}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Requieren Revisión</p>
              <p className="text-2xl font-bold">{needsReview}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Publicados</p>
              <p className="text-2xl font-bold">
                {productCount - needsReview}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Acciones Rápidas</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/proveedor/subir">
            <Card className="p-6 hover:bg-accent/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Subir Catálogo</h3>
                  <p className="text-sm text-muted-foreground">
                    Subí un PDF o Excel para procesar tus productos
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/proveedor/productos">
            <Card className="p-6 hover:bg-accent/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Gestionar Productos</h3>
                  <p className="text-sm text-muted-foreground">
                    Revisá, editá y administrá tu catálogo
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>

      {/* Empty state */}
      {productCount === 0 && (
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No tenés productos todavía</h3>
          <p className="text-muted-foreground mb-4">
            Subí tu primer catálogo para empezar a cargar productos
          </p>
          <Link href="/proveedor/subir">
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Subir Catálogo
            </Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
