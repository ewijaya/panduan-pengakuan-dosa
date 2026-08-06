// Compose the OG / social card (1200×630) → public/og-1200x630.jpg
//
// Left: Sarum parchment panel with the booklet's title set in Vollkorn.
// Right: the FULL La confessione painting, uncropped — at 630px tall its
// 1295:1600 aspect gives exactly 510px of width.
//
// Needs Vollkorn / Vollkorn SC / Jost visible to fontconfig (e.g. in
// ~/.local/share/fonts). Run: node scripts/og.mjs
import sharp from "sharp";

const W = 1200, H = 630;
const PAINT_W = Math.round(H * (1295 / 1600)); // 510 — full painting, no crop
const RULE_W = 6;
const PANEL_W = W - PAINT_W - RULE_W;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#F9F5EA"/>
  <rect x="${PANEL_W}" y="0" width="${RULE_W}" height="${H}" fill="#A81A1A"/>

  <!-- versal -->
  <rect x="64" y="72" width="84" height="84" rx="4" fill="#25478C" stroke="#1A3369" stroke-width="2"/>
  <text x="106" y="138" font-family="Vollkorn SC" font-size="62" fill="#F6EFDD" text-anchor="middle">T</text>

  <text x="64" y="216" font-family="Jost" font-weight="600" font-size="21" letter-spacing="4" fill="#A81A1A">KEUSKUPAN SURABAYA</text>

  <text x="60" y="300" font-family="Vollkorn SC" font-size="84" fill="#16130D">Sakramen</text>
  <text x="60" y="390" font-family="Vollkorn SC" font-size="84" fill="#16130D">Tobat</text>
  <text x="64" y="442" font-family="Vollkorn" font-style="italic" font-size="36" fill="#57503F">(Pengakuan Dosa)</text>

  <text x="64" y="484" font-family="Jost" font-weight="600" font-size="15" letter-spacing="3" fill="#A81A1A">PENYUNTING<tspan dx="12" font-family="Vollkorn" font-weight="400" font-size="19" letter-spacing="0" fill="#57503F">RD F.X. Zen Taufik</tspan></text>

  <line x1="64" y1="514" x2="${PANEL_W - 64}" y2="514" stroke="#DFD5BE" stroke-width="2"/>

  <text x="64" y="550" font-family="Vollkorn" font-size="24" fill="#16130D">Pemeriksaan batin, doa, dan tata cara:</text>
  <text x="64" y="580" font-family="Vollkorn" font-size="24" fill="#16130D">panduan pengakuan dosa di genggaman.</text>

  <text x="64" y="612" font-family="Jost" font-weight="500" font-size="19" letter-spacing="1.5" fill="#57503F">panduan-pengakuan-dosa.pages.dev</text>
</svg>`;

const painting = await sharp("assets/artwork/la-confessione-molteni.jpg")
  .resize(PAINT_W, H) // 510×630 = the painting's own aspect ratio: fully shown
  .toBuffer();

await sharp(Buffer.from(svg))
  .composite([{ input: painting, left: PANEL_W + RULE_W, top: 0 }])
  .flatten()
  .jpeg({ quality: 88 })
  .toFile("public/og-1200x630.jpg");

console.log("public/og-1200x630.jpg written");
