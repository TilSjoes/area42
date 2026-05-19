import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Area42",
      fileName: "area42",
    },
    rollupOptions: {
      // three.js (and its example modules) is always external. The 2D
      // bundle treats it as optional (Panel3D dyn-imports with graceful
      // fallback). The /world module imports it statically — peer dep.
      external: [
        "three",
        "three/examples/jsm/controls/OrbitControls.js",
        "three/examples/jsm/controls/PointerLockControls.js",
      ],
      output: {
        globals: {
          three: "THREE",
        },
      },
    },
  },
  server: {
    port: 4242,
    host: "0.0.0.0",
    strictPort: true,
  },
});
