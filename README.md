# panduan-pengakuan-dosa

A web app for the Sacrament of Reconciliation, based on the booklet **"Sakramen Tobat (Pengakuan Dosa)"** published openly by **Keuskupan Surabaya** (Nihil Obstat & Imprimatur, July 2019).

The booklet is a paper guide: five steps for a good confession, a prayer beforehand, an examination of conscience organized by the Ten Commandments and the Precepts of the Church, and the rite itself as a dialogue between penitent and priest. This project turns that into something a phone can carry into the confession line.

## Status

Content digitization is **complete** — all 17 booklet pages are transcribed verbatim. The application itself is **not yet started**.

## Repository layout

```
content/
  images/          # 17 source photographs, img-01 … img-17, in booklet order
  pages/           # verbatim markdown, one file per page
  booklet-full.md  # all pages concatenated, single-file reference
docs/
  TRANSCRIPTION.md # image → page map and transcription conventions
```

## Content overview

| Booklet pages | Section | App potential |
|---|---|---|
| 2 | Beberapa Hal yang Perlu Kita Ketahui | Static explainer |
| 3 | Lima Langkah untuk Pengakuan Dosa yang Baik | The app's primary flow |
| 4 | Doa Sebelum Pengakuan Dosa | Prayer screen |
| 5–13 | Pemeriksaan Batin (10 Perintah, Perintah Gereja, 7 Dosa Pokok) | Interactive checklist — the core feature |
| 13–16 | Tata Cara Pengakuan Dosa (Umat / Imam) | Guided rite, step-by-step |

## Design considerations

- **Privacy is the defining constraint.** An examination of conscience is deeply personal. Nothing selected should leave the device — local storage only, no accounts, no analytics on selections, and an obvious one-tap clear. This should be stated plainly in the UI, not buried in a policy.
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

Credit the diocese in the app footer. Before publishing publicly, contact the diocese at the address above — the booklet carries an Imprimatur, and a derived app should not imply approval it has not been granted.
