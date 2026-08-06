/* Anonymous page-open counter → Analytics Engine (dataset pdp_events).
 *
 * PRIVACY CONTRACT (see /tentang/ and the README): this endpoint receives a
 * path and nothing else. No cookies, no IDs, no fingerprinting, and never —
 * under any future change — the content of examination marks, penance notes,
 * or dates: those live in localStorage and are not sent anywhere. Geography
 * is Cloudflare's own coarse network inference (country/region/city), used
 * in aggregate only.
 *
 * Datapoint layout (keep in sync with functions/admin.js):
 *   index    path (sampling key)
 *   blob1    event   ("view" | "pwa" | "install")
 *   blob2    path
 *   blob3    country     blob4  region      blob5  city
 *   blob6    device      blob7  language    blob8  timezone
 *   blob9    latitude    blob10 longitude   (Cloudflare's city-level
 *            centroid, same coarse geo as blob3–5 — for the /admin map)
 *   double1  1
 */

export async function onRequestPost({ request, env }) {
  if (!env.PDP_ANALYTICS) return new Response(null, { status: 204 });

  let body = null;
  try { body = await request.json(); } catch { /* fall through */ }
  const path = typeof body?.p === "string" && /^\/[a-zA-Z0-9\-/]{0,80}$/.test(body.p) ? body.p : null;
  if (!path) return new Response(null, { status: 204 });

  // view = browser tab · pwa = launched from the installed app ·
  // install = Android's appinstalled moment (iOS has no equivalent)
  const EVENTS = new Set(["view", "pwa", "install"]);
  const event = EVENTS.has(body?.e) ? body.e : "view";

  const cf = request.cf ?? {};
  const ua = request.headers.get("user-agent") ?? "";
  const device = /Mobi|Android/i.test(ua) ? "mobile" : "desktop";
  const lang = (request.headers.get("accept-language") ?? "").split(",")[0].trim().slice(0, 8);

  env.PDP_ANALYTICS.writeDataPoint({
    indexes: [path.slice(0, 32)],
    blobs: [
      event,
      path,
      cf.country ?? "",
      cf.region ?? "",
      cf.city ?? "",
      device,
      lang,
      cf.timezone ?? "",
      cf.latitude ?? "",
      cf.longitude ?? "",
    ],
    doubles: [1],
  });

  return new Response(null, { status: 204 });
}
