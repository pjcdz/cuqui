"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, CheckCircle2, AlertCircle, FileText, Clock } from "lucide-react";

interface IngestResult {
  processed: number;
  needsReview: number;
  failedChunks: number[];
  totalChunks: number;
  duration: number;
  metadata: {
    documentType: string;
    pages: number;
    sections: number;
    ambiguities: number;
  };
}

export function CatalogUpload() {
  const ingest = useAction(api.ingest.ingestCatalog);

  // Handle undefined during initial load
  if (!ingest) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Conectando a Convex...</p>
      </Card>
    );
  }

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<IngestResult | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setProgress(10);
    setResult(null);

    try {
      const base64 = await file.arrayBuffer()
        .then(b => Buffer.from(b).toString("base64"));

      setProgress(50);

      const ingestResult = await ingest({
        fileBase64: base64,
        mimeType: file.type,
      });

      setProgress(100);
      setResult(ingestResult as IngestResult);

      // Show appropriate toast based on results
      if (ingestResult.failedChunks.length > 0) {
        toast.error(
          `Procesamiento parcial: ${ingestResult.processed} productos, ${ingestResult.failedChunks.length} chunks fallidos`,
          { duration: 5000 }
        );
      } else if (ingestResult.needsReview > 0) {
        toast.warning(
          `${ingestResult.processed} productos procesados, ${ingestResult.needsReview} requieren revisión`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Procesados ${ingestResult.processed} productos correctamente`);
      }
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

        {result && !uploading && (
          <div className="mt-4 space-y-4 border-t pt-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Resultados del Procesamiento
            </h3>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex flex-col">
                <span className="text-2xl font-bold text-green-600">{result.processed}</span>
                <span className="text-sm text-muted-foreground">Procesados</span>
              </div>

              {result.needsReview > 0 && (
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-yellow-600">{result.needsReview}</span>
                  <span className="text-sm text-muted-foreground">Revisión Requerida</span>
                </div>
              )}

              {result.failedChunks.length > 0 && (
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-red-600">{result.failedChunks.length}</span>
                  <span className="text-sm text-muted-foreground">Chunks Fallidos</span>
                </div>
              )}

              <div className="flex flex-col">
                <span className="text-2xl font-bold">{result.totalChunks}</span>
                <span className="text-sm text-muted-foreground">Total Chunks</span>
              </div>
            </div>

            {/* Document Metadata */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Metadatos del Documento
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>{" "}
                  <Badge variant="secondary">{result.metadata.documentType}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Páginas:</span>{" "}
                  <span className="font-medium">{result.metadata.pages}</span>
                </div>
                {result.metadata.sections > 0 && (
                  <div>
                    <span className="text-muted-foreground">Secciones:</span>{" "}
                    <span className="font-medium">{result.metadata.sections}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Duración:</span>{" "}
                  <span className="font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {(result.duration / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>

              {result.metadata.ambiguities > 0 && (
                <div className="flex items-center gap-2 text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">
                    {result.metadata.ambiguities} ambigüedades detectadas
                  </span>
                </div>
              )}
            </div>

            {result.failedChunks.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Chunks fallidos: {result.failedChunks.join(", ")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
