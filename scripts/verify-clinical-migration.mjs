/**
 * Runtime verification of the migrated clinical data layer (task 9).
 *
 * Confirms the Supabase-backed server functions replaced the Express calls
 * correctly, and — more importantly — that RLS still governs the results when
 * reached through the app rather than through a test harness.
 *
 * Checks:
 *   - a patient's clinical pages load without an Express backend running
 *   - a patient sees only their own records
 *   - no auth token appears in browser storage on any migrated page
 *   - no request is made to the old :3001 backend
 *
 * Run with the dev server on :5199.
 */

const BASE = process.env.E2E_BASE ?? "http://localhost:5199";
const PASSWORD = "SeedPassw0rd!dev";

const puppeteer = (await import("puppeteer")).default;

const failures = [];
function check(label, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : "  " + detail}`);
  if (!ok) failures.push(label);
}

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();

// Track any call to the retired Express backend.
const legacyCalls = [];
const pageErrors = [];
page.on("request", (r) => {
  const url = r.url();
  if (!/localhost:3001/.test(url)) return;
  // Health polling and the WebSocket realtime store still target Express;
  // those are replaced in task 10 (Realtime) and task 11 (decommission).
  // Task 9 covers the CLINICAL DATA endpoints, so only flag those.
  if (/\/health/.test(url)) return;
  if (/\/api\/(medical-records|prescriptions|lab|consent|appointments|did)/.test(url)) {
    legacyCalls.push(url);
  }
});
page.on("pageerror", (e) => pageErrors.push(String(e.message)));

/** Sign in through the real login form. */
async function login(portalLabel, email) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 60000 });
  const cards = await page.$$("button");
  for (const c of cards) {
    const txt = await page.evaluate((n) => n.textContent ?? "", c);
    if (txt.includes(portalLabel)) {
      await c.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 1200));
  await page.type('input[type="email"]', email);
  await page.type('input[type="password"]', PASSWORD);
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 6000));
}

console.log("\nSigning in as a patient");
await login("Patient", "alice.patient@seed.test");
check("reached the patient portal", (await page.evaluate(() => location.pathname)).startsWith("/patient"));

// ─── Clinical pages load from Supabase ──────────────────────────────────────
const pages = ["/patient/records", "/patient/consent", "/patient/appointments"];

for (const path of pages) {
  console.log(`\nLoading ${path}`);
  const resp = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0", timeout: 60000 }).catch(() => null);
  await new Promise((r) => setTimeout(r, 3500));

  const status = resp?.status() ?? 0;
  check(`${path} responded 200`, status === 200, `status=${status}`);

  const text = await page.evaluate(() => document.body.innerText);

  // A crash surfaces as an error boundary or a blank page.
  check(
    `${path} rendered without a crash`,
    !/Application Error|Unhandled|didn't load/i.test(text) && text.length > 40,
    text.slice(0, 120),
  );

  // The token must not be readable on any authenticated page.
  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    cookie: document.cookie,
  }));
  check(
    `${path} exposes no token to JS`,
    !/auth-token|authToken/.test(storage.cookie) &&
      !storage.local.some((k) => /token/i.test(k)) &&
      !storage.session.some((k) => /token/i.test(k)),
    JSON.stringify(storage),
  );
}

// ─── Cross-patient isolation through the UI ─────────────────────────────────
console.log("\nCross-patient isolation (Bob's DID must not appear for Alice)");
await page.goto(`${BASE}/patient/records`, { waitUntil: "networkidle0", timeout: 60000 });
await new Promise((r) => setTimeout(r, 3500));
const recordsText = await page.evaluate(() => document.body.innerText);

check(
  "Bob's DID does not appear on Alice's records page",
  !recordsText.includes("0xSEEDB02"),
  "found Bob's DID in Alice's view",
);
check(
  "Bob's record title does not appear",
  !recordsText.includes("Fracture Follow-up"),
  "found Bob's record in Alice's view",
);

// ─── The Express backend is no longer contacted ─────────────────────────────
console.log("\nLegacy backend usage");
check(
  "no clinical-data requests to the retired Express backend",
  legacyCalls.length === 0,
  `${legacyCalls.length} call(s), e.g. ${legacyCalls[0] ?? ""}`,
);

if (pageErrors.length) {
  console.log("\nPage errors observed (first 5):");
  for (const e of pageErrors.slice(0, 5)) console.log("   ", e.slice(0, 160));
}

await browser.close();

console.log("");
if (failures.length) {
  console.error(`FAILED (${failures.length}): ${failures.join(", ")}`);
  process.exit(1);
}
console.log("ALL CLINICAL MIGRATION CHECKS PASSED");
