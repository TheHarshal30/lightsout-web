import { benchData } from "../lib/engine.mjs";

export default function handler(req, res) {
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "public, max-age=3600, s-maxage=86400");
  res.status(200).send(JSON.stringify(benchData));
}
