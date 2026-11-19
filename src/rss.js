// Minimal RSS/Atom fetch + parse for Cloudflare Workers (no DOM available).
const UA = "Mozilla/5.0 (compatible; aaskAI-News/1.0)";
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…" };

export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const cp = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : "";
    }
    return ENT[e.toLowerCase()] ?? m;
  });
}

const CDATA = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/;
const raw = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  if (!m) return "";
  const c = m[1].match(CDATA);
  return c ? c[1] : decode(m[1]);
};
const text = (html) => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const attr = (block, tag, a) => {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*?\\s${a}="([^"]+)"`, "i"));
  return m ? decode(m[1]) : "";
};
const httpUrl = (u) => (/^https?:\/\//i.test(u) ? u : "");

function link(block) {
  let u = text(raw(block, "link"));
  if (!u) {
    const alt = block.match(/<link\b[^>]*rel="alternate"[^>]*href="([^"]+)"/i) || block.match(/<link\b[^>]*href="([^"]+)"/i);
    u = alt ? decode(alt[1]) : "";
  }
  return httpUrl(u);
}

function image(block, descHtml) {
  const u = attr(block, "media:content", "url") || attr(block, "media:thumbnail", "url") ||
    (/<enclosure\b[^>]*type="image/i.test(block) ? attr(block, "enclosure", "url") : "") ||
    ((descHtml.match(/<img\b[^>]*\ssrc="([^"]+)"/i) || [])[1] || "");
  return /^https:\/\//i.test(u) ? u : "";
}

function snippet(s, max = 240) {
  s = s.replace(/The post .* appeared first on .*$/i, "").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 120)).replace(/[\s,;:.-]+$/, "") + "…";
}

export function parseFeed(xml, feed) {
  const out = [];
  const max = feed.max || 40;
  const google = feed.kind === "google";
  for (const m of xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)) {
    if (out.length >= max) break;
    const b = m[0];
    let title = text(raw(b, "title"));
    const u = link(b);
    const ds = text(raw(b, "pubDate")) || text(raw(b, "published")) || text(raw(b, "updated")) || text(raw(b, "dc:date"));
    const d = new Date(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(ds) ? ds.replace(" ", "T") + "Z" : ds);
    if (!title || !u || isNaN(d)) continue;
    let source = feed.source || "";
    let sourceUrl = "";
    if (google) {
      source = text(raw(b, "source"));
      sourceUrl = attr(b, "source", "url");
      if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
      else if (title.includes(" - ")) {
        const i = title.lastIndexOf(" - ");
        if (title.length - i < 48) { source = source || title.slice(i + 3); title = title.slice(0, i); }
      }
    }
    const descHtml = google ? "" : raw(b, "description") || raw(b, "summary") || raw(b, "content:encoded");
    let x = text(descHtml);
    if (x.toLowerCase().startsWith(title.toLowerCase().slice(0, 40)) || x.length < 25) x = "";
    out.push({
      t: title,
      u,
      s: source || new URL(u).hostname.replace(/^www\./, ""),
      d: new Date(Math.min(d.getTime(), Date.now())).toISOString(),
      x: snippet(x),
      i: google ? "" : image(b, descHtml),
      g: feed.tag || "",
      su: sourceUrl,
      ed: feed.edition || "",
    });
  }
  return out;
}

export async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: { "user-agent": UA, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(7000),
      cf: { cacheTtl: 120, cacheEverything: true },
    });
    if (!res.ok) return [];
    return parseFeed(await res.text(), feed);
  } catch {
    return [];
  }
}

export const googleUrl = (q, { hl = "en-US", gl = "US", ceid = "US:en", when = "" } = {}) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(when ? `${q} when:${when}` : q)}&hl=${hl}&gl=${gl}&ceid=${encodeURIComponent(ceid)}`;

const STOP = new Set("a an the of for and or to in on with by at from as is are be its it this that new how why what who will can into over after vs via amid more than up out about".split(" "));
export const tokens = (t) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));

// Drops duplicates by URL and near-identical headlines, keeping the first (newest after sorting).
export function dedupe(items) {
  const seenUrl = new Set();
  const kept = [];
  const sets = [];
  for (const it of items) {
    if (seenUrl.has(it.u)) continue;
    seenUrl.add(it.u);
    const tk = tokens(it.t);
    let dup = false;
    for (let i = Math.max(0, kept.length - 120); i < kept.length; i++) {
      const o = sets[i];
      let inter = 0;
      for (const w of tk) if (o.has(w)) inter++;
      if (tk.size && inter / Math.max(tk.size, o.size) >= 0.75) { dup = true; break; }
    }
    if (dup) continue;
    kept.push(it);
    sets.push(tk);
  }
  return kept;
}
