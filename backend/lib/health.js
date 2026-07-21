/**
 * Health Check Module — Embrace Health Grid
 *
 * Provides two endpoints:
 *   GET /health        → lightweight liveness probe (for load balancers / k8s liveness)
 *   GET /health/ready  → deep readiness probe (checks DB, Convex, memory, etc.)
 *
 * Integrates with Kubernetes readiness / liveness probes and
 * Docker HEALTHCHECK instructions.
 */

import { getWorldStateSize } from "../world-state-db.js";

const SERVICE_START = Date.now();

/**
 * Returns uptime in seconds.
 */
function uptimeSeconds() {
  return Math.floor((Date.now() - SERVICE_START) / 1000);
}

/**
 * Formats bytes into a human-readable string.
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Run all deep subsystem checks and return an aggregate result.
 * Each check returns { name, status: 'ok'|'degraded'|'down', details? }
 */
async function runReadinessChecks(convexClient) {
  const checks = [];

  // ── Memory check ─────────────────────────────────────────────────────────
  const mem = process.memoryUsage();
  const heapUsedMb = mem.heapUsed / (1024 * 1024);
  const HEAP_WARN_MB = 400;
  checks.push({
    name: "memory",
    status: heapUsedMb > HEAP_WARN_MB ? "degraded" : "ok",
    details: {
      heapUsed: formatBytes(mem.heapUsed),
      heapTotal: formatBytes(mem.heapTotal),
      rss: formatBytes(mem.rss),
      external: formatBytes(mem.external),
    },
  });

  // ── World State DB check ──────────────────────────────────────────────────
  try {
    const size = getWorldStateSize();
    checks.push({
      name: "worldStateDb",
      status: "ok",
      details: { entries: size },
    });
  } catch (err) {
    checks.push({
      name: "worldStateDb",
      status: "down",
      details: { error: err.message },
    });
  }

  // ── Convex check (optional) ───────────────────────────────────────────────
  if (convexClient) {
    try {
      // Lightweight query — just pings the Convex URL
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const convexUrl = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL || "";
      const resp = await fetch(convexUrl.replace(/\/$/, "") + "/api", {
        signal: controller.signal,
        method: "HEAD",
      }).catch(() => null);
      clearTimeout(timeout);
      checks.push({
        name: "convex",
        status: resp ? "ok" : "degraded",
        details: { url: convexUrl, reachable: !!resp },
      });
    } catch (err) {
      checks.push({
        name: "convex",
        status: "degraded",
        details: { error: err.message },
      });
    }
  } else {
    checks.push({
      name: "convex",
      status: "ok",
      details: { note: "not configured — running in local storage mode" },
    });
  }

  // ── Environment check ─────────────────────────────────────────────────────
  const missingVars = [];
  if (process.env.NODE_ENV === "production") {
    const required = ["JWT_SECRET", "CLIENT_KEY"];
    required.forEach((v) => {
      if (!process.env[v]) missingVars.push(v);
    });
  }
  checks.push({
    name: "environment",
    status: missingVars.length > 0 ? "down" : "ok",
    details: { missingRequired: missingVars },
  });

  return checks;
}

/**
 * Aggregate status from individual check results.
 */
function aggregateStatus(checks) {
  if (checks.some((c) => c.status === "down")) return "down";
  if (checks.some((c) => c.status === "degraded")) return "degraded";
  return "ok";
}

/**
 * Register health check routes on an Express app.
 *
 * @param {import('express').Application} app
 * @param {{ convexClient?: object }} deps
 */
export function registerHealthRoutes(app, { convexClient } = {}) {
  /**
   * GET /health — Liveness probe
   * Ultra-fast. Always returns 200 unless the process itself is broken.
   * Suitable for load-balancer health checks and k8s livenessProbe.
   */
  app.get("/health", (_, res) => {
    res.status(200).json({
      status: "ok",
      service: "embrace-health-backend",
      version: process.env.npm_package_version || "1.0.0",
      uptime: uptimeSeconds(),
      ts: new Date().toISOString(),
    });
  });

  /**
   * GET /health/ready — Readiness probe
   * Performs deep checks. Returns 200 if ready, 503 if not.
   * Suitable for k8s readinessProbe and CI smoke tests.
   */
  app.get("/health/ready", async (_, res) => {
    try {
      const checks = await runReadinessChecks(convexClient);
      const status = aggregateStatus(checks);
      const httpStatus = status === "down" ? 503 : 200;

      res.status(httpStatus).json({
        status,
        service: "embrace-health-backend",
        version: process.env.npm_package_version || "1.0.0",
        uptime: uptimeSeconds(),
        ts: new Date().toISOString(),
        checks,
      });
    } catch (err) {
      res.status(503).json({
        status: "down",
        error: err.message,
        ts: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /health/metrics — Lightweight Prometheus-style text metrics
   * Useful for scraping by Prometheus, Grafana, or Datadog.
   */
  app.get("/health/metrics", (_, res) => {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const lines = [
      `# HELP process_heap_bytes Node.js heap used in bytes`,
      `# TYPE process_heap_bytes gauge`,
      `process_heap_bytes ${mem.heapUsed}`,
      `# HELP process_rss_bytes Node.js RSS in bytes`,
      `# TYPE process_rss_bytes gauge`,
      `process_rss_bytes ${mem.rss}`,
      `# HELP process_uptime_seconds Service uptime in seconds`,
      `# TYPE process_uptime_seconds counter`,
      `process_uptime_seconds ${uptimeSeconds()}`,
      `# HELP world_state_entries Total entries in World State DB`,
      `# TYPE world_state_entries gauge`,
      `world_state_entries ${getWorldStateSize()}`,
      `# HELP process_cpu_user_microseconds CPU user time`,
      `# TYPE process_cpu_user_microseconds counter`,
      `process_cpu_user_microseconds ${cpu.user}`,
    ];
    res.set("Content-Type", "text/plain; version=0.0.4").send(lines.join("\n") + "\n");
  });
}
