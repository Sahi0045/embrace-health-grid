/**
 * Verifies that Realtime actually connects in a browser.
 *
 * Worth its own check because this failed in production while every other test
 * passed. A trailing newline in the deployment's anon key made the WebSocket
 * URL end in "%0A", which the Realtime server rejects before the handshake. REST
 * calls tolerated the same value, so the app looked completely healthy while
 * live updates never arrived — the page said "changes sync instantly" and the
 * user had to press Refresh.
 *
 * The Node-level Realtime tests could not catch it: they build the URL from
 * process.env directly, not from the deployed bundle.
 *
 * Usage:
 *   node scripts/verify-realtime-browser.mjs                 # against localhost:5199
 *   BASE_URL=https://... node scripts/verify-realtime-browser.mjs
 */

const puppeteer = (await import("puppeteer")).default;
const { existsSync } = await import("node:fs");

const BASE = (process.env.BASE_URL ?? "http://localhost:5199").replace(/\/$/, "");
const EMAIL = process.env.VERIFY_EMAIL ?? "dr.smith@seed.test";
const PASSWORD = process.env.VERIFY_PASSWORD ?? "SeedPassw0rd!dev";

/** A page that actually opens a subscription. */
const REALTIME_PAGE = "/staff/appointments";

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

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ${detail}` : ""}`);
}

const browser = await puppeteer.launch(chromeLaunchOptions());

try {
  const page = await browser.newPage();

  const sockets = [];
  const cdp = await page.target().createCDPSession();
  await cdp.send("Network.enable");

  cdp.on("Network.webSocketCreated", (e) => {
    if (e.url.includes("/realtime/v1/websocket")) sockets.push({ url: e.url, status: null });
  });
  cdp.on("Network.webSocketHandshakeResponseReceived", (e) => {
    const open = sockets.find((s) => s.status === null);
    if (open) open.status = e.response.status;
  });

  // ── sign in ───────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle0", timeout: 70000 });
  for (const el of await page.$$("button")) {
    const text = await page.evaluate((n) => n.textContent ?? "", el);
    if (text.includes("Staff")) {
      await el.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 1500));
  await page.type('input[type="email"]', EMAIL);
  await page.type('input[type="password"]', PASSWORD);
  await page.keyboard.press("Enter");
  await new Promise((r) => setTimeout(r, 9000));

  await page.goto(`${BASE}${REALTIME_PAGE}`, { waitUntil: "networkidle0", timeout: 70000 });
  // Realtime connects after the session token is fetched, so allow for it.
  await new Promise((r) => setTimeout(r, 10000));

  record("a Realtime socket is attempted", sockets.length > 0, `${sockets.length} attempt(s)`);

  // The specific regression: an encoded newline or whitespace in the key.
  const dirty = sockets.filter((s) => /%0A|%0D|%20/.test(s.url));
  record(
    "the socket URL carries no encoded whitespace",
    dirty.length === 0,
    dirty.length ? "found %0A/%0D/%20 — check the anon key env var for a trailing newline" : "",
  );

  // 101 Switching Protocols is the only success case.
  const upgraded = sockets.filter((s) => s.status === 101);
  record(
    "the socket completes the handshake",
    sockets.length > 0 && upgraded.length > 0,
    `${upgraded.length}/${sockets.length} upgraded`,
  );

  // Repeated create-with-no-handshake means a reconnect loop, which is what a
  // rejected key looks like from the client side.
  const noHandshake = sockets.filter((s) => s.status === null).length;
  record(
    "no reconnect loop",
    noHandshake < 3,
    noHandshake >= 3 ? `${noHandshake} sockets never upgraded` : "",
  );
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log();
if (failed.length) {
  console.log(`NOT OK — ${failed.length} of ${results.length} checks failed`);
  process.exit(1);
}
console.log(`OK — Realtime connects in a browser (${results.length} checks)`);
