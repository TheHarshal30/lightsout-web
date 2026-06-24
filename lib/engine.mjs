
import { analyze, measureResponse, paintReadiness, classifyPRR, DEFAULT_RTT_MS } from "./analyze.mjs";
import { META, SITES, BY_HOST } from "./bench-data.mjs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
export const RTT = DEFAULT_RTT_MS;
export const benchData = { meta: META, sites: SITES };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

export async function analyzeUrl(target) {
  const url = /^https?:\/\//i.test(target) ? target : "https://" + target;
  const r = await fetch(url, { redirect: "follow", headers: { "user-agent": UA }, signal: AbortSignal.timeout(9000) });
  const html = await r.text();
  if (Buffer.byteLength(html) < 256 || !/<\s*(!doctype|html|head|body|meta)/i.test(html)) {
    throw new Error(`the server returned no usable HTML (HTTP ${r.status}) — it may block bots`);
  }
  const documentWire = measureResponse(r.headers, html);
  const report = await analyze(html, { baseUrl: r.url, documentWire, rtt: RTT });
  const cp = report.criticalPath, d = report.document;
  return {
    domain: host(r.url),
    finalUrl: r.url,
    rtts: cp.roundTrips,
    htmlTrips: cp.htmlTrips,
    blockingTrips: cp.blockingTrips,
    floorMs: cp.networkFloorMs,
    htmlKB: Number((d.wire / 1024).toFixed(1)),
    fits: d.fits,
    rttMs: RTT,
    blocking: report.blocking.filter((b) => !b.error).map((b) => ({ type: b.type, url: b.url, kb: b.gzip ? Number((b.gzip / 1024).toFixed(1)) : null, risk: b.risk || null })),
    advice: report.advice || [],
  };
}

export async function measureUrl(target) {
  const a = await analyzeUrl(target);
  const known = BY_HOST[a.domain];
  if (known) {
    const prr = paintReadiness(a.floorMs, known.fcpMs);
    return { fcpMs: known.fcpMs, floorMs: a.floorMs, prr, classification: classifyPRR(prr)?.label, source: "benchmark" };
  }
  try {
    const { renderFcp } = await import("./render.mjs");
    const fcpMs = await renderFcp(a.finalUrl);
    if (fcpMs != null) {
      const prr = paintReadiness(a.floorMs, fcpMs);
      return { fcpMs, floorMs: a.floorMs, prr, classification: classifyPRR(prr)?.label, source: "live" };
    }
    return { unavailable: true, floorMs: a.floorMs, message: `${a.domain} didn’t paint within the time limit — measure it with the CLI:  npx lightsout ${a.domain} --fcp` };
  } catch (e) {
    return { unavailable: true, floorMs: a.floorMs, message: `Live render isn’t available right now — measure ${a.domain} with the CLI:  npx lightsout ${a.domain} --fcp`, error: String((e && e.stack) || e).slice(0, 600) };
  }
}
