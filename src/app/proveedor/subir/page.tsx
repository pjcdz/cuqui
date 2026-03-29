import { CatalogUpload } from "@/components/upload-catalog";
import { Toaster } from "@/components/ui/sonner";

export default function ProveedorSubirPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subir Catálogo</h1>
        <p className="text-muted-foreground mt-1">
          Subí un archivo PDF o Excel con tus productos para procesarlos automáticamente
        </p>
      </div>

      <Toaster />
      <CatalogUpload />
    </div>
  );
}
