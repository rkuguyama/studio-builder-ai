import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@platform/shared-types": path.resolve(
        __dirname,
        "../../packages/shared-types/src",
      ),
    },
  },
  server: {
    port: 4320,
  },
});
