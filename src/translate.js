// Build-time translation of foreign-language headlines (cached across runs) and Google News link decoding.
const GN_ARTICLE = /^https:\/\/news\.google\.com\/rss\/articles\/([^?]+)/;
const NON_LATIN = /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/g;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const cache = { t: {}, u: {} };
const budget = { tr: 80, dec: 30 };

export function loadCache(prev) {
  if (prev?.t) cache.t = prev.t;
  if (prev?.u) cache.u = prev.u;
}
export function exportCache(limit = 4000) {
  const trim = (o) => Object.fromEntries(Object.entries(o).slice(-limit));
  return { t: trim(cache.t), u: trim(cache.u) };
}

export const isForeign = (t) => {
  const letters = t.match(/\p{L}/gu)?.length || 0;
  return letters > 0 && (t.match(NON_LATIN)?.length || 0) / letters > 0.25;
};

async function viaGoogle(text) {
  for (let a = 0; a < 2; a++) {
    try {
      const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`, { signal: AbortSignal.timeout(8000) });
      if (r.ok && (r.headers.get("content-type") || "").includes("json")) {
        const j = await r.json();
        const t = j[0].map((x) => x[0]).join("");
        if (t) return [t, j[2] || ""];
      }
    } catch { /* retry */ }
    await sleep(600 * (a + 1));
  }
  return null;
}

async function viaMyMemory(text) {
  try {
    const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 450))}&langpair=Autodetect|en`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    const t = j?.responseData?.translatedText;
    if (j?.responseStatus === 200 && t && !/MYMEMORY|INVALID|QUERY LENGTH/i.test(t)) return [t, j.responseData.detectedLanguage || ""];
  } catch { /* give up */ }
  return null;
}

let blocked = false;
let queue = Promise.resolve();
// Decodes run one at a time with a pause between them; a 429 stops further attempts for this run.
const decodeGoogleNews = (id) => (queue = queue.then(async () => {
  if (blocked) return null;
  await sleep(700);
  return decodeNow(id);
}));

async function decodeNow(id) {
  try {
    const res = await fetch(`https://news.google.com/articles/${id}`, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(8000) });
    if (res.status === 429) { blocked = true; return null; }
    const page = await res.text();
    const sg = page.match(/data-n-a-sg="([^"]+)"/)?.[1];
    const ts = page.match(/data-n-a-ts="([^"]+)"/)?.[1];
    if (!sg || !ts) return null;
    const payload = ["Fbv4je", `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${ts},"${sg}"]`];
    const r = await fetch("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "user-agent": "Mozilla/5.0" },
      body: "f.req=" + encodeURIComponent(JSON.stringify([[payload]])),
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 429) { blocked = true; return null; }
    return (await r.text()).match(/garturlres\\",\\"(https?:[^"\\]+)/)?.[1] || null;
  } catch { return null; }
}

async function one(n) {
  let hit = cache.t[n.t];
  if (!hit && budget.tr > 0) {
    budget.tr--;
    hit = (await viaGoogle(n.t)) || (await viaMyMemory(n.t));
    if (hit) cache.t[n.t] = hit;
  }
  if (!hit || hit[0].trim().toLowerCase() === n.t.trim().toLowerCase()) return;
  const [en, lg] = hit;
  n.to = n.t;
  n.t = en;
  if (lg) n.lg = lg;

  const id = n.u.match(GN_ARTICLE)?.[1];
  if (!id) { n.tu = translatePage(n.u); return; }
  let real = cache.u[id];
  if (!real && budget.dec > 0) { budget.dec--; real = await decodeGoogleNews(id); if (real) cache.u[id] = real; }
  if (real) n.tu = translatePage(real);
}

export const translatePage = (u) => `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(u)}`;

// Mutates items in place: foreign headlines get an English `t`, the original in `to`, a language code `lg`, and `tu` (translated-page link).
export async function localize(items) {
  const todo = items.filter((n) => isForeign(n.t));
  let i = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (i < todo.length) {
      const n = todo[i++];
      await one(n);
      if (isForeign(n.s)) {
        const h = cache.t[n.s] || (budget.tr > 0 && (budget.tr--, (await viaGoogle(n.s)) || (await viaMyMemory(n.s))));
        if (h) { cache.t[n.s] = h; n.s = h[0]; }
      }
    }
  }));
}
