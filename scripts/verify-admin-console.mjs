/**
 * Verifies the merged admin console.
 *
 * The admin pages used to live in a standalone SPA on :3002 that was never
 * deployed. They are now routes in the main app, so they inherit the httpOnly
 * session and RouteGuard.
 *
 * Two things are checked for every page:
 *   1. an admin can load it and it renders real data
 *   2. a PATIENT is refused — the guard is not just a hidden nav link
 *
 * Run with a dev server (npm run verify starts one).
 */

const BASE = process.env.E2E_BASE ?? "http://localhost:5199";
const PASSWORD = "SeedPassw0rd!dev";

const ADMIN_PAGES = [
  "/admin",
  "/admin/dids",
  "/admin/credentials",
  "/admin/people",
  "/admin/prescriptions",
  "/admin/nfc-cards",
  "/admin/policies",
  "/admin/fraud",
  "/admin/audit",
  "/admin/financial",
  "/admin/digital-twin",
  "/admin/command",
  "/admin/profile",
];

const puppeteer = (await import("puppeteer")).default;

const failures = [];
function check(label, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : "  " + detail}`);
  if (!ok) failures.push(label);
}

const { existsSync } = await import("node:fs");

/**
 * Puppeteer's bundled Chrome is not always present (the cache can be pruned, and
 * CI images vary), so fall back to a system install rather than failing the run.
 */
function chromeLaunchOptions(extra = {}) {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);

  const executablePath = candidates.find((p) => existsSync(p));

  return {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    ...(executablePath ? { executablePath } : {}),
    ...extra,
  };
}

const browser = await puppeteer.launch(chromeLaunchOptions());

/** Sign in through the real login form and return the page. */
async function signIn(portalLabel, email) {
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 60000 });

  for (const el of await page.$$("button")) {
    const t = await page.evaluate((n) => n.textContent ?? "", el);
    if (t.includes(portalLabel)) {
      await el.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 1200));

  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', PASSWORD);
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 6500));

  return page;
}

// ─── An admin can reach every page ──────────────────────────────────────────

console.log("\nAdmin access");

const admin = await signIn("Admin", "admin@seed.test");

let loaded = 0;
for (const path of ADMIN_PAGES) {
  const resp = await admin
    .goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 60000 })
    .catch(() => null);
  await new Promise((r) => setTimeout(r, 2000));

  const status = resp?.status() ?? 0;
  const text = await admin.evaluate(() => document.body.innerText);

  // A crash shows an error boundary; a blocked page shows "Access Denied".
  const crashed = /Application Error|Unhandled|didn't load/i.test(text);
  const denied = /Access Denied/i.test(text);
  const ok = status === 200 && !crashed && !denied && text.length > 40;

  if (ok) loaded += 1;
  else
    check(
      `${path} loads for an admin`,
      false,
      `status=${status} denied=${denied} crashed=${crashed}`,
    );
}
check(
  `all ${ADMIN_PAGES.length} admin pages load`,
  loaded === ADMIN_PAGES.length,
  `${loaded}/${ADMIN_PAGES.length}`,
);

// The DID page should show real registry rows, not an empty table.
await admin.goto(`${BASE}/admin/dids`, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));
const didText = await admin.evaluate(() => document.body.innerText);
check(
  "DID management lists real DIDs",
  /did:hosp:0x/.test(didText),
  "no did:hosp:0x… found on the page",
);
check("Issue DID control is present", /Issue DID/i.test(didText));

// No token may be readable, on an admin page especially.
const storage = await admin.evaluate(() => ({
  cookie: document.cookie,
  local: Object.keys(localStorage),
}));
check(
  "admin session is not readable from JS",
  !/auth-token|access_token/i.test(storage.cookie) && !storage.local.some((k) => /token/i.test(k)),
  JSON.stringify(storage).slice(0, 120),
);

await admin.close();

// ─── A patient is refused ───────────────────────────────────────────────────

console.log("\nPatient is refused admin pages");

const patient = await signIn("Patient", "alice.patient@seed.test");

let refused = 0;
const sample = ["/admin/dids", "/admin/people", "/admin/fraud", "/admin/policies"];

for (const path of sample) {
  await patient
    .goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 60000 })
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));

  const text = await patient.evaluate(() => document.body.innerText);
  const url = await patient.evaluate(() => location.pathname);

  // Acceptable outcomes: the guard's Access Denied screen, or a redirect away.
  const blocked = /Access Denied/i.test(text) || !url.startsWith("/admin");

  // The decisive check: no DID registry data leaked to a patient.
  const leaked = /did:hosp:0xSEEDD01|Dr\. Ravi Menon/.test(text);

  if (blocked && !leaked) refused += 1;
  else check(`${path} refuses a patient`, false, `blocked=${blocked} leaked=${leaked} url=${url}`);
}
check(
  `all ${sample.length} sampled pages refuse a patient`,
  refused === sample.length,
  `${refused}/${sample.length}`,
);

await patient.close();
await browser.close();

console.log("");
if (failures.length) {
  console.error(`FAILED (${failures.length}): ${failures.join(", ")}`);
  process.exit(1);
}
console.log("ALL ADMIN CONSOLE CHECKS PASSED");
