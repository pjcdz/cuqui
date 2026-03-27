"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export function CatalogUpload() {
  const ingest = useAction(api.ingest.ingestCatalog);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Handle undefined during initial load
  if (!ingest) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Conectando a Convex...</p>
      </Card>
    );
  }

  const handleFile = async (file: File) => {
    setUploading(true);
    setProgress(10);

    try {
      const base64 = await file.arrayBuffer()
        .then(b => Buffer.from(b).toString("base64"));

      setProgress(50);

      const result = await ingest({
        fileBase64: base64,
        mimeType: file.type,
      });

      setProgress(100);
      toast.success(`Procesados ${result.processed} productos`);
    } catch (error) {
      console.error(error);
      toast.error("Error al procesar catálogo");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold">Subir Catálogo</h2>
        <div className="flex flex-col gap-2">
          <label htmlFor="file-upload" className="text-sm font-medium">
            Selecciona un archivo (PDF, Excel)
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".pdf,.xlsx,.xls"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            disabled={uploading}
            className="mb-4 block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-primary file:text-primary-foreground
              hover:file:bg-primary/90"
          />
        </div>
        {uploading && (
          <div className="w-full">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">
              Procesando... {progress}%
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
