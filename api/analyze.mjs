import { analyzeUrl } from "../lib/engine.mjs";

export default async function handler(req, res) {
  res.setHeader("content-type", "application/json");
  const target = (req.query?.url || new URL(req.url, "http://x").searchParams.get("url") || "").trim();
  if (!target) return res.status(400).send(JSON.stringify({ error: "missing url" }));
  try {
    res.setHeader("cache-control", "public, max-age=60, s-maxage=300");
    res.status(200).send(JSON.stringify(await analyzeUrl(target)));
  } catch (e) {
    res.status(502).send(JSON.stringify({ error: e.message || String(e) }));
  }
}
