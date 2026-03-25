import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Area42",
      fileName: "area42",
    },
  },
  server: {
    port: 4242,
  },
});
