(() => {
"use strict";

const CATS = [
  { id: "stocks", label: "Stock Market", hue: 150, blurb: "India and US market, macro, earnings and IPO headlines from major publishers, updated live." },
  { id: "crypto", label: "Crypto", hue: 45, blurb: "Bitcoin, Ethereum, regulation and on-chain news." },
  { id: "tech", label: "Technology", hue: 200, blurb: "The wireless newsroom: Wi-Fi, Bluetooth, UWB / Matter / NearLink and the business around them — de-duplicated, clustered and ranked." },
  { id: "ai", label: "AI", hue: 265, blurb: "Models, labs, chips, startups and policy." },
  { id: "world", label: "World", hue: 35, blurb: "Global headlines from international broadcasters and wires." },
  { id: "politics", label: "Politics", hue: 0, blurb: "Washington, Westminster and the leaders in the news." },
  { id: "prediction", label: "Prediction", hue: 300, blurb: "What big agencies, banks and analysts forecast for next year, leaders, wars, markets and tech — plus live crowd odds." },
  { id: "science", label: "Science", hue: 175, blurb: "Space, climate and discoveries." },
  { id: "health", label: "Health", hue: 340, blurb: "Medicine, public health and biotech." },
  { id: "sports", label: "Sports", hue: 100, blurb: "Scores, transfers and big moments." },
  { id: "entertainment", label: "Entertainment", hue: 320, blurb: "Film, TV, music and culture." },
];
const CAT = Object.fromEntries(CATS.map((c) => [c.id, c]));
const EXTRA = ["stocksus"];
const STORE_V = "aask:v1:";
const store = {};
const failed = {};
const inflight = {};
const aux = { markets: null, predictions: null };
let disposers = [];
let route = { name: "home" };
let rendered = false;

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safe = (u) => (/^https?:\/\//i.test(u) ? u : "#");
const ago = (iso) => {
  const m = (Date.now() - new Date(iso).getTime()) / 6e4;
  if (m < 1) return "just now";
  if (m < 60) return Math.round(m) + "m ago";
  const h = m / 60;
  if (h < 24) return Math.round(h) + "h ago";
  return Math.round(h / 24) + "d ago";
};
const view = $("#view");
const BACK = '<a class="back" href="#/home" aria-label="Back to home" title="Back to home"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6"/></svg></a>';

// ---------- persistence (instant paint for repeat visitors)
const saveLocal = (k, d) => { try { localStorage.setItem(STORE_V + k, JSON.stringify(d)); } catch { /* quota */ } };
const readLocal = (k) => { try { return JSON.parse(localStorage.getItem(STORE_V + k) || "null"); } catch { return null; } };

function trimmed(id, d) {
  const seen = {};
  const items = d.tags?.length ? d.items.filter((n) => (seen[n.g] = (seen[n.g] || 0) + 1) <= 30) : d.items.slice(0, id === "tech" ? 250 : 120);
  return { ...d, partial: true, items };
}

// ---------- data loading (static JSON refreshed by the scheduled workflow)
const slot = () => Math.floor(Date.now() / 60000);
const newer = (a, b) => !a || a.partial || new Date(b.generated) > new Date(a.generated);

function loadCat(id) {
  if (inflight[id]) return inflight[id];
  inflight[id] = fetch(`data/news-${id}.json?t=${slot()}`)
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => {
      if (!Array.isArray(d.items)) throw new Error("bad payload");
      failed[id] = false;
      if (!newer(store[id], d)) return;
      store[id] = d;
      saveLocal(id, trimmed(id, d));
      onData(id);
    })
    .catch(() => { failed[id] = true; if (!store[id]) onData(id); })
    .finally(() => { delete inflight[id]; updateStatus(); });
  return inflight[id];
}

function loadAux(name) {
  fetch(`data/${name}.json?t=${slot()}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => {
    if (!newer(aux[name], d)) return;
    aux[name] = d; saveLocal(name, d); onAux(name);
  }).catch(() => {});
}

function loadAll() {
  const first = route.cat && CAT[route.cat] ? [route.cat] : [];
  const order = [...first, ...CATS.map((c) => c.id).filter((id) => !first.includes(id)), ...EXTRA];
  order.forEach(loadCat);
  loadAux("markets");
  loadAux("predictions");
}

// ---------- row templates
const techCls = (t) => ({ "Wi-Fi": "t-wifi", Bluetooth: "t-bt", "Other wireless": "t-oth", Business: "t-biz" }[t] || "");

function tagLabel(catId, g) {
  if (!g) return "";
  if (catId === "stocks") return g;
  const t = (store[catId]?.tags || []).find((x) => x.id === g);
  return t ? t.label : "";
}

function row(n, o = {}) {
  const tag = o.tag ? `<span class="pill p-${esc(n.g)}">${esc(o.tag)}</span>` : "";
  const img = n.i ? `<img class="thumb" src="${esc(n.i)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : "";
  const cat = o.catLabel ? `<span class="pill">${esc(o.catLabel)}</span>` : "";
  return `<li class="row"><div class="rbody">
    <div class="meta">${cat}${tag}<b>${esc(n.s)}</b><time datetime="${esc(n.d)}">${ago(n.d)}</time>${n.w ? '<span class="badge">Press release</span>' : ""}${o.cov || ""}</div>
    <a class="rt" href="${esc(safe(n.u))}" target="_blank" rel="noopener noreferrer">${esc(n.t)}</a>
    ${o.desc && n.x ? `<p class="rx">${esc(n.x)}</p>` : ""}${o.extra || ""}</div>${o.img === false ? "" : img}</li>`;
}

function techRow(n) {
  const th = (n.th || []).filter((t) => !["wifi", "bluetooth", "chips"].includes(t)).slice(0, 3)
    .map((t) => `<span class="chip">${esc(store.tech.themes?.[t] || t)}</span>`);
  const chips = [
    ...(n.c || []).map((c) => `<span class="chip co">${esc(c)}</span>`),
    ...(n.tech || []).filter((t) => t !== "General").map((t) => `<span class="chip ${techCls(t)}">${esc(t)}</span>`),
    ...th,
    ...(n.rg || []).map((r) => `<span class="chip">${esc(r)}</span>`),
  ].join("");
  const also = (n.al || []).map((a) => `<a href="${esc(safe(a.u))}" target="_blank" rel="noopener noreferrer">${esc(a.p)}</a>`).join("");
  const cov = n.cv > 1 && also ? `<button type="button" class="cov" data-cov aria-expanded="false">+${n.cv - 1} more outlet${n.cv > 2 ? "s" : ""} ▾</button>` : "";
  return card(n, { cov, extra: `<div class="chips">${chips}</div>${also ? `<div class="also" hidden>Also covered by: ${also}</div>` : ""}` });
}

// ---------- infinite list: everything is already fetched, so rows stream in as you scroll
function mountList(host, items, render, chunk = 36) {
  host.innerHTML = "";
  const ul = document.createElement("ul");
  ul.className = "rows";
  const sentinel = document.createElement("div");
  sentinel.className = "sentinel";
  host.append(ul, sentinel);
  if (!items.length) { ul.innerHTML = '<li class="empty">No stories match these filters.</li>'; return; }
  let shown = 0;
  const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) more(); }, { rootMargin: "1400px" });
  function more() {
    const part = items.slice(shown, shown + chunk);
    ul.insertAdjacentHTML("beforeend", part.map(render).join(""));
    shown += part.length;
    if (shown >= items.length) { io.disconnect(); sentinel.textContent = "You're all caught up"; }
  }
  more();
  if (shown < items.length) io.observe(sentinel);
  disposers.push(() => io.disconnect());
}

const skeletons = (n, cards = false) => Array.from({ length: n }, () => cards
  ? '<li class="hitem"><div class="hbody"><i class="sk s"></i><i class="sk"></i><i class="sk" style="width:80%"></i></div></li>'
  : '<li class="row"><div class="rbody" style="width:100%"><i class="sk s"></i><i class="sk"></i><i class="sk" style="width:80%"></i></div></li>').join("");

// ---------- helpers
const ageDays = (n) => (Date.now() - new Date(n.d).getTime()) / 864e5;
// The landing page shows US stock news; the Stock Market page itself offers both India and USA.
const homeItems = (id) => {
  const items = store[id === "stocks" ? "stocksus" : id]?.items || [];
  return id === "stocks" ? items.filter((n) => !STOCK_HIDE.has(n.g) && n.g !== "EARNINGS") : items;
};
function topItems(id, n) {
  return homeItems(id).slice(0, n);
}

// ---------- routing
function parseRoute() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  if (!h || h === "home") return { name: "home" };
  if (h.startsWith("search/")) return { name: "search", q: h.slice(7) };
  if (h.startsWith("company/")) return { name: "company", id: h.slice(8) };
  if (h === "stocks/usa") return { name: "cat", cat: "stocks", market: "usa" };
  if (CAT[h]) return { name: "cat", cat: h };
  return { name: "home" };
}

function render() {
  disposers.forEach((d) => d());
  disposers = [];
  route = parseRoute();
  rendered = false;
  document.querySelectorAll(".cbtn").forEach((b) => b.classList.toggle("on", b.dataset.id === (route.cat || (route.name === "home" ? "home" : ""))));
  $("#newPill").hidden = true;
  const on = $(".cbtn.on");
  if (on) $("#cats").scrollTo({ left: on.offsetLeft - 24, behavior: "smooth" });
  if (route.name === "home") renderHome();
  else if (route.name === "search") renderSearch();
  else if (route.name === "company") renderCompany();
  else renderCat();
  rendered = true;
  window.scrollTo({ top: Math.min(window.scrollY, $(".catnav").offsetTop), behavior: "instant" });
}

function onData(id) {
  updateStatus();
  if (!rendered) return;
  if (route.name === "home") { fillBlock(id === "stocksus" ? "stocks" : id); fillLead(); fillTicker(); fillTrending(); fillGlance(); }
  else if (route.name === "cat" && (route.sid || route.cat) === id) {
    if (window.scrollY < 300 || !route.drawn) drawCat(); else $("#newPill").hidden = false;
  } else if (route.name === "search") drawSearch();
}

function onAux(name) {
  if (!rendered) return;
  if (name === "markets") fillMarkets();
  if (name === "predictions") fillOdds();
}

// ---------- HOME
function renderHome() {
  view.innerHTML = `
    <div class="ticker"><b>LIVE</b><div class="tk-wrap"><div class="tk" id="tk"></div></div></div>
    <div id="lead"></div>
    <div class="home-grid">
      <div class="blocks">${CATS.map((c) => `<section class="block" data-cat="${c.id}" style="--h:${c.hue}">
        <header><h2><a href="#/${c.id}">${esc(c.label)}</a></h2><a class="more" href="#/${c.id === "stocks" ? "stocks/usa" : c.id}">View all →</a></header>
        <ul class="rows" id="blk-${c.id}"></ul></section>`).join("")}</div>
      <aside class="side">
        <section class="card"><h3>Markets snapshot</h3><div id="mkts"><i class="sk"></i><i class="sk"></i><i class="sk"></i></div><div id="mood"></div></section>
        <section class="card"><h3>World clocks</h3><div class="mstate" id="mstate"></div><div class="clocks" id="clocks"></div><p class="note">US regular hours 9:30–16:00 ET; holidays not tracked.</p></section>
        <section class="card"><h3>Crowd forecasts</h3><div id="odds"><i class="sk"></i><i class="sk"></i></div><p class="note">Probabilities from Polymarket traders, not a guarantee.</p></section>
        <section class="card"><h3>Trending in headlines</h3><div class="trend" id="trend"></div></section>
        <section class="card"><h3>Today at a glance</h3><div class="glance" id="glance"></div></section>
      </aside>
    </div>`;
  CATS.forEach((c) => fillBlock(c.id));
  fillLead(); fillTicker(); fillTrending(); fillGlance(); fillMarkets(); fillOdds(); startClocks();
}

function fillBlock(id) {
  const ul = $(`#blk-${id}`);
  if (!ul) return;
  const items = topItems(id, 5);
  if (!items.length) {
    ul.innerHTML = failed[id === "stocks" ? "stocksus" : id] ? '<li class="empty">Could not load — retrying shortly.</li>' : skeletons(4);
    return;
  }
  ul.innerHTML = items.map((n, i) => row(n, { img: i === 0, tag: id === "stocks" ? n.g : "" })).join("");
}

function fillLead() {
  const host = $("#lead");
  if (!host) return;
  const order = ["world", "stocks", "ai", "politics", "science", "entertainment", "sports"];
  const pool = order.flatMap((id) => homeItems(id).slice(0, 4).filter((n) => n.i).map((n) => ({ n, id })))
    .filter((x) => ageDays(x.n) < 2 && !/investing|seeking/i.test(x.n.s)).sort((a, b) => b.n.d.localeCompare(a.n.d));
  const pick = pool[0];
  if (!pick) { host.innerHTML = ""; return; }
  const { n, id } = pick;
  host.innerHTML = `<a class="lead" href="${esc(safe(n.u))}" target="_blank" rel="noopener noreferrer" style="--h:${CAT[id].hue}">
    <img src="${esc(n.i)}" alt="" decoding="async" referrerpolicy="no-referrer" fetchpriority="high"><div class="in"><span class="kicker">${esc(CAT[id].label)}</span>
    <h2>${esc(n.t)}</h2><div class="meta"><b>${esc(n.s)}</b><time>${ago(n.d)}</time></div></div></a>`;
}

function fillTicker() {
  const tk = $("#tk");
  if (!tk) return;
  const items = CATS.flatMap((c) => topItems(c.id, 3).map((n) => ({ n, c }))).sort((a, b) => b.n.d.localeCompare(a.n.d)).slice(0, 24);
  if (!items.length) { tk.innerHTML = '<a>Fetching the latest headlines…</a>'; return; }
  const html = items.map(({ n, c }) => `<a href="${esc(safe(n.u))}" target="_blank" rel="noopener noreferrer"><em>${esc(c.label)}</em>${esc(n.t)}</a>`).join("");
  tk.innerHTML = html + html;
}

const STOPCAP = new Set("The A An How Why What Who When Where This That These Those It Its His Her Their After Before As At In On Of For And But Or To With By From Is Are Be Will Can New Now Here There Can Could Would Should More Most Just Not You We They Our Your Says Said Report Reports Live Update Updates Watch Read Best Top One Two Three First Last Next Over Under About Into Out Up Down Why".split(" "));
function fillTrending() {
  const host = $("#trend");
  if (!host) return;
  const counts = new Map();
  const cutoff = Date.now() - 36e5 * 36;
  for (const c of CATS) {
    if (c.id === "tech") continue;
    for (const n of homeItems(c.id)) {
      if (new Date(n.d).getTime() < cutoff) continue;
      const seen = new Set();
      for (const m of n.t.matchAll(/\b([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,2})\b/g)) {
        let w = m[1].split(/\s+/);
        while (w.length && STOPCAP.has(w[0])) w.shift();
        if (!w.length) continue;
        const k = w.join(" ").replace(/['’]s$/, "").replace(/[.'’-]+$/, "");
        if (k.length < 4 || STOPCAP.has(k)) continue;
        seen.add(k);
      }
      seen.forEach((k) => counts.set(k, (counts.get(k) || 0) + 1));
    }
  }
  const top = [...counts].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, 14);
  host.innerHTML = top.length ? top.map(([k, c]) => `<a href="#/search/${encodeURIComponent(k)}">${esc(k)}<small>${c}</small></a>`).join("") : '<span class="note">Building trends from live headlines…</span>';
}

function fillGlance() {
  const host = $("#glance");
  if (!host) return;
  let stories = 0, last24 = 0;
  const pubs = new Set();
  for (const c of CATS) for (const n of homeItems(c.id)) { stories++; pubs.add(n.s); if (ageDays(n) < 1) last24++; }
  host.innerHTML = `<div><b>${stories}</b><span>stories live</span></div><div><b>${last24}</b><span>in last 24h</span></div><div><b>${pubs.size}</b><span>publishers</span></div>`;
}

function fmtPrice(q) {
  if (q.price >= 1000) return q.price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return q.price.toFixed(q.sym.includes("=X") ? 4 : 2);
}
function fillMarkets() {
  const host = $("#mkts");
  if (!host) return;
  const qs = aux.markets?.quotes;
  if (!qs) return;
  host.innerHTML = `<div class="quotes">${qs.map((q) => `<div class="q"><small>${esc(q.name)}</small><b>${esc(fmtPrice(q))}</b><span class="${q.pct >= 0 ? "up" : "down"}">${q.pct >= 0 ? "▲" : "▼"} ${Math.abs(q.pct).toFixed(2)}%</span></div>`).join("")}</div>`;
  const idx = qs.filter((q) => ["^GSPC", "^IXIC", "^DJI"].includes(q.sym));
  const up = idx.filter((q) => q.pct >= 0).length;
  $("#mood").innerHTML = idx.length ? `<p class="note">US indices: ${up} of ${idx.length} higher on the day · quotes may be delayed.</p>` : "";
}

function oddsHtml(items) {
  return items.map((o) => `<a class="odd" href="${esc(safe(o.url))}" target="_blank" rel="noopener noreferrer"><p>${esc(o.q)}</p>
    <div class="bar"><i style="width:${Math.round(o.yes * 100)}%"></i></div><small><span>Yes ${Math.round(o.yes * 100)}%</span><span>$${o.vol.toLocaleString()} 24h vol</span></small></a>`).join("");
}
function fillOdds() {
  const items = aux.predictions?.items;
  if (!items) return;
  const side = $("#odds");
  if (side) side.innerHTML = oddsHtml(items.slice(0, 5));
  const grid = $("#oddsGrid");
  if (grid) grid.innerHTML = oddsHtml(items);
}

let clockTimer;
function startClocks() {
  const zones = [["New York", "America/New_York"], ["London", "Europe/London"], ["Mumbai", "Asia/Kolkata"], ["Tokyo", "Asia/Tokyo"]];
  const tick = () => {
    const host = $("#clocks");
    if (!host) return clearInterval(clockTimer);
    const now = new Date();
    host.innerHTML = zones.map(([n, tz]) => `<div class="clk">${n}<b>${new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(now)}</b></div>`).join("");
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(now).map((x) => [x.type, x.value]));
    const mins = (+p.hour % 24) * 60 + +p.minute;
    const open = !["Sat", "Sun"].includes(p.weekday) && mins >= 570 && mins < 960;
    const st = $("#mstate");
    st.className = "mstate" + (open ? " open" : "");
    st.innerHTML = `<i></i>US stock market is <b>${open ? "open" : "closed"}</b>`;
  };
  clearInterval(clockTimer);
  tick();
  clockTimer = setInterval(tick, 30000);
}

// ---------- CATEGORY
function pageShell(c, extra = "", status = '<span id="cnt">Loading feeds…</span>') {
  view.innerHTML = `<section class="page" style="--h:${c.hue}">
    ${BACK}
    <div class="phead"><h1>${esc(c.label)}</h1><div class="pstat${c.id === "tech" ? " tech-company-stat" : ""}">${status}</div></div>
    ${extra}<div class="filters" id="filters"></div><div class="listbox" id="list"></div></section>`;
}

function renderCat() {
  if (route.cat === "stocks") return renderStocks();
  const c = CAT[route.cat];
  if (c.id === "tech") pageShell(c, TECH_COMPANY_PANEL, TECH_COMPANY_PICKER);
  else pageShell(c, c.id === "prediction" ? '<div class="odds-grid" id="oddsGrid"></div>' : "");
  route.filter = "";
  route.t = { tech: "", reg: "", days: 30, theme: "", topic: "", sort: "date", wire: false, q: "" };
  if (c.id === "tech") bindTechCompanyPicker();
  if (c.id === "prediction") fillOdds();
  route.drawn = false;
  drawCat();
  document.addEventListener("click", covToggle);
  disposers.push(() => document.removeEventListener("click", covToggle));
}

// ---------- STOCK MARKET (India / USA): mirrors the HeRAI news screener layout
const hAgo = (iso) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 6e4));
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 6) return `${h}h ${m % 60}m ago`;
  if (h < 24) return `${h} hours ago`;
  return `${Math.floor(h / 24)} days ago`;
};

function langName(code) {
  try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code); } catch { return ""; }
}

function card(n, o = {}) {
  const orig = n.to ? `<div class="orig" title="${esc(n.to)}">Translated${n.lg && langName(n.lg) ? ` from ${esc(langName(n.lg))}` : ""} · Original: ${esc(n.to)}</div>` : "";
  const img = n.i ? `<img class="hthumb" src="${esc(n.i)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : "";
  const tag = o.tag ? `<span class="htag">${esc(o.tag)}</span>` : "";
  const cat = o.catLabel ? `<span class="htag">${esc(o.catLabel)}</span>` : "";
  return `<li class="hitem">${img}<div class="hbody"><div class="hmeta">${cat}${tag}<span class="hsrc">${esc(n.s)}</span><span class="htime">${hAgo(n.d)}</span>${n.w ? '<span class="badge">Press release</span>' : ""}${o.cov || ""}</div>
    <a class="htitle" href="${esc(safe(n.tu || n.u))}" target="_blank" rel="noopener noreferrer">${esc(n.t)}</a>${orig}${n.x ? `<p class="hdesc">${esc(n.x)}</p>` : ""}${o.extra || ""}</div></li>`;
}

// AI and Politics have their own sections, so the stock page leaves them out.
const STOCK_HIDE = new Set(["AI", "POLITICAL"]);

function renderStocks() {
  const us = route.market === "usa";
  const name = us ? "USA" : "India";
  route.sid = us ? "stocksus" : "stocks";
  route.filter = "";
  route.drawn = false;
  view.innerHTML = `<section class="page herai">
    <div class="mkt"><a class="mk${us ? "" : " on"}" href="#/stocks">India</a><a class="mk${us ? " on" : ""}" href="#/stocks/usa">USA</a></div>
    ${BACK}
    <h1>${name} Market News</h1>
    <div class="hcard"><div class="hpills" id="filters"></div>
      <div class="hstatus"><span id="cnt">Loading feeds…</span></div>
      <div id="list"></div></div></section>`;
  drawStocks();
}

function drawStocks() {
  const id = route.sid;
  const d = store[id];
  const list = $("#list");
  if (!list) return;
  if (!d) {
    $("#filters").innerHTML = "";
    list.innerHTML = failed[id] ? '<div class="err">Could not load this feed right now. <button class="hbtn" id="retry" type="button">Retry</button></div>' : `<ul class="rows">${skeletons(6, true)}</ul>`;
    const r = $("#retry"); if (r) r.onclick = () => { failed[id] = false; drawStocks(); loadCat(id); };
    return;
  }
  route.drawn = true;
  $("#newPill").hidden = true;
  const f = $("#filters");
  f.innerHTML = [{ id: "", label: "All" }, ...(d.tags || []).filter((c) => !STOCK_HIDE.has(c.id))].map((c) => `<button class="hpill${route.filter === c.id ? " on" : ""}" data-f="${esc(c.id)}" type="button">${esc(c.label)}</button>`).join("");
  f.onclick = (e) => { const b = e.target.closest("[data-f]"); if (b) { route.filter = b.dataset.f; drawStocks(); } };
  const items = d.items.filter((n) => !STOCK_HIDE.has(n.g) && (!route.filter || n.g === route.filter));
  $("#cnt").textContent = `${items.length} stories · updated ${hAgo(d.generated)}`;
  mountList(list, items, (n) => card(n, { tag: n.g }));
}

function covToggle(e) {
  const b = e.target.closest("[data-cov]");
  if (!b) return;
  const box = b.closest(".hbody").querySelector(".also");
  box.hidden = !box.hidden;
  b.setAttribute("aria-expanded", String(!box.hidden));
}

function drawCat() {
  if (route.sid) return drawStocks();
  const id = route.cat;
  const d = store[id];
  const list = $("#list");
  if (!list) return;
  if (!d) {
    $("#filters").innerHTML = "";
    list.innerHTML = failed[id] ? '<div class="err">Could not load this feed right now. <button class="btn" id="retry" type="button">Retry</button></div>' : `<ul class="rows">${skeletons(9, true)}</ul>`;
    const r = $("#retry"); if (r) r.onclick = () => { failed[id] = false; drawCat(); loadCat(id); };
    return;
  }
  route.drawn = true;
  $("#newPill").hidden = true;
  if (id === "tech") return drawTech(d);
  const tags = d.tags?.length ? d.tags : null;
  let chips;
  if (tags) chips = [{ id: "", label: "All" }, ...tags];
  else {
    const counts = {};
    d.items.forEach((n) => (counts[n.s] = (counts[n.s] || 0) + 1));
    chips = [{ id: "", label: "All" }, ...Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([s]) => ({ id: s, label: s }))];
  }
  const f = $("#filters");
  f.innerHTML = `<div class="fgroup">${chips.map((c) => `<button class="tbtn${route.filter === c.id ? " on" : ""}" data-f="${esc(c.id)}" type="button">${esc(c.label)}</button>`).join("")}</div>`;
  f.onclick = (e) => { const b = e.target.closest("[data-f]"); if (b) { route.filter = b.dataset.f; drawCat(); } };
  const items = d.items.filter((n) => !route.filter || (tags ? n.g === route.filter : n.s === route.filter));
  $("#cnt").textContent = `${items.length} stories · updated ${ago(d.generated)}`;
  mountList(list, items, (n) => card(n, { tag: tags ? (id === "stocks" ? n.g : tagLabel(id, n.g)) : "" }));
}

// ---------- TECHNOLOGY (wireless newsroom)
function drawTech(d) {
  const s = route.t;
  const group = (lbl, key, opts) => `<div class="fgroup"><span class="lbl">${lbl}</span>${opts.map(([v, t]) => `<button class="tbtn${String(s[key]) === String(v) ? " on" : ""}" data-k="${key}" data-v="${esc(v)}" type="button">${esc(t)}</button>`).join("")}</div>`;
  const themeCount = {};
  d.items.forEach((n) => (n.th || []).forEach((t) => (themeCount[t] = (themeCount[t] || 0) + 1)));
  const f = $("#filters");
  const keep = document.activeElement?.id;
  f.innerHTML = group("Technology", "tech", [["", "All"], ["Wi-Fi", "Wi-Fi"], ["Bluetooth", "Bluetooth"], ["Other wireless", "UWB / Matter / NearLink"], ["Business", "Business & deals"]])
    + group("Region", "reg", [["", "All"], ["Americas", "Americas"], ["Europe", "Europe / EU"], ["China", "China"], ["APAC", "APAC"]])
    + group("Time", "days", [[1, "24 hours"], [7, "7 days"], [30, "30 days"]])
    + `<div class="finputs"><input type="text" id="tq" placeholder="Search headlines, publishers, companies…" aria-label="Search technology news" value="${esc(s.q)}">
      <select id="tth" aria-label="Theme"><option value="">All themes</option>${Object.entries(themeCount).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<option value="${esc(t)}"${s.theme === t ? " selected" : ""}>${esc(d.themes?.[t] || t)} (${n})</option>`).join("")}</select>
      <select id="ttp" aria-label="Topic"><option value="">All topics / feeds</option>${(d.topics || []).map((t) => `<option value="${esc(t.id)}"${s.topic === t.id ? " selected" : ""}>${esc(t.label)}</option>`).join("")}</select>
      <select id="tso" aria-label="Sort"><option value="score"${s.sort === "score" ? " selected" : ""}>Sort: Top (importance)</option><option value="date"${s.sort === "date" ? " selected" : ""}>Sort: Latest</option><option value="cv"${s.sort === "cv" ? " selected" : ""}>Sort: Most covered</option></select>
      <label><input type="checkbox" id="twr"${s.wire ? " checked" : ""}> press releases only</label></div>`;
  f.onclick = (e) => { const b = e.target.closest("[data-k]"); if (b) { s[b.dataset.k] = b.dataset.k === "days" ? +b.dataset.v : b.dataset.v; drawTech(d); } };
  let t;
  $("#tq").oninput = (e) => { s.q = e.target.value; clearTimeout(t); t = setTimeout(() => { drawTech(d); $("#tq").focus(); $("#tq").setSelectionRange(s.q.length, s.q.length); }, 250); };
  $("#tth").onchange = (e) => { s.theme = e.target.value; drawTech(d); };
  $("#ttp").onchange = (e) => { s.topic = e.target.value; drawTech(d); };
  $("#tso").onchange = (e) => { s.sort = e.target.value; drawTech(d); };
  $("#twr").onchange = (e) => { s.wire = e.target.checked; drawTech(d); };
  if (keep && $("#" + keep)) $("#" + keep).focus();

  const cut = Date.now() - s.days * 864e5;
  const q = s.q.toLowerCase();
  const rows = d.items.filter((n) => new Date(n.d).getTime() >= cut && (!s.tech || n.tech.includes(s.tech)) && (!s.reg || n.rg.includes(s.reg))
    && (!s.theme || n.th.includes(s.theme)) && (!s.wire || n.w) && (!s.topic || (n.tp || []).includes(s.topic))
    && (!q || (n.t + " " + n.s + " " + (n.c || []).join(" ")).toLowerCase().includes(q)));
  rows.sort((a, b) => (s.sort === "date" ? b.d.localeCompare(a.d) : s.sort === "cv" ? b.cv - a.cv || b.sc - a.sc : b.sc - a.sc));
  mountList($("#list"), rows, techRow);
}

const TECH_COMPANY_PICKER = `<details class="company-picker" id="techCompanyPicker">
  <summary>Choose a tech company</summary>
  <form class="company-menu" id="techCompanyMenu" autocomplete="off">
    <input id="techCompanyQuery" type="search" placeholder="Search companies" aria-label="Search tech companies">
    <div class="company-options" id="techCompanyOptions"></div>
  </form>
</details>`;
const TECH_COMPANY_PANEL = `<section class="tech-company-panel" id="techCompanyPanel" aria-labelledby="techCompanyTitle" hidden>
  <div class="tech-company-head">
    <h2 id="techCompanyTitle"></h2><button class="btn" id="techCompanyClear" type="button">Clear company</button>
    <div class="pstat" id="techCompanyCount" aria-live="polite"></div>
  </div>
  <div class="filters" id="techCompanyFilters"></div><div class="listbox" id="techCompanyList"></div>
</section>`;

function drawTechCompanyOptions() {
  const q = $("#techCompanyQuery").value.trim().toLowerCase();
  const companies = coIdx.list.filter((c) => !q || [c.n, ...c.t].some((name) => name.toLowerCase().startsWith(q)));
  $("#techCompanyOptions").innerHTML = companies.map((c) =>
    `<button type="button" data-company="${esc(c.id)}" aria-pressed="${c.id === route.t.company}">${esc(c.n)}</button>`).join("")
    || `<p>${coIndexFailed ? "Could not load companies." : coIdx.list.length ? "No companies match." : "Loading companies..."}</p>`;
}

function bindTechCompanyPicker() {
  const picker = $("#techCompanyPicker");
  const summary = picker.querySelector("summary");
  const query = $("#techCompanyQuery");
  const options = $("#techCompanyOptions");
  const select = (id) => {
    const c = coIdx.byId[id];
    route.t.company = id;
    route.t.companyDays = 30;
    picker.open = false;
    summary.textContent = c ? c.n : "Choose a tech company";
    summary.focus();
    if (c) {
      $("#techCompanyTitle").textContent = `${c.n} news`;
      ensureShard(c.k);
    }
    $("#techCompanyPanel").hidden = !c;
    if (c) drawTechCompany();
  };
  picker.ontoggle = () => {
    if (!picker.open) return;
    query.value = "";
    drawTechCompanyOptions();
    query.focus();
    if (coIndexFailed) loadIndex();
  };
  query.oninput = () => { drawTechCompanyOptions(); options.scrollTop = 0; };
  options.onclick = (e) => {
    const option = e.target.closest("[data-company]");
    if (option) select(option.dataset.company);
  };
  $("#techCompanyMenu").onsubmit = (e) => {
    e.preventDefault();
    const first = options.querySelector("[data-company]");
    if (first) select(first.dataset.company);
  };
  picker.onkeydown = (e) => {
    if (e.key === "Escape" && picker.open) { picker.open = false; summary.focus(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const next = e.target === query ? (e.key === "ArrowDown" ? options.firstElementChild : null)
        : e.key === "ArrowDown" ? e.target.nextElementSibling : e.target.previousElementSibling || query;
      if (next?.matches("button, input")) { e.preventDefault(); next.focus(); }
    }
  };
  picker.onfocusout = (e) => { if (e.relatedTarget && !picker.contains(e.relatedTarget)) picker.open = false; };
  const close = (e) => { if (!picker.contains(e.target)) picker.open = false; };
  document.addEventListener("click", close);
  disposers.push(() => document.removeEventListener("click", close));
  $("#techCompanyClear").onclick = () => select("");
}

function drawTechCompany() {
  const c = coIdx.byId[route.t.company];
  if (!c) return;
  drawCompanyNews(c, route.t.companyDays, {
    list: $("#techCompanyList"), filters: $("#techCompanyFilters"), count: $("#techCompanyCount"),
    setDays: (days) => { route.t.companyDays = days; drawTechCompany(); },
  });
}

// ---------- COMPANIES: global tech-company news (pre-fetched into rotating shards by the build)
const coIdx = { list: [], byId: {} };
const coShard = {}, coFailed = {}, coInflight = {};
let coIndexFailed = false;
const googleLink = (q) => `https://news.google.com/search?q=${encodeURIComponent(q + " when:30d")}`;

function setIndex(d) {
  coIdx.list = [...(d.companies || [])].sort((a, b) => a.n.localeCompare(b.n, "en"));
  coIdx.byId = Object.fromEntries(coIdx.list.map((c) => [c.id, c]));
}
function loadIndex() {
  const had = coIdx.list.length > 0;
  return fetch(`data/companies-index.json?t=${slot()}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => {
    coIndexFailed = false;
    setIndex(d); saveLocal("coidx", d);
    if (!had && rendered && (route.name === "company" || route.name === "search")) render();
    if ($("#techCompanyPicker")?.open) drawTechCompanyOptions();
  }).catch(() => {
    coIndexFailed = !coIdx.list.length;
    if ($("#techCompanyPicker")?.open) drawTechCompanyOptions();
  });
}
function loadShard(k) {
  if (coInflight[k]) return coInflight[k];
  coInflight[k] = fetch(`data/co-${k}.json?t=${slot()}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => {
    coFailed[k] = false;
    if (!coShard[k] || new Date(d.generated) > new Date(coShard[k].generated)) { coShard[k] = d; onCompanyData(k); }
  }).catch(() => { coFailed[k] = true; onCompanyData(k); }).finally(() => { delete coInflight[k]; });
  return coInflight[k];
}
const ensureShard = (k) => { if (!coShard[k] && !coInflight[k] && !coFailed[k]) loadShard(k); };
function onCompanyData(k) {
  if (!rendered) return;
  if (route.name === "company") drawCompany();
  else if (route.name === "search") drawSearch();
  else if (route.cat === "tech" && coIdx.byId[route.t.company]?.k === k) drawTechCompany();
}
const companyItems = (c) => coShard[c.k]?.companies?.[c.id]?.items || [];

// Best matches first: exact term, then prefix, then word prefix, then substring.
function matchCompanies(q) {
  q = q.trim().toLowerCase();
  if (q.length < 2) return [];
  const out = [];
  for (const c of coIdx.list) {
    const terms = [c.n, ...c.t].map((s) => s.toLowerCase());
    let score = 0;
    if (terms.includes(q)) score = 100;
    else if (terms.some((t) => t.startsWith(q))) score = 60;
    else if (terms.some((t) => t.split(/[^a-z0-9]+/).some((w) => w.startsWith(q)))) score = 40;
    else if (q.length >= 3 && terms.some((t) => t.includes(q))) score = 20;
    if (score) out.push({ c, score });
  }
  return out.sort((a, b) => b.score - a.score || a.c.n.localeCompare(b.c.n));
}

const timeButtons = (days) => `<div class="fgroup"><span class="lbl">Time</span>${[[1, "24 hours"], [7, "7 days"], [30, "30 days"]].map(([v, t]) => `<button class="tbtn${days === v ? " on" : ""}" data-days="${v}" type="button">${t}</button>`).join("")}</div>`;
const inDays = (n, days) => new Date(n.d).getTime() >= Date.now() - days * 864e5;

function renderCompany() {
  const c = coIdx.byId[route.id];
  route.days = 30;
  view.innerHTML = `<section class="page" style="--h:170">
    ${BACK}
    <div class="phead"><h1>${esc(c ? c.n : "Company")}</h1><div class="pstat"><span id="cnt"></span></div>
    <p>${c ? `${esc(c.s)} · ${esc(c.r)}` : "Loading company…"}</p></div>
    <div class="filters" id="filters"></div><div class="listbox" id="list"></div></section>`;
  if (c) ensureShard(c.k);
  drawCompany();
}
function drawCompany() {
  const list = $("#list");
  if (!list) return;
  const c = coIdx.byId[route.id];
  if (!c) { list.innerHTML = coIdx.list.length ? '<div class="err">Company not found. Use the search box above.</div>' : `<ul class="rows">${skeletons(6, true)}</ul>`; return; }
  drawCompanyNews(c, route.days, {
    list, filters: $("#filters"), count: $("#cnt"),
    setDays: (days) => { route.days = days; drawCompany(); },
  });
}

function drawCompanyNews(c, days, { list, filters, count, setDays }) {
  const sh = coShard[c.k];
  if (!sh) {
    count.textContent = coFailed[c.k] ? "" : "Loading company news...";
    filters.innerHTML = "";
    list.innerHTML = coFailed[c.k] ? '<div class="err">Could not load this company right now.</div>' : `<ul class="rows">${skeletons(9, true)}</ul>`;
    return;
  }
  filters.innerHTML = timeButtons(days);
  filters.onclick = (e) => { const b = e.target.closest("[data-days]"); if (b) setDays(+b.dataset.days); };
  const items = companyItems(c).filter((n) => inDays(n, days));
  count.textContent = `${items.length} stories · updated ${ago(sh.generated)}`;
  if (!items.length) { list.innerHTML = `<div class="err">No stories in this window. <a class="more" href="${esc(googleLink(c.n))}" target="_blank" rel="noopener noreferrer">Search Google News for ${esc(c.n)} ↗</a></div>`; return; }
  mountList(list, items, (n) => card(n, {}));
}

// ---------- SEARCH (all sections + matching company news)
function renderSearch() {
  route.days = 30;
  view.innerHTML = `<section class="page" style="--h:210">
    ${BACK}
    <div class="phead"><h1>Search: ${esc(route.q)}</h1><div class="pstat"><span id="cnt"></span></div><div class="cochips" id="coChips"></div></div>
    <div class="filters" id="filters"></div><div class="listbox" id="list"></div></section>`;
  drawSearch();
}
function drawSearch() {
  const list = $("#list");
  if (!list) return;
  const terms = route.q.toLowerCase().split(/\s+/).filter(Boolean);
  const matched = matchCompanies(route.q).filter((m) => m.score >= 40).slice(0, 3).map((m) => m.c);
  matched.forEach((c) => ensureShard(c.k));
  const hits = [];
  for (const c of CATS) for (const n of store[c.id]?.items || []) {
    const hay = (n.t + " " + (n.to || "") + " " + (n.x || "") + " " + n.s).toLowerCase();
    if (terms.every((t) => hay.includes(t))) hits.push({ n, label: c.label });
  }
  for (const c of matched) for (const n of companyItems(c)) hits.push({ n, label: c.n });
  hits.sort((a, b) => b.n.d.localeCompare(a.n.d));
  const seen = new Set();
  const uniq = hits.filter((h) => inDays(h.n, route.days) && !seen.has(h.n.u) && seen.add(h.n.u));
  const f = $("#filters");
  f.innerHTML = timeButtons(route.days);
  f.onclick = (e) => { const b = e.target.closest("[data-days]"); if (b) { route.days = +b.dataset.days; drawSearch(); } };
  $("#coChips").innerHTML = matched.map((c) => `<a href="#/company/${esc(c.id)}">${esc(c.n)} →</a>`).join("")
    + `<a href="${esc(googleLink(route.q))}" target="_blank" rel="noopener noreferrer">Search Google News for “${esc(route.q)}” ↗</a>`;
  const loading = CATS.filter((c) => !store[c.id]).length + matched.filter((c) => !coShard[c.k] && !coFailed[c.k]).length;
  $("#cnt").textContent = `${uniq.length} stories${loading ? " · still loading" : ""}`;
  mountList(list, uniq, ({ n, label }) => card(n, { catLabel: label }));
}

// ---------- chrome: nav, status, search box with company suggestions
function showSuggest() {
  const q = $("#q").value.trim();
  const sug = $("#suggest");
  if (q.length < 2) { sug.hidden = true; return; }
  const m = matchCompanies(q).slice(0, 7);
  sug.innerHTML = m.map(({ c }) => `<a href="#/company/${esc(c.id)}"><b>${esc(c.n)}</b><span>${esc(c.s)} · ${esc(c.r)}</span></a>`).join("")
    + `<a href="#/search/${encodeURIComponent(q)}"><b>Search all news for “${esc(q)}”</b><span>Every section, last 30 days</span></a>`;
  sug.hidden = false;
}
function buildNav() {
  $("#cats").innerHTML = [{ id: "home", label: "Home", hue: 210 }, ...CATS].map((c) => `<a class="cbtn" role="tab" data-id="${c.id}" href="#/${c.id}" style="--h:${c.hue}">${esc(c.label)}</a>`).join("");
  const q = $("#q");
  q.addEventListener("input", showSuggest);
  q.addEventListener("focus", showSuggest);
  q.addEventListener("blur", () => setTimeout(() => ($("#suggest").hidden = true), 180));
  $("#searchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = q.value.trim();
    if (!text) return;
    const best = matchCompanies(text)[0];
    $("#suggest").hidden = true;
    location.hash = best && best.score >= 60 ? "#/company/" + best.c.id : "#/search/" + encodeURIComponent(text);
  });
}

function updateStatus() {
  const times = Object.values(store).map((d) => new Date(d.generated).getTime()).filter(Boolean);
  const el = $("#statusText");
  if (!times.length) { el.textContent = "Fetching latest headlines…"; return; }
  el.textContent = `Live · updated ${ago(new Date(Math.max(...times)).toISOString())}`;
}

document.addEventListener("error", (e) => { if (e.target.tagName === "IMG") e.target.remove(); }, true);
$("#newPill").addEventListener("click", () => { route.drawn = false; drawCat(); window.scrollTo({ top: $(".catnav").offsetTop, behavior: "smooth" }); });
window.addEventListener("hashchange", () => { $("#suggest").hidden = true; render(); });

// ---------- boot: paint cached data immediately, then fetch everything in parallel in the background
buildNav();
for (const id of [...CATS.map((c) => c.id), ...EXTRA]) { const d = readLocal(id); if (d?.items) store[id] = d; }
for (const k of Object.keys(aux)) aux[k] = readLocal(k);
const cachedIdx = readLocal("coidx");
if (cachedIdx) setIndex(cachedIdx);
loadIndex();
route = parseRoute();
render();
updateStatus();
loadAll();
setInterval(() => [...CATS.map((c) => c.id), ...EXTRA].forEach(loadCat), 2 * 60 * 1000);
setInterval(() => { loadAux("markets"); loadAux("predictions"); }, 2 * 60 * 1000);
setInterval(updateStatus, 30000);
setInterval(() => { loadIndex(); for (const k in coFailed) delete coFailed[k]; Object.keys(coShard).forEach(loadShard); }, 2 * 60 * 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { [...CATS.map((c) => c.id), ...EXTRA].forEach(loadCat); loadAux("markets"); } });
})();
