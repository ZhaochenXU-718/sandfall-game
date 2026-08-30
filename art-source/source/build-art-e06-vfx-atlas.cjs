#!/usr/bin/env node

// Packs the approved ART-E01–E04 runtime masks into one white-alpha texture.
// The explicit layout is also copied beside the Cocos resource so runtime
// subframes and source validation share the same coordinates.

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
const layoutPath = path.resolve(argument("--layout"));
const sourceDir = path.resolve(argument("--source-dir"));
const atlasPath = path.resolve(argument("--atlas"));
const manifestPath = path.resolve(argument("--manifest"));
const runtimeAtlasPath = path.resolve(argument("--runtime-atlas"));
const runtimeManifestPath = path.resolve(argument("--runtime-manifest"));
const boardPath = path.resolve(argument("--board"));

const layout = JSON.parse(fs.readFileSync(layoutPath, "utf8"));
const sprites = Object.entries(layout.sprites);

function validateLayout() {
  if (!Number.isInteger(layout.width) || !Number.isInteger(layout.height)) {
    throw new Error("atlas dimensions must be integers");
  }
  for (const [name, sprite] of sprites) {
    const sourcePath = path.join(sourceDir, sprite.source);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`missing source for ${name}: ${sourcePath}`);
    }
    if (
      sprite.x < 0
      || sprite.y < 0
      || sprite.x + sprite.width > layout.width
      || sprite.y + sprite.height > layout.height
    ) {
      throw new Error(`sprite ${name} is outside the atlas`);
    }
  }
  for (let leftIndex = 0; leftIndex < sprites.length; leftIndex += 1) {
    const [leftName, left] = sprites[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < sprites.length; rightIndex += 1) {
      const [rightName, right] = sprites[rightIndex];
      const overlaps = left.x < right.x + right.width
        && left.x + left.width > right.x
        && left.y < right.y + right.height
        && left.y + left.height > right.y;
      if (overlaps) {
        throw new Error(`atlas sprites overlap: ${leftName} / ${rightName}`);
      }
    }
  }
}

function checkerboardSvg(width, height, size) {
  const blocks = [];
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      const fill = (x / size + y / size) % 2 === 0 ? "#142033" : "#0B1422";
      blocks.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${fill}"/>`);
    }
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${blocks.join("")}</svg>`);
}

function boardSvg() {
  const labels = sprites.map(([name, sprite], index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 90 + column * 420;
    const y = 820 + row * 54;
    const color = ["#41CDC3", "#5B8DEF", "#FF636B", "#FFC857"][column];
    return `<rect x="${x}" y="${y - 14}" width="8" height="8" fill="${color}"/><text x="${x + 18}" y="${y - 5}" fill="#B4C2DB" font-family="Oxanium, Arial, sans-serif" font-size="15">${name} · ${sprite.width}×${sprite.height}</text>`;
  }).join("");
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1000">
    <rect width="1800" height="1000" fill="#050D19"/>
    <text x="80" y="76" fill="#EEF3FF" font-family="Oxanium, Arial, sans-serif" font-size="44" font-weight="700" letter-spacing="3">SANDFALL VFX ATLAS</text>
    <text x="82" y="116" fill="#6F8EB1" font-family="Oxanium, Arial, sans-serif" font-size="20" letter-spacing="2">ART-E06 · 512×256 · 12 WHITE-ALPHA SPRITES · SINGLE TEXTURE</text>
    <rect x="82" y="142" width="72" height="8" fill="#41CDC3"/><rect x="162" y="142" width="72" height="8" fill="#5B8DEF"/><rect x="242" y="142" width="72" height="8" fill="#FF636B"/><rect x="322" y="142" width="72" height="8" fill="#FFC857"/><rect x="402" y="144" width="1318" height="4" fill="#375373"/>
    <path d="M86 190H1714L1730 206V694L1714 710H86L70 694V206Z" fill="#0C121F" stroke="#4E7398" stroke-width="2"/>
    <text x="90" y="232" fill="#41CDC3" font-family="Oxanium, Arial, sans-serif" font-size="21" font-weight="700">RUNTIME ATLAS · NEAREST · CLAMP · NO MIPMAP</text>
    ${labels}
    <text x="80" y="970" fill="#6F8EB1" font-family="Oxanium, Arial, sans-serif" font-size="15">E01 PARTICLES + E02 HALOS + E03 TRAILS + E04 DISSOLVE NOISE · RUNTIME TINT · ART-E07 PERFORMANCE VALIDATION DEFERRED</text>
  </svg>`);
}

async function build() {
  validateLayout();
  for (const target of [atlasPath, manifestPath, runtimeAtlasPath, runtimeManifestPath, boardPath]) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
  }

  const composites = sprites.map(([, sprite]) => ({
    input: path.join(sourceDir, sprite.source),
    left: sprite.x,
    top: sprite.y,
  }));
  await sharp({
    create: {
      width: layout.width,
      height: layout.height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    },
  }).composite(composites).png({ compressionLevel: 9 }).toFile(atlasPath);

  const manifest = `${JSON.stringify(layout, null, 2)}\n`;
  fs.writeFileSync(manifestPath, manifest);
  fs.copyFileSync(atlasPath, runtimeAtlasPath);
  fs.writeFileSync(runtimeManifestPath, manifest);

  const atlasPreview = await sharp(atlasPath)
    .resize(layout.width * 2, layout.height * 2, { kernel: "nearest" })
    .png()
    .toBuffer();
  await sharp({ create: { width: 1800, height: 1000, channels: 4, background: "#050D19" } })
    .composite([
      { input: boardSvg(), left: 0, top: 0 },
      { input: checkerboardSvg(1024, 512, 16), left: 388, top: 270 },
      { input: atlasPreview, left: 388, top: 270 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(boardPath);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
