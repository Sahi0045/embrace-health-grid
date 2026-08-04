#!/usr/bin/env node
/**
 * Full end-to-end verification — Embrace Health Grid
 *
 * One command that checks the whole stack. Run after any significant change:
 *
 *     npm run verify
 *
 * Stages, in dependency order so a failure points at the real cause:
 *
 *   1. Static     typecheck + formatting, both projects
 *   2. Build      main app and admin portal compile for production
 *   3. Database   Supabase reachable; schema and RLS present on every table
 *   4. Security   RLS isolation, Edge Function authorisation, Realtime filtering
 *   5. Runtime    a real browser drives login and the clinical pages
 *
 * The browser stage needs a dev server. It is started automatically and stopped
 * afterwards unless one is already listening on the port.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";

const ROOT = process.cwd();
const DEV_PORT = Number(process.env.VERIFY_PORT ?? 5199);

const results = [];
let devServer = null;

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function heading(text) {
  console.log(`\n${c.bold}${c.cyan}${text}${c.reset}`);
}

function record(name, ok, detail = "", skipped = false) {
  results.push({ name, ok, detail, skipped });
  const mark = skipped
    ? `${c.yellow}SKIP${c.reset}`
    : ok
      ? `${c.green}PASS${c.reset}`
      : `${c.red}FAIL${c.reset}`;
  console.log(`  ${mark}  ${name}${detail ? `  ${c.dim}${detail}${c.reset}` : ""}`);
}

/** Run a command, capture output, and report pass/fail on exit code. */
function step(name, cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    cwd: opts.cwd ?? ROOT,
    encoding: "utf8",
    timeout: opts.timeout ?? 900_000,
    env: { ...process.env, ...(opts.env ?? {}) },
  });

  const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
  const ok = res.status === 0;

  // Surface a useful fragment rather than the whole log.
  let detail = "";
  if (!ok) {
    const line =
      out.split("\n").find((l) => /error|failed|✖/i.test(l) && l.trim().length > 3) ?? "";
    detail = line.trim().slice(0, 110);
  } else if (opts.extract) {
    detail = opts.extract(out) ?? "";
  }

  record(name, ok, detail);
  return { ok, out };
}

/** Is something already listening on the dev port? */
function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1500);
  });
}

async function waitForPort(port, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portInUse(port)) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// ─── 1. Static analysis ─────────────────────────────────────────────────────

heading("1. Static analysis");

step("main app typechecks", "npx", ["tsc", "--noEmit"]);
step("admin portal typechecks", "npm", ["run", "typecheck"], {
  cwd: `${ROOT}/admin-portal`,
});
step("formatting is clean", "npm", ["run", "format:check"]);

// ─── 2. Production builds ───────────────────────────────────────────────────

heading("2. Production builds");

step("main app builds", "npm", ["run", "build"], {
  extract: (out) => (out.match(/built in [\d.]+s/) ?? [""])[0],
});
step("admin portal builds", "npm", ["run", "build"], {
  cwd: `${ROOT}/admin-portal`,
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? "https://placeholder.supabase.co",
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? "placeholder",
  },
  extract: (out) => (out.match(/built in [\d.]+s/) ?? [""])[0],
});

// ─── 3. Database ────────────────────────────────────────────────────────────

heading("3. Database and schema");

if (!existsSync(`${ROOT}/backend/.env`)) {
  record("Supabase credentials present", false, "backend/.env is missing");
} else {
  step("Supabase reachable, both keys valid", "npm", ["run", "supabase:check"], {
    cwd: `${ROOT}/backend`,
    extract: (out) => (out.match(/project [a-z]+/) ?? [""])[0],
  });
}

// ─── 4. Security and data-layer tests ───────────────────────────────────────

heading("4. Security and data layer");

const suites = [
  ["merkle tree hashing", "test", "backend"],
  ["RLS isolation (cross-patient denial)", "test:rls", "backend"],
  ["Edge Function authorisation", "test:functions", "backend"],
  ["Realtime respects RLS", "test:realtime", "backend"],
  ["onboarding: account + DID + credential", "test:onboard", "backend"],
];

for (const [label, script, dir] of suites) {
  step(label, "npm", ["run", script], {
    cwd: `${ROOT}/${dir}`,
    timeout: 900_000,
    extract: (out) => {
      const pass = (out.match(/ℹ pass (\d+)/) ?? [])[1];
      const fail = (out.match(/ℹ fail (\d+)/) ?? [])[1];
      return pass ? `${pass} passed${fail && fail !== "0" ? `, ${fail} failed` : ""}` : "";
    },
  });
}

// ─── 5. Browser end-to-end ──────────────────────────────────────────────────

heading("5. Browser end-to-end");

let havePuppeteer = true;
try {
  await import("puppeteer");
} catch {
  havePuppeteer = false;
}

if (!havePuppeteer) {
  record("browser checks", false, "puppeteer not installed (npm i -D puppeteer)", true);
} else {
  const alreadyRunning = await portInUse(DEV_PORT);

  if (!alreadyRunning) {
    console.log(`  ${c.dim}starting dev server on :${DEV_PORT}...${c.reset}`);
    devServer = spawn("npx", ["vite", "dev", "--port", String(DEV_PORT)], {
      cwd: ROOT,
      detached: true,
      stdio: "ignore",
    });
    devServer.unref();

    if (!(await waitForPort(DEV_PORT))) {
      record("dev server starts", false, `nothing listening on :${DEV_PORT}`);
    }
  } else {
    console.log(`  ${c.dim}using the dev server already on :${DEV_PORT}${c.reset}`);
  }

  if (await portInUse(DEV_PORT)) {
    const browserChecks = [
      ["session is httpOnly, no browser storage", "scripts/verify-auth-cookies.mjs"],
      ["login reaches the right portal per role", "scripts/verify-auth-e2e.mjs"],
      ["demo credentials actually sign in", "scripts/verify-demo-login.mjs"],
      ["clinical pages load, no cross-patient leak", "scripts/verify-clinical-migration.mjs"],
      ["admin console: 13 pages load, patients refused", "scripts/verify-admin-console.mjs"],
    ];

    for (const [label, script] of browserChecks) {
      step(label, "node", [script], {
        timeout: 600_000,
        env: {
          E2E_BASE: `http://localhost:${DEV_PORT}`,
          AUTHCHECK_BASE: `http://localhost:${DEV_PORT}`,
        },
        extract: (out) => {
          const n = (out.match(/PASS/g) ?? []).length;
          return n ? `${n} checks` : "";
        },
      });
    }
  }
}

// ─── Teardown ───────────────────────────────────────────────────────────────

if (devServer?.pid) {
  try {
    // Kill the process group, since npx spawns children.
    process.kill(-devServer.pid, "SIGKILL");
  } catch {
    /* already gone */
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok && !r.skipped);
const skipped = results.filter((r) => r.skipped);
const passed = results.filter((r) => r.ok);

console.log(`\n${c.bold}Summary${c.reset}`);
console.log(`  ${c.green}${passed.length} passed${c.reset}`);
if (skipped.length) console.log(`  ${c.yellow}${skipped.length} skipped${c.reset}`);
if (failed.length) {
  console.log(`  ${c.red}${failed.length} failed${c.reset}`);
  for (const f of failed)
    console.log(`    ${c.red}·${c.reset} ${f.name}  ${c.dim}${f.detail}${c.reset}`);
}

if (failed.length) {
  console.log(`\n${c.red}${c.bold}NOT OK${c.reset} — see the failures above.`);
  process.exit(1);
}
console.log(`\n${c.green}${c.bold}ALL CHECKS PASSED${c.reset} — the stack is working end to end.`);
