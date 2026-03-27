"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

type Product = {
  _id: string;
  name: string;
  brand: string;
  presentation: string;
  price: number;
  normalizedPrice?: number;
  unitOfMeasure?: string;
  category: string;
  tags: string[];
};

export function ProductsTable({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">No hay productos disponibles</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-4">Productos Disponibles</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Producto</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Presentación</TableHead>
            <TableHead>Precio Total</TableHead>
            <TableHead>Precio Normalizado</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Tags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            // Formatear precio normalizado (si existe)
            const normalizedDisplay = product.normalizedPrice
              ? (() => {
                  const normalizedUnit =
                    product.unitOfMeasure === "ml" ? "litro" :
                    product.unitOfMeasure === "g" ? "kg" :
                    product.unitOfMeasure || "unidad";
                  return `$${product.normalizedPrice.toFixed(2)}/${normalizedUnit}`;
                })()
              : "N/A";

            return (
              <TableRow key={product._id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{product.brand}</TableCell>
                <TableCell>{product.presentation}</TableCell>
                <TableCell>${product.price.toFixed(2)}</TableCell>
                <TableCell className={`font-semibold ${product.normalizedPrice ? "text-green-600" : "text-muted-foreground"}`}>
                  {normalizedDisplay}
                </TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {product.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-secondary text-secondary-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                    {product.tags.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{product.tags.length - 3}
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
