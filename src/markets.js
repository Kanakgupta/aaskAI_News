const SYMBOLS = [
  ["^GSPC", "S&P 500"], ["^IXIC", "Nasdaq"], ["^DJI", "Dow"], ["^VIX", "VIX"],
  ["^TNX", "US 10Y yield"], ["GC=F", "Gold"], ["CL=F", "Crude oil"], ["BTC-USD", "Bitcoin"],
  ["^NSEI", "Nifty 50"], ["^N225", "Nikkei 225"], ["^FTSE", "FTSE 100"], ["EURUSD=X", "EUR/USD"],
];

async function quote([sym, name]) {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; aaskAI-News/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const m = (await res.json()).chart?.result?.[0]?.meta;
    const price = m?.regularMarketPrice, prev = m?.chartPreviousClose;
    if (typeof price !== "number" || typeof prev !== "number" || !prev) return null;
    return { sym, name, price, chg: price - prev, pct: ((price - prev) / prev) * 100 };
  } catch {
    return null;
  }
}

export async function buildMarkets() {
  return { quotes: (await Promise.all(SYMBOLS.map(quote))).filter(Boolean) };
}
