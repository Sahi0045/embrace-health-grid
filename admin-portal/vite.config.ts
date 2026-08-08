import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { join } from "path";

// https://vite.dev/config/
/**
 * Redirect the main app's SSR-only modules to a stub.
 *
 * api.ts and the *.server.ts modules statically import @tanstack/react-start,
 * whose server entry resolves "#tanstack-router-entry" — a specifier only the
 * Start Vite plugin provides. This portal is a plain SPA, so Rollup fails there.
 *
 * They are imported by relative path from inside ../src (e.g. "./auth.server"),
 * which resolve.alias cannot match, hence a plugin.
 *
 * The admin portal does not need them: it queries Supabase directly through
 * ~/lib/admin-api, with RLS enforced exactly as in the main app.
 */
const SSR_ONLY =
  /(^|\/)(api|auth\.server|clinical\.server|operations\.server|inpatient\.server|supabase\.server)$/;

function stubSsrModules() {
  return {
    name: "stub-ssr-only-modules",
    enforce: "pre" as const,
    resolveId(source: string, importer?: string) {
      // Only redirect imports originating from the main app's src/, never from
      // node_modules — Convex has its own internal module called "api".
      if (!importer || !importer.includes("/src/lib/")) return null;
      if (importer.includes("node_modules")) return null;

      const bare = source.replace(/\.[tj]sx?$/, "");
      if (SSR_ONLY.test(bare)) {
        return join(__dirname, "src/lib/ssr-stub.ts");
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [
    stubSsrModules(),
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
