/**
 * Supplemental content — texts the booklet refers to but does not print.
 * Kept in `content/supplement/`, separate from the verbatim booklet record
 * in `content/pages/`; each file carries its own provenance header.
 */

import fs from "node:fs";
import path from "node:path";

export interface DoaTobat {
  title: string;
  paragraphs: string[];
}

let cached: DoaTobat | null = null;

export function loadDoaTobat(): DoaTobat {
  if (cached) return cached;
  const raw = fs.readFileSync(path.resolve("content/supplement/doa-tobat-ps25.md"), "utf8");
  const sep = raw.indexOf("\n---\n");
  if (sep === -1) throw new Error("[supplement] no metadata separator in doa-tobat-ps25.md");
  const body = raw.slice(sep + 5).trim();
  const [title, ...paragraphs] = body.split(/\n\n+/).map((s) => s.replace(/\n/g, " ").trim());
  if (title !== "DOA TOBAT" || paragraphs.length < 2) {
    throw new Error("[supplement] unexpected doa-tobat-ps25.md shape");
  }
  cached = { title, paragraphs };
  return cached;
}
