#!/usr/bin/env node

// Builds ART-E03 tintable horizontal streak/trail masks. ImageGen establishes
// motion rhythm only; deterministic quantized fields own every runtime pixel,
// gap, alpha tier, archive scale, and review-board placement.

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
const exportDir = path.resolve(argument("--export-dir"));
const boardPath = path.resolve(argument("--board"));
const sizeCheckPath = path.resolve(argument("--size-check"));

const colors = {
  canvas: "#050D19",
  panel: "#0C121F",
  gridA: "#142033",
  gridB: "#0B1422",
  border: "#4E7398",
  decoration: "#375373",
  weak: "#6F8EB1",
  secondary: "#B4C2DB",
  primary: "#EEF3FF",
  cyan: "#41CDC3",
  blue: "#5B8DEF",
  coral: "#FF636B",
  gold: "#FFC857",
};

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function quantizeAlpha(value, levels = 16) {
  if (value <= 0) {
    return 0;
  }
  return Math.round(clamp(value) * (levels - 1)) * 255 / (levels - 1);
}

function createMask(width, height, blockSize, evaluator) {
  const data = Buffer.alloc(width * height * 4);
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  for (let blockY = 0; blockY < height; blockY += blockSize) {
    for (let blockX = 0; blockX < width; blockX += blockSize) {
      const sampleX = blockX + (blockSize - 1) / 2 - centerX;
      const sampleY = blockY + (blockSize - 1) / 2 - centerY;
      const alpha = Math.round(quantizeAlpha(evaluator(sampleX, sampleY, blockX, blockY)));
      for (let y = blockY; y < Math.min(height, blockY + blockSize); y += 1) {
        for (let x = blockX; x < Math.min(width, blockX + blockSize); x += 1) {
          const offset = (y * width + x) * 4;
          data[offset] = 255;
          data[offset + 1] = 255;
          data[offset + 2] = 255;
          data[offset + 3] = alpha;
        }
      }
    }
  }
  return { data, info: { width, height, channels: 4 } };
}

function addRect(mask, x, y, width, height, alpha) {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      if (row < 0 || row >= mask.info.height || column < 0 || column >= mask.info.width) {
        continue;
      }
      const offset = (row * mask.info.width + column) * 4;
      mask.data[offset] = 255;
      mask.data[offset + 1] = 255;
      mask.data[offset + 2] = 255;
      mask.data[offset + 3] = Math.max(mask.data[offset + 3], alpha);
    }
  }
}

function scaleMaskNearest(mask, factor) {
  const width = mask.info.width * factor;
  const height = mask.info.height * factor;
  const data = Buffer.alloc(width * height * 4);
  for (let sourceY = 0; sourceY < mask.info.height; sourceY += 1) {
    for (let sourceX = 0; sourceX < mask.info.width; sourceX += 1) {
      const sourceOffset = (sourceY * mask.info.width + sourceX) * 4;
      for (let offsetY = 0; offsetY < factor; offsetY += 1) {
        for (let offsetX = 0; offsetX < factor; offsetX += 1) {
          const targetX = sourceX * factor + offsetX;
          const targetY = sourceY * factor + offsetY;
          const targetOffset = (targetY * width + targetX) * 4;
          mask.data.copy(data, targetOffset, sourceOffset, sourceOffset + 4);
        }
      }
    }
  }
  return { data, info: { width, height, channels: 4 } };
}

function sharpMask(mask) {
  return sharp(mask.data, { raw: mask.info });
}

function clearSweepMask() {
  const mask = createMask(256, 32, 2, (x, y, blockX) => {
    const edgeFade = Math.pow(clamp(1 - Math.abs(x) / 124), 1.45);
    if (edgeFade <= 0) {
      return 0;
    }
    const distanceY = Math.abs(y);
    const center = distanceY <= 1
      ? 1
      : distanceY < 5
        ? Math.pow(1 - (distanceY - 1) / 4, 2) * 0.48
        : 0;
    const railDistance = Math.min(Math.abs(distanceY - 7), Math.abs(distanceY - 11));
    const segment = Math.floor(blockX / 8);
    const gate = (segment * 7 + Math.floor(distanceY)) % 11 < 8 ? 1 : 0;
    const rail = railDistance <= 1 ? 0.62 * gate : 0;
    return Math.max(center, rail) * edgeFade;
  });
  addRect(mask, 124, 14, 8, 4, 255);
  addRect(mask, 30, 4, 4, 2, 64);
  addRect(mask, 218, 26, 4, 2, 58);
  addRect(mask, 58, 24, 2, 2, 50);
  addRect(mask, 196, 6, 2, 2, 54);
  return mask;
}

function cometTrailMask() {
  const mask = createMask(128, 32, 2, (x, y, blockX) => {
    const headX = 49;
    const headDistance = Math.max(Math.abs(x - headX), Math.abs(y));
    const head = headDistance <= 4
      ? 1
      : headDistance < 9
        ? Math.pow(1 - (headDistance - 4) / 5, 2) * 0.58
        : 0;
    const trailProgress = clamp((x + 59) / 108);
    const segment = Math.floor(blockX / 8);
    const centerGate = segment % 5 === 1 && blockX < 64 ? 0 : 1;
    const outerGate = (segment * 5) % 9 < 6 ? 1 : 0;
    const distanceY = Math.abs(y);
    const center = distanceY <= 1 ? Math.pow(trailProgress, 1.35) * centerGate : 0;
    const outer = Math.abs(distanceY - 5) <= 1
      ? Math.pow(trailProgress, 1.6) * 0.62 * outerGate
      : 0;
    return Math.max(head, center, outer);
  });
  addRect(mask, 110, 12, 8, 8, 255);
  addRect(mask, 106, 10, 4, 4, 196);
  addRect(mask, 106, 18, 4, 4, 196);
  addRect(mask, 120, 14, 4, 4, 112);
  addRect(mask, 18, 8, 4, 2, 54);
  addRect(mask, 32, 22, 4, 2, 62);
  addRect(mask, 50, 6, 2, 2, 50);
  return mask;
}

function noise(index, salt) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function grainFlowMask() {
  const mask = createMask(128, 24, 2, () => 0);
  for (let index = 0; index < 34; index += 1) {
    const progress = index / 33;
    const x = Math.round(4 + progress * 116 + (noise(index, 1) - 0.5) * 3);
    const lane = index % 3;
    const baseY = lane === 0 ? 7 : lane === 1 ? 12 : 16;
    const y = Math.round(baseY + (noise(index, 2) - 0.5) * 4);
    const dense = progress > 0.65;
    const width = dense && index % 4 === 0 ? 4 : 2;
    const height = index % 7 === 0 ? 3 : 2;
    const alpha = Math.round(52 + Math.pow(progress, 1.25) * 190);
    addRect(mask, x, y, width, height, alpha);
    if (dense && index % 3 === 0) {
      addRect(mask, x - 2, y + (lane === 2 ? -3 : 3), 2, 2, Math.round(alpha * 0.72));
    }
  }
  addRect(mask, 114, 10, 8, 4, 255);
  addRect(mask, 108, 8, 4, 2, 186);
  addRect(mask, 108, 16, 4, 2, 174);
  return mask;
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
  const rows = [
    [190, "01 · CLEAR SWEEP", "256×32 · SYMMETRIC CLEAR ENERGY", colors.gold],
    [420, "02 · COMET TRAIL", "128×32 · DIRECTIONAL / FLIPPABLE", colors.cyan],
    [650, "03 · GRAIN FLOW", "128×24 · SPARSE SAND ACCENT", colors.coral],
  ].map(([y, title, subtitle, accent]) => `<path d="${steppedPath(70, y, 1660, 190, 14)}" fill="${colors.panel}" stroke="${colors.border}" stroke-width="2"/>
    <text x="105" y="${y + 48}" fill="${accent}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="1.5">${title}</text>
    <text x="105" y="${y + 82}" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15" letter-spacing="1">${subtitle}</text>
    <text x="1660" y="${y + 182}" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="14">WHITE ALPHA · RUNTIME TINT</text>`).join("");

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200">
    <rect width="1800" height="1200" fill="${colors.canvas}"/>
    <text x="80" y="76" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="44" font-weight="700" letter-spacing="3">SANDFALL HORIZONTAL TRAIL SYSTEM</text>
    <text x="82" y="116" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="20" letter-spacing="2">ART-E03 · SEGMENTED RAILS · TINTABLE WHITE ALPHA · NO SOLID TUBE</text>
    <rect x="82" y="142" width="72" height="8" fill="${colors.cyan}"/><rect x="162" y="142" width="72" height="8" fill="${colors.blue}"/><rect x="242" y="142" width="72" height="8" fill="${colors.coral}"/><rect x="322" y="142" width="72" height="8" fill="${colors.gold}"/><rect x="402" y="144" width="1318" height="4" fill="${colors.decoration}"/>
    ${rows}
    <path d="${steppedPath(80, 900, 1640, 220, 16)}" fill="${colors.panel}" stroke="${colors.border}" stroke-width="2"/>
    <text x="120" y="948" fill="${colors.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">RUNTIME CONTRACT</text>
    <text x="120" y="994" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">COLOR / SAMPLING</text><text x="1680" y="994" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">WHITE MASK · RUNTIME TINT · LINEAR OR NEAREST BY LAYER</text>
    <text x="120" y="1034" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">DIRECTION</text><text x="1680" y="1034" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">COMET / GRAIN POINT RIGHT · FLIP X TO REUSE</text>
    <text x="120" y="1074" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">E06 BUDGET</text><text x="1680" y="1074" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">MAX 3 TRAILS · MAX 220 MS PEAK</text>
    <text x="80" y="1165" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">NO PREBAKED COLOR · NO FULL-WIDTH SOLID RECT · NO PHOTOGRAPHIC MOTION BLUR · ART-E06 INTEGRATION DEFERRED</text>
  </svg>`);
}

function sizeCheckBaseSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="390">
    <rect width="1200" height="390" fill="${colors.canvas}"/>
    <text x="42" y="48" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="24" font-weight="700">ART-E03 · 1× RUNTIME SIZE CHECK</text>
    <text x="42" y="78" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">256×32 SWEEP · 128×32 COMET · 128×24 GRAIN FLOW · ACTUAL PIXEL SIZE</text>
  </svg>`);
}

async function build() {
  fs.mkdirSync(exportDir, { recursive: true });
  fs.mkdirSync(path.dirname(boardPath), { recursive: true });
  fs.mkdirSync(path.dirname(sizeCheckPath), { recursive: true });

  const sweep = clearSweepMask();
  const comet = cometTrailMask();
  const grain = grainFlowMask();
  const sweep2x = scaleMaskNearest(sweep, 2);
  const comet2x = scaleMaskNearest(comet, 2);
  const grain2x = scaleMaskNearest(grain, 2);

  await Promise.all([
    sharpMask(sweep).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-streak-clear-sweep-256x32.png")),
    sharpMask(sweep2x).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-streak-clear-sweep-512x64.png")),
    sharpMask(comet).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-trail-comet-128x32.png")),
    sharpMask(comet2x).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-trail-comet-256x64.png")),
    sharpMask(grain).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-trail-grain-flow-128x24.png")),
    sharpMask(grain2x).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-trail-grain-flow-256x48.png")),
  ]);

  const sweepPreview = await sharpMask(sweep).resize(1024, 128, { kernel: "nearest" }).tint(colors.gold).png().toBuffer();
  const cometPreview = await sharpMask(comet).resize(512, 128, { kernel: "nearest" }).tint(colors.cyan).png().toBuffer();
  const grainPreview = await sharpMask(grain).resize(512, 96, { kernel: "nearest" }).tint(colors.coral).png().toBuffer();

  await sharp({ create: { width: 1800, height: 1200, channels: 4, background: colors.canvas } })
    .composite([
      { input: boardBaseSvg(), left: 0, top: 0 },
      { input: checkerboardSvg(1120, 128, 16), left: 540, top: 222 },
      { input: sweepPreview, left: 588, top: 222 },
      { input: checkerboardSvg(640, 128, 16), left: 900, top: 452 },
      { input: cometPreview, left: 964, top: 452 },
      { input: checkerboardSvg(640, 112, 16), left: 900, top: 686 },
      { input: grainPreview, left: 964, top: 694 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(boardPath);

  await sharp({ create: { width: 1200, height: 390, channels: 4, background: colors.canvas } })
    .composite([
      { input: sizeCheckBaseSvg(), left: 0, top: 0 },
      { input: checkerboardSvg(320, 64, 8), left: 80, top: 126 },
      { input: await sharpMask(sweep).tint(colors.gold).png().toBuffer(), left: 112, top: 142 },
      { input: checkerboardSvg(192, 64, 8), left: 500, top: 126 },
      { input: await sharpMask(comet).tint(colors.cyan).png().toBuffer(), left: 532, top: 142 },
      { input: checkerboardSvg(192, 64, 8), left: 820, top: 126 },
      { input: await sharpMask(grain).tint(colors.coral).png().toBuffer(), left: 852, top: 146 },
      { input: checkerboardSvg(960, 64, 8), left: 80, top: 246 },
      { input: await sharpMask(sweep).tint(colors.blue).png().toBuffer(), left: 432, top: 262 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(sizeCheckPath);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
