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
| **Live headless render** of an arbitrary URL | ✅ `@sparticuz/chromium` | ✅ `lightsout <url> --fcp` |

Live First Contentful Paint runs in the `/api/measure` function via
**`@sparticuz/chromium` + `puppeteer-core`** (a Lambda-compatible Chromium),
throttled to 150 ms RTT. Benchmarked hosts skip the browser and return the
committed value. The function gets **1024 MB / 60 s** (`vercel.json`); a page that
won't paint within the budget degrades to a "measure it with the CLI" message
rather than timing out. Locally it drives the system Chrome instead.

## Standalone

The lightsout engine is vendored into `lib/analyze.mjs` (and the benchmark into
`lib/bench-data.mjs`), so this repo has **no runtime dependencies** and needs no
sibling checkout. To track upstream, re-copy `lightsout/src/analyze.mjs` and
regenerate `lib/bench-data.mjs` from the committed dataset.

## Eats its own dog food

The shell ships inline critical CSS, defers its JS, and loads fonts async — **zero
render-blocking resources**. Run `lightsout <deployed-url> --fcp` to check.
