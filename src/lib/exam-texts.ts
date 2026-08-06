/**
 * Build-time helper for "Catatanku": the examination's key → question map,
 * embedded as JSON by /tata-cara/ and /antre/ so the client can recall the
 * reader's own marks (localStorage) at the confession step. Keys mirror the
 * checkbox data-keys on /pemeriksaan-batin/ — `${section.id}:${gi}:${qi}`.
 */

import type { Booklet } from "./booklet";

export function examTextsJson(bk: Booklet): string {
  const texts: Record<string, { s: string; q: string }> = {};
  bk.pemeriksaanBatin.sections.forEach((sec) =>
    sec.groups.forEach((g, gi) =>
      g.questions.forEach((q, qi) => {
        texts[`${sec.id}:${gi}:${qi}`] = { s: g.label ? `${sec.label} — ${g.label}` : sec.label, q };
      })
    )
  );
  bk.pemeriksaanBatin.perintahGereja.items.forEach((q, qi) => {
    texts[`perintah-gereja:0:${qi}`] = { s: "PERINTAH GEREJA", q };
  });
  return JSON.stringify(texts).replace(/</g, "\\u003c");
}
