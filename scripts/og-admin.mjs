// Compose the /admin OG card (1200×630) → public/og-admin-1200x630.jpg
//
// Deliberately unlike the main card (scripts/og.mjs): where the app's card
// is parchment with the Molteni painting, this one is "night office" ink
// with a rubric-red bar chart — ops, not devotion. Same type family so it
// still reads as the same house.
//
// Needs Vollkorn / Vollkorn SC / Jost visible to fontconfig.
// Run: node scripts/og-admin.mjs
import sharp from "sharp";

const W = 1200, H = 630;

// A quiet bar chart as the right-hand panel — fixed heights, no data claim.
const BARS = [28, 44, 36, 62, 50, 78, 66, 96, 84, 118];
const BAR_W = 30, GAP = 14, CHART_X = 760, BASE_Y = 470;
const bars = BARS.map((h, i) =>
  `<rect x="${CHART_X + i * (BAR_W + GAP)}" y="${BASE_Y - h}" width="${BAR_W}" height="${h}" rx="3"
     fill="${i === BARS.length - 1 ? "#E56B5C" : "#3A3630"}"/>`).join("\n  ");

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#100E0A"/>
  <rect x="0" y="0" width="${W}" height="6" fill="#A81A1A"/>

  <!-- versal chip: red, bars — matches /admin-favicon.svg -->
  <rect x="64" y="80" width="84" height="84" rx="6" fill="#A81A1A" stroke="#7A1212" stroke-width="2"/>
  <g fill="#FFF9F2">
    <rect x="80" y="127" width="13" height="21" rx="1.5"/>
    <rect x="99" y="111" width="13" height="37" rx="1.5"/>
    <rect x="118" y="98" width="13" height="50" rx="1.5"/>
  </g>

  <text x="64" y="224" font-family="Jost" font-weight="600" font-size="21" letter-spacing="4" fill="#E56B5C">DASBOR · AGREGAT ANONIM</text>

  <text x="60" y="312" font-family="Vollkorn SC" font-size="84" fill="#F4EEDE">Analitik</text>
  <text x="64" y="368" font-family="Vollkorn" font-style="italic" font-size="34" fill="#A0957F">Panduan Pengakuan Dosa</text>

  <line x1="64" y1="412" x2="640" y2="412" stroke="#2C2820" stroke-width="2"/>

  <text x="64" y="456" font-family="Vollkorn" font-size="24" fill="#F4EEDE">Kunjungan halaman, tempat, dan peta pembaca —</text>
  <text x="64" y="488" font-family="Vollkorn" font-size="24" fill="#F4EEDE">tanpa cookie, tanpa identitas siapa pun.</text>

  ${bars}
  <line x1="${CHART_X - 8}" y1="${BASE_Y}" x2="${CHART_X + BARS.length * (BAR_W + GAP) - GAP + 8}" y2="${BASE_Y}" stroke="#2C2820" stroke-width="2"/>

  <text x="64" y="580" font-family="Jost" font-weight="500" font-size="19" letter-spacing="1.5" fill="#A0957F">panduan-pengakuan-dosa.pages.dev/admin</text>
</svg>`;

await sharp(Buffer.from(svg)).jpeg({ quality: 92, mozjpeg: true }).toFile("public/og-admin-1200x630.jpg");
console.log("public/og-admin-1200x630.jpg written");
