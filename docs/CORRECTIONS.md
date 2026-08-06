# Presentation-layer corrections

Per the repo policy (README § Content fidelity), `content/pages/` is the verbatim
record of the printed booklet, typos included. The app corrects a small set of
obvious **printing errors** at build time, in `src/lib/booklet.ts`. This file is
the record of that decision.

Every correction below is applied as an exact-match replacement; the build fails
loudly if a source string is missing or matches more than once, so drift between
this list and `content/pages/` cannot go unnoticed.

| # | Page (printed) | As printed (`content/pages/`) | Displayed in app | Rationale |
|---|---|---|---|---|
| 1 | 5 | `pemyembahan` | `penyembahan` | printing error |
| 2 | 8 | `pengguguran kandung)` | `pengguguran kandungan)` | dropped syllable; the same page prints "menggugurkan kandungan" |
| 3 | 9 | `berpakain` | `berpakaian` | printing error |
| 4 | 11 | `saya saya berdusta` | `saya berdusta` | doubled word |
| 5 | — (rite, p14 inferred) | `dioakan` | `didoakan` | printing error |

Not corrected (deliberate): spelling conventions of the period/publisher such as
`ketidak adilan`, `dibawah`, `Putera`, and the eight-item list under "Ketujuh
Dosa Pokok" — these are the booklet's own text, not printing accidents.
