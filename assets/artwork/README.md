# Artwork Assets

Artwork used in the application UI. Distinct from `content/images/`, which holds the source scan photographs of the booklet and must not be edited.

## `la-confessione-molteni.jpg`

The key image of the app — the painting reproduced on the booklet's front cover.

| | |
|---|---|
| **Title** | *La confessione* (The Confession) |
| **Artist** | Giuseppe Molteni (Italian, 1800–1867) |
| **Date** | 1838 |
| **Medium / size** | Oil on canvas, 173.5 × 141 cm |
| **Collection** | Acquired 1998 by the Cariplo Collection; held at Gallerie d'Italia – Milano (Gallerie di Piazza Scala) |
| **File** | 1295 × 1600 px JPEG, ~495 KB |
| **Source** | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Artgate_Fondazione_Cariplo_-_Molteni_Giuseppe,_La_confessione.jpg) via Artgate Fondazione Cariplo |

### Licensing

**Public domain.** The painting is out of copyright (artist died 1867), and the photograph is a faithful reproduction of a two-dimensional public-domain work, which carries no new copyright in the US and comparable jurisdictions. Released under the Creative Commons Public Domain Mark 1.0.

No attribution is legally required. Credit it anyway, in the app's about screen:

> *La confessione* (1838), Giuseppe Molteni — Gallerie d'Italia, Milano. Photograph: Artgate Fondazione Cariplo (public domain).

### Notes for use

- This is the **full painting**; the booklet cover is a cropped detail of it. Deriving app crops from this original gives better quality than the cover photo in `content/images/img-01.jpeg`.
- The image is dark and low-contrast by design — light text overlays it well, dark text does not. It suits a splash or about screen more than a busy UI background.
- Portrait aspect ratio (~0.81:1). Plan separate crops for landscape and social/OG cards rather than stretching it.
- Keep this file as the unmodified master. Derived crops and resized variants belong beside it with descriptive names (e.g. `la-confessione-molteni--og-1200x630.jpg`), never overwriting this one.
