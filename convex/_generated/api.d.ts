/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as duplicates from "../duplicates.js";
import type * as ingest from "../ingest.js";
import type * as ingestionProgress from "../ingestionProgress.js";
import type * as lib_levenshtein from "../lib/levenshtein.js";
import type * as lib_schemas from "../lib/schemas.js";
import type * as lib_validation from "../lib/validation.js";
import type * as products from "../products.js";
import type * as providers from "../providers.js";
import type * as stats from "../stats.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  duplicates: typeof duplicates;
  ingest: typeof ingest;
  ingestionProgress: typeof ingestionProgress;
  "lib/levenshtein": typeof lib_levenshtein;
  "lib/schemas": typeof lib_schemas;
  "lib/validation": typeof lib_validation;
  products: typeof products;
  providers: typeof providers;
  stats: typeof stats;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
