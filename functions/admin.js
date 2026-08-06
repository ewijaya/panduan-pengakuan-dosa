/* Ops dashboard at /admin — scaled-down cousin of hop-web's functions/admin.js.
 *
 * Un-gated but aggregate-only, like the beacon that feeds it: page-open
 * counts by day, page, place, device and language over a selectable window
 * (?days=7|30|90). Nothing here can identify a reader, and the examination
 * marks never reach a server at all — there is nothing sensitive to gate.
 * Carries noindex; reached by link, not search. Live numbers come from the
 * Analytics Engine SQL API over dataset pdp_events (written by
 * functions/api/beacon.js — see the datapoint layout there).
 *
 * Needs two Pages-project secrets:
 *   ANALYTICS_ACCOUNT_ID — Cloudflare account id
 *   ANALYTICS_READ_TOKEN — API token with Account Analytics : Read
 */

const DATASET = "pdp_events";

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

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const num = (n) => Number(n ?? 0).toLocaleString("en-US");
const pageName = (p) => PAGE_NAMES[p] ?? p;

function countryName(code) {
  if (!/^[A-Z]{2}$/.test(code ?? "")) return code || "—";
  try { return new Intl.DisplayNames(["id"], { type: "region" }).of(code) ?? code; } catch { return code; }
}

async function sql(env, query) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.ANALYTICS_ACCOUNT_ID}/analytics_engine/sql`,
    { method: "POST", headers: { Authorization: `Bearer ${env.ANALYTICS_READ_TOKEN}` }, body: `${query} FORMAT JSON` },
  );
  if (!r.ok) throw new Error(`SQL ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return (await r.json()).data ?? [];
}

export async function onRequestGet({ request, env }) {
  if (!env.ANALYTICS_READ_TOKEN || !env.ANALYTICS_ACCOUNT_ID) {
    return new Response(
      "Dashboard belum dikonfigurasi.\n\nTambahkan secret ANALYTICS_ACCOUNT_ID dan ANALYTICS_READ_TOKEN pada proyek Pages\n(Settings → Environment variables), lalu deploy ulang.",
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const url = new URL(request.url);
  const raw = Number(url.searchParams.get("days"));
  const days = [7, 30, 90].includes(raw) ? raw : 7;
  const chartDays = Math.max(days, 30);
  const since = (d) => `timestamp >= NOW() - INTERVAL '${d}' DAY`;

  let totals, byDay, byPath, byCountry, byDevice, byLang, sqlError = null;
  try {
    [totals, byDay, byPath, byCountry, byDevice, byLang] = await Promise.all([
      sql(env, `SELECT SUM(_sample_interval) AS total FROM ${DATASET} WHERE ${since(days)}`),
      sql(env, `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, SUM(_sample_interval) AS total
        FROM ${DATASET} WHERE ${since(chartDays)} GROUP BY day ORDER BY day ASC`),
      sql(env, `SELECT blob2 AS path, SUM(_sample_interval) AS total
        FROM ${DATASET} WHERE ${since(days)} GROUP BY path ORDER BY total DESC LIMIT 20`),
      sql(env, `SELECT blob3 AS country, blob5 AS city, SUM(_sample_interval) AS total
        FROM ${DATASET} WHERE ${since(days)} GROUP BY country, city ORDER BY total DESC LIMIT 25`),
      sql(env, `SELECT blob6 AS k, SUM(_sample_interval) AS total
        FROM ${DATASET} WHERE ${since(days)} GROUP BY k ORDER BY total DESC`),
      sql(env, `SELECT blob7 AS k, SUM(_sample_interval) AS total
        FROM ${DATASET} WHERE ${since(days)} GROUP BY k ORDER BY total DESC LIMIT 6`),
    ]);
  } catch (error) {
    sqlError = error.message;
    totals = []; byDay = []; byPath = []; byCountry = []; byDevice = []; byLang = [];
  }

  const total = Number(totals?.[0]?.total ?? 0);
  const maxDay = Math.max(1, ...byDay.map((r) => Number(r.total)));
  const countries = new Set(byCountry.map((r) => r.country).filter((c) => /^[A-Z]{2}$/.test(c)));

  const table = (title, head, rows, note = "") => `
    <section class="card"><h2>${esc(title)}</h2>
    ${rows.length
      ? `<table><thead><tr>${head.map((h, i) => `<th${i > 0 ? ' class="n"' : ""}>${esc(h)}</th>`).join("")}</tr></thead>
         <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i > 0 ? ' class="n"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`
      : '<p class="empty">Belum ada data pada jendela ini.</p>'}
    ${note ? `<p class="note">${note}</p>` : ""}</section>`;

  const shareRow = (rows) => {
    const sum = rows.reduce((s, r) => s + Number(r.total), 0);
    if (!sum) return '<p class="empty">Belum ada data.</p>';
    return `<div class="sbar">${rows.map((r, i) =>
      `<span class="sseg c${i % 5}" style="flex:${Number(r.total)}" title="${esc(r.k || "(kosong)")} — ${num(r.total)}">${Number(r.total) / sum >= 0.14 ? `${Math.round((Number(r.total) / sum) * 100)}%` : ""}</span>`).join("")}</div>
      <div class="slegend">${rows.map((r, i) => `<span><i class="sw c${i % 5}"></i>${esc(r.k || "(kosong)")} ${num(r.total)}</span>`).join(" ")}</div>`;
  };

  const body = `<!doctype html>
<html lang="id"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin · Panduan Pengakuan Dosa</title>
<style>
  :root { --parchment:#F9F5EA; --leaf:#FFFDF6; --ink:#16130D; --soft:#57503F;
          --rubric:#A81A1A; --versal:#25478C; --edge:#E3DBC8; --rule:#DFD5BE; }
  @media (prefers-color-scheme: dark) {
    :root { --parchment:#100E0A; --leaf:#1A1712; --ink:#F4EEDE; --soft:#A0957F;
            --rubric:#E56B5C; --versal:#93AEE8; --edge:#2C2820; --rule:#272219; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--parchment); color:var(--ink);
         font:15px/1.55 Georgia, "Iowan Old Style", serif; }
  .wrap { max-width: 64rem; margin-inline:auto; padding: 24px 16px 48px; }
  h1 { font-size:1.5rem; margin:0; } h2 { font-size:1.05rem; margin:0 0 10px; }
  .sub, .note, .empty { color:var(--soft); font-size:0.8rem; }
  .filters { margin:16px 0; display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; }
  .filters a { color:var(--soft); text-decoration:none; border:1px solid var(--edge);
               border-radius:3px; padding:4px 10px; font-size:0.8rem; }
  .filters a.on { color:var(--rubric); border-color:var(--rubric); font-weight:600; }
  .tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(160px,1fr)); gap:12px; margin:16px 0; }
  .tile, .card { background:var(--leaf); border:1px solid var(--edge); border-radius:3px; padding:14px 16px; }
  .tile .lbl { font-size:0.72rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--rubric); }
  .tile .val { font-size:1.7rem; }
  .tile .sub { font-size:0.75rem; }
  .grid2 { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px,1fr)); gap:12px; margin-top:12px; }
  .card { margin-top:12px; }
  table { width:100%; border-collapse:collapse; font-size:0.85rem; }
  th, td { text-align:left; padding:5px 8px; border-top:1px solid var(--rule); }
  thead th { border-top:0; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.06em; color:var(--soft); }
  th.n, td.n { text-align:right; font-variant-numeric:tabular-nums; }
  .chart { display:flex; align-items:flex-end; gap:2px; height:120px; margin-top:8px; }
  .col { flex:1; position:relative; height:100%; display:flex; align-items:flex-end; }
  .bar { width:100%; background:var(--versal); border-radius:2px 2px 0 0; min-height:1px; }
  .col .tip { display:none; position:absolute; bottom:104%; left:50%; transform:translateX(-50%);
              background:var(--ink); color:var(--parchment); font-size:0.7rem; padding:3px 7px;
              border-radius:3px; white-space:nowrap; z-index:2; }
  .col:hover .tip { display:block; }
  .sbar { display:flex; height:22px; border-radius:3px; overflow:hidden; margin-top:6px; }
  .sseg { display:flex; align-items:center; justify-content:center; color:#fff; font-size:0.68rem; min-width:2px; }
  .c0{background:#25478C}.c1{background:#A81A1A}.c2{background:#57503F}.c3{background:#7A6C3E}.c4{background:#3E6B52}
  .slegend { margin-top:6px; font-size:0.75rem; color:var(--soft); display:flex; flex-wrap:wrap; gap:10px; }
  .sw { display:inline-block; width:9px; height:9px; border-radius:2px; margin-right:4px; }
  .err { background:var(--leaf); border:1px solid var(--rubric); border-radius:3px; padding:10px 14px;
         color:var(--rubric); font-size:0.85rem; margin-top:12px; }
  footer { margin-top:28px; color:var(--soft); font-size:0.75rem; }
  a { color:var(--rubric); }
</style></head><body><div class="wrap">
  <h1>Panduan Pengakuan Dosa — Admin</h1>
  <p class="sub">Hitungan kunjungan halaman, anonim dan agregat. Tanda pemeriksaan batin tidak pernah meninggalkan perangkat pembaca — tidak ada yang dapat dilihat di sini selain jumlah. · <a href="/">ke situs</a></p>

  <nav class="filters">${[7, 30, 90].map((d) =>
    `<a href="/admin?days=${d}" class="${d === days ? "on" : ""}">${d} hari</a>`).join("")}
    <span class="note">Analytics Engine menyimpan ±90 hari; angka adalah perkiraan tersampel (SUM _sample_interval).</span></nav>

  ${sqlError ? `<div class="err">Kueri gagal: ${esc(sqlError)}</div>` : ""}

  <div class="tiles">
    <div class="tile"><div class="lbl">Kunjungan halaman</div><div class="val">${num(total)}</div><div class="sub">${days} hari terakhir</div></div>
    <div class="tile"><div class="lbl">Halaman dibuka</div><div class="val">${num(byPath.length)}</div><div class="sub">halaman berbeda</div></div>
    <div class="tile"><div class="lbl">Negara</div><div class="val">${num(countries.size)}</div><div class="sub">${num(byCountry.length)} kelompok kota</div></div>
  </div>

  <section class="card">
    <h2>Kunjungan per hari — ${chartDays} hari terakhir</h2>
    <div class="chart">${byDay.map((r) => `<div class="col">
      <span class="tip">${esc(String(r.day).slice(0, 10))} · ${num(r.total)}</span>
      <div class="bar" style="height:${Math.max(1, Math.round((Number(r.total) / maxDay) * 100))}%"></div>
    </div>`).join("") || '<p class="empty">Belum ada data.</p>'}</div>
  </section>

  <div class="grid2">
    ${table("Halaman", ["Halaman", "Kunjungan"],
      byPath.map((r) => [`<span title="${esc(r.path)}">${esc(pageName(r.path))}</span>`, num(r.total)]))}
    ${table("Tempat", ["Tempat", "Kunjungan"],
      byCountry.map((r) => [esc([r.city, countryName(r.country)].filter(Boolean).join(", ") || "—"), num(r.total)]),
      "Lokasi perkiraan jaringan dari Cloudflare, agregat per kota.")}
  </div>

  <div class="grid2">
    <section class="card"><h2>Perangkat</h2>${shareRow(byDevice)}</section>
    <section class="card"><h2>Bahasa peramban</h2>${shareRow(byLang)}</section>
  </div>

  <footer>Beacon: functions/api/beacon.js → dataset ${DATASET} (path + geografi kasar saja, tanpa cookie, tanpa identitas).
    Halaman ini noindex dan hanya menampilkan agregat.</footer>
</div></body></html>`;

  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
