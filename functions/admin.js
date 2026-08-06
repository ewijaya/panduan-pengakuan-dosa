/* Ops dashboard at /admin — a full port of hop-web's functions/admin.js
 * pattern, restyled in Sarum Vellum and written in Indonesian.
 *
 * Un-gated but aggregate-only, like the beacon that feeds it: page-open
 * counts by day, page, place, device and language over a selectable window
 * (?days=7|30|90). Nothing here can identify a reader, and the examination
 * marks never reach a server at all — there is nothing sensitive to gate.
 * Carries noindex; reached by link, not search.
 *
 * Live numbers come from the Analytics Engine SQL API over dataset
 * pdp_events (functions/api/beacon.js — see the datapoint layout there).
 * ?tick returns just the latest-access ticker fragment for the 45s poll.
 * Unlike hop there is no KV/R2 tier: the health banner is computed live
 * (24h count vs 7-day average) and history is bounded by AE's ~90 days.
 *
 * Needs two Pages-project secrets (both stored as SECRETS — plaintext vars
 * are wiped by CLI-driven deploys, secrets survive):
 *   ANALYTICS_ACCOUNT_ID — Cloudflare account id
 *   ANALYTICS_READ_TOKEN — API token with Account Analytics : Read
 */

const DATASET = "pdp_events";
const LAUNCH_DAY = "2026-08-06"; // the day the beacon first collected
const WIB_MS = 7 * 60 * 60 * 1000; // times shown in WIB — the app's audience

/* path → readable page name (fallback: the path itself) */
const PAGE_NAMES = {
  "/": "Beranda",
  "/sakramen-tobat/": "Sakramen Tobat",
  "/lima-langkah/": "Lima Langkah",
  "/doa/": "Doa",
  "/pemeriksaan-batin/": "Pemeriksaan Batin",
  "/tata-cara/": "Tata Cara",
  "/antre/": "Mode Antre",
  "/selesai/": "Selesai",
  "/tentang/": "Tentang",
};

/* ------------------------------------------------------------ helpers */

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = (n) => Number(n ?? 0).toLocaleString("id-ID");
const pageName = (p) => PAGE_NAMES[p] ?? p;
const coord = (v) => /^-?\d+(\.\d+)?$/.test(v ?? "");

function countryName(code) {
  if (!/^[A-Z]{2}$/.test(code ?? "")) return code || "—";
  try { return new Intl.DisplayNames(["id"], { type: "region" }).of(code) ?? code; } catch { return code; }
}

/* Emoji flag from ISO code — regional indicators, no external requests. */
const flagOf = (code) =>
  /^[A-Z]{2}$/.test(code ?? "")
    ? `<span class="flag" aria-hidden="true">${String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))}</span>`
    : '<span class="flag flag-x" aria-hidden="true"></span>';

/* AE timestamps are UTC "YYYY-MM-DD hh:mm:ss". */
const utcOf = (ts) => new Date(`${String(ts).replace(" ", "T")}Z`).getTime();
const wibStamp = (ts) => new Date(utcOf(ts) + WIB_MS).toISOString().slice(0, 16).replace("T", " ");
const wibClock = (ts) => wibStamp(ts).slice(11);

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function prettyDay(ts) {
  const d = new Date(utcOf(ts) + WIB_MS);
  return `${d.getUTCDate()} ${MONTHS_ID[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function ago(ts) {
  const min = Math.max(0, Math.round((Date.now() - utcOf(ts)) / 60000));
  if (min < 60) return `${min} mnt lalu`;
  if (min < 48 * 60) return `${Math.round(min / 60)} jam lalu`;
  return `${Math.round(min / 1440)} hari lalu`;
}

async function sql(env, query) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.ANALYTICS_ACCOUNT_ID}/analytics_engine/sql`,
    { method: "POST", headers: { Authorization: `Bearer ${env.ANALYTICS_READ_TOKEN}` }, body: `${query} FORMAT JSON` },
  );
  if (!r.ok) throw new Error(`SQL ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()).data ?? [];
}

/* --------------------------------------------------- latest-access feed */

const latestQuery = `SELECT timestamp, blob1 AS event, blob2 AS path, blob3 AS country, blob5 AS city
  FROM ${DATASET} WHERE timestamp >= NOW() - INTERVAL '3' DAY
  ORDER BY timestamp DESC LIMIT 24`;

const tickLabel = (r) =>
  r.event === "install" ? "Memasang aplikasi 📲"
    : r.event === "pwa" ? `${pageName(r.path)} · aplikasi`
      : pageName(r.path);

/* Stock-ticker tape: two copies scroll 0 → −50% for a seamless loop. */
function tickerPanel(rows, error = null) {
  const items = (rows ?? []).map((r) => ({
    time: wibClock(r.timestamp),
    place: [r.city, countryName(r.country)].filter((v) => v && v !== "—").join(", ") || "Tempat tak dikenal",
    label: tickLabel(r),
  }));
  const cell = (r) =>
    `<span class="tick"><span class="tick-t">${esc(r.time)}</span><span class="tick-p">${esc(r.place)}</span><span class="tick-e">${esc(r.label)}</span></span>`;
  const key = items.map((r) => r.time + r.place + r.label).join("|");
  return `<section class="card" id="latest-panel">
    <h2>Akses terakhir <span class="live-dot" aria-hidden="true"></span><span class="live-note">live</span></h2>
    ${error ? `<p class="empty">Kueri gagal: ${esc(error)}</p>` : ""}
    ${items.length
      ? `<div class="ticker" data-key="${esc(key)}">
          <div class="ticker-track" style="animation-duration:${Math.max(24, items.length * 3.2).toFixed(0)}s">
            ${[0, 1].map((copy) => `<div class="ticker-copy"${copy ? ' aria-hidden="true"' : ""}>${items.map(cell).join("")}</div>`).join("")}
          </div>
        </div>`
      : '<p class="empty">Belum ada kunjungan dalam 3 hari terakhir.</p>'}
    <p class="note">Terbaru dulu, bergulir kanan ke kiri, waktu dalam WIB. Arahkan kursor untuk jeda. Lokasi perkiraan jaringan; sampling dapat menyembunyikan kunjungan bervolume sangat rendah.</p>
  </section>`;
}

/* -------------------------------------------------------- entry point */

export async function onRequestGet({ request, env }) {
  if (!env.ANALYTICS_READ_TOKEN || !env.ANALYTICS_ACCOUNT_ID) {
    // Presence booleans only — never values.
    const have = (k) => (env[k] ? "ada" : "TIDAK ADA");
    return new Response(
      "Dashboard belum dikonfigurasi.\n\n" +
        `ANALYTICS_ACCOUNT_ID: ${have("ANALYTICS_ACCOUNT_ID")}\n` +
        `ANALYTICS_READ_TOKEN: ${have("ANALYTICS_READ_TOKEN")}\n` +
        `PDP_ANALYTICS (binding): ${have("PDP_ANALYTICS")}\n\n` +
        "Tambahkan yang belum ada pada proyek Pages (Settings → Variables and Secrets\n" +
        "/ Bindings) sebagai SECRET, lalu buat deployment baru.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const url = new URL(request.url);

  // The ticker's 45s poll — a fragment, never a full dashboard render.
  if (url.searchParams.has("tick")) {
    let rows = [], err = null;
    try { rows = await sql(env, latestQuery); } catch (e) { err = e.message; }
    return new Response(tickerPanel(rows, err), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const store = env.PDP_STORE ?? null; // KV archive written by workers/analytics-cron

  // ?week=YYYY-MM-DD — drill into one archived KV rollup.
  const week = url.searchParams.get("week");
  if (week !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return new Response("Bad week", { status: 400 });
    const rollup = store ? await store.get(`rollup:${week}`, "json") : null;
    return weekPage(week, rollup);
  }

  const rawDays = url.searchParams.get("days") ?? "";
  const allTime = rawDays === "all";
  // 'all' = full KV history + live SQL capped at AE's ~90-day ceiling.
  const days = allTime ? 90 : [7, 30, 90].includes(Number(rawDays)) ? Number(rawDays) : 7;
  const chartDays = Math.max(days, 30);
  const since = (d) => `timestamp >= NOW() - INTERVAL '${d}' DAY`;

  let totals, prevTotals, sum7, last24, byDay, byPath, byPlace, byDevice, byLang, byMap, latest, arrivals, byEvent;
  let sqlError = null;
  try {
    [totals, prevTotals, sum7, last24, byDay, byPath, byPlace, byDevice, byLang, byMap, latest, arrivals, byEvent] = await Promise.all([
      sql(env, `SELECT SUM(_sample_interval) AS total FROM ${DATASET} WHERE ${since(days)}`),
      sql(env, `SELECT SUM(_sample_interval) AS total FROM ${DATASET}
        WHERE ${since(days * 2)} AND timestamp < NOW() - INTERVAL '${days}' DAY`),
      sql(env, `SELECT SUM(_sample_interval) AS total FROM ${DATASET} WHERE ${since(7)}`),
      sql(env, `SELECT SUM(_sample_interval) AS total FROM ${DATASET} WHERE ${since(1)}`),
      sql(env, `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, SUM(_sample_interval) AS total
        FROM ${DATASET} WHERE ${since(chartDays)} GROUP BY day ORDER BY day ASC`),
      sql(env, `SELECT blob2 AS path, SUM(_sample_interval) AS total
        FROM ${DATASET} WHERE ${since(days)} GROUP BY path ORDER BY total DESC LIMIT 20`),
      sql(env, `SELECT blob3 AS country, blob4 AS region, blob5 AS city, SUM(_sample_interval) AS total
        FROM ${DATASET} WHERE ${since(days)} GROUP BY country, region, city ORDER BY total DESC LIMIT 300`),
      sql(env, `SELECT blob6 AS k, SUM(_sample_interval) AS total
        FROM ${DATASET} WHERE ${since(days)} GROUP BY k ORDER BY total DESC`),
      sql(env, `SELECT blob7 AS k, SUM(_sample_interval) AS total
        FROM ${DATASET} WHERE ${since(days)} GROUP BY k ORDER BY total DESC LIMIT 6`),
      sql(env, `SELECT blob3 AS country, blob4 AS region, blob5 AS city, blob9 AS lat, blob10 AS lon,
          SUM(_sample_interval) AS total
        FROM ${DATASET} WHERE ${since(days)} AND blob9 != ''
        GROUP BY country, region, city, lat, lon ORDER BY total DESC LIMIT 300`),
      sql(env, latestQuery),
      sql(env, `SELECT blob3 AS country, blob4 AS region, blob5 AS city,
          MIN(timestamp) AS first, SUM(_sample_interval) AS total
        FROM ${DATASET} WHERE ${since(90)}
        GROUP BY country, region, city ORDER BY first ASC LIMIT 2000`),
      sql(env, `SELECT blob1 AS k, SUM(_sample_interval) AS total
        FROM ${DATASET} WHERE ${since(days)} GROUP BY k ORDER BY total DESC`),
    ]);
  } catch (error) {
    sqlError = error.message;
    totals = prevTotals = sum7 = last24 = [];
    byDay = byPath = byPlace = byDevice = byLang = byMap = latest = arrivals = byEvent = [];
  }

  const total = Number(totals?.[0]?.total ?? 0);
  const prev = Number(prevTotals?.[0]?.total ?? 0);
  const maxDay = Math.max(1, ...byDay.map((r) => Number(r.total)));
  const countrySet = new Set(byPlace.map((r) => r.country).filter((c) => /^[A-Z]{2}$/.test(c)));

  const delta = prev > 0
    ? `${total >= prev ? "+" : "−"}${Math.abs(Math.round(((total - prev) / prev) * 100))}% vs ${days} hari sebelumnya`
    : "jendela sebelumnya kosong";

  /* -- map points: rows with Cloudflare's city-centroid coordinates -- */
  const points = byMap
    .filter((r) => coord(r.lat) && coord(r.lon))
    .map((r) => ({
      lat: Number(r.lat), lon: Number(r.lon),
      city: r.city || "", region: r.region || "", country: countryName(r.country) || "",
      total: Number(r.total),
    }));
  // User-influenced place names must never close the JSON script tag.
  const mapData = JSON.stringify(points).replace(/</g, "\\u003c");

  /* -- beacon health, computed live (no KV tier here, unlike hop) -- */
  const h24 = Number(last24?.[0]?.total ?? 0);
  const avg7 = Number(sum7?.[0]?.total ?? 0) / 7;
  const health = avg7 < 1
    ? { cls: "quiet", ic: "·", text: "Beacon baru mulai: belum cukup data untuk rata-rata 7 hari." }
    : h24 === 0
      ? { cls: "bad", ic: "✕", text: `Beacon senyap: nol kunjungan dalam 24 jam terakhir (rata-rata ${num(Math.round(avg7))}/hari).` }
      : h24 < avg7 * 0.4
        ? { cls: "warn", ic: "!", text: `Beacon menurun: hanya ${num(h24)} kunjungan dalam 24 jam, dari rata-rata ${num(Math.round(avg7))}/hari.` }
        : { cls: "ok", ic: "✓", text: `Beacon sehat: ${num(h24)} kunjungan dalam 24 jam terakhir (rata-rata 7 hari: ${num(Math.round(avg7))}/hari).` };

  /* -- newest place reached (fixed 90-day window, like hop) -- */
  const places = (arrivals ?? [])
    .filter((r) => /^[A-Z]{2}$/.test(r.country || "") && r.city)
    .sort((a, b) => (String(a.first) < String(b.first) ? -1 : 1));
  let newestPanel = "";
  if (places.length >= 2) {
    const newest = places.at(-1);
    const countryFirst = new Map();
    for (const p of places) if (!countryFirst.has(p.country)) countryFirst.set(p.country, p.first);
    const newCountry = countryFirst.get(newest.country) === newest.first;
    const countryNo = [...countryFirst.keys()].indexOf(newest.country) + 1;
    const dayNo = Math.max(1, Math.floor((utcOf(newest.first) - utcOf(`${LAUNCH_DAY} 00:00:00`)) / 86400000) + 1);
    const where = [newest.region, countryName(newest.country)].filter((v) => v && v !== "—").join(", ");
    const trail = places.slice(-9, -1).reverse();
    newestPanel = `<section class="card np">
      <h2>Tempat baru terjangkau</h2>
      <div class="np-hero">
        ${flagOf(newest.country)}
        <span class="np-city">${esc(newest.city)}</span>
        <span class="np-where">${esc(where)}</span>
        ${newCountry ? `<span class="np-badge">pembaca pertama dari ${esc(countryName(newest.country))}</span>` : ""}
      </div>
      <p class="np-meta">Kunjungan pertama ${esc(prettyDay(newest.first))} pukul ${esc(wibClock(newest.first))} WIB
        (${esc(ago(newest.first))}) · hari ke-${num(dayNo)} sejak beacon ·
        kota #${num(places.length)} · negara #${num(countryNo)} ·
        ${num(newest.total)} kunjungan sejak tiba</p>
      <h3>Kedatangan sebelum ${esc(newest.city)}</h3>
      <table><thead><tr><th>Tempat</th><th>Wilayah</th><th>Kunjungan pertama (WIB)</th><th class="n">Sejak itu</th></tr></thead>
      <tbody>${trail.map((p) => `<tr>
        <td>${flagOf(p.country)}${esc(p.city)}, ${esc(countryName(p.country))}</td>
        <td>${esc(p.region || "—")}</td>
        <td>${esc(wibStamp(p.first))}</td>
        <td class="n">${num(p.total)}</td></tr>`).join("")}</tbody></table>
      <p class="note">Jendela tetap 90 hari (seluruh ingatan Analytics Engine), apa pun filter di atas; tempat "baru" berarti tanpa kunjungan lebih awal dalam jendela itu. Hitungan tersampel; tempat bervolume sangat rendah bisa terhitung kurang.</p>
    </section>`;
  }

  /* -- visitor places: country rows expanding to their cities -- */
  const SHOW = 12;
  const countryMap = new Map();
  for (const r of byPlace) {
    const code = /^[A-Z]{2}$/.test(r.country || "") ? r.country : "??";
    if (!countryMap.has(code)) countryMap.set(code, { code, total: 0, places: [] });
    const c = countryMap.get(code);
    c.total += Number(r.total);
    c.places.push(r);
  }
  const countriesArr = [...countryMap.values()].sort((a, b) => b.total - a.total);
  const countryTotal = countriesArr.reduce((s, c) => s + c.total, 0);
  const pct1 = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1).replace(/\.0$/, "")}%` : "—");
  const extraC = Math.max(0, countriesArr.length - SHOW);
  const vcRow = (c, i) => `<details class="vc${extraC && i >= SHOW ? " xtra" : ""}">
    <summary>
      ${flagOf(c.code)}
      <span class="vc-name">${esc(c.code === "??" ? "Tak dikenal" : countryName(c.code))}</span>
      <span class="vc-bar"><i style="width:${Math.max(1, (c.total / countryTotal) * 100).toFixed(1)}%"></i></span>
      <span class="vc-pct">${pct1(c.total, countryTotal)}</span>
      <span class="vc-n">${num(c.total)}</span>
      <span class="vc-chev" aria-hidden="true">›</span>
    </summary>
    <table class="vc-sub"><thead><tr><th>Kota</th><th>Wilayah</th><th class="n">Kunjungan</th></tr></thead>
    <tbody>${c.places.map((p) => `<tr>
      <td>${esc(p.city || "—")}</td><td>${esc(p.region || "—")}</td>
      <td class="n">${num(p.total)}</td></tr>`).join("")}</tbody></table>
  </details>`;
  const visitorPanel = `<section class="card">
    <h2>Tempat pembaca</h2>
    <p class="note">Menurut negara; pilih negara untuk kota dan wilayahnya. Tempat bervolume rendah bisa terhitung kurang karena sampling.</p>
    ${countriesArr.length
      ? (extraC
        ? `<input type="checkbox" id="xt-places" class="xtoggle">
           <div class="vclist">${countriesArr.map(vcRow).join("")}</div>
           <p class="empty xmore"><label for="xt-places"><span class="more">…dan ${extraC} lagi: tampilkan semua</span><span class="less">tampilkan lebih sedikit</span></label></p>`
        : `<div class="vclist">${countriesArr.map(vcRow).join("")}</div>`)
      : '<p class="empty">Belum ada data pada jendela ini.</p>'}
  </section>`;

  /* -- small builders -- */
  const table = (title, head, rows, note = "") => `
    <section class="card"><h2>${esc(title)}</h2>
    ${rows.length
      ? `<table><thead><tr>${head.map((h, i) => `<th${i > 0 ? ' class="n"' : ""}>${esc(h)}</th>`).join("")}</tr></thead>
         <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i > 0 ? ' class="n"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      : '<p class="empty">Belum ada data pada jendela ini.</p>'}
    ${note ? `<p class="note">${note}</p>` : ""}</section>`;

  const shareRow = (rows) => {
    const entries = (rows ?? []).map((r) => [r.k || "(kosong)", Number(r.total)]).filter(([, n]) => n > 0);
    const sum = entries.reduce((s, [, n]) => s + n, 0);
    if (!sum) return '<p class="empty">Belum ada data.</p>';
    return `<div class="sbar">${entries.map(([k, n], i) =>
      `<span class="sseg c${i % 5}" style="flex:${n}" title="${esc(k)}: ${num(n)}">${n / sum >= 0.14 ? `${Math.round((n / sum) * 100)}%` : ""}</span>`).join("")}</div>
      <div class="slegend">${entries.map(([k, n], i) => `<span><i class="sw c${i % 5}"></i>${esc(k)} ${num(n)}</span>`).join(" ")}</div>`;
  };

  /* -- permanent memory: the KV archive (weekly rollups, never expire) -- */
  let digest = null, kvError = null;
  if (store) {
    try { digest = await store.get("digest:latest", "json"); } catch (e) { kvError = e.message; }
  }
  const weeks = digest?.weeks ?? [];
  const lastEnd = weeks.at(-1)?.end ?? null;
  const maxWeek = Math.max(1, ...weeks.map((w) => Number(w.events)));

  // All-time figures: every archived week + live events since the last
  // rollup's exclusive end (no overlap, no double count).
  let allTimeBlock = "";
  if (allTime) {
    let liveEvents = total;
    try {
      if (lastEnd) {
        const r = await sql(env, `SELECT SUM(_sample_interval) AS total FROM ${DATASET}
          WHERE timestamp >= toDateTime('${lastEnd} 00:00:00')`);
        liveEvents = Number(r?.[0]?.total ?? 0);
      }
    } catch { /* keep the 90-day figure */ }
    const weekSum = weeks.reduce((s, w) => s + Number(w.events), 0);
    const allCountries = new Set([...countrySet]);
    weeks.forEach((w) => (w.countries ?? []).forEach((c) => allCountries.add(c)));
    const pathSums = new Map();
    weeks.forEach((w) => (w.topPaths ?? []).forEach(([p, n]) => pathSums.set(p, (pathSums.get(p) || 0) + Number(n))));
    const allPaths = [...pathSums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    allTimeBlock = `
  <div class="tiles">
    <div class="tile"><div class="lbl">Kunjungan, sepanjang waktu</div><div class="val">${num(weekSum + liveEvents)}</div><div class="sub">${weeks.length ? `${num(weeks.length)} pekan terarsip + live sejak ${esc(lastEnd)}` : "hanya jendela live 90 hari (belum ada arsip)"}</div></div>
    <div class="tile"><div class="lbl">Negara, sepanjang waktu</div><div class="val">${num(allCountries.size)}</div><div class="sub">gabungan arsip + jendela live</div></div>
    <div class="tile"><div class="lbl">Pekan terarsip</div><div class="val">${num(weeks.length)}</div><div class="sub">rollup KV, tak pernah kedaluwarsa</div></div>
  </div>
  ${allPaths.length ? `<section class="card"><h2>Halaman teratas · sepanjang waktu</h2>
    <table><thead><tr><th>Halaman</th><th class="n">Kunjungan</th></tr></thead>
    <tbody>${allPaths.map(([p, n]) => `<tr><td><span title="${esc(p)}">${esc(pageName(p))}</span></td><td class="n">${num(n)}</td></tr>`).join("")}</tbody></table>
    <p class="note">Dijumlah dari 5 halaman teratas tiap rollup mingguan; sinyal kuat, bukan peringkat persis ekor panjang.</p>
  </section>` : ""}`;
  }

  // Weekly history card — always present so the archive's state is visible.
  const weeklyCard = !store
    ? `<section class="card"><h2>Arsip mingguan (tak lekang)</h2>
        <p class="empty">Belum aktif: tambahkan binding KV <code>PDP_STORE</code> → namespace <code>pdp_analytics_store</code> pada proyek Pages (Settings → Bindings), lalu buat deployment baru.</p></section>`
    : kvError
      ? `<section class="card"><h2>Arsip mingguan (tak lekang)</h2><p class="empty">KV gagal dibaca: ${esc(kvError)}</p></section>`
      : weeks.length
        ? `<section class="card"><h2>Arsip mingguan (tak lekang)</h2>
            <div class="chart" style="height:80px">
              ${weeks.slice(allTime ? 0 : -26).map((w) => `<div class="col" tabindex="0">
                <span class="tip">${esc(w.start)} → ${esc(w.end)} · ${num(w.events)} kunjungan</span>
                <div class="bar ${Number(w.events) === 0 ? "zero" : ""}" style="height:${Math.max(1, Math.round((Number(w.events) / maxWeek) * 100))}%"></div>
              </div>`).join("")}
            </div>
            <table><thead><tr><th>Pekan berakhir</th><th class="n">Kunjungan</th><th class="n">Dari aplikasi</th><th>Halaman teratas</th></tr></thead><tbody>
              ${[...weeks].reverse().slice(0, allTime ? weeks.length : 12).map((w) => `<tr>
                <td><a href="/admin?week=${esc(w.end)}">${esc(w.end)}</a></td>
                <td class="n">${num(w.events)}</td>
                <td class="n">${num(w.byEvent?.pwa ?? 0)}</td>
                <td>${esc(pageName(w.topPaths?.[0]?.[0] ?? "") || "—")}</td></tr>`).join("")}
            </tbody></table>
            ${!allTime && weeks.length > 12 ? `<p class="empty">…dan ${num(weeks.length - 12)} pekan lebih awal: <a href="/admin?days=all">lihat semua</a>, atau pilih pekan untuk rinciannya.</p>` : ""}
          </section>`
        : `<section class="card"><h2>Arsip mingguan (tak lekang)</h2>
            <p class="empty">Binding aktif, belum ada rollup; cron menulis tiap Minggu 20.00 UTC (Senin 03.00 WIB). Sampai itu, jendela live 7/30/90 hari di atas mencakup semuanya.</p></section>`;

  /* -- visit sources: browser vs installed app, plus Android installs -- */
  const SOURCE_LABELS = { view: "peramban", pwa: "aplikasi terpasang" };
  const sources = (byEvent ?? [])
    .filter((r) => r.k !== "install")
    .map((r) => ({ k: SOURCE_LABELS[r.k] ?? r.k, total: r.total }));
  const installs = Number((byEvent ?? []).find((r) => r.k === "install")?.total ?? 0);

  const ranges = [[7, "7 hari"], [30, "30 hari"], [90, "90 hari"], ["all", "Semua"]];
  const current = allTime ? "all" : days;

  const body = `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin · Panduan Pengakuan Dosa</title>
<meta name="description" content="Dasbor agregat anonim · Panduan Pengakuan Dosa.">
<link rel="icon" href="/admin-favicon.svg" type="image/svg+xml">
<meta property="og:title" content="Admin · Panduan Pengakuan Dosa">
<meta property="og:description" content="Dasbor agregat anonim: kunjungan halaman, tempat, dan peta pembaca.">
<meta property="og:type" content="website">
<meta property="og:image" content="https://panduan-pengakuan-dosa.pages.dev/og-admin-1200x630.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="/vendor/leaflet/leaflet.css">
<script src="/vendor/leaflet/leaflet.js"></script>
<style>
  :root {
    --bg:#F9F5EA; --bg-raised:#FFFDF6; --ink:#16130D; --ink-soft:#57503F;
    --red:#A81A1A; --blue:#25478C; --gold:#8A6D2F; --rule:#DFD5BE;
    --ok-bg: color-mix(in srgb, #3E6B52 12%, var(--bg));
    --warn-bg: color-mix(in srgb, var(--gold) 18%, var(--bg));
    --bad-bg: color-mix(in srgb, var(--red) 12%, var(--bg));
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:#100E0A; --bg-raised:#1A1712; --ink:#F4EEDE; --ink-soft:#A0957F;
      --red:#E56B5C; --blue:#7C97CE; --gold:#C8A85C; --rule:#272219;
      --ok-bg: color-mix(in srgb, #3E6B52 20%, var(--bg));
      --warn-bg: color-mix(in srgb, var(--gold) 14%, var(--bg));
      --bad-bg: color-mix(in srgb, var(--red) 16%, var(--bg));
    }
  }
  * { box-sizing: border-box; }
  html, body { overflow-x: hidden; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font: 16px/1.5 Georgia, "Iowan Old Style", serif; padding: 1.2rem 1rem 4rem; }
  .wrap { max-width: 1120px; margin: 0 auto; }
  svg, img { max-width: 100%; }
  a { color: var(--blue); }
  header { text-align: center; margin: 0.8rem 0 1.4rem; }
  header .cross { color: var(--red); letter-spacing: 0.35em; font-size: 1.1rem; }
  h1 { font-weight: 500; font-variant: small-caps; letter-spacing: 0.1em; font-size: 1.7rem; margin: 0.3rem 0 0.1rem; }
  h1 a { color: inherit; text-decoration: none; }
  h1 a:hover { color: var(--red); }
  header p { margin: 0; font-style: italic; color: var(--ink-soft); font-size: 0.9rem; }

  .filters { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: baseline; margin: 0 0 1rem; }
  .filters a { text-decoration: none; border: 1px solid var(--rule); border-radius: 999px;
    padding: 0.25rem 0.9rem; color: var(--ink-soft); font-variant: small-caps; font-size: 0.9rem; }
  .filters a.on { border-color: var(--gold); color: var(--red); background: var(--bg-raised); }
  .filters a:hover { border-color: var(--gold); color: var(--ink); }
  .fnote { font-size: 0.78rem; font-style: italic; color: var(--ink-soft); margin-left: 0.4rem; }
  @media (max-width: 460px) { .fnote { flex-basis: 100%; margin: 0.1rem 0 0; } }

  .banner { display: flex; gap: 0.6rem; align-items: baseline; flex-wrap: wrap;
    border: 1px solid var(--rule); border-radius: 6px; padding: 0.7rem 1rem; margin: 0 0 1rem; font-size: 0.95rem; }
  .banner .ic { font-weight: 700; }
  .banner.ok { background: var(--ok-bg); border-color: #3E6B52; } .banner.ok .ic { color: #3E6B52; }
  .banner.warn { background: var(--warn-bg); border-color: var(--gold); } .banner.warn .ic { color: var(--gold); }
  .banner.bad { background: var(--bad-bg); border-color: var(--red); } .banner.bad .ic { color: var(--red); }
  .banner.quiet { background: var(--bg-raised); color: var(--ink-soft); }

  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(165px, 1fr)); gap: 0.7rem; margin-bottom: 1rem; }
  .tile { border: 1px solid var(--rule); border-radius: 6px; background: var(--bg-raised); padding: 0.8rem 1rem; }
  .tile .lbl { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.09em; color: var(--red); }
  .tile .val { font-variant-numeric: lining-nums tabular-nums; font-weight: 600; font-size: 1.8rem; margin: 0.15rem 0 0.1rem; line-height: 1.1; }
  .tile .sub { font-size: 0.78rem; font-style: italic; color: var(--ink-soft); }

  .card { border: 1px solid var(--rule); border-radius: 6px; background: var(--bg-raised);
    padding: 1rem 1.2rem 1.1rem; margin-bottom: 1rem; }
  .card h2 { margin: 0 0 0.7rem; font-size: 0.95rem; font-weight: 500;
    font-variant: small-caps; letter-spacing: 0.1em; color: var(--red); }
  .note { font-size: 0.78rem; font-style: italic; color: var(--ink-soft); margin: 0.4rem 0 0.6rem; }
  .empty { font-style: italic; color: var(--ink-soft); font-size: 0.9rem; margin: 0.2rem 0; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 0.85em; }
  .err { background: var(--bg-raised); border: 1px solid var(--red); border-radius: 6px;
    padding: 0.7rem 1rem; color: var(--red); font-size: 0.85rem; margin: 0 0 1rem; }

  /* latest-access tape */
  #latest-panel h2 { display: flex; align-items: center; gap: 0.5rem; }
  .live-dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--red);
    animation: livepulse 2s ease-out infinite; }
  @keyframes livepulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--red) 55%, transparent); }
    70% { box-shadow: 0 0 0 0.35rem transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
  .live-note { font-size: 0.62rem; font-variant: normal; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--ink-soft); font-weight: 400; }
  .ticker { overflow: hidden; white-space: nowrap; position: relative;
    border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); padding: 0.5rem 0;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent); }
  .ticker-track { display: inline-flex; white-space: nowrap; will-change: transform;
    animation-name: tickerscroll; animation-timing-function: linear; animation-iteration-count: infinite; }
  @media (hover: hover) { .ticker:hover .ticker-track { animation-play-state: paused; } }
  .ticker-copy { display: inline-flex; }
  @keyframes tickerscroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .tick { display: inline-flex; align-items: baseline; gap: 0.5rem; padding: 0 1.1rem;
    border-right: 1px solid color-mix(in srgb, var(--rule) 60%, transparent); font-size: 0.86rem; }
  .tick-t { font-family: ui-monospace, Menlo, monospace; font-size: 0.8rem;
    font-variant-numeric: tabular-nums; color: var(--red); }
  .tick-p { font-weight: 600; }
  .tick-e { font-family: ui-monospace, Menlo, monospace; font-size: 0.78rem; color: var(--ink-soft); }
  @media (prefers-reduced-motion: reduce) {
    .live-dot { animation: none; }
    /* a frozen tape reads as broken and never fires the ?tick swap seam —
       keep it drifting, far slower than the marquee */
    .ticker-track { animation-duration: 60s !important; }
  }

  .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; align-items: start; margin-bottom: 1rem; }
  .grid2 .card { margin-bottom: 0; }

  table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
  th { text-align: left; font-weight: 500; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em;
    color: var(--ink-soft); padding: 0.2rem 0.4rem; border-bottom: 1px solid var(--rule); white-space: nowrap; }
  th.n, td.n { text-align: right; }
  td { padding: 0.3rem 0.4rem; border-bottom: 1px solid color-mix(in srgb, var(--rule) 55%, transparent); }
  td.n { font-family: system-ui, sans-serif; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr:last-child td { border-bottom: none; }
  .card table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .card table thead, .card table tbody { display: table; width: 100%; min-width: max-content; }

  /* CSS-only "show all" toggle */
  .xtoggle { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }
  .xtoggle:not(:checked) ~ .vclist .xtra { display: none; }
  .xtoggle:checked ~ .vclist { max-height: 26rem; overflow-y: auto; }
  .xtoggle:not(:checked) ~ .xmore .less { display: none; }
  .xtoggle:checked ~ .xmore .more { display: none; }
  .xmore label { cursor: pointer; color: var(--blue); text-decoration: underline; text-underline-offset: 2px; }

  /* country-grouped visitor panel */
  .flag { font-size: 1.1rem; flex: none; }
  .flag-x { display: inline-block; width: 1.1rem; height: 1.1rem; border-radius: 50%;
    background: color-mix(in srgb, var(--rule) 45%, transparent); }
  .vc { border-bottom: 1px solid color-mix(in srgb, var(--rule) 55%, transparent); }
  .vc:last-of-type { border-bottom: none; }
  .vc summary { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.1rem;
    cursor: pointer; list-style: none; }
  .vc summary::-webkit-details-marker { display: none; }
  .vc summary:hover .vc-name { color: var(--red); }
  .vc-name { font-weight: 600; flex: none; width: 10em; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; }
  .vc-bar { flex: 1; height: 8px; border-radius: 4px; overflow: hidden;
    background: color-mix(in srgb, var(--rule) 45%, transparent); }
  .vc-bar i { display: block; height: 100%; background: var(--blue); border-radius: 4px; }
  .vc-pct { font-family: system-ui, sans-serif; font-variant-numeric: tabular-nums;
    font-size: 0.85rem; min-width: 3.4em; text-align: right; }
  .vc-n { font-family: system-ui, sans-serif; font-variant-numeric: tabular-nums;
    font-size: 0.75rem; color: var(--ink-soft); min-width: 3.2em; text-align: right; }
  .vc-chev { color: var(--ink-soft); flex: none; transition: transform 0.15s ease; }
  .vc[open] .vc-chev { transform: rotate(90deg); }
  .vc .vc-sub { margin: 0.1rem 0 0.6rem 2rem; width: calc(100% - 2rem); font-size: 0.84rem; }
  @media (max-width: 560px) {
    .vc-name { width: 7.5em; }
    .vc-n { display: none; }
    .vc .vc-sub { margin-left: 0.5rem; width: calc(100% - 0.5rem); }
  }

  /* newest place */
  .np-hero { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; margin: 0.35rem 0 0.15rem; }
  .np-hero .flag { font-size: 1.7rem; }
  .np-city { font-size: 1.9rem; font-weight: 600; line-height: 1.1; }
  .np-where { font-size: 1.05rem; font-style: italic; color: var(--ink-soft); }
  .np-badge { border: 1px solid var(--gold); color: var(--red); border-radius: 999px;
    padding: 0.16rem 0.7rem; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; white-space: nowrap; }
  .np-meta { margin: 0.15rem 0 0.9rem; font-size: 0.86rem; color: var(--ink-soft); }
  .np h3 { margin: 1.2rem 0 0.4rem; font-size: 0.78rem; text-transform: uppercase;
    letter-spacing: 0.09em; color: var(--ink-soft); }
  .np td .flag { font-size: 0.95rem; margin-right: 0.35rem; }

  /* chart */
  .chart { display: flex; gap: 2px; align-items: flex-end; height: 180px; padding: 0.4rem 0 0; position: relative; }
  .chart .grid-line { position: absolute; left: 0; right: 0; border-top: 1px solid color-mix(in srgb, var(--rule) 60%, transparent); }
  .col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; height: 100%; position: relative; }
  .col .bar { background: var(--blue); border-radius: 4px 4px 0 0; min-height: 2px; margin: 0 auto; width: min(24px, 88%); }
  .col .bar.zero { background: transparent; border-bottom: 2px solid var(--rule); border-radius: 0; }
  .col:hover .bar { filter: brightness(1.12); }
  .col .tip { display: none; position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%);
    background: var(--ink); color: var(--bg); font-family: system-ui, sans-serif; font-size: 0.72rem;
    padding: 0.25rem 0.55rem; border-radius: 4px; white-space: nowrap; z-index: 5; }
  .col:hover .tip, .col:focus-within .tip { display: block; }
  .col .top-lbl { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
    font-family: system-ui, sans-serif; font-size: 0.72rem; color: var(--ink-soft); padding-bottom: 2px; }
  .xlabels { display: flex; gap: 2px; margin-top: 0.4rem; }
  .xlabels span { flex: 1; text-align: center; font-family: system-ui, sans-serif; font-size: 0.66rem; color: var(--ink-soft); }

  /* map */
  .map { width: 100%; height: clamp(360px, 52vw, 580px); background: var(--bg); z-index: 0; border-radius: 4px; }
  .leaflet-container { font-family: system-ui, sans-serif; }
  .leaflet-control-attribution { font-size: 0.6rem; }
  /* visitor count riding on each circle — a bare number, no tooltip chrome */
  .count-label { background: transparent; border: none; box-shadow: none; padding: 0;
    color: #fff; font-family: system-ui, sans-serif; font-size: 10px; font-weight: 700;
    text-shadow: 0 1px 2px rgba(0,0,0,0.65), 0 0 3px rgba(0,0,0,0.5); pointer-events: none; }
  .count-label::before { display: none; }
  @media (max-width: 560px) { .map { height: 400px; } }

  /* share bars */
  .shares { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 1rem 1.6rem; }
  .share h3 { margin: 0 0 0.4rem; font-size: 0.78rem; font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.09em; color: var(--ink-soft); }
  .sbar { display: flex; gap: 2px; height: 22px; border-radius: 4px; overflow: hidden; }
  .sseg { display: flex; align-items: center; justify-content: center; color: #fff;
    font-family: system-ui, sans-serif; font-size: 0.68rem; min-width: 3px; }
  .sseg.c0, .sw.c0 { background: var(--blue); } .sseg.c1, .sw.c1 { background: var(--red); }
  .sseg.c2, .sw.c2 { background: #3E6B52; } .sseg.c3, .sw.c3 { background: var(--gold); }
  .sseg.c4, .sw.c4 { background: #57503F; }
  .slegend { display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; margin-top: 0.35rem;
    font-size: 0.75rem; color: var(--ink-soft); font-family: system-ui, sans-serif; }
  .sw { width: 9px; height: 9px; border-radius: 2px; display: inline-block; margin-right: 0.3em; }

  footer { text-align: center; margin-top: 2rem; font-size: 0.8rem; font-style: italic; color: var(--ink-soft); }
  footer .cross { color: var(--red); }

  @media (max-width: 560px) {
    body { padding: 0.8rem 0.7rem 3rem; }
    h1 { font-size: 1.35rem; }
    .card { padding: 0.9rem 0.8rem 1rem; }
    .tile .val { font-size: 1.55rem; }
  }
  @media print {
    body { background: #fff; color: #222; padding: 0.5rem; }
    .filters, .live-note, .live-dot, .xmore, .leaflet-control-container { display: none; }
    .ticker-track { animation: none; }
    .card, .tile { break-inside: avoid; }
  }
</style></head><body><div class="wrap">
  <header>
    <div class="cross">✠</div>
    <h1><a href="/">Panduan Pengakuan Dosa</a> · Analitik</h1>
    <p>${allTime ? "sepanjang waktu (panel live dibatasi 90 hari)" : `jendela live: ${days} hari terakhir`} · waktu dalam WIB · <a href="/">ke situs</a></p>
  </header>

  <nav class="filters">${ranges.map(([v, label]) =>
    `<a href="/admin?days=${v}" class="${v === current ? "on" : ""}">${label}</a>`).join("")}
    <span class="fnote">${allTime
      ? "panel live menampilkan 90 hari terakhir; bagian sepanjang-waktu di bawah mencakup seluruh arsip mingguan"
      : "Analytics Engine menyimpan ±90 hari; angka adalah perkiraan tersampel."}</span></nav>

  ${sqlError ? `<div class="err">Kueri gagal: ${esc(sqlError)}</div>` : ""}

  ${tickerPanel(latest)}

  <div class="banner ${health.cls}"><span class="ic">${health.ic}</span> ${health.text}</div>

  <div class="tiles">
    <div class="tile"><div class="lbl">Kunjungan, ${days} hari</div><div class="val">${num(total)}</div><div class="sub">${esc(delta)}</div></div>
    <div class="tile"><div class="lbl">Halaman dibuka</div><div class="val">${num(byPath.length)}</div><div class="sub">halaman berbeda</div></div>
    <div class="tile"><div class="lbl">Tempat</div><div class="val">${num(byPlace.length)}</div><div class="sub">kelompok kota</div></div>
    <div class="tile"><div class="lbl">Negara</div><div class="val">${num(countrySet.size)}</div><div class="sub">terjangkau dalam ${days} hari</div></div>
  </div>

  ${allTimeBlock}

  ${newestPanel}

  <section class="card">
    <h2>Peta pembaca · ${num(points.length)} tempat, ${days} hari terakhir</h2>
    ${points.length
      ? `<div id="map" class="map" role="region" aria-label="Peta interaktif kota pembaca"></div>
         <script type="application/json" id="map-data">${mapData}</script>`
      : '<p class="empty">Belum ada titik: koordinat baru dicatat sejak fitur peta dipasang; kunjungan lama hanya tampil pada panel Tempat.</p>'}
    <p class="note">Gulir/cubit untuk zoom, seret untuk geser; pilih lingkaran untuk tempat dan jumlahnya. Titik adalah sentroid kota dari jaringan Cloudflare, bukan lokasi persis siapa pun.</p>
  </section>

  <section class="card">
    <h2>Kunjungan per hari · ${chartDays} hari terakhir</h2>
    <div class="chart">
      ${[0.25, 0.5, 0.75].map((f) => `<div class="grid-line" style="bottom:${f * 100}%"></div>`).join("")}
      ${byDay.map((r) => {
        const n = Number(r.total);
        const day = String(r.day).slice(0, 10);
        return `<div class="col" tabindex="0">
          ${n === maxDay && n > 0 ? `<span class="top-lbl">${num(n)}</span>` : ""}
          <span class="tip">${esc(day)} · ${num(n)} kunjungan</span>
          <div class="bar ${n === 0 ? "zero" : ""}" style="height:${Math.max(1, Math.round((n / maxDay) * 100))}%"></div>
        </div>`;
      }).join("") || '<p class="empty">Belum ada data.</p>'}
    </div>
    <div class="xlabels">${byDay.map((r, i) => `<span>${i % Math.ceil(chartDays / 12) === 0 ? esc(String(r.day).slice(5, 10)) : ""}</span>`).join("")}</div>
  </section>

  <div class="grid2">
    ${table("Halaman", ["Halaman", "Kunjungan"],
      byPath.map((r) => [`<span title="${esc(r.path)}">${esc(pageName(r.path))}</span>`, num(r.total)]))}
    ${visitorPanel}
  </div>

  <section class="card">
    <h2>Pembaca · ${days} hari</h2>
    <div class="shares">
      <div class="share"><h3>Sumber kunjungan</h3>${shareRow(sources)}</div>
      <div class="share"><h3>Perangkat</h3>${shareRow(byDevice)}</div>
      <div class="share"><h3>Bahasa peramban</h3>${shareRow(byLang)}</div>
    </div>
    <p class="note">"Aplikasi terpasang" = dibuka dari ikon layar utama (terdeteksi di iPhone maupun Android).
      Pemasangan tercatat: ${num(installs)}; momen pemasangan hanya dapat dideteksi di Android; iPhone tidak pernah mengumumkannya, jadi angka sebenarnya lebih tinggi.</p>
  </section>

  ${weeklyCard}

  <footer><span class="cross">✠</span> Dibuat ${esc(wibStamp(new Date(Date.now()).toISOString().slice(0, 19).replace("T", " ")))} WIB ·
    beacon menghitung kunjungan halaman saja, tanpa cookie, tanpa identitas; tanda pemeriksaan batin tidak pernah meninggalkan perangkat pembaca.<br>
    Analytics Engine menyimpan ±90 hari; arsip mingguan KV menyimpan selamanya · sejak ${esc(prettyDay(`${weeks[0]?.start ?? LAUNCH_DAY} 00:00:00`))}</footer>
</div>
<script>
/* Leaflet map */
(function () {
  var el = document.getElementById('map');
  var data = document.getElementById('map-data');
  if (!el || !data || !window.L) return;
  var points = JSON.parse(data.textContent);
  var dark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  // Home view: Indonesia, the whole archipelago — the app's audience.
  var HOME = [[-11.2, 94.5], [6.3, 141.5]];
  var map = L.map(el, { minZoom: 2, worldCopyJump: true });
  map.fitBounds(HOME);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/' + (dark ? 'dark_all' : 'light_all') + '/{z}/{x}/{y}{r}.png', {
    maxZoom: 19, subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);
  var ResetControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      var button = L.DomUtil.create('a', '', container);
      button.href = '#';
      button.title = 'Kembali ke tampilan Indonesia';
      button.setAttribute('aria-label', 'Kembali ke tampilan Indonesia');
      button.setAttribute('role', 'button');
      button.innerHTML = '&#8634;';
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(button, 'click', L.DomEvent.preventDefault);
      L.DomEvent.on(button, 'click', function () { map.fitBounds(HOME); });
      return container;
    },
  });
  map.addControl(new ResetControl());
  var max = Math.max(1, ...points.map(function (p) { return p.total; }));
  points.forEach(function (p) {
    var label = [p.city, p.region, p.country].filter(Boolean).join(', ');
    var marker = L.circleMarker([p.lat, p.lon], {
      radius: 7 + 9 * Math.sqrt(p.total / max),
      stroke: false,
      fillColor: dark ? '#E56B5C' : '#A81A1A', fillOpacity: 0.55,
    }).addTo(map);
    // the count sits on the circle itself; place + count on tap/click
    marker.bindTooltip(p.total.toLocaleString('id-ID'),
      { permanent: true, direction: 'center', className: 'count-label' });
    marker.bindPopup('<strong>' + escapeHtml(label) + '</strong><br>' + p.total.toLocaleString('id-ID') + ' kunjungan');
  });
  // The view stays on Indonesia regardless of where points fall — zoom out
  // (or the ↺ control) for the rest of the world.
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
})();

/* Latest-access poll — fetch the ?tick fragment and swap only the tape,
   at the animation seam so the scroll never jumps. */
(function () {
  var EVERY = 45000;
  var pending = null;

  function ticker() { return document.querySelector('#latest-panel .ticker'); }

  function applyPending() {
    if (!pending) return;
    var c = ticker();
    if (c) c.replaceWith(pending);
    pending = null;
  }

  function armApply(next) {
    var cur = ticker();
    if (!cur) return;
    pending = next;
    var track = cur.querySelector('.ticker-track');
    if (!track) { applyPending(); return; }
    track.addEventListener('animationiteration', applyPending, { once: true });
    setTimeout(applyPending, 30000); // reduced motion → the seam may never come
  }

  function refresh() {
    if (document.visibilityState !== 'visible') return;
    var cur = ticker();
    if (!cur) return;
    fetch('/admin?tick', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (html) {
        if (!html) return;
        var next = new DOMParser().parseFromString(html, 'text/html').querySelector('.ticker');
        if (!next) return;
        if (next.dataset.key === cur.dataset.key) return; // no change → touch nothing
        armApply(next);
      })
      .catch(function () {});
  }

  setInterval(refresh, EVERY);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refresh();
  });
})();
</script>
</body></html>`;

  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

/* ------------------------------------------ archived-week drill-down */

const EVENT_LABELS = { view: "Peramban", pwa: "Aplikasi terpasang", install: "Pemasangan (Android)" };

function weekPage(week, rollup) {
  const rows = rollup?.rows ?? [];
  const total = rows.reduce((s, r) => s + Number(r.total), 0);
  const sumBy = (keyOf) => {
    const m = new Map();
    for (const r of rows) {
      const k = keyOf(r);
      if (k) m.set(k, (m.get(k) || 0) + Number(r.total));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const tbl = (title, head, list) => `<section class="card"><h2>${esc(title)}</h2>
    ${list.length
      ? `<table><thead><tr><th>${esc(head)}</th><th class="n">Kunjungan</th></tr></thead>
         <tbody>${list.map(([k, n]) => `<tr><td>${k}</td><td class="n">${num(n)}</td></tr>`).join("")}</tbody></table>`
      : '<p class="empty">Tidak ada data.</p>'}</section>`;

  const content = !rollup
    ? `<section class="card"><h2>rollup:${esc(week)}</h2>
       <p class="empty">Tidak ada rollup dengan kunci ini${rollup === null ? " (atau binding KV PDP_STORE belum aktif)" : ""}. <a href="/admin">Kembali ke dasbor</a>.</p></section>`
    : `<p class="sub">${esc(rollup.start)} → ${esc(rollup.end)} (eksklusif) · ${num(total)} kunjungan · <a href="/admin?days=all">kembali ke dasbor</a></p>
      ${tbl("Sumber", "Sumber", sumBy((r) => r.event).map(([e, n]) => [esc(EVENT_LABELS[e] ?? e), n]))}
      ${tbl("Halaman", "Halaman", sumBy((r) => r.path).slice(0, 15).map(([p, n]) => [`<span title="${esc(p)}">${esc(pageName(p))}</span>`, n]))}
      ${tbl("Tempat", "Tempat", sumBy((r) => (r.city ? `${r.city}|${r.country}` : null)).slice(0, 15)
        .map(([k, n]) => {
          const [city, country] = k.split("|");
          return [`${flagOf(country)}${esc(city)}, ${esc(countryName(country))}`, n];
        }))}
      <footer><span class="cross">✠</span> Rollup KV permanen, tetap ada setelah jendela ±90 hari Analytics Engine berlalu.</footer>`;

  const html = `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Pekan ${esc(week)} · Admin · Panduan Pengakuan Dosa</title>
<link rel="icon" href="/admin-favicon.svg" type="image/svg+xml">
<style>
  :root { --bg:#F9F5EA; --bg-raised:#FFFDF6; --ink:#16130D; --ink-soft:#57503F; --red:#A81A1A; --blue:#25478C; --rule:#DFD5BE; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#100E0A; --bg-raised:#1A1712; --ink:#F4EEDE; --ink-soft:#A0957F; --red:#E56B5C; --blue:#7C97CE; --rule:#272219; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.5 Georgia, serif; padding:1.2rem 1rem 3rem; }
  .wrap { max-width:760px; margin:0 auto; }
  a { color: var(--blue); }
  header { text-align:center; margin:0.8rem 0 1.2rem; }
  header .cross { color:var(--red); letter-spacing:0.35em; }
  h1 { font-weight:500; font-variant:small-caps; letter-spacing:0.1em; font-size:1.4rem; margin:0.3rem 0 0.1rem; }
  .sub { text-align:center; font-style:italic; color:var(--ink-soft); font-size:0.9rem; margin:0 0 1rem; }
  .card { border:1px solid var(--rule); border-radius:6px; background:var(--bg-raised); padding:1rem 1.2rem 1.1rem; margin-bottom:1rem; }
  .card h2 { margin:0 0 0.7rem; font-size:0.95rem; font-weight:500; font-variant:small-caps; letter-spacing:0.1em; color:var(--red); }
  table { width:100%; border-collapse:collapse; font-size:0.88rem; }
  th { text-align:left; font-weight:500; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--ink-soft); padding:0.2rem 0.4rem; border-bottom:1px solid var(--rule); }
  th.n, td.n { text-align:right; }
  td { padding:0.3rem 0.4rem; border-bottom:1px solid color-mix(in srgb, var(--rule) 55%, transparent); }
  td.n { font-family:system-ui, sans-serif; font-variant-numeric:tabular-nums; }
  tr:last-child td { border-bottom:none; }
  .flag { margin-right:0.35rem; }
  .empty { font-style:italic; color:var(--ink-soft); font-size:0.9rem; }
  footer { text-align:center; margin-top:1.6rem; font-size:0.8rem; font-style:italic; color:var(--ink-soft); }
  footer .cross { color:var(--red); }
</style></head><body><div class="wrap">
  <header><div class="cross">✠</div><h1>Pekan arsip · ${esc(week)}</h1></header>
  ${content}
</div></body></html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
