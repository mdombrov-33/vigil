import { defineConfig } from "vitest/config";
import path from "node:path";

// The source uses `@/` path aliases and `.js` extensions on relative/aliased
// imports (NodeNext/bundler style). Rewrite both so Vitest resolves to the
// actual `.ts` sources. Order matters: the `.js` rule must come first.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)\.js$/, replacement: path.resolve(__dirname, "src/$1.ts") },
      { find: /^@\//, replacement: path.resolve(__dirname, "src") + "/" },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
