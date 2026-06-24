
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";
import { analyzeUrl, measureUrl, benchData } from "./lib/engine.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUB = join(HERE, "public");
const PORT = Number(process.env.PORT) || 8080;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const send = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };

async function serveStatic(res, urlPath) {
  const rel = normalize(urlPath === "/" ? "/index.html" : urlPath).replace(/^(\.\.[/\\])+/, "");
  const file = join(PUB, rel);
  if (!file.startsWith(PUB)) return send(res, 403, { error: "forbidden" });
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream", "cache-control": rel === "/index.html" ? "no-store" : "max-age=600" });
    res.end(body);
  } catch {
    if (!extname(rel)) return serveStatic(res, "/");
    send(res, 404, { error: "not found" });
  }
}

createServer(async (req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (u.pathname === "/api/bench") return send(res, 200, benchData);
    if (u.pathname === "/api/analyze") {
      const t = u.searchParams.get("url");
      return t ? send(res, 200, await analyzeUrl(t)) : send(res, 400, { error: "missing url" });
    }
    if (u.pathname === "/api/measure") {
      const t = u.searchParams.get("url");
      return t ? send(res, 200, await measureUrl(t)) : send(res, 400, { error: "missing url" });
    }
    return serveStatic(res, u.pathname);
  } catch (e) {
    send(res, 502, { error: e.message || String(e) });
  }
}).listen(PORT, () => {
  console.log(`\n  lightsout-web (local) → http://localhost:${PORT}`);
  console.log(`  APIs: /api/bench · /api/analyze?url= · /api/measure?url=`);
  console.log(`  (production runs the same logic as the Vercel functions in api/)\n`);
});
