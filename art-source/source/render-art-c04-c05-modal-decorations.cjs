#!/usr/bin/env node

// Builds the shared ART-C04 / ART-C05 modal decoration system. ImageGen
// candidates guide particle rhythm only; these deterministic SVGs own the
// final geometry, safe zones, colors, and transparent runtime exports.

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

const c = {
  canvas: "#050D19",
  panel: "#0C121F",
  inset: "#091728",
  idle: "#4E7398",
  decoration: "#375373",
  cyan: "#41CDC3",
  blue: "#5B8DEF",
  danger: "#FF636B",
  dangerDim: "#A83F4D",
  primary: "#EEF3FF",
  secondary: "#B4C2DB",
  weak: "#6F8EB1",
};

function steppedPath(x, y, width, height, cut) {
  const right = x + width;
  const bottom = y + height;
  const half = cut / 2;
  return `M${x + cut} ${y}H${right - cut}H${right - half}V${y + half}H${right}V${bottom - cut}V${bottom - half}H${right - half}V${bottom}H${x + cut}H${x + half}V${bottom - half}H${x}V${y + cut}V${y + half}H${x + half}V${y}Z`;
}

const cornerParticles = [
  [8, 17, 3, "primary"], [14, 11, 2, "secondary"], [15, 24, 2, "primary"],
  [11, 31, 2, "secondary"], [23, 15, 1, "primary"], [14, 27, 2, "idle"],
  [6, 268, 2, "secondary"], [12, 276, 3, "primary"], [18, 284, 2, "primary"],
  [15, 272, 2, "idle"], [27, 288, 1, "secondary"], [10, 280, 2, "primary"],
];

function mirroredParticles(variant) {
  const colorFor = (role) => {
    if (variant === "pause") {
      return role === "primary" ? c.cyan : role === "secondary" ? c.blue : c.idle;
    }
    return role === "primary" ? c.danger : role === "secondary" ? c.blue : c.idle;
  };
  const blocks = [];
  for (const [x, y, size, role] of cornerParticles) {
    const color = colorFor(role);
    blocks.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${color}" opacity="${role === "idle" ? 0.55 : 0.92}"/>`);
    blocks.push(`<rect x="${286 - x - size}" y="${y}" width="${size}" height="${size}" fill="${color}" opacity="${role === "idle" ? 0.55 : 0.92}"/>`);
  }
  return blocks.join("");
}

function modalDecorationSvg(variant) {
  const pause = variant === "pause";
  const primary = pause ? c.cyan : c.danger;
  const secondary = c.blue;
  const bottomAccent = pause ? c.blue : c.dangerDim;
  const title = pause ? "SANDFALL PAUSE MODAL DECORATION" : "SANDFALL GAME OVER MODAL DECORATION";
  const topMotif = pause
    ? '<rect x="137" y="7" width="4" height="12" fill="#41CDC3"/><rect x="145" y="7" width="4" height="12" fill="#41CDC3"/>'
    : '<rect x="137" y="6" width="12" height="3" fill="#FF636B"/><rect x="140" y="12" width="6" height="4" fill="#FF636B"/><rect x="141" y="19" width="4" height="4" fill="#A83F4D"/>';
  const failureDebris = pause ? "" : [
    [8, 48, 2], [11, 59, 3], [14, 72, 2], [276, 51, 2], [272, 64, 3],
    [8, 246, 2], [11, 258, 3], [276, 249, 2], [272, 262, 3],
  ].map(([x, y, size], index) => `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${index % 3 === 0 ? c.dangerDim : c.danger}" opacity="${index % 2 === 0 ? 0.72 : 0.94}"/>`).join("");

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 286 300" width="286" height="300" shape-rendering="crispEdges">
    <title>${title}</title>
    <defs>
      <mask id="frame-gaps">
        <rect width="286" height="300" fill="white"/>
        <rect x="104" y="0" width="24" height="5" fill="black"/><rect x="158" y="0" width="24" height="5" fill="black"/>
        <rect x="0" y="82" width="5" height="14" fill="black"/><rect x="0" y="151" width="5" height="14" fill="black"/><rect x="0" y="218" width="5" height="14" fill="black"/>
        <rect x="281" y="82" width="5" height="14" fill="black"/><rect x="281" y="151" width="5" height="14" fill="black"/><rect x="281" y="218" width="5" height="14" fill="black"/>
        <rect x="99" y="295" width="28" height="5" fill="black"/><rect x="159" y="295" width="28" height="5" fill="black"/>
      </mask>
    </defs>
    <path d="${steppedPath(2, 2, 282, 296, 12)}" fill="none" stroke="${c.idle}" stroke-width="2" mask="url(#frame-gaps)"/>
    <path d="M14 2H74M212 2H272M2 14V67M284 14V67" fill="none" stroke="${primary}" stroke-width="2"/>
    <path d="M14 298H70M216 298H272M2 246V286M284 246V286" fill="none" stroke="${bottomAccent}" stroke-width="2"/>
    <path d="M17 7H58M228 7H269M17 293H51M235 293H269" fill="none" stroke="${secondary}" stroke-width="1" opacity="0.8"/>
    <rect x="4" y="103" width="2" height="45" fill="${c.decoration}"/><rect x="280" y="103" width="2" height="45" fill="${c.decoration}"/>
    <rect x="4" y="170" width="2" height="37" fill="${c.decoration}"/><rect x="280" y="170" width="2" height="37" fill="${c.decoration}"/>
    ${topMotif}
    ${mirroredParticles(variant)}
    ${failureDebris}
  </svg>`);
}

function safeZoneSvg(x, y, scale, variant) {
  const accent = variant === "pause" ? c.cyan : c.danger;
  const box = (top, height, label) => `<rect x="${x + 18 * scale}" y="${y + top * scale}" width="${250 * scale}" height="${height * scale}" fill="none" stroke="${c.weak}" stroke-width="1.5" stroke-dasharray="7 6" opacity="0.62"/><text x="${x + 143 * scale}" y="${y + (top + height / 2 + 3) * scale}" text-anchor="middle" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="${8 * scale}" font-weight="700">${label}</text>`;
  return `<g>
    <path d="${steppedPath(x, y, 286 * scale, 300 * scale, 12 * scale)}" fill="${c.panel}"/>
    <rect x="${x + 20 * scale}" y="${y + 20 * scale}" width="${246 * scale}" height="${260 * scale}" fill="${c.inset}" opacity="0.22"/>
    ${box(24, 52, "TITLE SAFE")}
    ${box(76, 102, "DATA SAFE")}
    ${box(190, 56, "BUTTON SAFE")}
    ${box(254, 28, "HINT SAFE")}
    <rect x="${x + 16 * scale}" y="${y + 14 * scale}" width="${6 * scale}" height="${6 * scale}" fill="${accent}" opacity="0.5"/>
  </g>`;
}

function checkerboardSvg(width, height) {
  const blocks = [];
  const size = 10;
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      blocks.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${(x / size + y / size) % 2 === 0 ? "#142033" : "#0B1422"}"/>`);
    }
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${blocks.join("")}</svg>`);
}

function boardBaseSvg() {
  const leftX = 80;
  const rightX = 1034;
  const modalY = 205;
  const scale = 2.4;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1320">
    <rect width="1800" height="1320" fill="${c.canvas}"/>
    <text x="80" y="78" fill="${c.primary}" font-family="Oxanium, Arial, sans-serif" font-size="46" font-weight="700" letter-spacing="3">SANDFALL MODAL DECORATION SYSTEM</text>
    <text x="82" y="118" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="20" letter-spacing="2">ART-C04 / C05 · SHARED GEOMETRY · CLEAN INFORMATION ZONES</text>
    <rect x="82" y="144" width="72" height="8" fill="${c.cyan}"/><rect x="162" y="144" width="72" height="8" fill="${c.blue}"/><rect x="242" y="144" width="72" height="8" fill="${c.danger}"/><rect x="322" y="146" width="1398" height="4" fill="${c.decoration}"/>
    <text x="${leftX}" y="185" fill="${c.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">C04 · PAUSE · CALM CYAN / BLUE</text>
    <text x="${rightX}" y="185" fill="${c.danger}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">C05 · GAME OVER · RESTRAINED DANGER</text>
    ${safeZoneSvg(leftX, modalY, scale, "pause")}
    ${safeZoneSvg(rightX, modalY, scale, "game-over")}
    <text x="80" y="950" fill="${c.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">1× TRANSPARENT RUNTIME OUTPUT</text>
    <text x="80" y="978" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="16">286×300 · WHITE BOXES ABOVE ARE REVIEW GUIDES ONLY · NOT IN THE PNG</text>
    <path d="${steppedPath(840, 990, 880, 300, 16)}" fill="${c.panel}" stroke="${c.idle}" stroke-width="2"/>
    <text x="880" y="1035" fill="${c.primary}" font-family="Oxanium, Arial, sans-serif" font-size="19" font-weight="700">COMMON GEOMETRY</text>
    <text x="880" y="1074" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">VIEWPORT</text><text x="1680" y="1074" text-anchor="end" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">286×300</text>
    <text x="880" y="1110" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">MASTER</text><text x="1680" y="1110" text-anchor="end" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">572×600</text>
    <text x="880" y="1146" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">OUTER BAND</text><text x="1680" y="1146" text-anchor="end" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">≤18 PX</text>
    <text x="880" y="1182" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">CENTER ALPHA</text><text x="1680" y="1182" text-anchor="end" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">FULLY CLEAR</text>
    <path d="M880 1206H1680" stroke="${c.decoration}" stroke-width="2"/>
    <text x="880" y="1242" fill="${c.weak}" font-family="Noto Sans SC, Arial, sans-serif" font-size="16">C05 与 C04 共用粒子坐标；只改变红色占比并增加少量坠落方粒。</text>
    <text x="80" y="1300" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">TRANSPARENT SPRITE OVER COCOS GRAPHICS CARD · NO TEXT · NO BUTTONS · ART-C08 INTEGRATION</text>
  </svg>`);
}

async function build() {
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(exportDir, { recursive: true });
  const pauseSvg = modalDecorationSvg("pause");
  const gameOverSvg = modalDecorationSvg("game-over");
  fs.writeFileSync(path.join(sourceDir, "luosha-modal-decoration-pause.svg"), pauseSvg);
  fs.writeFileSync(path.join(sourceDir, "luosha-modal-decoration-game-over.svg"), gameOverSvg);

  await Promise.all([
    sharp(pauseSvg).resize(286, 300).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-modal-decoration-pause-286x300.png")),
    sharp(pauseSvg).resize(572, 600).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-modal-decoration-pause-572x600.png")),
    sharp(gameOverSvg).resize(286, 300).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-modal-decoration-game-over-286x300.png")),
    sharp(gameOverSvg).resize(572, 600).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-modal-decoration-game-over-572x600.png")),
  ]);

  const scale = 2.4;
  const pauseLarge = await sharp(pauseSvg).resize(Math.round(286 * scale), Math.round(300 * scale)).png().toBuffer();
  const gameOverLarge = await sharp(gameOverSvg).resize(Math.round(286 * scale), Math.round(300 * scale)).png().toBuffer();
  const checker = checkerboardSvg(286, 300);
  const board = await sharp({ create: { width: 1800, height: 1320, channels: 4, background: c.canvas } })
    .composite([
      { input: boardBaseSvg(), left: 0, top: 0 },
      { input: pauseLarge, left: 80, top: 205 },
      { input: gameOverLarge, left: 1034, top: 205 },
      { input: checker, left: 80, top: 990 },
      { input: pauseSvg, left: 80, top: 990 },
      { input: checker, left: 430, top: 990 },
      { input: gameOverSvg, left: 430, top: 990 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(boardPath);
  return board;
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
