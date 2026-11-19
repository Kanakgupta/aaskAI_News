import { fetchFeed, googleUrl, tokens } from "./rss.js";
import { localize } from "./translate.js";

// Wireless-industry newsroom: Wi-Fi, Bluetooth, UWB/Matter/NearLink and the business around them.
const TOPICS = [
  ["wifi7", "Wi-Fi 7", '"Wi-Fi 7" OR "WiFi 7" OR "802.11be"', "Wi-Fi"],
  ["wifi8", "Wi-Fi 8 / 802.11bn", '"Wi-Fi 8" OR "WiFi 8" OR "802.11bn"', "Wi-Fi"],
  ["wifi6e", "Wi-Fi 6 / 6E", '"Wi-Fi 6E" OR "Wi-Fi 6" chip OR router', "Wi-Fi"],
  ["6ghz", "6 GHz spectrum & regulation", '"6 GHz" (Wi-Fi OR WiFi OR spectrum OR FCC OR Ofcom OR AFC)', "Wi-Fi"],
  ["wfa", "Wi-Fi Alliance", '"Wi-Fi Alliance"', "Wi-Fi"],
  ["wifichip", "Wi-Fi chips", '("Wi-Fi chip" OR "WiFi chip" OR "Wi-Fi SoC" OR "wireless chip")', "Wi-Fi"],
  ["router", "Routers & mesh", '("Wi-Fi router" OR "mesh Wi-Fi" OR "WiFi router")', "Wi-Fi"],
  ["enterprise", "Enterprise WLAN", '("enterprise Wi-Fi" OR "wireless LAN" OR WLAN OR "access points")', "Wi-Fi"],
  ["bt", "Bluetooth (industry)", '"Bluetooth SIG" OR "Bluetooth 6" OR "Bluetooth Core"', "Bluetooth"],
  ["leaudio", "LE Audio & Auracast", '"LE Audio" OR Auracast', "Bluetooth"],
  ["cs", "Bluetooth Channel Sounding", '"Channel Sounding"', "Bluetooth"],
  ["btchip", "Bluetooth chips", '("Bluetooth chip" OR "Bluetooth SoC" OR "Bluetooth LE SoC" OR "BLE SoC")', "Bluetooth"],
  ["matter", "Matter / Thread", '("Matter" smart home) OR "Thread 1.4" OR "Thread Group"', "Other wireless"],
  ["uwb", "UWB", '"ultra-wideband" OR "UWB chip" OR "UWB" smartphone', "Other wireless"],
  ["halow", "Wi-Fi HaLow", '"HaLow"', "Wi-Fi"],
  ["nearlink", "NearLink / SparkLink", "NearLink OR SparkLink", "Other wireless"],
  ["sensing", "Wi-Fi sensing", '"Wi-Fi sensing" OR "WiFi sensing" OR "802.11bf"', "Wi-Fi"],
  ["wearables", "Wearables (wireless)", "(wearable OR smartwatch OR earbuds) (Bluetooth OR chip OR launch)", "Bluetooth"],
  ["glasses", "Smart glasses", '"smart glasses" OR "AI glasses"', "Bluetooth"],
  ["iot", "IoT connectivity", '"IoT" (Wi-Fi OR Bluetooth OR wireless) chip', "Other wireless"],
  ["mna", "Wireless M&A & funding", "(acquire OR acquisition OR merger OR funding) (Wi-Fi OR Bluetooth OR \"wireless chip\" OR \"connectivity semiconductor\")", "Business"],
  ["tariff", "Trade, tariffs & export controls", "(tariff OR \"export control\" OR sanctions) (semiconductor OR chip) (wireless OR Wi-Fi OR Bluetooth OR router)", "Business"],
  ["security", "Wireless security", "(vulnerability OR exploit OR CVE) (Bluetooth OR Wi-Fi OR WiFi)", "Other wireless"],
];

const EDITIONS = {
  US: { hl: "en-US", gl: "US", ceid: "US:en", rg: "Americas" },
  UK: { hl: "en-GB", gl: "GB", ceid: "GB:en", rg: "Europe" },
  DE: { hl: "de", gl: "DE", ceid: "DE:de", rg: "Europe" },
  IN: { hl: "en-IN", gl: "IN", ceid: "IN:en", rg: "APAC" },
  CN: { hl: "zh-CN", gl: "CN", ceid: "CN:zh-Hans", rg: "China" },
  TW: { hl: "zh-TW", gl: "TW", ceid: "TW:zh-Hant", rg: "APAC" },
  JP: { hl: "ja", gl: "JP", ceid: "JP:ja", rg: "APAC" },
};

const REGIONAL = [
  ["UK", '"Wi-Fi" OR Bluetooth OR "Wi-Fi 7" chip OR router', "Wi-Fi"],
  ["DE", '"WLAN" OR "Wi-Fi 7" OR Bluetooth Chip OR Router', "Wi-Fi"],
  ["IN", '"Wi-Fi" OR Bluetooth OR wearable OR earbuds launch', "Bluetooth"],
  ["CN", "Wi-Fi 7 芯片 OR 蓝牙芯片 OR 星闪 OR 无线芯片", "Wi-Fi"],
  ["CN", "蓝牙 耳机 OR 智能眼镜 OR AI眼镜 OR 智能手表", "Bluetooth"],
  ["TW", "Wi-Fi 7 晶片 OR 藍牙 晶片 OR 聯發科 Wi-Fi OR 瑞昱", "Wi-Fi"],
  ["JP", "Wi-Fi 7 OR Bluetooth チップ OR 無線LAN", "Wi-Fi"],
];

const THEMES = [
  ["wifi8", "Wi-Fi 8 / UHR", /wi-?fi ?8\b|802\.11bn|ultra high reliability/i, 2.5],
  ["wifi7", "Wi-Fi 7", /wi-?fi ?7\b|802\.11be|wifi7/i, 1.5],
  ["wifi6", "Wi-Fi 6 / 6E", /wi-?fi ?6e?\b|802\.11ax/i, 0.7],
  ["halow", "Wi-Fi HaLow", /halow|802\.11ah/i, 1.5],
  ["sensing", "Wi-Fi Sensing", /wi-?fi sensing|802\.11bf|wifi motion|wi-fi motion/i, 1.5],
  ["spectrum", "Spectrum & Regulation", /6 ?ghz|spectrum|\bfcc\b|ofcom|\bafc\b|regulat|\bmiit\b|\bbnetza\b/i, 1.5],
  ["leaudio", "LE Audio / Auracast", /le audio|auracast|\blc3\b/i, 1.5],
  ["cs", "Bluetooth Channel Sounding", /channel sounding/i, 1.8],
  ["bluetooth", "Bluetooth", /bluetooth|\bble\b|蓝牙|藍牙/i, 0.6],
  ["wifi", "Wi-Fi (general)", /wi-?fi|wlan|wireless lan|无线局域网/i, 0.4],
  ["uwb", "UWB", /\buwb\b|ultra-?wideband/i, 1.2],
  ["matter", "Matter / Thread / Zigbee", /\bmatter\b|\bthread\b|zigbee|z-wave/i, 1.0],
  ["nearlink", "NearLink / SparkLink", /nearlink|sparklink|星闪/i, 1.5],
  ["ai", "AI / Edge AI", /\bai\b|artificial intelligence|edge ai|genai|\bllm\b|machine learning|neural|人工智能|\bnpu\b/i, 1.0],
  ["mna", "M&A / Divestiture", /acqui|merger|\bmerge|takeover|buyout|divest|to buy\b|stake in|收购|并购/i, 3.0],
  ["partnership", "Partnership", /partner|collaborat|teams up|alliance with|joins forces|合作|strategic agreement/i, 1.5],
  ["launch", "Product Launch", /launch|unveil|introduc|debut|announc|rolls? out|releases|showcas|发布|推出|上市/i, 1.2],
  ["earnings", "Earnings & Financials", /earnings|revenue|quarter|\bq[1-4]\b|results|guidance|profit|outlook|财报|营收|业绩/i, 1.0],
  ["funding", "Funding & IPO", /funding|raises \$|series [a-e]\b|\bipo\b|venture|融资/i, 1.5],
  ["legal", "Legal, Patents & Trade", /lawsuit|patent|\bsues?\b|litigation|antitrust|tariff|export control|sanction|\bban\b|security flaw|vulnerab|cve-/i, 1.8],
  ["wearables", "Wearables & Hearables", /smart ?watch|apple watch|galaxy watch|pixel watch|earbud|wearable|smart ring|oura ring|galaxy ring|glasses|headphone|hearable|hearing aid|airpods|\bbuds\b|耳机|手表|眼镜|手环/i, 0.8],
  ["smarthome", "Smart Home & IoT", /smart home|home automation|\biot\b|internet of things|smart appliance|物联网/i, 0.8],
  ["automotive", "Automotive", /automotive|vehicle|\bcar\b|digital key|\bev\b|汽车/i, 0.8],
  ["xr", "XR / AR / VR", /\bxr\b|\bar\b glasses|augmented reality|virtual reality|mixed reality|\bvr\b|headset/i, 0.8],
  ["chips", "Chips & Silicon", /\bchip|\bsoc\b|semiconductor|silicon|芯片|晶片|半导体/i, 0.6],
];
const THEME_LABELS = Object.fromEntries(THEMES.map(([k, l]) => [k, l]));

const WIRELESS_RE = /wi-?fi|wlan|bluetooth|\bble\b|wireless|\buwb\b|ultra-?wideband|matter\b|thread\b|zigbee|halow|auracast|le audio|nearlink|sparklink|802\.11|router|mesh|earbud|headphone|smartwatch|smart glasses|ai glasses|wearable|蓝牙|藍牙|星闪|无线|無線|connectivity|6 ?ghz|access point|芯片|晶片|チップ/i;
const WIFI_RE = /wi-?fi|wlan|802\.11|halow|router|access point|mesh wi|6 ?ghz|無線lan/i;
const BT_RE = /bluetooth|\bble\b|le audio|auracast|channel sounding|蓝牙|藍牙|earbud|headphone|hearable|hearing aid/i;
const OTHER_RE = /\buwb\b|ultra-?wideband|matter\b|thread\b|zigbee|z-wave|nearlink|sparklink|星闪|\bnfc\b/i;
const BIZ_RE = /acqui|merger|earnings|revenue|tariff|funding|ipo\b|stake|lawsuit|quarter|guidance|收购|财报/i;
const NOISE_RE = /deals? of the day|best deals?\b|early black friday|black friday|cyber monday|prime day|\d+% off|\$\d+ off|price cut|price drop|lowest price|record low|all-time low|on sale\b|\bsave \$|\bsave \d+%|coupon|\bdiscount|deal alert|^deal:|\bdeal:|bargain|stocks? to buy|should you buy|better buy|millionaire|buy the dip|gift guide|holiday gift|shares (sold|bought|purchased|acquired) by|price target|short interest|insider (selling|buying)|stock forecast|price prediction/i;
const WIRES = /business ?wire|pr ?newswire|globe ?newswire|accesswire|newsfile|ein presswire|prweb|newswire|cision|eqs/i;
const TIER1 = /reuters|bloomberg|wsj|wall street journal|financial times|cnbc|the verge|techcrunch|ee times|eetimes|nikkei|digitimes|fierce|light reading|9to5|android authority|tom's hardware|engadget|wired|ars technica|zdnet|the register|caixin|scmp|south china morning post|forbes|associated press|heise|mobile world live|rcr wireless|sdxcentral|semiconductor engineering|trendforce|counterpoint|idc|canalys/i;

const TLD_REGION = {
  cn: "China", hk: "China", tw: "APAC", jp: "APAC", kr: "APAC", in: "APAC", sg: "APAC", au: "APAC", my: "APAC", id: "APAC", vn: "APAC", th: "APAC", ph: "APAC", nz: "APAC",
  uk: "Europe", de: "Europe", fr: "Europe", it: "Europe", es: "Europe", nl: "Europe", se: "Europe", no: "Europe", fi: "Europe", dk: "Europe", ch: "Europe", at: "Europe", be: "Europe", pl: "Europe", ie: "Europe", pt: "Europe", eu: "Europe",
  ca: "Americas", us: "Americas", br: "Americas", mx: "Americas",
};

const COMPANIES = ["Qualcomm", "Broadcom", "MediaTek", "Intel", "Realtek", "Nordic Semiconductor", "Silicon Labs", "Texas Instruments", "NXP", "STMicroelectronics", "Infineon", "Espressif", "Marvell", "Murata", "Skyworks", "Qorvo", "Apple", "Samsung", "Google", "Microsoft", "Amazon", "Meta", "Sony", "Huawei", "Xiaomi", "Cisco", "Juniper", "Aruba", "Ubiquiti", "TP-Link", "Netgear", "ASUS", "Ericsson", "Nokia", "Ceva", "Synaptics", "Airoha", "Unisoc", "Wi-Fi Alliance", "Bluetooth SIG", "Qualcomm", "Eero", "Ruckus", "CommScope", "Spirent", "Keysight", "Nvidia", "Arm", "OPPO", "Honor", "Garmin", "Oura"]
  .filter((n, i, a) => a.indexOf(n) === i)
  .map((n) => [n, new RegExp(`(?<![\\w])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`)]);

const domainRegion = (u) => {
  try {
    const h = new URL(u).hostname.split(".");
    return TLD_REGION[h[h.length - 1]] || "";
  } catch { return ""; }
};

function classify(it, topic, bucket, edition) {
  const text = it.t + " " + it.x;
  const th = THEMES.filter(([, , re]) => re.test(text));
  const tech = [];
  if (WIFI_RE.test(text)) tech.push("Wi-Fi");
  if (BT_RE.test(text)) tech.push("Bluetooth");
  if (OTHER_RE.test(text)) tech.push("Other wireless");
  if (BIZ_RE.test(text) || bucket === "Business" || th.some(([k]) => k === "mna" || k === "funding")) tech.push("Business");
  if (!tech.length) tech.push(bucket);
  const rg = [domainRegion(it.su) || EDITIONS[edition].rg];
  const c = COMPANIES.filter(([, re]) => re.test(it.t)).map(([n]) => n).slice(0, 4);
  const w = WIRES.test(it.s) || WIRES.test(it.su || "");
  return {
    t: it.t, u: it.u, s: it.s, d: it.d, x: it.x, i: "",
    tech, rg, th: th.map(([k]) => k), c, w, tp: [topic], cv: 1, al: [],
    _w: Math.min(4, th.reduce((a, [, , , wt]) => a + wt, 0)),
    _t1: TIER1.test(it.s),
  };
}

export async function buildTech() {
  const jobs = [
    ...TOPICS.map(([id, , q, bucket]) => ({ topic: id, bucket, edition: "US", q })),
    ...REGIONAL.map(([ed, q, bucket], i) => ({ topic: "regional-" + ed.toLowerCase(), bucket, edition: ed, q, n: i })),
  ];
  const results = await Promise.all(jobs.map(async (j) => {
    const e = EDITIONS[j.edition];
    const items = await fetchFeed({ url: googleUrl(j.q, { hl: e.hl, gl: e.gl, ceid: e.ceid, when: j.topic.startsWith("regional") ? "14d" : "30d" }), kind: "google", max: 60, edition: j.edition });
    return items.map((it) => ({ it, j }));
  }));

  const cutoff = Date.now() - 30 * 864e5;
  const clusters = [];
  const index = new Map();
  const seen = new Set();
  const all = results.flat().sort((a, b) => b.it.d.localeCompare(a.it.d));
  for (const { it, j } of all) {
    if (seen.has(it.u) || new Date(it.d).getTime() < cutoff || NOISE_RE.test(it.t)) continue;
    seen.add(it.u);
    if (!WIRELESS_RE.test(it.t + " " + it.x)) continue;
    const row = classify(it, j.topic, j.bucket, j.edition);
    const tk = [...tokens(it.t)];
    const probe = tk.slice().sort((a, b) => b.length - a.length).slice(0, 6);
    const cand = new Set();
    for (const w of probe) for (const ci of index.get(w) || []) cand.add(ci);
    let hit = -1;
    for (const ci of cand) {
      const o = clusters[ci].tk;
      let inter = 0;
      for (const w of tk) if (o.has(w)) inter++;
      if (inter / Math.max(tk.length, o.size) >= 0.6) { hit = ci; break; }
    }
    if (hit >= 0) {
      const cl = clusters[hit];
      const main = cl.row;
      if (!cl.srcs.has(row.s)) {
        cl.srcs.add(row.s);
        main.cv++;
        if (main.al.length < 6) main.al.push({ p: row.s, u: row.u });
      }
      for (const k of ["tech", "th", "tp", "c", "rg"]) main[k] = [...new Set([...main[k], ...row[k]])];
      main.w = main.w && row.w;
      if (row._t1 && !main._t1) { main._t1 = true; }
    } else {
      const ci = clusters.length;
      clusters.push({ row, tk: new Set(tk), srcs: new Set([row.s]) });
      for (const w of tk) { if (!index.has(w)) index.set(w, []); index.get(w).push(ci); }
    }
  }

  const now = Date.now();
  const items = clusters.map(({ row }) => {
    const age = (now - new Date(row.d).getTime()) / 864e5;
    row.sc = +(row._w + (row._t1 ? 1.5 : 0) + Math.min(4, (row.cv - 1) * 0.7) + 2.5 * Math.exp(-age / 5)).toFixed(2);
    row.th = row.th.slice(0, 8);
    delete row._w; delete row._t1;
    return row;
  }).sort((a, b) => b.d.localeCompare(a.d)).slice(0, 700);
  await localize(items);

  const topicLabels = [
    ...TOPICS.map(([id, label]) => ({ id, label })),
    ...REGIONAL.map(([ed], i) => ({ id: "regional-" + ed.toLowerCase(), label: `Regional press: ${ed} edition` })),
  ].filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i);

  return { items, themes: THEME_LABELS, topics: topicLabels };
}
