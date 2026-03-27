import { Id } from "@/convex/_generated/dataModel";

export type Product = {
  _id: Id<"products">;
  _creationTime: number;
  name: string;
  brand: string;
  presentation: string;
  price: number;
  normalizedPrice?: number;
  unitOfMeasure?: string;
  quantity?: number;
  multiplier?: number;
  category: string;
  tags: string[];
  providerId: string;
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
};
