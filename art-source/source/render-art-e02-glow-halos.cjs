#!/usr/bin/env node

// Builds ART-E02 tintable glow masks from deterministic quantized distance
// fields. ImageGen is a material reference only; no generated background,
// color, blur kernel, or pixel is copied into the runtime candidates.

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
  const data = Buffer.alloc(width * height * 4, 255);
  data.fill(0);
  const centerX = (width - 1) / 2;
  const centerY = (height - 1) / 2;
  for (let blockY = 0; blockY < height; blockY += blockSize) {
    for (let blockX = 0; blockX < width; blockX += blockSize) {
      const sampleX = blockX + (blockSize - 1) / 2 - centerX;
      const sampleY = blockY + (blockSize - 1) / 2 - centerY;
      const alpha = Math.round(quantizeAlpha(evaluator(sampleX, sampleY)));
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

function coreGlowMask() {
  const mask = createMask(64, 64, 2, (x, y) => {
    const radius = Math.hypot(x, y);
    if (radius <= 4) {
      return 1;
    }
    if (radius >= 29) {
      return 0;
    }
    const progress = (radius - 4) / 25;
    return Math.pow(1 - progress, 2.15);
  });
  addRect(mask, 30, 30, 4, 4, 255);
  addRect(mask, 12, 16, 2, 2, 68);
  addRect(mask, 50, 18, 2, 2, 58);
  addRect(mask, 16, 48, 2, 2, 52);
  addRect(mask, 48, 46, 2, 2, 64);
  return mask;
}

function pulseRingMask() {
  const mask = createMask(128, 128, 2, (x, y) => {
    const radius = Math.hypot(x, y);
    const distance = Math.abs(radius - 43);
    if (distance >= 9) {
      return 0;
    }
    const angle = Math.atan2(y, x);
    const cardinalDistance = Math.abs(Math.sin(angle * 2));
    if (cardinalDistance < 0.2) {
      return 0;
    }
    const line = distance <= 1.4 ? 1 : Math.pow(1 - (distance - 1.4) / 7.6, 2);
    const gapFade = clamp((cardinalDistance - 0.2) / 0.16);
    return line * gapFade;
  });
  const sparks = [
    [62, 10, 4, 4, 210], [63, 4, 2, 2, 108], [62, 114, 4, 4, 196], [63, 122, 2, 2, 98],
    [10, 62, 4, 4, 200], [4, 63, 2, 2, 98], [114, 62, 4, 4, 210], [122, 63, 2, 2, 108],
  ];
  for (const spark of sparks) {
    addRect(mask, ...spark);
  }
  return mask;
}

function diamondHaloMask() {
  const mask = createMask(128, 128, 2, (x, y) => {
    const diamondRadius = Math.abs(x) + Math.abs(y);
    const distance = Math.abs(diamondRadius - 49);
    if (distance >= 9) {
      return 0;
    }
    return distance <= 1.2 ? 1 : Math.pow(1 - (distance - 1.2) / 7.8, 2.1);
  });
  const sparks = [
    [62, 6, 4, 4, 208], [63, 0, 2, 2, 104], [62, 118, 4, 4, 194], [63, 126, 2, 2, 90],
    [6, 62, 4, 4, 194], [0, 63, 2, 2, 90], [118, 62, 4, 4, 208], [126, 63, 2, 2, 104],
    [20, 20, 2, 2, 54], [106, 20, 2, 2, 60], [20, 106, 2, 2, 48], [106, 106, 2, 2, 54],
  ];
  for (const spark of sparks) {
    addRect(mask, ...spark);
  }
  return mask;
}

function sharpMask(mask) {
  return sharp(mask.data, { raw: mask.info });
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
  const cards = [
    [70, "01 · CORE GLOW", "64×64 · CLEAR CONTACT", colors.gold],
    [640, "02 · PULSE RING", "128×128 · CHAIN PULSE", colors.cyan],
    [1210, "03 · DIAMOND HALO", "128×128 · LEVEL REWARD", colors.coral],
  ].map(([x, title, subtitle, accent]) => `<path d="${steppedPath(x, 190, 520, 510, 14)}" fill="${colors.panel}" stroke="${colors.border}" stroke-width="2"/>
    <text x="${x + 30}" y="235" fill="${accent}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="1.5">${title}</text>
    <text x="${x + 30}" y="270" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15" letter-spacing="1">${subtitle}</text>
    <text x="${x + 260}" y="658" text-anchor="middle" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="14">WHITE ALPHA · RUNTIME TINT</text>`).join("");

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1100">
    <rect width="1800" height="1100" fill="${colors.canvas}"/>
    <text x="80" y="76" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="44" font-weight="700" letter-spacing="3">SANDFALL GLOW / HALO SYSTEM</text>
    <text x="82" y="116" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="20" letter-spacing="2">ART-E02 · QUANTIZED DISTANCE FIELD · TINTABLE WHITE ALPHA</text>
    <rect x="82" y="142" width="72" height="8" fill="${colors.cyan}"/><rect x="162" y="142" width="72" height="8" fill="${colors.blue}"/><rect x="242" y="142" width="72" height="8" fill="${colors.coral}"/><rect x="322" y="142" width="72" height="8" fill="${colors.gold}"/><rect x="402" y="144" width="1318" height="4" fill="${colors.decoration}"/>
    ${cards}
    <path d="${steppedPath(80, 760, 1640, 260, 16)}" fill="${colors.panel}" stroke="${colors.border}" stroke-width="2"/>
    <text x="120" y="808" fill="${colors.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">RUNTIME CONTRACT</text>
    <text x="120" y="855" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">COLOR / BLEND</text><text x="1680" y="855" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">WHITE MASK · RUNTIME TINT · CONTROLLED ADDITIVE</text>
    <text x="120" y="895" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">CENTER SAFETY</text><text x="1680" y="895" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">RING / DIAMOND CENTER ALPHA 0</text>
    <text x="120" y="935" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">E06 BUDGET</text><text x="1680" y="935" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">MAX 4 HALOS · MAX 180 MS PEAK FLASH</text>
    <text x="120" y="975" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">SAMPLING</text><text x="1680" y="975" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">LINEAR FOR SOFT FIELD · PIXEL-SNAPPED TRANSFORM</text>
    <text x="80" y="1065" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">NO PREBAKED COLOR · NO FULL-SCREEN BLOOM · NO MAGIC GLYPHS · ART-E06 INTEGRATION DEFERRED</text>
  </svg>`);
}

function sizeCheckBaseSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="340">
    <rect width="1200" height="340" fill="${colors.canvas}"/>
    <text x="42" y="48" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="24" font-weight="700">ART-E02 · 1× RUNTIME SIZE CHECK</text>
    <text x="42" y="78" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">64×64 CORE · 128×128 RING / DIAMOND · ACTUAL PIXEL SIZE</text>
  </svg>`);
}

async function build() {
  fs.mkdirSync(exportDir, { recursive: true });
  fs.mkdirSync(path.dirname(boardPath), { recursive: true });
  fs.mkdirSync(path.dirname(sizeCheckPath), { recursive: true });

  const core = coreGlowMask();
  const ring = pulseRingMask();
  const diamond = diamondHaloMask();
  const core2x = scaleMaskNearest(core, 2);
  const ring2x = scaleMaskNearest(ring, 2);
  const diamond2x = scaleMaskNearest(diamond, 2);

  await Promise.all([
    sharpMask(core).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-glow-core-64.png")),
    sharpMask(core2x).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-glow-core-128.png")),
    sharpMask(ring).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-halo-pulse-ring-128.png")),
    sharpMask(ring2x).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-halo-pulse-ring-256.png")),
    sharpMask(diamond).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-halo-diamond-128.png")),
    sharpMask(diamond2x).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-halo-diamond-256.png")),
  ]);

  const corePreview = await sharpMask(core).resize(256, 256, { kernel: "nearest" }).tint(colors.gold).png().toBuffer();
  const ringPreview = await sharpMask(ring).resize(256, 256, { kernel: "nearest" }).tint(colors.cyan).png().toBuffer();
  const diamondPreview = await sharpMask(diamond).resize(256, 256, { kernel: "nearest" }).tint(colors.coral).png().toBuffer();

  await sharp({ create: { width: 1800, height: 1100, channels: 4, background: colors.canvas } })
    .composite([
      { input: boardBaseSvg(), left: 0, top: 0 },
      { input: checkerboardSvg(360, 320, 20), left: 150, top: 310 },
      { input: corePreview, left: 202, top: 342 },
      { input: checkerboardSvg(360, 320, 20), left: 720, top: 310 },
      { input: ringPreview, left: 772, top: 342 },
      { input: checkerboardSvg(360, 320, 20), left: 1290, top: 310 },
      { input: diamondPreview, left: 1342, top: 342 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(boardPath);

  await sharp({ create: { width: 1200, height: 340, channels: 4, background: colors.canvas } })
    .composite([
      { input: sizeCheckBaseSvg(), left: 0, top: 0 },
      { input: checkerboardSvg(128, 128, 8), left: 110, top: 130 },
      { input: await sharpMask(core).tint(colors.gold).png().toBuffer(), left: 142, top: 162 },
      { input: checkerboardSvg(160, 160, 8), left: 400, top: 114 },
      { input: await sharpMask(ring).tint(colors.cyan).png().toBuffer(), left: 416, top: 130 },
      { input: checkerboardSvg(160, 160, 8), left: 760, top: 114 },
      { input: await sharpMask(diamond).tint(colors.coral).png().toBuffer(), left: 776, top: 130 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(sizeCheckPath);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
