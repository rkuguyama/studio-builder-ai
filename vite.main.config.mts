import { defineConfig } from "vite";
import path from "path";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@platform/sdk": path.resolve(__dirname, "./packages/sdk/src"),
      "@platform/shared-types": path.resolve(
        __dirname,
        "./packages/shared-types/src",
      ),
    },
  },
  build: {
    rollupOptions: {
      external: ["better-sqlite3"],
    },
  },
  plugins: [
    {
      name: "restart",
      closeBundle() {
        process.stdin.emit("data", "rs");
      },
    },
  ],
});
