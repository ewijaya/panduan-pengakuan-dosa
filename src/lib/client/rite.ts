/**
 * Rite-page extras, shared by /tata-cara/ and /antre/:
 *
 *  - "Catatanku" — at the confession step, the questions marked during the
 *    Pemeriksaan Batin are recalled from the device (never from anywhere
 *    else) so the penitent does not have to remember them in the queue.
 *  - "how long since" — at the last-confession step, the opt-in recorded
 *    date is phrased ready to be said aloud.
 *
 * The page embeds the key → question map as JSON in #exam-texts; marks stay
 * in localStorage. Both stay on the device.
 */

import { loadMarks, lastConfession, agoText } from "./store";

export function initRiteExtras(): void {
  const textsEl = document.getElementById("exam-texts");
  const box = document.getElementById("catatan");
  const list = document.getElementById("catatan-list");
  if (textsEl && box && list) {
    const texts: Record<string, { s: string; q: string }> = JSON.parse(textsEl.textContent ?? "{}");
    const marks = loadMarks();
    let lastSection = "";
    let count = 0;
    // Object key order is booklet order — the recap reads top to bottom.
    for (const key of Object.keys(texts)) {
      if (!marks[key]) continue;
      const { s, q } = texts[key];
      const li = document.createElement("li");
      if (s !== lastSection) {
        const label = document.createElement("span");
        label.className = "gloss catatan-sec";
        label.textContent = s;
        li.appendChild(label);
        lastSection = s;
      }
      li.appendChild(document.createTextNode(q));
      list.appendChild(li);
      count++;
    }
    if (count > 0) (box as HTMLElement).hidden = false;
  }

  const ago = document.getElementById("last-ago");
  const last = lastConfession();
  if (ago && last !== null) {
    ago.textContent = `Menurut catatan di perangkat ini: ${agoText(last)}.`;
    ago.hidden = false;
  }
}
