/**
 * Build-time content pipeline.
 *
 * Single source of truth: `content/pages/*.md` — the verbatim transcription of
 * the printed booklet. This module reads those files at build time, strips the
 * transcription metadata (source-image header, printed folio numbers), applies
 * the documented corrections (docs/CORRECTIONS.md), and stitches the pages —
 * whose boundaries split sections mid-stream — into structured data for the app.
 *
 * Every extraction anchors on markers present in the source text and THROWS if
 * a marker is missing or ambiguous, so any future edit to `content/pages/`
 * breaks the build loudly instead of silently drifting from the booklet.
 */

import fs from "node:fs";
import path from "node:path";

const PAGES_DIR = path.resolve("content/pages");

/* ------------------------------------------------------------------ */
/* Corrections — keep in lockstep with docs/CORRECTIONS.md             */
/* ------------------------------------------------------------------ */

const CORRECTIONS: ReadonlyArray<readonly [string, string]> = [
  ["pemyembahan", "penyembahan"],
  ["pengguguran kandung)", "pengguguran kandungan)"],
  ["berpakain", "berpakaian"],
  ["saya saya berdusta", "saya berdusta"],
  ["dioakan", "didoakan"],
];

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface IntroSection {
  heading: string;
  paragraphs: string[]; // raw inline markdown (bold/italic preserved)
}

export interface Step {
  n: number;
  title: string;
  points: string[];
}

export interface ExamGroup {
  label: string | null; // e.g. "Bagi Anak-Anak"; null for the ungrouped run
  questions: string[];
}

export interface ExamSection {
  id: string; // stable id for localStorage, e.g. "perintah-1"
  label: string; // e.g. "PERINTAH PERTAMA"
  quote: string | null; // the commandment text
  groups: ExamGroup[];
}

export type RitePartKind = "action" | "speech" | "note";

export interface RitePart {
  kind: RitePartKind;
  text: string;
}

export interface RiteStep {
  umat: RitePart[];
  imam: RitePart[];
}

export interface Booklet {
  cover: { title: string; subtitle: string };
  credits: {
    nihilObstat: string[];
    imprimatur: string[];
    cover: string[];
    penyunting: string;
    publisher: string[];
  };
  intro: { title: string; subtitle: string; kicker: string; sections: IntroSection[] };
  limaLangkah: { steps: Step[] };
  doaSebelum: { title: string; lines: string[] };
  pemeriksaanBatin: {
    epigraph: string;
    sections: ExamSection[];
    perintahGereja: { epigraph: string; items: string[] };
    dosaPokok: { epigraph: string; lead: string; body: string };
  };
  tataCara: { petunjuk: string[]; steps: RiteStep[] };
}

/* ------------------------------------------------------------------ */
/* Loading                                                             */
/* ------------------------------------------------------------------ */

function fail(msg: string): never {
  throw new Error(`[booklet] ${msg} — content/pages/ may have changed; re-anchor src/lib/booklet.ts`);
}

/** Strip transcription metadata: title + "> Source image / > Booklet page"
 *  header above the first `---`, and the trailing printed folio (`*7*`). */
function pageBody(raw: string, file: string): string {
  const sep = raw.indexOf("\n---\n");
  if (sep === -1) fail(`no metadata separator in ${file}`);
  let body = raw.slice(sep + 5).trim();
  body = body.replace(/\n\*\d+\*\s*$/, "").trim(); // printed page number — excluded per requirements
  return body;
}

function loadPages(): Map<string, string> {
  const files = fs
    .readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();
  if (files.length !== 17) fail(`expected 17 page files, found ${files.length}`);
  const map = new Map<string, string>();
  for (const f of files) {
    const raw = fs.readFileSync(path.join(PAGES_DIR, f), "utf8");
    map.set(f.slice(0, 6), pageBody(raw, f)); // key: "img-01" … "img-17"
  }
  return map;
}

function applyCorrections(text: string): string {
  for (const [from, to] of CORRECTIONS) {
    const count = text.split(from).length - 1;
    if (count !== 1) fail(`correction "${from}" matched ${count} times (expected exactly 1)`);
    text = text.replace(from, to);
  }
  return text;
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const strip = (s: string) => s.replace(/^\*{1,3}|\*{1,3}$/g, "").trim();

function lines(text: string): string[] {
  return text.split("\n").map((l) => l.trim());
}

/** Collect `- ` bullets (a bullet may wrap onto continuation lines). */
function bullets(block: string): string[] {
  const out: string[] = [];
  for (const line of lines(block)) {
    if (line.startsWith("- ")) out.push(line.slice(2).trim());
    else if (line && out.length > 0 && !line.startsWith("#") && !line.startsWith("**")) {
      out[out.length - 1] += " " + line;
    }
  }
  return out;
}

function section(text: string, from: string | RegExp, to: string | RegExp | null, label: string): string {
  const fromMatch = typeof from === "string" ? { index: text.indexOf(from), length: from.length } : (() => {
    const m = text.match(from);
    return m && m.index !== undefined ? { index: m.index, length: m[0].length } : { index: -1, length: 0 };
  })();
  if (fromMatch.index === -1) fail(`start marker not found for ${label}`);
  const start = fromMatch.index + fromMatch.length;
  if (to === null) return text.slice(start).trim();
  const rest = text.slice(start);
  const endIdx = typeof to === "string" ? rest.indexOf(to) : (rest.match(to)?.index ?? -1);
  if (endIdx === -1) fail(`end marker not found for ${label}`);
  return rest.slice(0, endIdx).trim();
}

/* ------------------------------------------------------------------ */
/* Section extractors                                                  */
/* ------------------------------------------------------------------ */

function parseCredits(p02: string): Booklet["credits"] {
  const grab = (key: string, stopAt: string | RegExp | null) =>
    lines(section(p02, `**${key}**`, stopAt, `credits/${key}`)).filter(Boolean);
  const nihilObstat = grab("NIHIL OBSTAT", "**IMPRIMATUR**");
  const imprimatur = grab("IMPRIMATUR", "**COVER**");
  const cover = grab("COVER", "**PENYUNTING**").map(strip);
  const tail = grab("PENYUNTING", null);
  const penyunting = tail[0];
  if (penyunting !== "RD F.X. Zen Taufik") fail(`unexpected PENYUNTING value: "${penyunting}"`);
  const publisher = tail.slice(1);
  if (!publisher[0]?.startsWith("Diedarkan Secara Terbuka")) fail("publisher block not found");
  return { nihilObstat, imprimatur, cover, penyunting, publisher };
}

function parseIntro(p03: string): Booklet["intro"] {
  const kicker = "Beberapa Hal yang Perlu Kita Ketahui dari";
  if (!p03.startsWith(kicker)) fail("intro kicker missing");
  const sections: IntroSection[] = [];
  const parts = p03.split(/^## (?=[A-Z])/m).slice(1); // "## APA ITU…", "## KAPAN…"
  // First split chunk is "(PENGAKUAN DOSA)" subtitle block; real sections start with capitals.
  for (const part of parts) {
    const [head, ...rest] = part.split("\n");
    if (head.startsWith("(")) continue; // the "(PENGAKUAN DOSA)" subtitle
    const paragraphs = rest.join("\n").split(/\n\n+/).map((s) => s.replace(/\n/g, " ").trim()).filter(Boolean);
    sections.push({ heading: head.trim(), paragraphs });
  }
  if (sections.length !== 2) fail(`expected 2 intro sections, got ${sections.length}`);
  return { title: "SAKRAMEN TOBAT", subtitle: "(PENGAKUAN DOSA)", kicker, sections };
}

function parseLimaLangkah(p04: string, p05: string): Booklet["limaLangkah"] {
  const joined = p04 + "\n\n" + p05.split("• • •")[0];
  const stepRe = /^## (\d)\. (.+)$/gm;
  const steps: Step[] = [];
  const matches = [...joined.matchAll(stepRe)];
  if (matches.length !== 5) fail(`expected 5 steps, got ${matches.length}`);
  matches.forEach((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : joined.length;
    steps.push({ n: Number(m[1]), title: m[2].trim(), points: bullets(joined.slice(start, end)) });
  });
  if (steps.map((s) => s.n).join(",") !== "1,2,3,4,5") fail("steps out of order");
  return { steps };
}

function parseDoa(p05: string): Booklet["doaSebelum"] {
  const after = section(p05, "# DOA SEBELUM PENGAKUAN DOSA", null, "doa-sebelum");
  const ls = lines(after).filter(Boolean).map(strip);
  if (ls[ls.length - 1] !== "Amin.") fail("prayer should end with Amin.");
  return { title: "DOA SEBELUM PENGAKUAN DOSA", lines: ls };
}

const ORDINALS = [
  "PERTAMA", "KEDUA", "KETIGA", "KEEMPAT", "KELIMA",
  "KEENAM", "KETUJUH", "KEDELAPAN", "KESEMBILAN", "KESEPULUH",
];

function parseExamination(pages: Map<string, string>): Booklet["pemeriksaanBatin"] {
  // Examination stream: p05 (img-06) … p12 (img-13), plus the Dosa Pokok block
  // at the top of p13 (img-14, before "• • •").
  const stream = ["img-06", "img-07", "img-08", "img-09", "img-10", "img-11", "img-12", "img-13"]
    .map((k) => pages.get(k)!)
    .join("\n\n") + "\n\n" + pages.get("img-14")!.split("• • •")[0];

  const epigraph = "Apakah aku sungguh-sungguh menjalankan Kesepuluh Perintah Allah?";
  if (!stream.includes("Kesepuluh Perintah Allah?***")) fail("examination epigraph missing");

  // Locate each commandment heading (printed inconsistently as `**PERINTAH X:**`
  // or `## PERINTAH X:`).
  const headingRe = /^(?:\*\*|## )PERINTAH (\w+):?\**\s*$/gm;
  const found = [...stream.matchAll(headingRe)];
  if (found.length !== 10) fail(`expected 10 commandment headings, got ${found.length}`);
  found.forEach((m, i) => {
    if (m[1] !== ORDINALS[i]) fail(`commandment #${i + 1} is "${m[1]}", expected "${ORDINALS[i]}"`);
  });

  const gerejaMark = stream.indexOf("Kelima Perintah Gereja?");
  if (gerejaMark === -1) fail("Perintah Gereja marker missing");

  const sections: ExamSection[] = found.map((m, i) => {
    const start = m.index! + m[0].length;
    const end = i + 1 < found.length ? found[i + 1].index! : gerejaMark;
    let block = stream.slice(start, end);
    if (i === 9) block = block.split(/\n---\n/)[0]; // trim the epigraph lead-in after Perintah X

    // The commandment text: first ***"…"*** run (may span lines).
    const quoteMatch = block.match(/\*\*\*"([\s\S]*?)"\*\*\*/);
    const quote = quoteMatch ? quoteMatch[1].replace(/\s*\n\s*/g, " ").trim() : null;
    if (!quote) fail(`no quote for PERINTAH ${ORDINALS[i]}`);

    // Subgroups (only Perintah IV has them: Bagi Anak-Anak / Orang Tua / Atasan dan Bawahan)
    const groups: ExamGroup[] = [];
    const groupRe = /^\*\*(Bagi [^*]+)\*\*$/gm;
    const groupMatches = [...block.matchAll(groupRe)];
    if (groupMatches.length === 0) {
      groups.push({ label: null, questions: bullets(block) });
    } else {
      groupMatches.forEach((g, j) => {
        const gStart = g.index! + g[0].length;
        const gEnd = j + 1 < groupMatches.length ? groupMatches[j + 1].index! : block.length;
        groups.push({ label: g[1].trim(), questions: bullets(block.slice(gStart, gEnd)) });
      });
    }
    const total = groups.reduce((n, g) => n + g.questions.length, 0);
    if (total === 0) fail(`no questions for PERINTAH ${ORDINALS[i]}`);
    return { id: `perintah-${i + 1}`, label: `PERINTAH ${ORDINALS[i]}`, quote, groups };
  });

  // Kelima Perintah Gereja — numbered list after its epigraph.
  const gerejaBlock = section(stream, "Kelima Perintah Gereja?***", /\n\*\*\*Apakah aku sungguh-sungguh menjauhkan/, "perintah-gereja");
  const items = [...gerejaBlock.matchAll(/^\d\.\s+(.+)$/gm)].map((m) => m[1].trim());
  if (items.length !== 5) fail(`expected 5 Perintah Gereja items, got ${items.length}`);

  // Ketujuh Dosa Pokok
  const pokokBlock = section(stream, "Ketujuh Dosa Pokok***", null, "dosa-pokok");
  const lead = "Dosa-dosa pokok itu adalah:";
  if (!pokokBlock.includes(`**${lead}**`)) fail("dosa pokok lead missing");
  const body = strip(section(pokokBlock, `**${lead}**`, null, "dosa-pokok-body").split(/\n\n+/)[0].trim());

  return {
    epigraph,
    sections,
    perintahGereja: { epigraph: "Apakah aku sungguh-sungguh menjalankan Kelima Perintah Gereja?", items },
    dosaPokok: { epigraph: "Apakah aku sungguh-sungguh menjauhkan diri dari Ketujuh Dosa Pokok", lead, body },
  };
}

function classifyPart(part: string): RitePart {
  // Speech/action cells are styled wholesale by the UI, so residual emphasis
  // markers from nested print styling are dropped rather than rendered.
  // Actions keep their printed parentheses: Petunjuk #1 ("Lakukan tulisan di
  // (dalam kurung)") refers to them.
  const clean = (s: string) => s.replace(/\*+/g, "").trim();
  const t = part.trim();
  if (t.startsWith("(")) return { kind: "action", text: clean(t) };
  if (/^\*{1,3}/.test(t)) return { kind: "speech", text: clean(t) };
  return { kind: "note", text: clean(t) };
}

function parseTataCara(pages: Map<string, string>): Booklet["tataCara"] {
  const p13 = pages.get("img-14")!;
  const petunjukBlock = section(p13, "## PETUNJUK", /\n\| ?UMAT/, "petunjuk");
  const petunjuk = [...petunjukBlock.matchAll(/^\d\.\s+(.+)$/gm)].map((m) =>
    m[1].replace(/\*\*/g, "").replace(/\*/g, "").trim()
  );
  if (petunjuk.length !== 2) fail(`expected 2 petunjuk items, got ${petunjuk.length}`);

  const tableText = [
    section(p13, "# TATA CARA PENGAKUAN DOSA", null, "rite-p13"),
    pages.get("img-15")!,
    pages.get("img-16")!,
    pages.get("img-17")!.replace(/• • •\s*$/, ""),
  ].join("\n");

  const steps: RiteStep[] = [];
  for (const line of lines(tableText)) {
    if (!line.startsWith("|")) continue;
    if (/^\|[\s\-|]+\|$/.test(line)) continue; // separator row
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length !== 2) fail(`rite row does not have 2 cells: ${line.slice(0, 60)}`);
    if (/^\*{0,2}UMAT\*{0,2}$/.test(cells[0])) continue; // header row
    const [umat, imam] = cells.map((cell) =>
      cell.length === 0 ? [] : cell.split(/<br\s*\/?>(?:<br\s*\/?>)?/).map((p) => p.trim()).filter(Boolean).map(classifyPart)
    );
    steps.push({ umat, imam });
  }
  if (steps.length !== 11) fail(`expected 11 rite steps, got ${steps.length}`);
  return { petunjuk, steps };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

let cached: Booklet | null = null;

export function loadBooklet(): Booklet {
  if (cached) return cached;
  const rawPages = loadPages();
  const pages = new Map<string, string>();
  // Corrections are applied over the concatenated stream via per-page pass;
  // each must land exactly once across the whole booklet.
  {
    const DELIM = "\n@@PAGE-BREAK@@\n";
    const keys = [...rawPages.keys()];
    const whole = applyCorrections(keys.map((k) => rawPages.get(k)!).join(DELIM));
    const bodies = whole.split(DELIM);
    if (bodies.length !== keys.length) fail("page delimiter corrupted during corrections");
    bodies.forEach((body, i) => pages.set(keys[i], body));
  }

  cached = {
    cover: { title: "SAKRAMEN TOBAT", subtitle: "(PENGAKUAN DOSA)" },
    credits: parseCredits(pages.get("img-02")!),
    intro: parseIntro(pages.get("img-03")!),
    limaLangkah: parseLimaLangkah(pages.get("img-04")!, pages.get("img-05")!),
    doaSebelum: parseDoa(pages.get("img-05")!),
    pemeriksaanBatin: parseExamination(pages),
    tataCara: parseTataCara(pages),
  };
  return cached;
}

/* ------------------------------------------------------------------ */
/* Inline markdown → HTML (bold/italic only, escaped first)            */
/* ------------------------------------------------------------------ */

export function inlineMd(src: string): string {
  const esc = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .replace(/\*\*\*([\s\S]+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([\s\S]+?)\*/g, "<em>$1</em>");
}
