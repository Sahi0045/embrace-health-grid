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
      buffer: "buffer/",
      react: join(__dirname, "node_modules/react"),
      "react-dom": join(__dirname, "node_modules/react-dom"),
    },
  },
  server: {
    port: 3002,
    strictPort: true,
  },
});
