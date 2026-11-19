import { googleUrl } from "./rss.js";

const rss = (source, url, extra = {}) => ({ source, url, ...extra });
const gn = (source, q, extra = {}) => ({ source, url: googleUrl(q, { when: extra.when || "3d" }), kind: "google", max: 40, ...extra });

// Stock Market page mirrors the HeRAI USA news screener: same filters and same publisher mix.
export const STOCK_TAGS = [
  ["MARKETS", "Markets"],
  ["AI", "AI & Tech"],
  ["MACRO", "Macro / Economy"],
  ["BUSINESS", "Business"],
  ["EARNINGS", "Financial Results"],
  ["IPO", "IPO News"],
  ["POLITICAL", "Political"],
];

const EARN_RE = /earnings|transcript|\bq[1-4]\b|results|presentation|slides|guidance|dividend|eps\b|10-?q\b|10-?k\b|revenue of/i;

// Re-tags feeds that mix content so earnings items land under "Financial Results".
export function stockRetag(item) {
  if (item.g === "MARKETS" && EARN_RE.test(item.t) && /seeking ?alpha|investing/i.test(item.s)) item.g = "EARNINGS";
  return item;
}

export const CATEGORIES = {
  // India market news: same filters and publisher mix as the HeRAI India news screener.
  stocks: {
    label: "Stock Market (India)",
    tags: STOCK_TAGS,
    feeds: [
      rss("The Hindu National", "https://www.thehindu.com/news/national/feeder/default.rss", { tag: "POLITICAL", max: 50 }),
      rss("LiveMint News", "https://www.livemint.com/rss/news", { tag: "BUSINESS" }),
      rss("Livemint Markets", "https://www.livemint.com/rss/markets", { tag: "MARKETS" }),
      rss("Economic Times Markets", "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms", { tag: "MARKETS", max: 50 }),
      rss("Economic Times Economy", "https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms", { tag: "MACRO" }),
      rss("Livemint Economy", "https://www.livemint.com/rss/economy", { tag: "MACRO" }),
      rss("Business Standard Economy", "https://www.business-standard.com/rss/economy-102.rss", { tag: "MACRO" }),
      rss("The Hindu Economy", "https://www.thehindu.com/business/Economy/feeder/default.rss", { tag: "MACRO" }),
      rss("Business Today Economy", "https://www.businesstoday.in/rss/economy", { tag: "MACRO" }),
      gn("Google News India Economy", "India economy (RBI OR inflation OR GDP OR \"trade deficit\" OR \"interest rate\")", { tag: "MACRO", when: "7d" }),
      rss("ET Technology", "https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms", { tag: "AI" }),
      rss("Economic Times Companies", "https://economictimes.indiatimes.com/news/company/rssfeeds/2143429.cms", { tag: "EARNINGS" }),
      rss("Business Standard Markets", "https://www.business-standard.com/rss/markets-106.rss", { tag: "MARKETS" }),
      rss("Business Standard Companies", "https://www.business-standard.com/rss/companies-101.rss", { tag: "EARNINGS" }),
      rss("Business Standard Tech", "https://www.business-standard.com/rss/technology-108.rss", { tag: "AI" }),
      rss("Business Today", "https://www.businesstoday.in/rss/latest", { tag: "BUSINESS", max: 50 }),
      gn("Google News India IPO", "India IPO", { tag: "IPO" }),
      gn("Google News NSE IPO", "NSE IPO", { tag: "IPO" }),
    ],
  },
  // US market news: same filters and publisher mix as the HeRAI USA news screener.
  stocksus: {
    label: "Stock Market (USA)",
    tags: STOCK_TAGS,
    retag: stockRetag,
    feeds: [
      rss("CNBC Top News", "https://www.cnbc.com/id/100003114/device/rss/rss.html", { tag: "MARKETS" }),
      rss("CNBC Markets", "https://www.cnbc.com/id/15839069/device/rss/rss.html", { tag: "MARKETS" }),
      rss("CNBC Economy", "https://www.cnbc.com/id/20910258/device/rss/rss.html", { tag: "MACRO" }),
      rss("CNBC Business", "https://www.cnbc.com/id/10001147/device/rss/rss.html", { tag: "BUSINESS" }),
      rss("SeekingAlpha Latest", "https://seekingalpha.com/market_currents.xml", { tag: "MARKETS" }),
      rss("SeekingAlpha Earnings", "https://seekingalpha.com/feed.xml", { tag: "EARNINGS" }),
      rss("Investing.com Earnings", "https://www.investing.com/rss/news.rss", { tag: "EARNINGS" }),
      rss("Forbes Business", "https://www.forbes.com/business/feed/", { tag: "BUSINESS" }),
      rss("The Hill", "https://thehill.com/feed/", { tag: "POLITICAL" }),
      rss("NPR Politics", "https://feeds.npr.org/1014/rss.xml", { tag: "POLITICAL" }),
      rss("TechCrunch AI", "https://techcrunch.com/category/artificial-intelligence/feed/", { tag: "AI" }),
      rss("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index", { tag: "AI" }),
      rss("The Verge AI", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", { tag: "AI" }),
      rss("MIT Technology Review", "https://www.technologyreview.com/feed/", { tag: "AI" }),
      rss("Federal Reserve", "https://www.federalreserve.gov/feeds/press_all.xml", { tag: "MACRO" }),
      gn("Google News US IPO", "US IPO", { tag: "IPO" }),
      gn("Google News NASDAQ IPO", "NASDAQ IPO", { tag: "IPO" }),
    ],
  },
  ai: {
    label: "AI",
    blurb: "Models, labs, chips, startups and policy.",
    feeds: [
      rss("TechCrunch AI", "https://techcrunch.com/category/artificial-intelligence/feed/"),
      rss("The Verge AI", "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml"),
      rss("MIT Technology Review", "https://www.technologyreview.com/feed/"),
      rss("Ars Technica", "https://feeds.arstechnica.com/arstechnica/index"),
      rss("Wired", "https://www.wired.com/feed/rss"),
      rss("CNBC Technology", "https://www.cnbc.com/id/19854910/device/rss/rss.html"),
      gn("Google News", "(OpenAI OR Anthropic OR Gemini OR Nvidia OR \"artificial intelligence\")", { when: "2d" }),
    ],
  },
  world: {
    label: "World",
    blurb: "Global headlines from international broadcasters and wires.",
    feeds: [
      rss("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
      rss("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml"),
      rss("NYT World", "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"),
      rss("The Guardian World", "https://www.theguardian.com/world/rss"),
      rss("NPR News", "https://feeds.npr.org/1001/rss.xml"),
      rss("CNBC World", "https://www.cnbc.com/id/100727362/device/rss/rss.html"),
    ],
  },
  politics: {
    label: "Politics",
    blurb: "Washington, Westminster and the leaders in the news.",
    feeds: [
      rss("NPR Politics", "https://feeds.npr.org/1014/rss.xml"),
      rss("The Hill", "https://thehill.com/feed/"),
      rss("NYT Politics", "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml"),
      rss("The Guardian US", "https://www.theguardian.com/us-news/us-politics/rss"),
      rss("BBC Politics", "https://feeds.bbci.co.uk/news/politics/rss.xml"),
      rss("CNBC Politics", "https://www.cnbc.com/id/10000113/device/rss/rss.html"),
    ],
  },
  prediction: {
    label: "Prediction",
    blurb: "What big agencies, banks and analysts forecast for next year, leaders, wars, markets and tech.",
    tags: [
      ["ECON", "Economy & Markets"],
      ["NEXT", "Next Year"],
      ["LEADERS", "Elections & Leaders"],
      ["WAR", "War & Security"],
      ["AI", "AI & Tech"],
      ["ENERGY", "Energy & Climate"],
    ],
    feeds: [
      gn("Google News", "(forecast OR outlook OR predicts OR expects) (economy OR recession OR inflation OR \"interest rates\" OR \"S&P 500\") (IMF OR \"World Bank\" OR OECD OR \"Goldman Sachs\" OR \"Morgan Stanley\" OR JPMorgan OR Reuters OR Bloomberg)", { tag: "ECON", when: "14d" }),
      gn("Google News", "\"2027 outlook\" OR \"2027 predictions\" OR \"2027 forecast\" OR \"in 2027\" predict", { tag: "NEXT", when: "14d" }),
      gn("Google News", "(election OR president OR \"prime minister\" OR leader) (forecast OR poll OR predicts OR \"expected to win\" OR \"could win\") (2027 OR 2028)", { tag: "LEADERS", when: "14d" }),
      gn("Google News", "(war OR ceasefire OR conflict OR \"peace talks\") (analysts predict OR forecast OR outlook OR \"could end\" OR \"likely to\")", { tag: "WAR", when: "7d" }),
      gn("Google News", "(AI OR \"artificial intelligence\" OR chips) (predictions OR forecast OR outlook) (Gartner OR Forrester OR IDC OR McKinsey OR Goldman OR Morgan)", { tag: "AI", when: "14d" }),
      gn("Google News", "(\"oil price\" OR energy OR climate) forecast (IEA OR OPEC OR EIA OR \"Goldman Sachs\") (2026 OR 2027)", { tag: "ENERGY", when: "14d" }),
    ],
  },
  crypto: {
    label: "Crypto",
    blurb: "Bitcoin, Ethereum, regulation and on-chain news.",
    feeds: [
      rss("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
      rss("Cointelegraph", "https://cointelegraph.com/rss"),
      rss("Decrypt", "https://decrypt.co/feed"),
      gn("Google News", "bitcoin OR ethereum OR \"crypto ETF\"", { when: "2d" }),
    ],
  },
  science: {
    label: "Science",
    blurb: "Space, climate and discoveries.",
    feeds: [
      rss("ScienceDaily", "https://www.sciencedaily.com/rss/all.xml"),
      rss("NASA", "https://www.nasa.gov/feed/"),
      rss("Nature", "https://www.nature.com/nature.rss"),
      rss("Ars Technica Science", "https://feeds.arstechnica.com/arstechnica/science"),
      rss("BBC Science", "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml"),
      rss("NYT Science", "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml"),
      rss("The Guardian Science", "https://www.theguardian.com/science/rss"),
    ],
  },
  health: {
    label: "Health",
    blurb: "Medicine, public health and biotech.",
    feeds: [
      rss("STAT News", "https://www.statnews.com/feed/"),
      rss("BBC Health", "https://feeds.bbci.co.uk/news/health/rss.xml"),
      rss("NYT Health", "https://rss.nytimes.com/services/xml/rss/nyt/Health.xml"),
      rss("CNBC Health", "https://www.cnbc.com/id/10000108/device/rss/rss.html"),
    ],
  },
  sports: {
    label: "Sports",
    blurb: "Scores, transfers and big moments.",
    feeds: [
      rss("ESPN", "https://www.espn.com/espn/rss/news"),
      rss("BBC Sport", "https://feeds.bbci.co.uk/sport/rss.xml"),
      rss("The Guardian Sport", "https://www.theguardian.com/uk/sport/rss"),
    ],
  },
  entertainment: {
    label: "Entertainment",
    blurb: "Film, TV, music and culture.",
    feeds: [
      rss("Variety", "https://variety.com/feed/"),
      rss("Hollywood Reporter", "https://www.hollywoodreporter.com/feed/"),
      rss("BBC Entertainment", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"),
    ],
  },
};
