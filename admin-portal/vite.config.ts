import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { join } from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: join(__dirname, "src/routes"),
      generatedRouteTree: join(__dirname, "src/routeTree.gen.ts"),
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": join(__dirname, "../src"),
      "~": join(__dirname, "src"),
    },
  },
  server: {
    port: 3002,
    strictPort: true,
  },
});
