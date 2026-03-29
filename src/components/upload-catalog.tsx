"use client";

import { useState, useEffect } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, FileText, Clock, AlertTriangle } from "lucide-react";

interface IngestResult {
  ingestionId: Id<"ingestionRuns">;
  processed: number;
  needsReview: number;
  failedProducts: number;
  failedBatches: number[];
  totalBatches: number;
  totalRows: number;
  duration: number;
  metadata: {
    documentType: string;
    pages: number;
    ambiguities: number;
  };
}

interface IngestionProgress {
  status: string;
  progressPercent: number;
  message: string;
  currentBatch?: number;
  totalBatches?: number;
  processedRows?: number;
  totalRows?: number;
  errorMessage?: string;
}

export function CatalogUpload() {
  const { isSignedIn } = useAuth();
  const createRun = useMutation(api.ingestionProgress.createRun);
  const ingest = useAction(api.ingest.ingestCatalog);
  const processBatchesAction = useAction(api.ingest.processBatches);
  const [uploading, setUploading] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const [localProgressLabel, setLocalProgressLabel] = useState("Procesando archivo...");
  const [ingestionId, setIngestionId] = useState<Id<"ingestionRuns"> | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const runProgress = useQuery(
    api.ingestionProgress.get,
    ingestionId ? { ingestionId } : "skip"
  ) as IngestionProgress | null | undefined;

  const progressValue = runProgress?.progressPercent ?? localProgress;
  const progressLabel = runProgress?.message ?? localProgressLabel;

  // Navigation protection during upload
  useEffect(() => {
    if (!uploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploading]);

  // Handle undefined during initial load
  if (!ingest || !createRun) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Conectando a Convex...</p>
      </Card>
    );
  }

  const handleFile = async (file: File) => {
    if (!isSignedIn) {
      toast.error("Tenés que iniciar sesión para subir catálogos");
      return;
    }

    const allowedMimeTypes = new Set([
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]);

    if (!allowedMimeTypes.has(file.type)) {
      toast.error("Formato no soportado. Subí un PDF o Excel válido");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("El archivo supera el límite de 50 MB");
      return;
    }

    setUploading(true);
    setLocalProgress(5);
    setLocalProgressLabel("Preparando archivo...");
    setResult(null);
    setIngestionId(null);

    try {
      const newIngestionId = await createRun({});
      setIngestionId(newIngestionId);

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setLocalProgress(10);
      setLocalProgressLabel("Iniciando procesamiento...");

      const ingestResult = await ingest({
        ingestionId: newIngestionId,
        fileBase64: base64,
        mimeType: file.type,
      });

      // If there are rows to process, call processBatches
      let finalResult: IngestResult;
      if (ingestResult.totalRows > 0) {
        const batchResult = await processBatchesAction({
          ingestionId: newIngestionId,
        });
        finalResult = batchResult as IngestResult;
      } else {
        finalResult = {
          ingestionId: ingestResult.ingestionId,
          processed: 0,
          needsReview: 0,
          failedProducts: 0,
          failedBatches: [],
          totalBatches: 0,
          totalRows: 0,
          duration: 0,
          metadata: ingestResult.metadata,
        };
      }

      setResult(finalResult as IngestResult);

      // Show appropriate toast based on results
      if (finalResult.failedBatches.length > 0 || finalResult.failedProducts > 0) {
        toast.error(
          `Procesamiento parcial: ${finalResult.processed} productos, ${finalResult.failedProducts} productos fallidos, ${finalResult.failedBatches.length} batches fallidos`,
          { duration: 5000 }
        );
      } else if (finalResult.needsReview > 0) {
        toast.warning(
          `${finalResult.processed} productos procesados, ${finalResult.needsReview} requieren revisión`,
          { duration: 5000 }
        );
      } else {
        toast.success(`Procesados ${finalResult.processed} productos correctamente`);
      }
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Error al procesar catálogo";
      toast.error(message);
    } finally {
      setUploading(false);
      setLocalProgress(0);
      setLocalProgressLabel("Procesando archivo...");
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
            aria-label="Seleccionar archivo de catálogo (PDF, Excel, máximo 50MB)"
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
            <Progress value={progressValue} className="w-full" />
            <p className="text-sm text-muted-foreground mt-2">
              {progressLabel} {progressValue}%
            </p>
            {runProgress?.totalBatches ? (
              <p className="text-sm text-muted-foreground">
                Batch {runProgress.currentBatch ?? 0} de {runProgress.totalBatches}
                {" · "}
                Filas {runProgress.processedRows ?? 0} / {runProgress.totalRows ?? 0}
              </p>
            ) : null}
            {runProgress?.errorMessage ? (
              <p className="text-sm text-red-600">{runProgress.errorMessage}</p>
            ) : null}
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

              {result.failedBatches.length > 0 && (
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-red-600">{result.failedBatches.length}</span>
                  <span className="text-sm text-muted-foreground">Batches Fallidos</span>
                </div>
              )}

              {result.failedProducts > 0 && (
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-red-600">{result.failedProducts}</span>
                  <span className="text-sm text-muted-foreground">Productos Fallidos</span>
                </div>
              )}

              <div className="flex flex-col">
                <span className="text-2xl font-bold">{result.totalBatches}</span>
                <span className="text-sm text-muted-foreground">Total Batches</span>
              </div>

              <div className="flex flex-col">
                <span className="text-2xl font-bold">{result.totalRows}</span>
                <span className="text-sm text-muted-foreground">Total Filas</span>
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

            {result.failedBatches.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Batches fallidos: {result.failedBatches.join(", ")}
                </p>
              </div>
            )}

            {/* Warning for 0 products */}
            {result.processed === 0 && result.totalRows === 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    No se encontraron productos en este documento
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1">
                    El documento fue procesado como <Badge variant="secondary">{result.metadata.documentType}</Badge> pero no se detectaron filas de productos.
                    Verificá que el archivo contenga un catálogo con productos y precios.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
