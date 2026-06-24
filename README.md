# lightsoutt — landing page

The landing page for **[lightsoutt](https://www.npmjs.com/package/lightsoutt)** —
the paint-readiness CLI. A single static HTML file, no build, no server.

Live at **https://theharshal30.github.io/lightsoutt/**. The interactive analysis
lives where it belongs: the CLI. This page just explains the idea, shows the
benchmark finding, and points people to it.

## Hosting

Static — nothing to build. Served by **GitHub Pages** from `main` branch root
(`.nojekyll` disables Jekyll processing). It would run on any static host equally
well; the page uses no local asset paths, so it works at any base path.

## Local preview

```bash
npx serve .        # or: python3 -m http.server
```

## Design notes

- Self-contained `index.html`: inline critical CSS, async-loaded fonts, only a
  tiny end-of-body script (copy buttons) — **no render-blocking resources**, so
  the page paints in the first round-trip (it practices what lightsoutt measures).
- The leaderboard numbers are baked from the committed
  [benchmark](https://github.com/TheHarshal30/lightsout/blob/main/bench/RESULTS.md).
