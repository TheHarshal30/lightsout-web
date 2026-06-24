/*
 * Live First Contentful Paint via headless Chrome.
 *
 * Running Chromium *inside* a Vercel function is unreliable (the @sparticuz
 * binary can't find its shared libs — libnss3 — on the Lambda runtime). The
 * robust serverless pattern is to drive a REMOTE browser over a WebSocket:
 *
 *   BROWSER_WS_ENDPOINT = wss://production-sfo.browserless.io/chromium?token=…
 *
 * Set that env var (e.g. a Browserless token URL) and live render works for any
 * URL. Without it, the hosted tool serves committed PRR for benchmarked hosts and
 * points everything else to the CLI. Locally it just drives the system Chrome.
 */
import puppeteer from "puppeteer-core";
import { access } from "node:fs/promises";

const THROTTLE = { latencyMs: 150, downloadKbps: 1600, uploadKbps: 750 };
const WS_ENDPOINT = process.env.BROWSER_WS_ENDPOINT
  || (process.env.BROWSERLESS_TOKEN ? `wss://production-sfo.browserless.io/chromium?token=${process.env.BROWSERLESS_TOKEN}` : null);
const onServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_REGION);

const LOCAL_CHROME = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

async function localChromePath() {
  for (const p of LOCAL_CHROME) { try { await access(p); return p; } catch {} }
  return null;
}

// Reuse a locally-launched browser across calls; remote connections are made
// fresh per render (one session each) so we don't hold a Browserless slot.
let localBrowserP = null;
async function getLocalBrowser() {
  if (localBrowserP) {
    const b = await localBrowserP.catch(() => null);
    if (b && b.connected) return b;
    localBrowserP = null;
  }
  localBrowserP = (async () => {
    const exe = await localChromePath();
    if (!exe) throw new Error("no Chrome found for local rendering (set CHROME_PATH)");
    return puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
  })();
  return localBrowserP;
}

// Returns FCP in ms (throttled), or null if it never painted in the budget.
export async function renderFcp(url, { gotoMs = 30000, paintMs = 20000 } = {}) {
  let browser, remote = false;
  if (WS_ENDPOINT) { browser = await puppeteer.connect({ browserWSEndpoint: WS_ENDPOINT }); remote = true; }
  else if (onServerless) { throw new Error("live rendering isn’t configured on this deployment (set BROWSER_WS_ENDPOINT)"); }
  else { browser = await getLocalBrowser(); }

  const page = await browser.newPage();
  try {
    const client = page.createCDPSession ? await page.createCDPSession() : await page.target().createCDPSession();
    await client.send("Network.enable");
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: THROTTLE.latencyMs,
      downloadThroughput: Math.round((THROTTLE.downloadKbps * 1024) / 8),
      uploadThroughput: Math.round((THROTTLE.uploadKbps * 1024) / 8),
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: gotoMs }).catch(() => {});
    const fcp = await page.evaluate((to) => new Promise((resolve) => {
      const read = () => { const e = performance.getEntriesByName("first-contentful-paint")[0]; return e ? e.startTime : null; };
      const v = read(); if (v != null) return resolve(v);
      const obs = new PerformanceObserver(() => { const x = read(); if (x != null) { obs.disconnect(); resolve(x); } });
      obs.observe({ type: "paint", buffered: true });
      setTimeout(() => resolve(read()), to);
    }), paintMs);
    return fcp != null ? Math.round(fcp) : null;
  } finally {
    await page.close().catch(() => {});
    if (remote) await browser.disconnect().catch(() => {});
  }
}
