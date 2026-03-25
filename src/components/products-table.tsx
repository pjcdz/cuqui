"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

export function ProductsTable() {
  const products = useQuery(api.products.list);

  // Handle undefined during initial load
  if (products === undefined) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Conectando a Convex...</p>
      </Card>
    );
  }

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
            <TableHead>Precio</TableHead>
            <TableHead>Categoría</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product._id}>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell>{product.brand}</TableCell>
              <TableCell>{product.presentation}</TableCell>
              <TableCell>${product.price.toFixed(2)}</TableCell>
              <TableCell>{product.category}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
