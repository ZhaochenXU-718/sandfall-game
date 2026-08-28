import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    // A string keeps Vite from auto-loading Creator's generated root config.
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        useDefineForClassFields: true,
      },
    }),
  },
});
