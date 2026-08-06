/* pdp-analytics-cron — copies pdp_events out of Workers Analytics Engine
   (which forgets raw data after ~90 days) into Workers KV with no expiry.
   Ported from hop-web's workers/analytics-cron, minus the tiers pdp does
   not need: no R2 raw archive, no stored health checks (/admin computes
   health live) — weekly aggregates are plenty at this volume.

   weekly SUN 20:00 UTC  rollup: event×path×geo aggregate
                         → KV `rollup:YYYY-MM-DD` (exclusive end day)
                         plus `digest:latest`, the summary /admin reads.

   Manual trigger (same token the SQL API uses):
     POST https://pdp-analytics-cron.<subdomain>.workers.dev/run?job=rollup
     Authorization: Bearer <ANALYTICS_READ_TOKEN>
   NOTE: rollup keys by run day over a trailing 7-day window — running it
   off-schedule creates a bucket overlapping Sunday's and double-counts
   the overlap in all-time sums. Prefer the cron. */

const DATASET = "pdp_events";
const PAGE = 10000; // SQL API row cap per query

async function sql(env, query) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.ANALYTICS_ACCOUNT_ID}/analytics_engine/sql`,
    { method: "POST", headers: { Authorization: `Bearer ${env.ANALYTICS_READ_TOKEN}` }, body: `${query} FORMAT JSON` },
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`SQL API ${response.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text).data ?? [];
}

const isoDay = (d) => d.toISOString().slice(0, 10);

/* Weekly aggregate to KV plus the digest:latest summary /admin reads.
   Keyed by the exclusive end day (the run day), so a re-run replaces,
   never duplicates. */
async function rollup(env) {
  const end = isoDay(new Date());
  const start = isoDay(new Date(Date.now() - 7 * 86400000));
  const rows = await sql(env, `SELECT blob1 AS event, blob2 AS path, blob3 AS country,
      blob4 AS region, blob5 AS city, SUM(_sample_interval) AS total
    FROM ${DATASET}
    WHERE timestamp >= toDateTime('${start} 00:00:00')
      AND timestamp < toDateTime('${end} 00:00:00')
    GROUP BY event, path, country, region, city
    ORDER BY total DESC LIMIT ${PAGE}`);

  const events = rows.reduce((s, r) => s + Number(r.total), 0);
  const generatedAt = new Date().toISOString();
  await env.PDP_STORE.put(`rollup:${end}`, JSON.stringify({ schema: 1, start, end, events, generatedAt, rows }));

  const sumBy = (keyOf) => {
    const m = new Map();
    for (const r of rows) {
      const k = keyOf(r);
      if (k !== null) m.set(k, (m.get(k) || 0) + Number(r.total));
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const previous = await env.PDP_STORE.get("digest:latest", "json");
  const weeks = (previous?.weeks ?? []).filter((w) => w.end !== end);
  weeks.push({
    start, end, events,
    byEvent: Object.fromEntries(sumBy((r) => r.event)),
    topPaths: sumBy((r) => r.path).slice(0, 5),
    // distinct country codes this week — /admin unions these for an
    // all-time "negara terjangkau" that outlives the 90-day window
    countries: sumBy((r) => r.country || null).map(([c]) => c).filter((c) => /^[A-Za-z]{2}$/.test(c)),
  });
  weeks.sort((a, b) => (a.end < b.end ? -1 : 1));
  await env.PDP_STORE.put("digest:latest", JSON.stringify({ schema: 1, generatedAt, weeks }));
  return { job: "rollup", key: `rollup:${end}`, start, end, events, weeks: weeks.length };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(rollup(env).then((r) => console.log(JSON.stringify(r))));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/run") return new Response("pdp-analytics-cron", { status: 404 });
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
    }
    const auth = request.headers.get("Authorization") || "";
    if (auth !== `Bearer ${env.ANALYTICS_READ_TOKEN}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (url.searchParams.get("job") !== "rollup") {
      return new Response("Unknown job (rollup)", { status: 400 });
    }
    try {
      return Response.json(await rollup(env));
    } catch (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  },
};
