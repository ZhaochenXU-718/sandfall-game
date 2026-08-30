#!/usr/bin/env node

// Builds ART-E04 tileable sand-dissolve masks. ImageGen establishes the
// granular breakup rhythm only; deterministic ranked fields own every runtime
// pixel, alpha tier, repeat boundary, archive scale, and review-board state.

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

function smoothStep(value) {
  const clamped = clamp(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function hash2(x, y, salt = 0) {
  let value = Math.imul(x + 0x51ed + salt * 17, 0x45d9f3b)
    ^ Math.imul(y + 0x9e37 + salt * 31, 0x119de1f3);
  value ^= value >>> 16;
  value = Math.imul(value, 0x27d4eb2d);
  value ^= value >>> 15;
  return (value >>> 0) / 0x1_0000_0000;
}

function rankedMask(values, cellWidth, cellHeight, cellSize = 2, levels = 16) {
  const order = values.map((value, index) => ({ value, index }))
    .sort((left, right) => left.value - right.value || left.index - right.index);
  const ranks = new Uint32Array(values.length);
  for (let rank = 0; rank < order.length; rank += 1) {
    ranks[order[rank].index] = rank;
  }

  const width = cellWidth * cellSize;
  const height = cellHeight * cellSize;
  const data = Buffer.alloc(width * height * 4);
  for (let cellY = 0; cellY < cellHeight; cellY += 1) {
    for (let cellX = 0; cellX < cellWidth; cellX += 1) {
      const cellIndex = cellY * cellWidth + cellX;
      const normalized = ranks[cellIndex] / Math.max(1, values.length - 1);
      const alpha = Math.round(normalized * (levels - 1)) * 255 / (levels - 1);
      for (let offsetY = 0; offsetY < cellSize; offsetY += 1) {
        for (let offsetX = 0; offsetX < cellSize; offsetX += 1) {
          const x = cellX * cellSize + offsetX;
          const y = cellY * cellSize + offsetY;
          const offset = (y * width + x) * 4;
          data[offset] = 255;
          data[offset + 1] = 255;
          data[offset + 2] = 255;
          data[offset + 3] = Math.round(alpha);
        }
      }
    }
  }
  return { data, info: { width, height, channels: 4 } };
}

function fineThresholdMask() {
  const width = 32;
  const height = 32;
  const values = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const checkerBias = ((x & 1) ^ (y & 1)) * 0.035;
      values.push(hash2(x, y, 4) + checkerBias);
    }
  }
  return rankedMask(values, width, height);
}

function periodicValue(cellX, cellY, frequency, gridSize, salt) {
  const gridX = Math.floor(cellX / frequency);
  const gridY = Math.floor(cellY / frequency);
  const localX = smoothStep((cellX % frequency) / frequency);
  const localY = smoothStep((cellY % frequency) / frequency);
  const sample = (x, y) => hash2(
    positiveModulo(x, gridSize),
    positiveModulo(y, gridSize),
    salt,
  );
  const top = lerp(sample(gridX, gridY), sample(gridX + 1, gridY), localX);
  const bottom = lerp(sample(gridX, gridY + 1), sample(gridX + 1, gridY + 1), localX);
  return lerp(top, bottom, localY);
}

function clusterValue(cellX, cellY) {
  const broad = periodicValue(cellX, cellY, 8, 4, 9);
  const medium = periodicValue(cellX, cellY, 4, 8, 13);
  return broad * 0.52 + medium * 0.33 + hash2(cellX, cellY, 15) * 0.15;
}

function clusterThresholdMask() {
  const width = 32;
  const height = 32;
  const values = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      values.push(clusterValue(x, y));
    }
  }
  return rankedMask(values, width, height);
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

function repeatMask(mask, repeatX, repeatY) {
  const width = mask.info.width * repeatX;
  const height = mask.info.height * repeatY;
  const data = Buffer.alloc(width * height * 4);
  for (let tileY = 0; tileY < repeatY; tileY += 1) {
    for (let tileX = 0; tileX < repeatX; tileX += 1) {
      for (let y = 0; y < mask.info.height; y += 1) {
        const sourceOffset = y * mask.info.width * 4;
        const targetOffset = (
          (tileY * mask.info.height + y) * width
          + tileX * mask.info.width
        ) * 4;
        mask.data.copy(data, targetOffset, sourceOffset, sourceOffset + mask.info.width * 4);
      }
    }
  }
  return { data, info: { width, height, channels: 4 } };
}

function dissolveStageMask(fine, cluster, progress) {
  const width = 128;
  const height = 64;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const macroCell = Math.floor(x / 64);
      const sampleX = positiveModulo(x + macroCell * 18, 64);
      const sampleY = positiveModulo(y + macroCell * 10, 64);
      const sampleOffset = (sampleY * 64 + sampleX) * 4;
      const fineThreshold = fine.data[sampleOffset + 3] / 255;
      const clusterThreshold = cluster.data[sampleOffset + 3] / 255;
      const threshold = fineThreshold * 0.38 + clusterThreshold * 0.62;
      const gravityBias = progress * (y / (height - 1)) * 0.22;
      const remaining = clamp(1 - progress - gravityBias);
      const visible = progress === 0 || threshold < remaining;
      const offset = (y * width + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
      data[offset + 3] = visible ? 255 : 0;
    }
  }
  return { data, info: { width, height, channels: 4 } };
}

function sharpMask(mask) {
  return sharp(mask.data, { raw: mask.info });
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
  const stages = [
    [0, "00% · SOLID", colors.gold],
    [35, "35% · OPEN", colors.cyan],
    [65, "65% · BREAK", colors.coral],
    [85, "85% · GRAINS", colors.blue],
  ].map(([progress, label, accent], index) => {
    const x = 110 + index * 410;
    return `<text x="${x}" y="1070" fill="${accent}" font-family="Oxanium, Arial, sans-serif" font-size="18" font-weight="700">${label}</text>`;
  }).join("");

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200">
    <rect width="1800" height="1200" fill="${colors.canvas}"/>
    <text x="80" y="76" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="44" font-weight="700" letter-spacing="3">SANDFALL DISSOLVE TEXTURE SYSTEM</text>
    <text x="82" y="116" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="20" letter-spacing="2">ART-E04 · TILEABLE RANKED NOISE · WHITE ALPHA · NEAREST SAMPLE</text>
    <rect x="82" y="142" width="72" height="8" fill="${colors.cyan}"/><rect x="162" y="142" width="72" height="8" fill="${colors.blue}"/><rect x="242" y="142" width="72" height="8" fill="${colors.coral}"/><rect x="322" y="142" width="72" height="8" fill="${colors.gold}"/><rect x="402" y="144" width="1318" height="4" fill="${colors.decoration}"/>
    <path d="${steppedPath(70, 190, 800, 500, 14)}" fill="${colors.panel}" stroke="${colors.border}" stroke-width="2"/>
    <text x="105" y="238" fill="${colors.gold}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="1.5">01 · FINE THRESHOLD</text>
    <text x="105" y="272" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">64×64 · 2×2 CELLS · EVEN RANKS</text>
    <text x="105" y="318" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="15">STABLE MICRO BREAKUP</text>
    <text x="105" y="348" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="15">NO CENTER / NO BORDER</text>
    <text x="105" y="378" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="15">16 ALPHA TIERS</text>
    <path d="${steppedPath(930, 190, 800, 500, 14)}" fill="${colors.panel}" stroke="${colors.border}" stroke-width="2"/>
    <text x="965" y="238" fill="${colors.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="1.5">02 · CLUSTER THRESHOLD</text>
    <text x="965" y="272" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">64×64 · PERIODIC FIELD · OPEN CHANNELS</text>
    <text x="965" y="318" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="15">MACRO CHIP GROUPING</text>
    <text x="965" y="348" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="15">TOROIDAL CONTROL GRID</text>
    <text x="965" y="378" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="15">16 ALPHA TIERS</text>
    <path d="${steppedPath(70, 730, 1660, 390, 16)}" fill="${colors.panel}" stroke="${colors.border}" stroke-width="2"/>
    <text x="105" y="778" fill="${colors.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">COMBINED DISSOLVE PROGRESSION</text>
    <text x="105" y="812" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">38% FINE + 62% CLUSTER · LOWER EDGE OPENS FIRST · RUNTIME COLOR</text>
    ${stages}
    <text x="80" y="1165" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">NO PREBAKED COLOR · NO ANIMATED NOISE · NO FULL-SCREEN MASK · ART-E06 SHADER / MATERIAL INTEGRATION DEFERRED</text>
  </svg>`);
}

function sizeCheckBaseSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420">
    <rect width="1200" height="420" fill="${colors.canvas}"/>
    <text x="42" y="48" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="24" font-weight="700">ART-E04 · 1× / REPEAT SIZE CHECK</text>
    <text x="42" y="78" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">64×64 RUNTIME · 128×128 ARCHIVE · 4×2 TILE REPEAT · ACTUAL PIXEL SIZE</text>
    <text x="80" y="116" fill="${colors.gold}" font-family="Oxanium, Arial, sans-serif" font-size="14">FINE 1×</text>
    <text x="240" y="116" fill="${colors.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="14">CLUSTER 1×</text>
    <text x="420" y="116" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="14">FINE 2× ARCHIVE</text>
    <text x="640" y="116" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="14">CLUSTER 2× ARCHIVE</text>
    <text x="80" y="285" fill="${colors.blue}" font-family="Oxanium, Arial, sans-serif" font-size="14">CLUSTER · 4×2 REPEAT · TILE BOUNDARIES MUST DISAPPEAR AT RUNTIME</text>
  </svg>`);
}

async function build() {
  fs.mkdirSync(exportDir, { recursive: true });
  fs.mkdirSync(path.dirname(boardPath), { recursive: true });
  fs.mkdirSync(path.dirname(sizeCheckPath), { recursive: true });

  const fine = fineThresholdMask();
  const cluster = clusterThresholdMask();
  const fine2x = scaleMaskNearest(fine, 2);
  const cluster2x = scaleMaskNearest(cluster, 2);

  await Promise.all([
    sharpMask(fine).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-noise-sand-threshold-64x64.png")),
    sharpMask(fine2x).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-noise-sand-threshold-128x128.png")),
    sharpMask(cluster).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-noise-sand-cluster-64x64.png")),
    sharpMask(cluster2x).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-noise-sand-cluster-128x128.png")),
  ]);

  const fineRepeat = repeatMask(fine, 3, 3);
  const clusterRepeat = repeatMask(cluster, 3, 3);
  const stageProgress = [0, 0.35, 0.65, 0.85];
  const stageColors = [colors.gold, colors.cyan, colors.coral, colors.blue];
  const stageBuffers = await Promise.all(stageProgress.map((progress, index) => (
    sharpMask(dissolveStageMask(fine, cluster, progress))
      .resize(320, 160, { kernel: "nearest" })
      .tint(stageColors[index])
      .png()
      .toBuffer()
  )));

  const boardComposites = [
    { input: boardBaseSvg(), left: 0, top: 0 },
    { input: checkerboardSvg(384, 384, 12), left: 430, top: 286 },
    { input: await sharpMask(fineRepeat).resize(384, 384, { kernel: "nearest" }).tint(colors.gold).png().toBuffer(), left: 430, top: 286 },
    { input: checkerboardSvg(384, 384, 12), left: 1290, top: 286 },
    { input: await sharpMask(clusterRepeat).resize(384, 384, { kernel: "nearest" }).tint(colors.cyan).png().toBuffer(), left: 1290, top: 286 },
  ];
  for (let index = 0; index < stageBuffers.length; index += 1) {
    const left = 110 + index * 410;
    boardComposites.push(
      { input: checkerboardSvg(360, 180, 12), left: left - 20, top: 852 },
      { input: stageBuffers[index], left, top: 862 },
    );
  }
  await sharp({ create: { width: 1800, height: 1200, channels: 4, background: colors.canvas } })
    .composite(boardComposites)
    .png({ compressionLevel: 9 })
    .toFile(boardPath);

  await sharp({ create: { width: 1200, height: 420, channels: 4, background: colors.canvas } })
    .composite([
      { input: sizeCheckBaseSvg(), left: 0, top: 0 },
      { input: checkerboardSvg(64, 64, 4), left: 80, top: 132 },
      { input: await sharpMask(fine).tint(colors.gold).png().toBuffer(), left: 80, top: 132 },
      { input: checkerboardSvg(64, 64, 4), left: 240, top: 132 },
      { input: await sharpMask(cluster).tint(colors.cyan).png().toBuffer(), left: 240, top: 132 },
      { input: checkerboardSvg(128, 128, 8), left: 420, top: 132 },
      { input: await sharpMask(fine2x).tint(colors.gold).png().toBuffer(), left: 420, top: 132 },
      { input: checkerboardSvg(128, 128, 8), left: 640, top: 132 },
      { input: await sharpMask(cluster2x).tint(colors.cyan).png().toBuffer(), left: 640, top: 132 },
      { input: checkerboardSvg(256, 128, 8), left: 80, top: 304 },
      { input: await sharpMask(repeatMask(cluster, 4, 2)).tint(colors.blue).png().toBuffer(), left: 80, top: 304 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(sizeCheckPath);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
