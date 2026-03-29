/**
 * GET /api/tree/structure — Returns the product tree hierarchy as JSON.
 *
 * Response includes:
 * - nextLevel: The first navigation level ("category")
 * - options: Array of { name, productCount } grouped by category
 * - levels: Ordered array of hierarchy levels
 *
 * Implements 5-minute server-side caching via Cache-Control and ETag.
 * Supports conditional requests with If-None-Match for 304 responses.
 *
 * SRS Ref: RF-019
 */
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { buildTreeStructure, computeETag } from "@/lib/tree-builder";

export const dynamic = "force-dynamic";

/** Cache duration in seconds (5 minutes). */
const CACHE_MAX_AGE = 300;

export async function GET(request: NextRequest) {
  // Fetch all active products from Convex
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const client = new ConvexHttpClient(convexUrl);
  const products = await client.query(api.products.list, { limit: 1000 });

  // Build tree structure from products
  const treeData = buildTreeStructure(products);

  // Compute ETag from the tree data
  const etag = computeETag(treeData);

  // Check If-None-Match for 304 Not Modified
  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate`,
      },
    });
  }

  // Return full response with cache headers
  return NextResponse.json(treeData, {
    status: 200,
    headers: {
      "Cache-Control": `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate`,
      ETag: etag,
    },
  });
}
