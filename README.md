# panduan-pengakuan-dosa

A web app for the Sacrament of Reconciliation, based on the booklet **"Sakramen Tobat (Pengakuan Dosa)"** published openly by **Keuskupan Surabaya** (Nihil Obstat & Imprimatur, July 2019).

The booklet is a paper guide: five steps for a good confession, a prayer beforehand, an examination of conscience organized by the Ten Commandments and the Precepts of the Church, and the rite itself as a dialogue between penitent and priest. This project turns that into something a phone can carry into the confession line.

## Status

Content digitization is **complete** — all 17 booklet pages are transcribed verbatim. The app is **live**: an Astro static site at **https://panduan-pengakuan-dosa.pages.dev**, deployed automatically to Cloudflare Pages by GitHub Actions on every push to `main`.

## Repository layout

```
assets/
  artwork/         # UI artwork — key image, with provenance and licensing
  styles/          # Sarum Vellum design tokens (sarum.css) + self-hosted fonts
content/
  images/          # 17 source photographs, img-01 … img-17, in booklet order
  pages/           # verbatim markdown, one file per page — single source of truth
  booklet-full.md  # all pages concatenated, single-file reference
docs/
  TRANSCRIPTION.md # image → page map and transcription conventions
  CORRECTIONS.md   # printing errors normalized in the app's presentation layer
src/
  lib/booklet.ts   # build-time parser: content/pages → structured app data
  lib/client/      # device-only state: expiring marks, penance, dates
  pages/           # Astro routes (guided flow, checklist, rite, queue mode)
functions/         # Cloudflare Pages Functions: /api/beacon + /admin
public/            # PWA manifest, icons, OG image
wrangler.toml      # Pages config: Analytics Engine binding for the beacon
.github/workflows/ # push to main → build → deploy to Cloudflare Pages
```

Build locally with `npm ci && npm run dev`. The site is fully static, offline-capable (service worker), and keeps examination marks in `localStorage` only.

**Key image:** `assets/artwork/la-confessione-molteni.jpg` — *La confessione* (1838) by Giuseppe Molteni, the painting on the booklet cover. Public domain; full original rather than the cover crop. See [`assets/artwork/README.md`](assets/artwork/README.md) for provenance and usage notes.

## Content overview

| Booklet pages | Section | App potential |
|---|---|---|
| 2 | Beberapa Hal yang Perlu Kita Ketahui | Static explainer |
| 3 | Lima Langkah untuk Pengakuan Dosa yang Baik | The app's primary flow |
| 4 | Doa Sebelum Pengakuan Dosa | Prayer screen |
| 5–13 | Pemeriksaan Batin (10 Perintah, Perintah Gereja, 7 Dosa Pokok) | Interactive checklist — the core feature |
| 13–16 | Tata Cara Pengakuan Dosa (Umat / Imam) | Guided rite, step-by-step |

## The guided flow

The app runs the booklet's own sequence end to end: **Doa → Pemeriksaan Batin → Tata Cara → Selesai**. Marks made during the examination are recalled privately at the rite's confession step ("Catatanku"); `/antre/` is a one-step-per-screen queue mode with large type and the screen kept awake; `/selesai/` holds the penance note (7-day expiry), the Doa Tobat, an opt-in last-confession date (a single timestamp, used to answer "kapan pengakuan terakhir" next time), and a one-tap wipe. Examination marks self-expire after 24 hours.

## Admin & analytics

`/admin` (functions/admin.js) is an aggregate-only ops dashboard in the style of hop-web's: page-open counts by day, page, place, device and language from an Analytics Engine dataset (`pdp_events`) written by `/api/beacon`. The beacon sends the path and nothing else — no cookies, no IDs, DNT/GPC respected — and examination marks never reach a server, so the dashboard has nothing sensitive to show. To activate it, set two secrets on the Pages project (Settings → Environment variables or `wrangler pages secret put`): `ANALYTICS_ACCOUNT_ID` and `ANALYTICS_READ_TOKEN` (API token with *Account Analytics : Read*). Until then `/admin` answers 503 with the same instructions.

## Design considerations

- **Privacy is the defining constraint.** An examination of conscience is deeply personal. Nothing selected should leave the device — local storage only, no accounts, no analytics on selections, and an obvious one-tap clear. This should be stated plainly in the UI, not buried in a policy. Page-open counting (above) is the sole, deliberate exception, and it is anonymous, aggregate, and disclosed on `/tentang/`.
- **Offline-first.** Churches have poor signal and phones get silenced. The app should work fully offline once loaded.
- **Reverent, not gamified.** No streaks, no scores, no badges. Progress indicators should be quiet.
- **Indonesian first.** Source text is Indonesian; keep it verbatim in the UI. English can come later as a translation layer, never replacing the original.

## Content fidelity

The transcription is verbatim, including printed typos (`pemyembahan`, `saya saya berdusta`, `dioakan`). When building the app, decide deliberately whether to display these as printed or silently normalize — and record that decision. Do not edit the files in `content/pages/`; they are the faithful record of the source. Any presentation-layer corrections belong in the app's data layer.

## Attribution

Source booklet published openly (*"Diedarkan Secara Terbuka"*) by:

> **Keuskupan Surabaya**
> Jl. Polisi Istimewa 17, Surabaya 60265
> Telp: 031-5677796, 5615592 · Email: sekrupsby@sby.dnet.net.id
>
> Nihil Obstat: RD Yosef Indrakusuma, Ketua Komisi Liturgi (15 Juli 2019)
> Imprimatur: RD Yosef Eko Budi Susilo, Vikjen Keuskupan Surabaya (16 Juli 2019)
> Penyunting: RD F.X. Zen Taufik
> Cover: *"La confessione"* oleh Molteni Giuseppe

The cover painting itself is public domain and separately licensed from the booklet text — see [`assets/artwork/README.md`](assets/artwork/README.md).

Credit the diocese in the app footer. Before publishing publicly, contact the diocese at the address above — the booklet carries an Imprimatur, and a derived app should not imply approval it has not been granted.
