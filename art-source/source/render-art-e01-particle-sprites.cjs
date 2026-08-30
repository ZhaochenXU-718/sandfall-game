#!/usr/bin/env node

// Builds ART-E01 tintable sand/dust particle masks. ImageGen establishes the
// four motion silhouettes only; these deterministic 32 px SVGs own every
// runtime pixel, alpha tier, export size, and review-board placement.

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
const smallCheckPath = path.resolve(argument("--small-check"));

const colors = {
  canvas: "#050D19",
  panel: "#0C121F",
  inset: "#091728",
  gridA: "#142033",
  gridB: "#0B1422",
  border: "#4E7398",
  weak: "#6F8EB1",
  secondary: "#B4C2DB",
  primary: "#EEF3FF",
  cyan: "#41CDC3",
  blue: "#5B8DEF",
  coral: "#FF636B",
  gold: "#FFC857",
};

// Rect tuple: x, y, width, height, opacity. All coordinates land on the 1 px
// grid so nearest sampling stays crisp at both 32 px and 64 px exports.
const sprites = [
  {
    key: "dust-impact",
    title: "01 · IMPACT PUFF",
    motion: "COMPACT CONTACT / LAND",
    tint: colors.gold,
    rects: [
      [11, 14, 10, 5, 1], [13, 11, 6, 3, 0.84], [8, 16, 3, 3, 0.72],
      [21, 15, 3, 3, 0.68], [10, 20, 4, 2, 0.58], [17, 20, 5, 2, 0.62],
      [7, 11, 2, 2, 0.48], [23, 10, 2, 2, 0.52], [4, 15, 2, 2, 0.36],
      [26, 17, 2, 2, 0.4], [7, 23, 2, 2, 0.34], [23, 23, 2, 2, 0.38],
      [14, 7, 2, 2, 0.42], [19, 5, 1, 1, 0.3],
    ],
  },
  {
    key: "dust-rise",
    title: "02 · RISING WISP",
    motion: "SANDIFY / LEVEL LIFT",
    tint: colors.cyan,
    rects: [
      [9, 23, 10, 4, 1], [12, 20, 8, 3, 0.88], [17, 17, 5, 3, 0.78],
      [14, 14, 5, 3, 0.68], [18, 11, 4, 3, 0.6], [16, 8, 3, 3, 0.52],
      [20, 5, 2, 2, 0.42], [18, 2, 2, 2, 0.3], [7, 21, 2, 2, 0.44],
      [22, 20, 2, 2, 0.46], [12, 10, 2, 2, 0.36], [23, 8, 2, 2, 0.34],
      [13, 4, 1, 1, 0.28],
    ],
  },
  {
    key: "dust-burst",
    title: "03 · OUTWARD BURST",
    motion: "CLEAR / CHAIN ACCENT",
    tint: colors.coral,
    rects: [
      [13, 13, 6, 6, 1], [11, 15, 2, 3, 0.82], [19, 14, 3, 3, 0.78],
      [14, 10, 3, 3, 0.72], [16, 19, 3, 3, 0.68], [7, 10, 2, 2, 0.52],
      [23, 8, 2, 2, 0.5], [5, 18, 3, 2, 0.46], [24, 20, 3, 2, 0.48],
      [9, 24, 2, 2, 0.4], [21, 25, 2, 2, 0.38], [3, 7, 2, 2, 0.3],
      [27, 13, 2, 2, 0.34], [14, 3, 2, 2, 0.34], [5, 27, 1, 1, 0.24],
      [27, 28, 1, 1, 0.24],
    ],
  },
  {
    key: "sand-fall",
    title: "04 · FALLING TRAIL",
    motion: "DROP / COLLAPSE",
    tint: colors.blue,
    rects: [
      [10, 4, 12, 3, 1], [12, 7, 8, 3, 0.82], [14, 10, 5, 3, 0.74],
      [12, 13, 4, 3, 0.66], [15, 16, 4, 3, 0.6], [13, 20, 3, 3, 0.54],
      [16, 24, 3, 3, 0.46], [14, 29, 2, 2, 0.34], [8, 8, 2, 2, 0.4],
      [21, 11, 2, 2, 0.44], [10, 18, 2, 2, 0.36], [20, 21, 2, 2, 0.34],
      [9, 26, 2, 2, 0.3], [22, 27, 1, 1, 0.26],
    ],
  },
];

function spriteSvg(sprite, tint = "#FFFFFF") {
  const rects = sprite.rects.map(([x, y, width, height, opacity]) =>
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${tint}" opacity="${opacity}"/>`,
  ).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges">
    <title>SANDFALL ${sprite.key.toUpperCase()} PARTICLE MASK</title>
    ${rects}
  </svg>`);
}

function checkerboardSvg(width, height, size) {
  const blocks = [];
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      const fill = (x / size + y / size) % 2 === 0 ? colors.gridA : colors.gridB;
      blocks.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${fill}"/>`);
    }
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${blocks.join("")}</svg>`);
}

function steppedPath(x, y, width, height, cut) {
  const right = x + width;
  const bottom = y + height;
  const half = cut / 2;
  return `M${x + cut} ${y}H${right - cut}H${right - half}V${y + half}H${right}V${bottom - cut}V${bottom - half}H${right - half}V${bottom}H${x + cut}H${x + half}V${bottom - half}H${x}V${y + cut}V${y + half}H${x + half}V${y}Z`;
}

function boardBaseSvg() {
  const cards = sprites.map((sprite, index) => {
    const x = 60 + index * 430;
    return `<path d="${steppedPath(x, 190, 390, 500, 14)}" fill="${colors.panel}" stroke="${colors.border}" stroke-width="2"/>
      <text x="${x + 28}" y="232" fill="${sprite.tint}" font-family="Oxanium, Arial, sans-serif" font-size="21" font-weight="700" letter-spacing="1.5">${sprite.title}</text>
      <text x="${x + 28}" y="266" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="14" letter-spacing="1">${sprite.motion}</text>
      <text x="${x + 195}" y="648" text-anchor="middle" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="14">32×32 WHITE ALPHA MASK</text>`;
  }).join("");

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1100">
    <rect width="1800" height="1100" fill="${colors.canvas}"/>
    <text x="80" y="76" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="44" font-weight="700" letter-spacing="3">SANDFALL PARTICLE SPRITE SYSTEM</text>
    <text x="82" y="116" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="20" letter-spacing="2">ART-E01 · TINTABLE WHITE ALPHA · NEAREST SAMPLING · NO SOFT BLUR</text>
    <rect x="82" y="142" width="72" height="8" fill="${colors.cyan}"/><rect x="162" y="142" width="72" height="8" fill="${colors.blue}"/><rect x="242" y="142" width="72" height="8" fill="${colors.coral}"/><rect x="322" y="142" width="72" height="8" fill="${colors.gold}"/><rect x="402" y="144" width="1318" height="4" fill="#375373"/>
    ${cards}
    <path d="${steppedPath(80, 750, 1640, 270, 16)}" fill="${colors.panel}" stroke="${colors.border}" stroke-width="2"/>
    <text x="120" y="800" fill="${colors.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">RUNTIME CONTRACT</text>
    <text x="120" y="848" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">SOURCE / ARCHIVE</text><text x="1680" y="848" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">32×32 / 64×64 · RGBA</text>
    <text x="120" y="886" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">COLOR</text><text x="1680" y="886" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">WHITE MASK · SPRITE COLOR AT RUNTIME</text>
    <text x="120" y="924" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">SAMPLING / BLEND</text><text x="1680" y="924" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">NEAREST · NORMAL OR CONTROLLED ADDITIVE</text>
    <text x="120" y="962" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">E06 BUDGET</text><text x="1680" y="962" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">ATLAS LATER · MAX 48 ACTIVE PARTICLES</text>
    <text x="80" y="1065" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">NO PREBAKED COLOR · NO CLOUDY SMOKE · NO FULL-SCREEN NOISE · ART-E06 INTEGRATION DEFERRED</text>
  </svg>`);
}

function smallCheckBaseSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="260">
    <rect width="1000" height="260" fill="${colors.canvas}"/>
    <text x="42" y="48" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="24" font-weight="700">ART-E01 · 1× RUNTIME SIZE CHECK</text>
    <text x="42" y="78" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">SPRITES BELOW ARE DISPLAYED AT EXACTLY 32×32 PIXELS</text>
  </svg>`);
}

async function build() {
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(exportDir, { recursive: true });
  fs.mkdirSync(path.dirname(boardPath), { recursive: true });
  fs.mkdirSync(path.dirname(smallCheckPath), { recursive: true });

  const whiteSprites = sprites.map((sprite) => spriteSvg(sprite));
  for (let index = 0; index < sprites.length; index += 1) {
    const sprite = sprites[index];
    const source = whiteSprites[index];
    fs.writeFileSync(path.join(sourceDir, `luosha-particle-${sprite.key}.svg`), source);
    await Promise.all([
      sharp(source).resize(32, 32, { kernel: "nearest" }).png({ compressionLevel: 9 }).toFile(path.join(exportDir, `luosha-particle-${sprite.key}-32.png`)),
      sharp(source).resize(64, 64, { kernel: "nearest" }).png({ compressionLevel: 9 }).toFile(path.join(exportDir, `luosha-particle-${sprite.key}-64.png`)),
    ]);
  }

  const boardComposites = [{ input: boardBaseSvg(), left: 0, top: 0 }];
  const smallComposites = [{ input: smallCheckBaseSvg(), left: 0, top: 0 }];
  for (let index = 0; index < sprites.length; index += 1) {
    const sprite = sprites[index];
    const x = 95 + index * 430;
    const tinted = spriteSvg(sprite, sprite.tint);
    boardComposites.push({ input: checkerboardSvg(320, 320, 20), left: x, top: 300 });
    boardComposites.push({ input: await sharp(tinted).resize(256, 256, { kernel: "nearest" }).png().toBuffer(), left: x + 32, top: 332 });

    const smallX = 100 + index * 225;
    smallComposites.push({ input: checkerboardSvg(96, 96, 8), left: smallX, top: 112 });
    smallComposites.push({ input: await sharp(tinted).resize(32, 32, { kernel: "nearest" }).png().toBuffer(), left: smallX + 32, top: 144 });
  }

  await Promise.all([
    sharp({ create: { width: 1800, height: 1100, channels: 4, background: colors.canvas } })
      .composite(boardComposites).png({ compressionLevel: 9 }).toFile(boardPath),
    sharp({ create: { width: 1000, height: 260, channels: 4, background: colors.canvas } })
      .composite(smallComposites).png({ compressionLevel: 9 }).toFile(smallCheckPath),
  ]);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
