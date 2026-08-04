/**
 * Verifies the demo auto-fill buttons on the login page actually work.
 *
 * The advertised credentials previously pointed at Express-era accounts
 * (patient@example.com etc.) that have no Supabase Auth equivalent, so every
 * auto-fill button failed. This clicks each one and confirms a real sign-in.
 *
 * Run with the dev server on :5199.
 */

const BASE = process.env.E2E_BASE ?? "http://localhost:5199";
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

/** Click a button whose text contains the given fragment. */
async function clickContaining(page, fragment) {
  for (const el of await page.$$("button")) {
    const t = await page.evaluate((n) => n.textContent ?? "", el);
    if (t.includes(fragment)) {
      await el.click();
      return true;
    }
  }
  return false;
}

/**
 * Select a portal, press its auto-fill button, submit, and report where we land.
 */
async function tryPortal(portalLabel, autofillLabel, expectedPath) {
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 60000 });

  await clickContaining(page, portalLabel);
  await new Promise((r) => setTimeout(r, 1200));

  const filled = await clickContaining(page, autofillLabel);
  if (!filled) {
    await page.close();
    return { ok: false, reason: `auto-fill button "${autofillLabel}" not found` };
  }
  await new Promise((r) => setTimeout(r, 400));

  // Confirm the fields were actually populated by the button.
  const values = await page.evaluate(() => ({
    email: (document.querySelector('input[type="email"]') || {}).value ?? "",
    password: (document.querySelector('input[type="password"]') || {}).value ?? "",
  }));

  await clickContaining(page, "Sign in");
  await new Promise((r) => setTimeout(r, 6500));

  const path = await page.evaluate(() => location.pathname);
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
  await page.close();

  return {
    ok: path.startsWith(expectedPath),
    email: values.email,
    passwordFilled: values.password.length > 0,
    path,
    bodyText,
  };
}

console.log("\nPatient portal auto-fill");
{
  const r = await tryPortal("Patient", "Auto-fill Patient", "/patient");
  check("auto-fill populated the email", r.email?.includes("@"), r.email ?? "");
  check("auto-fill populated the password", r.passwordFilled === true);
  check("sign-in reached /patient", r.ok, `path=${r.path} :: ${r.bodyText?.slice(0, 120)}`);
}

console.log("\nStaff portal auto-fill");
{
  const r = await tryPortal("Staff", "Auto-fill Doctor", "/staff");
  check("auto-fill populated the email", r.email?.includes("@"), r.email ?? "");
  check("sign-in reached /staff", r.ok, `path=${r.path} :: ${r.bodyText?.slice(0, 120)}`);
}

console.log("\nAdmin portal auto-fill");
{
  const r = await tryPortal("Admin", "Auto-fill Admin", "/");
  check("auto-fill populated the email", r.email?.includes("@"), r.email ?? "");
  // Admin lands on "/" so only assert it left the login page.
  check("sign-in left the login page", r.path !== "/login", `path=${r.path}`);
}

console.log("\nSignup is disabled");
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 60000 });
  await clickContaining(page, "Patient");
  await new Promise((r) => setTimeout(r, 1200));
  const text = await page.evaluate(() => document.body.innerText);
  check(
    "no self-service Sign up link is offered",
    !/Sign up/i.test(text),
    "a Sign up affordance is still present",
  );
  check("directs the user to an administrator", /administrator/i.test(text));
  await page.close();
}

await browser.close();

console.log("");
if (failures.length) {
  console.error(`FAILED (${failures.length}): ${failures.join(", ")}`);
  process.exit(1);
}
console.log("ALL DEMO LOGIN CHECKS PASSED");
