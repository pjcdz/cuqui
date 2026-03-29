import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: [
      // @/convex/* must take precedence over @ -> src
      { find: "@/convex", replacement: path.resolve(__dirname, "convex") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
});
