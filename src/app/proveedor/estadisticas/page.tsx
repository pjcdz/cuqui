"use client";

import { useState, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  Eye,
  Search,
  Calendar,
  Download,
  BarChart3,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Types for stats query results
interface TopViewedProduct {
  _id: string;
  name: string;
  brand: string;
  presentation: string;
  price: number;
  viewCount: number;
}

interface DashboardStats {
  activeCount: number;
  totalCount: number;
  inactiveCount: number;
  needsReviewCount: number;
  topViewed: TopViewedProduct[];
  totalSearchAppearances: number;
  avgSearchAppearances: number;
  lastUpdate: number | null;
}

interface ProductStat {
  name: string;
  brand: string;
  presentation: string;
  price: number;
  category: string;
  subcategory: string;
  viewCount: number;
  searchAppearances: number;
  updatedAt: number;
}

/**
 * Statistics dashboard for providers.
 * Shows active products count, top 10 viewed, search appearances, last update date.
 * Supports date range filtering and PDF export.
 *
 * VAL-POLISH-001: Statistics dashboard renders
 * VAL-POLISH-002: Statistics date range filter
 * VAL-POLISH-003: Export statistics to PDF
 */
export default function EstadisticasPage() {
  // Date range state
  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndDateStr] = useState("");

  // Convert date strings to epoch ms for the query
  const startDate = startDateStr
    ? new Date(startDateStr + "T00:00:00").getTime()
    : undefined;
  const endDate = endDateStr
    ? new Date(endDateStr + "T23:59:59").getTime()
    : undefined;

  // Fetch dashboard stats
  const stats: DashboardStats | undefined | null = useQuery(
    api.stats.getDashboardStats,
    { startDate, endDate }
  );

  // Fetch product stats for PDF export
  const productStats: ProductStat[] | undefined = useQuery(
    api.stats.getProductStats,
    { startDate, endDate }
  );

  // Format date for display
  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Sin datos";
    return new Date(timestamp).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format price in ARS
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  // Clear date range
  const clearDateRange = useCallback(() => {
    setStartDateStr("");
    setEndDateStr("");
  }, []);

  // Export to PDF (VAL-POLISH-003)
  const exportToPDF = useCallback(() => {
    if (!stats || !productStats) return;

    const doc = new jsPDF() as jsPDF & {
      lastAutoTable?: { finalY: number };
    };

    // Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Cuqui - Estadísticas de Catálogo", 14, 20);

    // Date range info
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const dateRangeText =
      startDateStr || endDateStr
        ? `Período: ${startDateStr || "Inicio"} - ${endDateStr || "Hoy"}`
        : "Período: Todos los tiempos";
    doc.text(dateRangeText, 14, 28);
    doc.text(
      `Generado: ${new Date().toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      14,
      34
    );

    // Summary metrics
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen", 14, 44);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Productos Activos: ${stats.activeCount}`, 14, 52);
    doc.text(`Total Productos: ${stats.totalCount}`, 14, 58);
    doc.text(
      `Apariciones en Búsquedas: ${stats.totalSearchAppearances}`,
      14,
      64
    );
    doc.text(
      `Promedio Apariciones/Producto: ${stats.avgSearchAppearances}`,
      14,
      70
    );
    doc.text(
      `Última Actualización: ${formatDate(stats.lastUpdate)}`,
      14,
      76
    );
    doc.text(`Productos Inactivos: ${stats.inactiveCount}`, 14, 82);
    doc.text(
      `Productos con Revisión Pendiente: ${stats.needsReviewCount}`,
      14,
      88
    );

    // Top 10 viewed products table
    if (stats.topViewed.length > 0) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Top 10 Productos Más Vistos", 14, 100);

      autoTable(doc, {
        startY: 104,
        head: [["#", "Producto", "Marca", "Presentación", "Precio", "Vistas"]],
        body: stats.topViewed.map(
          (p: TopViewedProduct, i: number) => [
            i + 1,
            p.name,
            p.brand,
            p.presentation,
            formatPrice(p.price),
            p.viewCount.toString(),
          ]
        ),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    // All products stats table
    if (productStats.length > 0) {
      const currentY =
        doc.lastAutoTable?.finalY ?? 110;

      if (currentY > 240) {
        doc.addPage();
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(
        "Detalle de Productos",
        14,
        currentY > 240 ? 20 : currentY + 10
      );

      autoTable(doc, {
        startY: currentY > 240 ? 24 : currentY + 14,
        head: [
          [
            "Producto",
            "Marca",
            "Categoría",
            "Precio",
            "Vistas",
            "Apariciones",
          ],
        ],
        body: productStats.map((p: ProductStat) => [
          p.name,
          p.brand,
          p.category,
          formatPrice(p.price),
          p.viewCount.toString(),
          p.searchAppearances.toString(),
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Cuqui - Estadísticas de Catálogo - Página ${i} de ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: "center" }
      );
    }

    // Trigger download
    doc.save("cuqui-estadisticas.pdf");
  }, [stats, productStats, startDateStr, endDateStr]);

  // Loading state
  if (stats === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Cargando estadísticas...</p>
      </div>
    );
  }

  // Not authenticated state
  if (stats === null) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">
          Iniciá sesión para ver las estadísticas
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Estadísticas</h1>
          <p className="text-muted-foreground mt-1">
            Métricas de visibilidad de tu catálogo
          </p>
        </div>
        <Button onClick={exportToPDF} disabled={!productStats}>
          <Download className="h-4 w-4 mr-2" />
          Exportar a PDF
        </Button>
      </div>

      {/* Date Range Filter (VAL-POLISH-002) */}
      <Card>
        <CardContent>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1.5">
              <label
                htmlFor="startDate"
                className="text-sm font-medium text-foreground"
              >
                <Calendar className="h-4 w-4 inline mr-1" />
                Fecha desde
              </label>
              <Input
                id="startDate"
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="w-44"
                aria-label="Fecha de inicio del rango"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="endDate"
                className="text-sm font-medium text-foreground"
              >
                <Calendar className="h-4 w-4 inline mr-1" />
                Fecha hasta
              </label>
              <Input
                id="endDate"
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className="w-44"
                aria-label="Fecha de fin del rango"
              />
            </div>
            {(startDateStr || endDateStr) && (
              <Button variant="outline" size="sm" onClick={clearDateRange}>
                <X className="h-3 w-3 mr-1" />
                Limpiar filtro
              </Button>
            )}
            {(startDateStr || endDateStr) && (
              <span className="text-sm text-muted-foreground">
                Mostrando datos del{" "}
                {startDateStr
                  ? new Date(startDateStr + "T00:00:00").toLocaleDateString(
                      "es-AR"
                    )
                  : "inicio"}{" "}
                al{" "}
                {endDateStr
                  ? new Date(endDateStr + "T23:59:59").toLocaleDateString(
                      "es-AR"
                    )
                  : "hoy"}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Active Products Count */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Productos Activos
                </p>
                <p className="text-2xl font-bold">{stats.activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Products */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Productos
                </p>
                <p className="text-2xl font-bold">{stats.totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Appearances */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Search className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Apariciones en Búsquedas
                </p>
                <p className="text-2xl font-bold">
                  {stats.totalSearchAppearances}
                </p>
                {stats.activeCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Promedio: {stats.avgSearchAppearances}/producto
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Update */}
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Última Actualización
                </p>
                <p className="text-sm font-semibold">
                  {formatDate(stats.lastUpdate)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Viewed Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Top 10 Productos Más Vistos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topViewed.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No hay datos de visualizaciones todavía</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      #
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      Producto
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      Marca
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      Presentación
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      Precio
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      Vistas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topViewed.map(
                    (product: TopViewedProduct, index: number) => (
                      <tr
                        key={product._id}
                        className="border-b hover:bg-muted/50"
                      >
                        <td className="py-3 px-2 font-medium">{index + 1}</td>
                        <td className="py-3 px-2">{product.name}</td>
                        <td className="py-3 px-2">{product.brand}</td>
                        <td className="py-3 px-2">{product.presentation}</td>
                        <td className="py-3 px-2 text-right">
                          {formatPrice(product.price)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="inline-flex items-center gap-1">
                            <Eye className="h-3 w-3 text-muted-foreground" />
                            {product.viewCount}
                          </span>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Package className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Requieren Revisión
                </p>
                <p className="text-2xl font-bold">{stats.needsReviewCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Package className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Productos Inactivos
                </p>
                <p className="text-2xl font-bold">{stats.inactiveCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
