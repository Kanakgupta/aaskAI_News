// Generates public/data/*.json. Runs in GitHub Actions every few minutes; the site itself needs no build.
import { mkdir, writeFile } from "node:fs/promises";
import { CATEGORIES } from "../src/config.js";
import { fetchFeed, dedupe } from "../src/rss.js";
import { buildTech } from "../src/tech.js";
import { buildMarkets } from "../src/markets.js";
import { buildPredictions } from "../src/predictions.js";

const OUT = new URL("../public/data/", import.meta.url);
const SITE = (process.env.SITE_URL || "").replace(/\/?$/, "/");
await mkdir(OUT, { recursive: true });

async function buildCategory(id) {
  const cat = CATEGORIES[id];
  let items = (await Promise.all(cat.feeds.map(fetchFeed))).flat();
  if (cat.retag) items = items.map(cat.retag);
  items.sort((a, b) => b.d.localeCompare(a.d));
  items = dedupe(items).slice(0, 200).map(({ su, ed, ...rest }) => rest);
  return { items, tags: cat.tags ? cat.tags.map(([k, label]) => ({ id: k, label })) : [] };
}

// If a source is down this run, keep serving the previous published file instead of an empty one.
async function previous(name) {
  if (!SITE) return null;
  try {
    const r = await fetch(`${SITE}data/${name}.json?t=${Date.now()}`, { signal: AbortSignal.timeout(10000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function publish(name, build, ok) {
  let body = null;
  try { body = await build(); } catch (e) { console.warn(`${name}: ${e.message}`); }
  if (body && ok(body)) {
    body = { generated: new Date().toISOString(), ...body };
    console.log(`${name}: fresh`);
  } else {
    body = await previous(name);
    console.log(`${name}: ${body ? "kept previous" : "unavailable"}`);
    if (!body) return;
  }
  await writeFile(new URL(`${name}.json`, OUT), JSON.stringify(body));
}

const jobs = [
  ...Object.keys(CATEGORIES).map((id) => publish(`news-${id}`, () => buildCategory(id), (b) => b.items.length)),
  publish("news-tech", buildTech, (b) => b.items.length),
  publish("markets", buildMarkets, (b) => b.quotes.length),
  publish("predictions", buildPredictions, (b) => b.items.length),
];
await Promise.all(jobs);
