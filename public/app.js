
const $ = (sel, el = document) => el.querySelector(sel);
const RTT_MS = 150;
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (ms) => (ms == null ? "—" : ms < 1000 ? Math.round(ms) + " ms" : (ms / 1000).toFixed(1) + " s");

function band(prr) {
  if (prr == null) return { name: "—", color: "#5a616b", icon: "○", i: -1 };
  if (prr < 0.1) return { name: "JS-bound", color: "#eb5a5a", icon: "●", i: 0 };
  if (prr < 0.3) return { name: "JS-taxed", color: "#eb9646", icon: "◕", i: 1 };
  if (prr < 0.6) return { name: "Moderately delayed", color: "#e6c850", icon: "◑", i: 2 };
  if (prr < 0.9) return { name: "Efficient", color: "#a6d94f", icon: "◔", i: 3 };
  return { name: "Floor-limited", color: "#50dc78", icon: "○", i: 4 };
}

function lights(prr, measured, loading, loadLit, size) {
  const dim = size === "big" ? "30px" : size === "share" ? "9px" : "10px";
  const out = [];
  for (let i = 0; i < 5; i++) {
    let on, col;
    if (loading) { on = i < loadLit; col = "#eb5a5a"; }
    else if (!measured) { on = false; col = "#2a2f37"; }
    else { const lit = Math.round((1 - prr) * 5); on = i < lit; col = band(prr).color; }
    const glow = on ? `box-shadow:0 0 ${size === "big" ? "18px" : "8px"} ${col};` : "";
    const bg = on ? col : measured && !loading ? "rgba(80,220,120,0.12)" : "#15181d";
    const bord = on ? col : "#23282f";
    out.push(`<span style="width:${dim};height:${dim};border-radius:50%;background:${bg};border:1px solid ${bord};${glow}display:inline-block;transition:all .25s;"></span>`);
  }
  return out.join("");
}

const S = {
  page: "home", url: "spotify.com",
  analyze: null, analyzing: false, error: null,
  fcp: null, prr: null, measured: false, loading: false, loadLit: 0, measureMsg: null,
  bench: null, sortDir: "desc",
};

const api = async (path) => {
  const r = await fetch(path);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "request failed");
  return j;
};

async function loadBench() {
  if (S.bench) return S.bench;
  S.bench = await api("/api/bench");
  return S.bench;
}

async function runAnalyze(url) {
  S.analyzing = true; S.error = null; S.analyze = null; S.measured = false; S.fcp = null; S.prr = null; S.measureMsg = null;
  render();
  try {
    S.analyze = await api("/api/analyze?url=" + encodeURIComponent(url));
    S.url = S.analyze.domain;
  } catch (e) {
    S.error = e.message;
  }
  S.analyzing = false;
  render();
}

function measure() {
  if (S.loading || !S.analyze) return;
  S.loading = true; S.loadLit = 0; render();
  const start = Date.now();
  const tick = setInterval(() => { if (S.loadLit < 5) { S.loadLit++; render(); } }, 230);
  api("/api/measure?url=" + encodeURIComponent(S.analyze.finalUrl || S.url))
    .then((m) => {
      const finish = () => {
        clearInterval(tick);
        S.loading = false; S.loadLit = 0;
        if (m.unavailable) { S.measureMsg = m.message; }
        else {
          S.fcp = m.fcpMs;
          S.prr = m.prr != null ? m.prr : (m.fcpMs ? Math.min(1, S.analyze.floorMs / m.fcpMs) : null);
          S.measured = true; S.loadLit = 5;
        }
        render();
      };
      const elapsed = Date.now() - start;
      elapsed < 1200 ? setTimeout(finish, 1200 - elapsed) : finish();
    })
    .catch((e) => { clearInterval(tick); S.loading = false; S.error = e.message; render(); });
}

function go(page) { S.page = page; S.error = null; render(); if (page === "result" && !S.analyze && !S.analyzing) runAnalyze(S.url); }
function select(h) { S.url = h; S.page = "result"; runAnalyze(h); }

document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-action]");
  if (!t) return;
  const a = t.dataset.action;
  if (a === "nav") go(t.dataset.page);
  else if (a === "select") select(t.dataset.host);
  else if (a === "measure") measure();
  else if (a === "sort") { S.sortDir = S.sortDir === "desc" ? "asc" : "desc"; render(); }
  else if (a === "go") { const v = $("#urlInput")?.value.trim(); if (v) select(v.replace(/^https?:\/\//, "").replace(/\/$/, "")); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "urlInput") { const v = e.target.value.trim(); if (v) select(v.replace(/^https?:\/\//, "").replace(/\/$/, "")); } });

function animateBars() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll("[data-w]").forEach((el) => { el.style.width = el.dataset.w; });
  }));
}

function render() {
  const app = $("#app");
  app.innerHTML = nav() + (S.page === "home" ? home() : S.page === "result" ? result() : S.page === "bench" ? bench() : docs());
  animateBars();
}

function nav() {
  const navLights = lights(prrNow(), S.page !== "home", false, 0, "nav");
  const item = (label, page) => { const on = S.page === page; return `<button data-action="nav" data-page="${page}" style="background:${on ? "#16191e" : "none"};border:1px solid ${on ? "#23282f" : "transparent"};color:${on ? "#e7e9ec" : "#8b919b"};border-radius:8px;padding:7px 14px;cursor:pointer;font-family:'IBM Plex Mono',monospace;font-size:13px;">${label}</button>`; };
  return `<div style="position:sticky;top:0;z-index:50;background:rgba(10,12,15,0.82);backdrop-filter:blur(12px);border-bottom:1px solid #1a1e24;">
    <div style="max-width:1080px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;">
      <div data-action="nav" data-page="home" style="display:flex;align-items:center;gap:11px;cursor:pointer;">
        <div style="display:flex;gap:3px;">${navLights}</div>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:600;letter-spacing:-0.01em;">lights<span style="color:#50dc78;">out</span></span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">${item("home", "home")}${item("benchmark", "bench")}${item("cli", "docs")}</div>
    </div></div>`;
}

function prrNow() { return S.measured ? S.prr : 0.94; }

function home() {
  const b = S.bench;
  const top = b ? b.sites.slice(0, 3) : [];
  const bottom = b ? b.sites.slice(-3).reverse() : [];
  const miniRow = (s, i) => { const bd = band(s.prr); return `<div data-action="select" data-host="${esc(s.host)}" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;margin:0 -12px;border-radius:8px;cursor:pointer;">
    <span style="display:flex;align-items:center;gap:12px;"><span style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#5a616b;width:14px;">${i + 1}</span><span style="font-size:14px;">${esc(s.host)}</span></span>
    <span style="display:flex;align-items:center;gap:10px;"><span style="width:54px;height:6px;background:#16191e;border-radius:3px;overflow:hidden;display:inline-block;"><span data-w="${(s.prr * 100).toFixed(0)}%" style="display:block;height:100%;width:0;background:${bd.color};transition:width .9s cubic-bezier(.2,.8,.2,1);"></span></span><span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:${bd.color};width:34px;text-align:right;">${s.prr.toFixed(2)}</span></span></div>`; };
  const presetBtns = (b ? b.sites.slice(0, 7) : []).map((s) => { const on = s.host === S.url; return `<button data-action="select" data-host="${esc(s.host)}" style="background:${on ? "#16201a" : "#0e1115"};color:${on ? "#50dc78" : "#8b919b"};border:1px solid ${on ? "#50dc78" : "#23282f"};border-radius:20px;padding:7px 14px;font-family:'IBM Plex Mono',monospace;font-size:12px;cursor:pointer;">${esc(s.host)}</button>`; }).join("");
  const steps = [
    ["01", "Network floor", "Count the critical-path round trips at a fixed RTT. That’s the earliest first paint physically possible — pure protocol math, no browser."],
    ["02", "Real paint", "Render the page in headless Chrome under the same throttle and record when the first pixel actually lands."],
    ["03", "PRR + class", "Divide floor by actual paint. 1.00 is lights-out. We bucket the result into five classes from JS-bound to floor-limited."],
  ].map(([n, t, body]) => `<div style="background:#0e1115;border:1px solid #1a1e24;border-radius:14px;padding:26px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:#50dc78;margin-bottom:14px;">${n}</div><div style="font-size:17px;font-weight:600;margin-bottom:8px;">${t}</div><div style="font-size:14px;color:#8b919b;line-height:1.5;">${body}</div></div>`).join("");

  return `<div style="max-width:1080px;margin:0 auto;padding:0 24px 120px;">
    <div style="text-align:center;padding:88px 0 56px;">
      <div style="display:flex;justify-content:center;margin-bottom:38px;"><div style="display:flex;gap:14px;padding:22px 26px;background:#0e1115;border:1px solid #1a1e24;border-radius:16px;">${lights(0.94, true, false, 0, "big")}</div></div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#50dc78;margin-bottom:20px;">lights out · and away we go</div>
      <h1 style="font-size:56px;line-height:1.04;font-weight:700;letter-spacing:-0.025em;max-width:780px;margin:0 auto 18px;text-wrap:balance;">Does your site paint as fast as the network allows?</h1>
      <p style="font-size:18px;color:#8b919b;max-width:560px;margin:0 auto 38px;line-height:1.5;">lightsout computes the earliest paint physically possible — then measures how long JavaScript actually makes you wait.</p>
      <div style="display:flex;gap:10px;max-width:540px;margin:0 auto;font-family:'IBM Plex Mono',monospace;">
        <div style="flex:1;display:flex;align-items:center;gap:10px;background:#0e1115;border:1px solid #23282f;border-radius:12px;padding:0 16px;height:56px;">
          <span style="color:#5a616b;font-size:14px;">https://</span>
          <input id="urlInput" value="${esc(S.url)}" spellcheck="false" autocapitalize="off" style="flex:1;background:none;border:none;outline:none;color:#e7e9ec;font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:500;">
        </div>
        <button data-action="go" style="background:#50dc78;color:#06210f;border:none;border-radius:12px;height:56px;padding:0 30px;font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:600;cursor:pointer;letter-spacing:0.04em;">GO</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:18px;">${presetBtns}</div>
    </div>

    <div style="background:linear-gradient(150deg,#0f1318,#0b0e12);border:1px solid #1a1e24;border-radius:18px;padding:46px;text-align:center;margin-top:10px;">
      <div style="font-size:32px;font-weight:700;letter-spacing:-0.015em;margin-bottom:26px;text-wrap:balance;">Network constraints matter. <span style="color:#50dc78;">JavaScript dominates.</span></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);max-width:760px;margin:0 auto;font-family:'IBM Plex Mono',monospace;">
        <div style="padding:0 18px;"><div style="font-size:40px;font-weight:600;">77</div><div style="font-size:12px;color:#5a616b;margin-top:6px;">sites studied</div></div>
        <div style="padding:0 18px;border-left:1px solid #1a1e24;border-right:1px solid #1a1e24;"><div style="font-size:40px;font-weight:600;color:#eb9646;">10.7×</div><div style="font-size:12px;color:#5a616b;margin-top:6px;">mean FCP vs floor</div></div>
        <div style="padding:0 18px;"><div style="font-size:40px;font-weight:600;color:#eb5a5a;">≈0</div><div style="font-size:12px;color:#5a616b;margin-top:6px;">size↔paint correlation</div></div>
      </div>
      <p style="color:#8b919b;font-size:14px;margin-top:26px;max-width:520px;margin:26px auto 0;line-height:1.5;">A 5 KB page can paint in 13 seconds. A 257 KB page can paint in 0.5. Bytes don't decide paint.</p>
    </div>

    <div style="margin-top:64px;display:grid;grid-template-columns:1fr 1fr;gap:24px;">
      <div style="background:#0e1115;border:1px solid #1a1e24;border-radius:14px;padding:26px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;"><span style="width:8px;height:8px;border-radius:50%;background:#50dc78;box-shadow:0 0 10px #50dc78;"></span><h3 style="font-size:15px;font-weight:600;">Lights out — paints at the floor</h3></div>
        ${top.map(miniRow).join("") || skeletonRows()}
      </div>
      <div style="background:#0e1115;border:1px solid #1a1e24;border-radius:14px;padding:26px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;"><span style="width:8px;height:8px;border-radius:50%;background:#eb5a5a;box-shadow:0 0 10px #eb5a5a;"></span><h3 style="font-size:15px;font-weight:600;">Stuck on the grid — JS-bound</h3></div>
        ${bottom.map(miniRow).join("") || skeletonRows()}
      </div>
    </div>
    <div style="text-align:center;margin-top:22px;"><button data-action="nav" data-page="bench" style="background:none;border:1px solid #23282f;color:#8b919b;border-radius:10px;padding:10px 20px;font-family:'IBM Plex Mono',monospace;font-size:13px;cursor:pointer;">See all 77 sites →</button></div>

    <div style="margin-top:72px;"><h2 style="font-size:24px;font-weight:600;margin-bottom:28px;letter-spacing:-0.01em;">How it works</h2><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;">${steps}</div></div>

    <div style="margin-top:64px;background:#0e1115;border:1px solid #1a1e24;border-radius:16px;padding:38px;display:grid;grid-template-columns:1fr auto;gap:40px;align-items:center;">
      <div><h2 style="font-size:22px;font-weight:600;margin-bottom:10px;">Fix it in your repo</h2><p style="color:#8b919b;font-size:15px;line-height:1.5;max-width:420px;">Same engine, in your terminal and CI. Gate merges on paint readiness so regressions never ship.</p><button data-action="nav" data-page="docs" style="margin-top:18px;background:none;border:1px solid #23282f;color:#e7e9ec;border-radius:10px;padding:10px 18px;font-family:'IBM Plex Mono',monospace;font-size:13px;cursor:pointer;">Read the docs →</button></div>
      <div style="background:#07090b;border:1px solid #1a1e24;border-radius:10px;padding:18px 22px;font-family:'IBM Plex Mono',monospace;font-size:14px;white-space:nowrap;"><div style="color:#5a616b;">$ <span style="color:#e7e9ec;">npx lightsout scan</span></div><div style="color:#50dc78;margin-top:8px;">✓ lights out · PRR 0.94</div></div>
    </div>

    <div style="margin-top:80px;padding-top:30px;border-top:1px solid #1a1e24;display:flex;justify-content:space-between;align-items:center;font-family:'IBM Plex Mono',monospace;font-size:12px;color:#5a616b;flex-wrap:wrap;gap:12px;"><span>lightsout · paint efficiency &gt; document size</span><span style="display:flex;gap:18px;"><span>github</span><span>boxthis ↗</span><span>the article ↗</span></span></div>
  </div>`;
}
const skeletonRows = () => Array(3).fill('<div style="height:38px;margin:0 -12px;border-radius:8px;background:#10141a;animation:pulseGlow 1.1s ease-in-out infinite;"></div>').join("");

function result() {
  if (S.error) return errorPanel();
  if (S.analyzing || !S.analyze) return analyzingPanel();
  const a = S.analyze;
  const floor = a.floorMs;
  const measured = S.measured, loading = S.loading;
  const prr = measured ? S.prr : null;
  const b = band(prr);
  const slow = measured && S.fcp ? Math.max(1, Math.round(S.fcp / floor)) : null;
  const verdict = !measured ? "Network floor computed. Measure a real render to see how far JavaScript pushes paint past it."
    : prr >= 0.9 ? "Lights out. This page paints the instant the network allows — JavaScript isn’t in the way."
    : prr >= 0.6 ? "Almost away. A little render-blocking work sits between the network floor and first paint."
    : prr >= 0.3 ? "Held on the grid. Render-blocking work roughly doubles time to paint beyond the floor."
    : prr >= 0.1 ? "Stuck on the grid. JavaScript dominates first paint; the network was ready long ago."
    : `Lights still red. Paint arrives ${slow}× slower than the network requires — this is a JavaScript problem.`;

  const floorBarW = measured && S.fcp ? Math.max(2, (floor / S.fcp) * 100) + "%" : "100%";
  const fcpBarW = measured ? "100%" : "0%";

  const wf = [];
  for (let i = 0; i < a.rtts; i++) {
    const last = i === a.rtts - 1;
    const name = i < a.htmlTrips ? (a.htmlTrips > 1 ? `HTML · window ${i + 1}` : "HTML document") : "Render-blocking &lt;head&gt;";
    wf.push(`<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#5a616b;width:48px;flex-shrink:0;">RTT ${i + 1}</div>
      <div style="flex:1;height:30px;background:#07090b;border-radius:6px;position:relative;overflow:hidden;"><div data-w="${(RTT_MS / floor * 100).toFixed(1)}%" style="position:absolute;top:0;left:${(i * RTT_MS / floor * 100).toFixed(1)}%;height:100%;width:0;background:${last ? "#6b7785" : "#586273"};border-radius:5px;display:flex;align-items:center;padding:0 12px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#0a0d11;font-weight:600;transition:width .5s ease;white-space:nowrap;">${name}</div></div>
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#8b919b;width:60px;text-align:right;flex-shrink:0;">${fmt((i + 1) * RTT_MS)}</div></div>`);
  }

  const over = !a.fits, extra = Math.max(1, Math.ceil(a.htmlKB / 14) - 1);
  const budgetColor = over ? "#eb9646" : "#50dc78";
  const budgetTag = over ? `${a.htmlKB} KB gzip spills the 14 KB first window — adds +${extra} round trip${extra > 1 ? "s" : ""} before the browser has the full document.` : `${a.htmlKB} KB gzip fits inside the 14 KB first window — delivered in one round trip.`;

  const adviceCards = (a.advice || []).map(adviceCard).join("") || `<div style="color:#5a616b;font-family:'IBM Plex Mono',monospace;font-size:13px;">No render-blocking resources found in &lt;head&gt;. 🎉</div>`;

  const shareLights = lights(prr, measured, false, 0, "share");

  return `<div style="max-width:920px;margin:0 auto;padding:48px 24px 120px;">
    <button data-action="nav" data-page="home" style="background:none;border:none;color:#5a616b;font-family:'IBM Plex Mono',monospace;font-size:13px;cursor:pointer;margin-bottom:24px;">← analyze another URL</button>

    <div style="background:linear-gradient(160deg,#0f1318,#0a0d11);border:1px solid #1a1e24;border-radius:20px;padding:40px;position:relative;overflow:hidden;">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${b.color};"></div>
      <div style="display:flex;align-items:center;gap:10px;font-family:'IBM Plex Mono',monospace;font-size:13px;color:#8b919b;margin-bottom:26px;"><span style="color:#e7e9ec;">https://${esc(a.domain)}</span><span style="color:#3a3f47;">·</span><span>RTT ${a.rttMs} ms</span></div>
      <div style="display:flex;justify-content:center;margin-bottom:30px;"><div style="display:flex;gap:14px;padding:22px 26px;background:#0a0d11;border:1px solid #1a1e24;border-radius:16px;">${lights(prr, measured, loading, S.loadLit, "big")}</div></div>
      <div style="text-align:center;">
        <div style="display:inline-flex;align-items:center;gap:10px;background:${b.color}1f;border:1px solid ${b.color};border-radius:30px;padding:8px 18px;margin-bottom:18px;"><span style="font-family:'IBM Plex Mono',monospace;font-size:16px;color:${b.color};">${b.icon}</span><span style="font-size:16px;font-weight:600;color:${b.color};">${measured ? b.name : "not yet measured"}</span></div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:88px;line-height:1;font-weight:600;color:${measured ? b.color : "#5a616b"};letter-spacing:-0.03em;">${measured ? prr.toFixed(2) : "—"}</div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:#5a616b;margin-top:8px;letter-spacing:0.08em;">PAINT READINESS RATIO</div>
        <p style="color:#8b919b;font-size:15px;line-height:1.5;max-width:440px;margin:18px auto 0;">${verdict}</p>
      </div>
    </div>

    <div style="margin-top:28px;background:#0e1115;border:1px solid #1a1e24;border-radius:16px;padding:32px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:24px;"><h2 style="font-size:18px;font-weight:600;">Floor vs. actual paint</h2><span style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#5a616b;">scaled to FCP — floor length = PRR</span></div>
      <div style="display:flex;flex-direction:column;gap:20px;">
        <div><div style="display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:13px;margin-bottom:8px;"><span style="color:#8b919b;">Network floor</span><span style="color:#e7e9ec;">${fmt(floor)}</span></div><div style="height:20px;background:#07090b;border-radius:6px;overflow:hidden;"><div data-w="${floorBarW}" style="height:100%;width:0;background:#586273;border-radius:6px;transition:width 1s cubic-bezier(.2,.8,.2,1);"></div></div></div>
        <div><div style="display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:13px;margin-bottom:8px;"><span style="color:#8b919b;">Actual paint</span><span style="color:${measured ? b.color : "#5a616b"};">${measured ? fmt(S.fcp) : "—"}</span></div><div style="height:20px;background:#07090b;border-radius:6px;overflow:hidden;"><div data-w="${fcpBarW}" style="height:100%;width:0;background:${measured ? b.color : "#23282f"};border-radius:6px;transition:width 1.1s cubic-bezier(.2,.8,.2,1);"></div></div></div>
      </div>
      ${measured ? "" : S.measureMsg ? `<div style="margin-top:26px;border-top:1px solid #1a1e24;padding-top:24px;text-align:center;"><p style="color:#8b919b;font-size:14px;line-height:1.6;max-width:460px;margin:0 auto 14px;">Live rendering runs in the CLI, not the hosted tool — it needs a real browser. Measure this URL for real with:</p><div style="display:inline-block;background:#07090b;border:1px solid #1a1e24;border-radius:10px;padding:12px 18px;font-family:'IBM Plex Mono',monospace;font-size:13.5px;color:#50dc78;">npx lightsout ${esc(a.domain)} --fcp</div></div>` : `<div style="margin-top:26px;border-top:1px solid #1a1e24;padding-top:24px;text-align:center;"><p style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:#8b919b;margin-bottom:16px;">Network floor computed instantly. Actual paint needs a real render.</p><button data-action="measure" style="background:${loading ? "#0e1115" : "#50dc78"};color:${loading ? "#8b919b" : "#06210f"};border:1px solid ${loading ? "#23282f" : "#50dc78"};border-radius:10px;padding:13px 24px;font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:600;cursor:pointer;">${loading ? "Measuring…  " + S.loadLit + "/5" : "Measure real paint readiness →"}</button></div>`}
    </div>

    <div style="margin-top:28px;background:#0e1115;border:1px solid #1a1e24;border-radius:16px;padding:32px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;"><h2 style="font-size:18px;font-weight:600;">Document</h2><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5a616b;border:1px solid #23282f;border-radius:16px;padding:3px 10px;">diagnostic, not a verdict</span></div>
      <p style="color:#8b919b;font-size:14px;margin-bottom:24px;">${budgetTag}</p>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:30px;align-items:center;margin-bottom:26px;">
        <div><div style="font-family:'IBM Plex Mono',monospace;font-size:32px;font-weight:600;">${a.htmlKB}<span style="font-size:15px;color:#5a616b;"> KB</span></div><div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5a616b;margin-top:4px;">gzip · wire</div></div>
        <div><div style="display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:12px;color:#8b919b;margin-bottom:8px;"><span>First window (14 KB)</span><span>${a.htmlKB} / 14</span></div><div style="height:18px;background:#07090b;border-radius:5px;overflow:hidden;"><div data-w="${Math.min(100, a.htmlKB / 14 * 100).toFixed(0)}%" style="height:100%;width:0;background:${budgetColor};transition:width .9s cubic-bezier(.2,.8,.2,1);"></div></div></div>
      </div>
      <div style="border-top:1px solid #1a1e24;padding-top:24px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#5a616b;margin-bottom:16px;">ROUND-TRIP WATERFALL</div>${wf.join("")}</div>
    </div>

    <div style="margin-top:28px;"><h2 style="font-size:18px;font-weight:600;margin-bottom:6px;">Recommendations</h2><p style="color:#8b919b;font-size:14px;margin-bottom:20px;">Risk-graded. Safe wins first — architectural changes flagged so you don't just bolt on <span style="font-family:'IBM Plex Mono',monospace;">defer</span> and call it done.</p><div style="display:flex;flex-direction:column;gap:14px;">${adviceCards}</div></div>

    <div style="margin-top:40px;text-align:center;">
      <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#5a616b;margin-bottom:16px;">Share card</div>
      <div style="display:inline-block;background:linear-gradient(160deg,#0f1318,#0a0d11);border:1px solid ${b.color};border-radius:16px;padding:28px 40px;text-align:left;min-width:400px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;border-bottom:1px solid #1a1e24;padding-bottom:14px;"><span style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#5a616b;">lightsout.dev/r/${esc(a.domain)}</span><span style="display:flex;gap:5px;">${shareLights}</span></div>
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:16px;"><span style="font-family:'IBM Plex Mono',monospace;font-size:16px;color:${b.color};">${b.icon}</span><span style="font-size:20px;font-weight:600;color:${b.color};">${measured ? b.name : "floor only"}</span></div>
        <div style="display:flex;gap:30px;font-family:'IBM Plex Mono',monospace;"><div><div style="font-size:11px;color:#5a616b;margin-bottom:3px;">PRR</div><div style="font-size:22px;font-weight:600;color:${measured ? b.color : "#5a616b"};">${measured ? prr.toFixed(2) : "—"}</div></div><div><div style="font-size:11px;color:#5a616b;margin-bottom:3px;">FLOOR</div><div style="font-size:22px;font-weight:600;color:#e7e9ec;">${fmt(floor)}</div></div><div><div style="font-size:11px;color:#5a616b;margin-bottom:3px;">FCP</div><div style="font-size:22px;font-weight:600;color:#e7e9ec;">${measured ? fmt(S.fcp) : "—"}</div></div></div>
      </div>
    </div>
  </div>`;
}

function adviceCard(a) {
  const m = { architectural: ["⛔", "#eb5a5a", "rgba(235,90,90,0.06)", "rgba(235,90,90,0.35)"], caution: ["⚠", "#eb9646", "rgba(235,150,70,0.06)", "rgba(235,150,70,0.3)"], safe: ["✓", "#50dc78", "rgba(80,220,120,0.06)", "rgba(80,220,120,0.3)"] }[a.risk] || ["•", "#8b919b", "#0e1115", "#1a1e24"];
  const [icon, color, bg, bord] = m;
  const code = codeFor(a);
  return `<div style="background:${bg};border:1px solid ${bord};border-radius:14px;padding:20px 22px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;"><span style="font-family:'IBM Plex Mono',monospace;font-size:14px;color:${color};">${icon}</span><span style="font-size:15px;font-weight:600;">${esc(stripTags(a.title))}</span><span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:${color};border:1px solid ${color};border-radius:12px;padding:2px 8px;margin-left:auto;">${a.risk}</span></div>
    <p style="color:#8b919b;font-size:14px;line-height:1.5;margin-left:24px;margin-bottom:${code ? "12px" : "0"};">${esc(a.detail || "")}</p>
    ${code ? `<div style="margin-left:24px;background:#07090b;border:1px solid #1a1e24;border-radius:8px;padding:11px 14px;font-family:'IBM Plex Mono',monospace;font-size:12.5px;color:#9aa1ab;white-space:pre-wrap;">${esc(code)}</div>` : ""}</div>`;
}
const stripTags = (s) => String(s || "").replace(/<[^>]+>/g, (m) => m);
function codeFor(a) {
  const t = (a.title || "").toLowerCase();
  if (t.includes("preconnect")) { const m = (a.title || "").match(/href="([^"]+)"/); return `<link rel="preconnect" href="${m ? m[1] : "https://cdn.example.com"}">`; }
  if (t.includes("defer")) return `<script src="…" defer></script>`;
  if (t.includes("critical css") || t.includes("inline")) return `<style>/* critical rules */</style>\n<link rel="stylesheet" href="rest.css" media="print" onload="this.media='all'">`;
  if (a.risk === "architectural") return `<!-- ship server-rendered HTML for above-the-fold,\n     hydrate the rest after paint -->`;
  if (t.includes("trim") || t.includes("window")) return `gzip target: ≤ 14 KB for the critical document`;
  return "";
}

function analyzingPanel() {
  return `<div style="max-width:920px;margin:0 auto;padding:120px 24px;text-align:center;">
    <div style="display:flex;justify-content:center;gap:14px;margin-bottom:28px;">${lights(0, false, true, 3, "big")}</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:14px;color:#8b919b;">fetching <span style="color:#e7e9ec;">${esc(S.url)}</span> · modelling the network floor…</div>
  </div>`;
}
function errorPanel() {
  return `<div style="max-width:640px;margin:0 auto;padding:120px 24px;text-align:center;">
    <div style="font-size:40px;margin-bottom:16px;">🚧</div>
    <h2 style="font-size:22px;font-weight:600;margin-bottom:10px;">Couldn’t analyze ${esc(S.url)}</h2>
    <p style="color:#8b919b;font-size:15px;line-height:1.5;margin-bottom:24px;">${esc(S.error)}</p>
    <button data-action="nav" data-page="home" style="background:#50dc78;color:#06210f;border:none;border-radius:10px;padding:12px 24px;font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:600;cursor:pointer;">← try another URL</button>
  </div>`;
}

function bench() {
  const b = S.bench;
  const rows = b ? [...b.sites].sort((x, y) => (S.sortDir === "desc" ? y.prr - x.prr : x.prr - y.prr)) : [];
  const row = (s, i) => { const bd = band(s.prr); const on = s.host === S.url; return `<div data-action="select" data-host="${esc(s.host)}" style="display:flex;align-items:center;padding:13px 12px;margin:0 -12px;border-radius:8px;cursor:pointer;border-bottom:1px solid #15181d;background:${on ? "#16191e" : "transparent"};">
    <span style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#5a616b;width:26px;">${i + 1}</span>
    <span style="flex:1;font-size:14px;">${esc(s.host)}</span>
    <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:#8b919b;width:90px;text-align:right;">${fmt(s.floorMs)}</span>
    <span style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:#8b919b;width:90px;text-align:right;">${fmt(s.fcpMs)}</span>
    <span style="width:150px;display:flex;align-items:center;justify-content:flex-end;gap:10px;"><span style="width:46px;height:6px;background:#16191e;border-radius:3px;overflow:hidden;"><span data-w="${(s.prr * 100).toFixed(0)}%" style="display:block;height:100%;width:0;background:${bd.color};transition:width .8s cubic-bezier(.2,.8,.2,1);"></span></span><span style="font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:${bd.color};width:34px;text-align:right;">${s.prr.toFixed(2)}</span></span></div>`; };
  const stat = (v, color, label) => `<div style="background:#0e1115;border:1px solid #1a1e24;border-radius:14px;padding:24px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:30px;font-weight:600;${color ? "color:" + color : ""}">${v}</div><div style="font-size:12px;color:#5a616b;margin-top:6px;">${label}</div></div>`;

  return `<div style="max-width:1000px;margin:0 auto;padding:48px 24px 120px;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#50dc78;margin-bottom:14px;">Validation</div>
    <h1 style="font-size:42px;font-weight:700;letter-spacing:-0.02em;margin-bottom:14px;">77 real sites, one ratio</h1>
    <p style="font-size:17px;color:#8b919b;max-width:580px;line-height:1.5;margin-bottom:40px;">The network is rarely the bottleneck. Across the set, actual paint runs an order of magnitude past the floor — and document size barely predicts it.</p>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:48px;">${stat('608<span style="font-size:14px;color:#5a616b;"> ms</span>', "", "mean network floor")}${stat('6,521<span style="font-size:14px;color:#5a616b;"> ms</span>', "#eb9646", "mean actual FCP")}${stat("10.7×", "#eb5a5a", "FCP ÷ floor")}${stat("≈0.00", "", "size ↔ paint corr.")}</div>

    <div style="background:#0e1115;border:1px solid #1a1e24;border-radius:16px;padding:28px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2 style="font-size:18px;font-weight:600;">PRR leaderboard</h2><button data-action="sort" style="background:none;border:1px solid #23282f;color:#8b919b;border-radius:8px;padding:7px 14px;font-family:'IBM Plex Mono',monospace;font-size:12px;cursor:pointer;">sort: PRR ${S.sortDir === "desc" ? "↓" : "↑"}</button></div>
      <div style="display:flex;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5a616b;padding:0 12px 10px;border-bottom:1px solid #1a1e24;"><span style="width:26px;"></span><span style="flex:1;">host</span><span style="width:90px;text-align:right;">floor</span><span style="width:90px;text-align:right;">fcp</span><span style="width:150px;text-align:right;">PRR</span></div>
      ${rows.map(row).join("") || skeletonRows()}
      <p style="font-family:'IBM Plex Mono',monospace;font-size:12px;color:#5a616b;margin-top:18px;line-height:1.6;">Note the inversions: sites that <span style="color:#50dc78;">fit 14 KB but paint slowly</span>, and sites that <span style="color:#eb9646;">bust the window but paint fast</span>. Size is not the signal.</p>
    </div>

    <div style="margin-top:40px;background:#0e1115;border:1px solid #1a1e24;border-radius:16px;padding:30px;">
      <h2 style="font-size:18px;font-weight:600;margin-bottom:16px;">Methodology &amp; honesty</h2>
      <div style="display:flex;flex-direction:column;gap:14px;color:#9aa1ab;font-size:14px;line-height:1.6;">
        <p><span style="color:#e7e9ec;font-weight:600;">Network floor</span> — derived from the critical-path round trips at a fixed 150 ms RTT throttle. No browser required; it's pure protocol arithmetic.</p>
        <p><span style="color:#e7e9ec;font-weight:600;">Actual FCP</span> — measured in headless Chrome under the same 150 ms throttle, one controlled high-quality run per site.</p>
        <p><span style="color:#e7e9ec;font-weight:600;">Caveats</span> — single runs carry per-site noise; CDNs, geography, and bot protection shift numbers. We show the assumption rather than hide it. The honesty is the point.</p>
      </div>
    </div>
  </div>`;
}

function docs() {
  const modes = [
    ["lightsout <url> --fcp", "One-off audit", "Floor instantly, then a real headless render for actual paint. Verdict in your terminal."],
    ["lightsout scan", "Scan your project", "Point it at a local build or dev server and get PRR for every route, ranked."],
    ["lightsout --ci", "Gate the merge", "Drop the GitHub Action in and fail the build when paint readiness regresses. Lights stay out."],
  ].map(([cmd, t, body]) => `<div style="background:#0e1115;border:1px solid #1a1e24;border-radius:14px;padding:24px 26px;"><div style="font-family:'IBM Plex Mono',monospace;font-size:14px;color:#50dc78;margin-bottom:8px;">${esc(cmd)}</div><div style="font-size:15px;font-weight:600;margin-bottom:6px;">${t}</div><div style="color:#8b919b;font-size:14px;line-height:1.5;">${body}</div></div>`).join("");
  return `<div style="max-width:820px;margin:0 auto;padding:48px 24px 120px;">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#50dc78;margin-bottom:14px;">CLI &amp; CI</div>
    <h1 style="font-size:42px;font-weight:700;letter-spacing:-0.02em;margin-bottom:14px;">Fix it in your repo</h1>
    <p style="font-size:17px;color:#8b919b;max-width:560px;line-height:1.5;margin-bottom:36px;">The same engine that powers the web tool, in your terminal — no dashboard babysitting.</p>
    <div style="background:#07090b;border:1px solid #1a1e24;border-radius:12px;padding:22px 26px;font-family:'IBM Plex Mono',monospace;font-size:14px;margin-bottom:40px;line-height:1.9;"><div><span style="color:#5a616b;">$</span> <span style="color:#e7e9ec;">npx lightsout spotify.com --fcp</span></div><div style="color:#eb5a5a;">✕ JS-bound · PRR 0.03 · floor 450ms · fcp 13.3s</div></div>
    <div style="display:flex;flex-direction:column;gap:14px;">${modes}</div>
    <div style="margin-top:40px;background:linear-gradient(150deg,#0f1318,#0b0e12);border:1px solid #1a1e24;border-radius:16px;padding:34px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;"><span style="width:9px;height:9px;border-radius:50%;background:#50dc78;box-shadow:0 0 10px #50dc78;"></span><h2 style="font-size:20px;font-weight:600;">boxthis</h2><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#5a616b;">companion</span></div>
      <p style="color:#9aa1ab;font-size:15px;line-height:1.6;max-width:520px;">lightsout measures it; <span style="color:#e7e9ec;">boxthis fixes it</span>. Run <span style="font-family:'IBM Plex Mono',monospace;color:#50dc78;">boxthis audit</span> to inline critical CSS, pre-render above-the-fold markup, and box the work that's keeping your lights on.</p>
    </div>
    <div style="margin-top:36px;text-align:center;"><button data-action="nav" data-page="home" style="background:#50dc78;color:#06210f;border:none;border-radius:10px;padding:13px 26px;font-family:'IBM Plex Mono',monospace;font-size:14px;font-weight:600;cursor:pointer;">Analyze a URL →</button></div>
  </div>`;
}

(async function init() {
  render();
  try { await loadBench(); } catch {}
  render();
})();
