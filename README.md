# lightsout-web

The landing page for **[lightsout](https://github.com/TheHarshal30/lightsout)** —
the paint-readiness CLI. A single static HTML file, no build, no server.

The interactive analysis lives where it belongs: the CLI. This page just explains
the idea, shows the benchmark finding, and points people to it.

## Deploy

It's static — nothing to build. On Vercel, framework preset **Other**; it serves
`index.html` directly. (It would run on any static host — GitHub Pages, Netlify,
S3 — equally well.)

## Local preview

```bash
npx serve .        # or: python3 -m http.server
```

## Design notes

- Self-contained `index.html`: inline critical CSS, async-loaded fonts, **no
  render-blocking resources and zero JavaScript** — so the page itself paints in
  the first round-trip (it practices what lightsout measures).
- The leaderboard numbers are baked from the committed
  [benchmark](https://github.com/TheHarshal30/lightsout/blob/main/bench/RESULTS.md).
