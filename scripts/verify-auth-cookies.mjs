/**
 * Headless verification of the httpOnly cookie auth flow.
 *
 * Loads the /authcheck page in a real browser, clicks through
 * sign in -> who am I -> sign out, and asserts:
 *   - the session cookie is HttpOnly (invisible to document.cookie)
 *   - localStorage and sessionStorage stay empty
 *   - the profile is resolved from Postgres
 *
 * Uses the browser rather than curl because TanStack server functions use a
 * seroval wire format that is impractical to hand-craft.
 *
 * Run: node scripts/verify-auth-cookies.mjs   (requires dev server on :5199)
 */

const BASE = process.env.AUTHCHECK_BASE ?? "http://localhost:5199";

let puppeteer;
try {
  puppeteer = await import("puppeteer");
} catch {
  console.error("puppeteer not installed — skipping browser verification.");
  console.error("Install with: npm i -D puppeteer");
  process.exit(2);
}

const browser = await puppeteer.default.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
const failures = [];
const consoleErrors = [];

page.on("pageerror", (e) => consoleErrors.push(String(e.message)));


/** Click a button by its visible label — the page also renders sidebar buttons. */
async function clickByText(page, label) {
  const handles = await page.$$("button");
  for (const h of handles) {
    const t = await page.evaluate((el) => el.textContent?.trim(), h);
    if (t === label) {
      await h.click();
      return;
    }
  }
  throw new Error(`button not found: ${label}`);
}

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.log(`  FAIL  ${label} ${detail}`);
    failures.push(label);
  }
}

console.log(`Loading ${BASE}/authcheck`);
await page.goto(`${BASE}/authcheck`, { waitUntil: "networkidle0", timeout: 60000 });

// ─── Sign in ────────────────────────────────────────────────────────────────
console.log("\nStep 1: sign in");
await clickByText(page, "1. Sign in");
await new Promise((r) => setTimeout(r, 4000));

let logText = await page.$eval("pre", (el) => el.textContent ?? "");

check("signIn returned ok:true", /"ok":\s*true/.test(logText), logText.slice(0, 200));
check("profile resolved from DB (role present)", /"role":\s*"patient"/.test(logText));

// The critical assertion: the token must not be reachable from JavaScript.
const jsVisibleCookie = await page.evaluate(() => document.cookie);
check(
  "document.cookie contains no auth token",
  !/sb-.*-auth-token/.test(jsVisibleCookie),
  `saw: "${jsVisibleCookie}"`,
);

const storage = await page.evaluate(() => ({
  local: Object.keys(localStorage),
  session: Object.keys(sessionStorage),
}));
check("localStorage is empty", storage.local.length === 0, JSON.stringify(storage.local));
check("sessionStorage is empty", storage.session.length === 0, JSON.stringify(storage.session));

// Confirm the cookie exists but is flagged HttpOnly.
const cookies = await page.cookies();
const authCookies = cookies.filter((c) => c.name.includes("auth-token"));
check("an auth cookie was set", authCookies.length > 0, JSON.stringify(cookies.map((c) => c.name)));
check(
  "every auth cookie is HttpOnly",
  authCookies.length > 0 && authCookies.every((c) => c.httpOnly),
  JSON.stringify(authCookies.map((c) => ({ name: c.name, httpOnly: c.httpOnly }))),
);
check(
  "every auth cookie is SameSite=Lax",
  authCookies.length > 0 && authCookies.every((c) => c.sameSite === "Lax"),
  JSON.stringify(authCookies.map((c) => c.sameSite)),
);

// ─── Who am I ───────────────────────────────────────────────────────────────
console.log("\nStep 2: getCurrentUser (server reads cookie, queries Postgres)");
await clickByText(page, "2. Who am I");
await new Promise((r) => setTimeout(r, 3000));
logText = await page.$eval("pre", (el) => el.textContent ?? "");

check("getCurrentUser returned the profile", /"fullName":\s*"Alice Tan"/.test(logText));
check("primary DID came from the database", /did:hosp:0xSEEDA01/.test(logText));

// ─── Sign out ───────────────────────────────────────────────────────────────
console.log("\nStep 3: sign out");
await clickByText(page, "3. Sign out");
await new Promise((r) => setTimeout(r, 3000));

const afterSignOut = await page.cookies();
const remaining = afterSignOut.filter(
  (c) => c.name.includes("auth-token") && c.value && c.value.length > 5,
);
check("auth cookies cleared on sign out", remaining.length === 0, JSON.stringify(remaining.map((c) => c.name)));

if (consoleErrors.length) {
  console.log("\nPage errors observed:");
  for (const e of consoleErrors.slice(0, 5)) console.log("   ", e);
}

await browser.close();

console.log("");
if (failures.length) {
  console.error(`FAILED (${failures.length}): ${failures.join(", ")}`);
  process.exit(1);
}
console.log("ALL AUTH COOKIE CHECKS PASSED");
