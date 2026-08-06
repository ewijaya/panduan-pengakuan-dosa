/**
 * Client-side storage — the app's entire private state, in one place.
 *
 * Everything here is localStorage-only (README: "Privacy is the defining
 * constraint") and expiring by design: examination marks live 24 hours,
 * a penance note 7 days. Only the opt-in last-confession date persists,
 * and it is a single timestamp.
 */

const DAY = 24 * 60 * 60 * 1000;

/* ---- examination marks (24-hour auto-expiry) ----------------------- */

const MARKS_KEY = "pb-marks-v2";
const MARKS_V1 = "pb-marks-v1"; // pre-expiry format, migrated on first read
const MARKS_TTL = DAY;

export type Marks = Record<string, 1>;

export function loadMarks(): Marks {
  try {
    const v1 = localStorage.getItem(MARKS_V1);
    if (v1) {
      localStorage.removeItem(MARKS_V1);
      const marks = JSON.parse(v1) as Marks;
      saveMarks(marks);
      return marks;
    }
    const raw = localStorage.getItem(MARKS_KEY);
    if (!raw) return {};
    const { t, marks } = JSON.parse(raw);
    if (typeof t !== "number" || Date.now() - t > MARKS_TTL) {
      localStorage.removeItem(MARKS_KEY);
      return {};
    }
    return marks ?? {};
  } catch {
    return {};
  }
}

export function saveMarks(marks: Marks): void {
  localStorage.setItem(MARKS_KEY, JSON.stringify({ t: Date.now(), marks }));
}

export function clearMarks(): void {
  localStorage.removeItem(MARKS_KEY);
  localStorage.removeItem(MARKS_V1);
}

/* ---- penance note (7-day auto-expiry) ------------------------------ */

const PENANCE_KEY = "pd-penance";
const PENANCE_TTL = 7 * DAY;

export function loadPenance(): string {
  try {
    const raw = localStorage.getItem(PENANCE_KEY);
    if (!raw) return "";
    const { t, text } = JSON.parse(raw);
    if (typeof t !== "number" || Date.now() - t > PENANCE_TTL) {
      localStorage.removeItem(PENANCE_KEY);
      return "";
    }
    return text ?? "";
  } catch {
    return "";
  }
}

export function savePenance(text: string): void {
  if (!text.trim()) localStorage.removeItem(PENANCE_KEY);
  else localStorage.setItem(PENANCE_KEY, JSON.stringify({ t: Date.now(), text }));
}

export function clearPenance(): void {
  localStorage.removeItem(PENANCE_KEY);
}

/* ---- last confession date (opt-in, a single timestamp) ------------- */

const LAST_KEY = "pd-last-confession";

export function lastConfession(): number | null {
  const raw = localStorage.getItem(LAST_KEY);
  const t = raw ? Number(raw) : NaN;
  return Number.isFinite(t) ? t : null;
}

export function recordConfession(t: number = Date.now()): void {
  localStorage.setItem(LAST_KEY, String(t));
}

export function clearLastConfession(): void {
  localStorage.removeItem(LAST_KEY);
}

/** "Sekitar 3 bulan yang lalu" — phrased in the units the rite itself asks
 *  for ("…minggu/bulan/tahun yang lalu"), ready to be said aloud. */
export function agoText(from: number, to: number = Date.now()): string {
  const days = Math.max(0, Math.round((to - from) / DAY));
  if (days === 0) return "hari ini";
  if (days < 14) return `sekitar ${days} hari yang lalu`;
  if (days < 60) return `sekitar ${Math.round(days / 7)} minggu yang lalu`;
  if (days < 730) return `sekitar ${Math.round(days / 30.44)} bulan yang lalu`;
  return `sekitar ${Math.round(days / 365.25)} tahun yang lalu`;
}

/* ---- examination audience filter ----------------------------------- */

const AUD_KEY = "pd-audience";
export type Audience = "semua" | "anak" | "ortu";

export function audience(): Audience {
  const v = localStorage.getItem(AUD_KEY);
  return v === "anak" || v === "ortu" ? v : "semua";
}

export function setAudience(a: Audience): void {
  if (a === "semua") localStorage.removeItem(AUD_KEY);
  else localStorage.setItem(AUD_KEY, a);
}

/* ---- seasonal invitation (Natal / Paskah) --------------------------- */

/** Gregorian computus (anonymous algorithm) — Easter Sunday of a year. */
export function easterDate(y: number): Date {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

/**
 * A quiet, once-a-season line for the home page: shown only in the three
 * weeks before Natal or Paskah, and only when the recorded last confession
 * is absent or more than two months old. Never a badge, never a nag.
 */
export function seasonalNudge(last: number | null, now: Date = new Date()): string | null {
  if (last !== null && now.getTime() - last < 60 * DAY) return null;
  const targets: Array<[string, Date]> = [];
  for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
    targets.push(["Paskah", easterDate(y)], ["Natal", new Date(y, 11, 25)]);
  }
  for (const [name, d] of targets) {
    const days = Math.floor((d.getTime() - now.getTime()) / DAY);
    if (days >= 0 && days <= 21) {
      return `Menjelang ${name}, waktu yang baik untuk menerima Sakramen Tobat.`;
    }
  }
  return null;
}
