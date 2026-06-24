# lightsout-web

The lightsout web app — the **Paint Efficiency** design, implemented as a real app
backed by the actual lightsout engine. Built to deploy on **Vercel**.

```
public/index.html   the app shell (inline critical CSS, async fonts, deferred JS)
public/app.js       the design, ported to vanilla JS — renders from live data
api/analyze.mjs     GET /api/analyze?url=  → live network-floor analysis + advice
api/measure.mjs     GET /api/measure?url=  → committed FCP for benchmark hosts
api/bench.mjs       GET /api/bench         → the committed 77-site leaderboard
lib/                the vendored lightsout engine + precomputed benchmark data
server.mjs          local dev server (same logic as the functions)
vercel.json         function limits + security headers
```

## Run locally

```bash
npm run dev          # → http://localhost:8080
```

## Deploy to Vercel

No build step. Vercel serves `public/` statically and turns each `api/*.mjs` into
a serverless function automatically (framework preset: **Other**).

```bash
# option A — CLI
npm i -g vercel && vercel        # preview;  vercel --prod  to ship

# option B — Git
#   push this repo to GitHub, then Vercel dashboard → New Project → Import.
```

## What runs where

| | Hosted (Vercel) | CLI (`lightsout`) |
|---|---|---|
| Network floor + risk-graded advice (any URL) | ✅ instant | ✅ |
| Measured PRR for the 77 benchmark sites | ✅ committed value (instant) | ✅ |
| **Live headless render** of an arbitrary URL | ✅ *if* a remote browser is configured | ✅ `lightsout <url> --fcp` |

Running Chromium *inside* a Vercel function is unreliable (the `@sparticuz`
binary fails to load its shared libs on the Lambda runtime). So `/api/measure`
drives a **remote browser over WebSocket** via `puppeteer-core`. Set one env var
and live render works for any URL:

```
BROWSER_WS_ENDPOINT = wss://production-sfo.browserless.io/chromium?token=<your-token>
```

(A free [Browserless](https://www.browserless.io) token works; or point it at any
remote Chrome.) Without it, the hosted tool still serves the committed PRR for the
77 benchmark hosts and hands every other URL the one-line CLI command. Locally it
drives the system Chrome — no env var needed.

## Standalone

The lightsout engine is vendored into `lib/analyze.mjs` (and the benchmark into
`lib/bench-data.mjs`), so this repo has **no runtime dependencies** and needs no
sibling checkout. To track upstream, re-copy `lightsout/src/analyze.mjs` and
regenerate `lib/bench-data.mjs` from the committed dataset.

## Eats its own dog food

The shell ships inline critical CSS, defers its JS, and loads fonts async — **zero
render-blocking resources**. Run `lightsout <deployed-url> --fcp` to check.
