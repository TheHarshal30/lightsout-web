/*
 * Live First Contentful Paint via headless Chrome — the one piece that needs a
 * real browser. On Vercel it runs @sparticuz/chromium (a Lambda-compatible
 * Chromium) through puppeteer-core; locally it drives the system Chrome. The
 * browser is reused across warm invocations.
 *
 * Hobby plan: the function is given 1024 MB / 60 s (see vercel.json). We keep an
 * internal budget below that and return null if the page never paints in time,
 * so a pathologically slow site degrades to a message instead of a hard timeout.
 */
// Static imports so Vercel's bundler (nft) reliably traces puppeteer-core and the
// Chromium binary into the function. On local macOS the @sparticuz import just
// loads JS (its Linux binary is never launched — we use the system Chrome).
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { access } from "node:fs/promises";

const THROTTLE = { latencyMs: 150, downloadKbps: 1600, uploadKbps: 750 };
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

let browserP = null;
async function getBrowser() {
  if (browserP) {
    const b = await browserP.catch(() => null);
    if (b && b.connected) return b;
    browserP = null;
  }
  browserP = (async () => {
    if (onServerless) {
      return puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: chromium.headless });
    }
    const exe = await localChromePath();
    if (!exe) throw new Error("no Chrome found for local rendering (set CHROME_PATH)");
    return puppeteer.launch({ executablePath: exe, headless: true, args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"] });
  })();
  return browserP;
}

// Returns FCP in ms (throttled), or null if it never painted in the budget.
export async function renderFcp(url, { gotoMs = 30000, paintMs = 20000 } = {}) {
  const browser = await getBrowser();
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
    // domcontentloaded resolves after the first paint for most pages; the in-page
    // observer (buffered + live) then catches FCP whether it fired before or after.
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
  }
}
