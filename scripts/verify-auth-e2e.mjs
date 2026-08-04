/**
 * End-to-end verification of the migrated auth flow.
 *
 * Drives the real login page in a browser to confirm the localStorage removal
 * actually holds at runtime:
 *   - signing in via the login form sets an HttpOnly cookie
 *   - no token material lands in localStorage / sessionStorage / document.cookie
 *   - the role gate lets the right portal through
 *   - a wrong-portal choice is refused
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

/** Click a button whose visible text matches exactly. */
async function clickText(page, text) {
  const els = await page.$$("button");
  for (const el of els) {
    const t = await page.evaluate((n) => n.textContent?.trim(), el);
    if (t === text) {
      await el.click();
      return true;
    }
  }
  return false;
}

/** Run the login form for one portal and return observed state. */
async function login(portalLabel, email) {
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 60000 });

  // Portal cards render as buttons; pick the requested one.
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

  await Promise.race([
    clickText(page, "Sign In"),
    clickText(page, "Continue"),
    page.keyboard.press("Enter"),
  ]);
  await new Promise((r) => setTimeout(r, 6000));

  const state = await page.evaluate(() => ({
    url: location.pathname,
    cookieVisibleToJs: document.cookie,
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    bodyText: document.body.innerText.slice(0, 400),
  }));
  const cookies = await page.cookies();
  await page.close();
  return { state, cookies };
}

// ─── Patient signs into the patient portal ──────────────────────────────────
console.log("\nPatient -> patient portal");
{
  const { state, cookies } = await login("Patient", "alice.patient@seed.test");
  const auth = cookies.filter((c) => c.name.includes("auth-token"));

  check("reached the patient portal", state.url.startsWith("/patient"), `url=${state.url}`);
  check("auth cookie present", auth.length > 0, JSON.stringify(cookies.map((c) => c.name)));
  check("auth cookie is HttpOnly", auth.length > 0 && auth.every((c) => c.httpOnly));
  check(
    "no token readable from JS",
    !/auth-token/.test(state.cookieVisibleToJs),
    state.cookieVisibleToJs.slice(0, 120),
  );
  check(
    "localStorage holds no auth keys",
    !state.local.some((k) => /token|userRole|userEmail|userDID/i.test(k)),
    JSON.stringify(state.local),
  );
  check(
    "sessionStorage holds no auth keys",
    !state.session.some((k) => /token|userRole|userEmail|userDID/i.test(k)),
    JSON.stringify(state.session),
  );
}

// ─── Doctor signs into the staff portal ─────────────────────────────────────
console.log("\nDoctor -> staff portal");
{
  const { state } = await login("Staff", "dr.smith@seed.test");
  check("doctor reached the staff portal", state.url.startsWith("/staff"), `url=${state.url}`);
}

// ─── Wrong portal must be refused ───────────────────────────────────────────
console.log("\nPatient -> admin portal (must be refused)");
{
  const { state } = await login("Admin", "alice.patient@seed.test");
  check(
    "patient not admitted to the admin portal",
    !state.url.startsWith("/admin"),
    `url=${state.url}`,
  );
}

await browser.close();

console.log("");
if (failures.length) {
  console.error(`FAILED (${failures.length}): ${failures.join(", ")}`);
  process.exit(1);
}
console.log("ALL AUTH E2E CHECKS PASSED");
