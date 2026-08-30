#!/usr/bin/env node

// Renders deterministic SVG exports and a review board. Sharp is supplied by
// the host art-tooling environment so it does not become a game dependency.

const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
function argument(name) {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) {
    throw new Error(`missing ${name}`);
  }
  return args[index + 1];
}

const sharp = require(argument("--sharp"));
const sourceDir = path.resolve(argument("--source-dir"));
const exportDir = path.resolve(argument("--export-dir"));
const boardPath = path.resolve(argument("--board"));

fs.mkdirSync(exportDir, { recursive: true });
fs.mkdirSync(path.dirname(boardPath), { recursive: true });

const variants = [
  ["luosha-logo-horizontal", 640, 260],
  ["luosha-logo-lockup", 640, 320],
  ["luosha-logo-vertical", 420, 420],
  ["luosha-logo-mark", 256, 256],
  ["luosha-logo-monochrome", 640, 260],
  ["luosha-logo-monochrome-dark", 640, 260],
];

async function renderVariant(name, width, height) {
  const input = path.join(sourceDir, `${name}.svg`);
  const oneX = path.join(exportDir, `${name}.png`);
  const twoX = path.join(exportDir, `${name}@2x.png`);
  await sharp(input).resize(width, height).png({ compressionLevel: 9 }).toFile(oneX);
  await sharp(input).resize(width * 2, height * 2).png({ compressionLevel: 9 }).toFile(twoX);
}

function panelSvg(x, y, width, height, label) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="22" fill="#0C121F" stroke="#375373" stroke-width="2"/>
    <text x="30" y="45" fill="#41CDC3" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">${label}</text>
  </svg>`);
}

async function buildBoard() {
  const width = 1600;
  const height = 1100;
  const header = Buffer.from(`<svg width="1600" height="1100" xmlns="http://www.w3.org/2000/svg">
    <rect width="1600" height="1100" fill="#050D19"/>
    <text x="78" y="74" fill="#EEF3FF" font-family="Arial, sans-serif" font-size="48" font-weight="700" letter-spacing="3">LUOSHA / SANDFALL LOGO SYSTEM</text>
    <text x="80" y="116" fill="#6F8EB1" font-family="Arial, sans-serif" font-size="20" letter-spacing="2">ART-B02 · 02 HORIZONTAL BRIDGE + 01 COMPLETE PIXEL-GLYPH SKELETON</text>
    <rect x="80" y="146" width="62" height="6" rx="3" fill="#4ECDC4"/>
    <rect x="148" y="146" width="62" height="6" rx="3" fill="#5B8DEF"/>
    <rect x="216" y="146" width="62" height="6" rx="3" fill="#FF6B6B"/>
    <rect x="284" y="146" width="62" height="6" rx="3" fill="#FFC857"/>
    <rect x="352" y="146" width="1170" height="6" rx="3" fill="#375373"/>
  </svg>`);

  const composites = [
    { input: header, left: 0, top: 0 },
    { input: panelSvg(0, 0, 930, 330, "CHINESE HORIZONTAL"), left: 70, top: 190 },
    { input: panelSvg(0, 0, 460, 330, "PURE MARK"), left: 1070, top: 190 },
    { input: panelSvg(0, 0, 930, 390, "CHINESE + SANDFALL"), left: 70, top: 550 },
    { input: panelSvg(0, 0, 460, 390, "VERTICAL LOCKUP"), left: 1070, top: 550 },
    { input: path.join(exportDir, "luosha-logo-horizontal.png"), left: 210, top: 250 },
    { input: path.join(exportDir, "luosha-logo-mark.png"), left: 1172, top: 236 },
    { input: path.join(exportDir, "luosha-logo-lockup.png"), left: 210, top: 600 },
    { input: path.join(exportDir, "luosha-logo-vertical.png"), left: 1090, top: 542 },
  ];

  const footer = Buffer.from(`<svg width="1600" height="1100" xmlns="http://www.w3.org/2000/svg">
    <rect x="70" y="970" width="1460" height="70" rx="18" fill="#091728" stroke="#4E7398" stroke-width="2"/>
    <text x="100" y="1014" fill="#B4C2DB" font-family="Arial, sans-serif" font-size="21">28×28 square-grain Chinese skeleton · transparent PNG · self-contained SVG · Oxanium paths</text>
  </svg>`);
  composites.push({ input: footer, left: 0, top: 0 });

  await sharp({
    create: { width, height, channels: 4, background: "#050D19" },
  }).composite(composites).png({ compressionLevel: 9 }).toFile(boardPath);
}

(async () => {
  for (const [name, width, height] of variants) {
    await renderVariant(name, width, height);
  }
  await buildBoard();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
