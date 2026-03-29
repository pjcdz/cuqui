"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useParams, useRouter } from "next/navigation";
import { UserButton, SignInButton, useAuth } from "@clerk/nextjs";
import {
  ArrowLeft,
  Store,
  Tag,
  Package,
  DollarSign,
  Building2,
  FileText,
} from "lucide-react";
import Link from "next/link";

export default function ProductoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const productId = params.id as string;

  const product = useQuery(api.products.getProduct, {
    id: productId as Id<"products">,
  });

  if (product === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <Link href="/buscar" className="text-xl font-bold">
                Cuqui
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {isLoaded && !isSignedIn && (
                <SignInButton mode="modal">
                  <button className="text-sm font-medium hover:underline">
                    Iniciar Sesión
                  </button>
                </SignInButton>
              )}
              {isSignedIn && <UserButton />}
            </div>
          </div>
        </header>
        <main className="container mx-auto py-8 px-4">
          <div className="flex items-center justify-center min-h-[50vh]">
            <p className="text-muted-foreground">Cargando producto...</p>
          </div>
        </main>
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="min-h-screen bg-background">
        <Toaster />
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              <Link href="/buscar" className="text-xl font-bold">
                Cuqui
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {isLoaded && !isSignedIn && (
                <SignInButton mode="modal">
                  <button className="text-sm font-medium hover:underline">
                    Iniciar Sesión
                  </button>
                </SignInButton>
              )}
              {isSignedIn && <UserButton />}
            </div>
          </div>
        </header>
        <main className="container mx-auto py-8 px-4">
          <Card className="p-8 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Producto no encontrado</h2>
            <p className="text-muted-foreground mb-4">
              El producto que buscás no existe o fue eliminado
            </p>
            <Link href="/buscar">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a buscar
              </Button>
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  // Format price in ARS
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            <Link href="/buscar" className="text-xl font-bold">
              Cuqui
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {isLoaded && !isSignedIn && (
              <SignInButton mode="modal">
                <button className="text-sm font-medium hover:underline">
                  Iniciar Sesión
                </button>
              </SignInButton>
            )}
            {isSignedIn && <UserButton />}
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-6 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Product info */}
          <Card className="p-6">
            <h1 className="text-2xl font-bold mb-2">{product.name}</h1>
            <div className="flex items-center gap-2 mb-6">
              <Badge variant="secondary" className="capitalize">
                {product.category}
              </Badge>
              {product.subcategory && (
                <Badge variant="outline" className="capitalize">
                  {product.subcategory}
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              {/* Brand */}
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Marca</p>
                  <p className="font-medium">{product.brand}</p>
                </div>
              </div>

              {/* Presentation */}
              <div className="flex items-center gap-3">
                <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Presentación</p>
                  <p className="font-medium">{product.presentation}</p>
                </div>
              </div>

              {/* Price */}
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm text-muted-foreground">Precio</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatPrice(product.price)}
                  </p>
                </div>
              </div>

              {/* Normalized Price */}
              {product.normalizedPrice && (
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm text-muted-foreground">Precio Normalizado</p>
                    <p className="font-semibold text-green-600">
                      {formatPrice(product.normalizedPrice)}
                      {product.unitOfMeasure && `/${product.unitOfMeasure}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <div className="flex items-start gap-3">
                  <Tag className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {product.tags.map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="capitalize">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Additional details */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalles Adicionales
            </h2>
            <div className="space-y-3">
              {product.packagingType && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Tipo de Envase</span>
                  <span className="text-sm font-medium capitalize">{product.packagingType}</span>
                </div>
              )}
              {product.saleFormat && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Formato de Venta</span>
                  <span className="text-sm font-medium capitalize">{product.saleFormat}</span>
                </div>
              )}
              {product.priceType && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Tipo de Precio</span>
                  <span className="text-sm font-medium capitalize">{product.priceType}</span>
                </div>
              )}
              {product.unitOfMeasure && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Unidad de Medida</span>
                  <span className="text-sm font-medium">{product.unitOfMeasure}</span>
                </div>
              )}
              {product.quantity && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Cantidad</span>
                  <span className="text-sm font-medium">{product.quantity}</span>
                </div>
              )}
              {product.multiplier && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Multiplicador</span>
                  <span className="text-sm font-medium">{product.multiplier}</span>
                </div>
              )}
              {product.confidence !== undefined && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Confianza</span>
                  <span className="text-sm font-medium">
                    {Math.round(product.confidence * 100)}%
                  </span>
                </div>
              )}
              {product.reviewStatus && (
                <div className="flex justify-between py-2 border-b">
                  <span className="text-sm text-muted-foreground">Estado de Revisión</span>
                  <Badge variant={product.reviewStatus === "needs_review" ? "destructive" : "secondary"}>
                    {product.reviewStatus === "needs_review" ? "Requiere Revisión" : "Publicado"}
                  </Badge>
                </div>
              )}
              {product.ambiguityNotes && product.ambiguityNotes.length > 0 && (
                <div className="py-2">
                  <p className="text-sm text-muted-foreground mb-2">Notas de Ambigüedad</p>
                  <ul className="text-sm space-y-1">
                    {product.ambiguityNotes.map((note: string, idx: number) => (
                      <li key={idx} className="text-yellow-600">• {note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
