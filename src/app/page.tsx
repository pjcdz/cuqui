import { CatalogUpload } from "@/components/upload-catalog";
import { ProductsTable } from "@/components/products-table";
import { Toaster } from "@/components/ui/sonner";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <main className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Cuqui - Catálogo B2B</h1>
          <p className="text-muted-foreground mt-2">
            Sistema de catálogo y búsqueda para proveedores y comercios
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <CatalogUpload />
        </div>

        <div className="mt-8">
          <ProductsTable />
        </div>
      </main>
    </div>
  );
}
