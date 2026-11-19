// Crowd forecasts from Polymarket's public API; sports and near-certain outcomes are dropped.
const SPORTS = /\bvs\.?\b|spread:|o\/u|\bwin on 20|nba|nfl|nhl|mlb|ufc|premier league|champions league|\bcup\b|\bset \d|\bmap \d|\bgame \d|\bbo\d\b/i;

export async function buildPredictions() {
  const res = await fetch("https://gamma-api.polymarket.com/markets?active=true&closed=false&order=volume24hr&ascending=false&limit=150", {
    headers: { "user-agent": "Mozilla/5.0 (compatible; aaskAI-News/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error("polymarket " + res.status);
  const byEvent = new Map();
  for (const m of await res.json()) {
    let outcomes, prices;
    try { outcomes = JSON.parse(m.outcomes); prices = JSON.parse(m.outcomePrices); } catch { continue; }
    if (outcomes?.[0] !== "Yes" || outcomes?.[1] !== "No" || SPORTS.test(m.question)) continue;
    const yes = Number(prices[0]);
    const slug = m.events?.[0]?.slug;
    if (!slug || !(yes >= 0.04 && yes <= 0.96)) continue;
    const prev = byEvent.get(slug);
    if (!prev || Math.abs(yes - 0.5) < Math.abs(prev.yes - 0.5)) {
      byEvent.set(slug, { q: m.question, yes, vol: Math.round(Number(m.volume24hr) || 0), end: m.endDate || "", url: `https://polymarket.com/event/${slug}` });
    }
  }
  return { items: [...byEvent.values()].sort((a, b) => b.vol - a.vol).slice(0, 8) };
}
