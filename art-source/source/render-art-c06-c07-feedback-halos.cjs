#!/usr/bin/env node

// Builds ART-C06 / ART-C07 feedback ornaments. ImageGen references establish
// energy direction only; these deterministic SVGs own pixel geometry, the
// dynamic-text safe zone, colors, and transparent runtime exports.

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
  gold: "#FFC857",
  goldStrong: "#FFC44B",
  purple: "#C257B7",
  primary: "#EEF3FF",
  secondary: "#B4C2DB",
  weak: "#6F8EB1",
};

const levelParticles = [
  [16, 14, 2, "blue", 0.78], [24, 22, 2, "gold", 0.92], [34, 10, 1, "cyan", 0.78],
  [48, 24, 2, "gold", 0.88], [63, 15, 1, "blue", 0.66], [79, 23, 2, "cyan", 0.82],
  [104, 12, 2, "gold", 0.72], [116, 22, 1, "gold", 0.92], [126, 8, 2, "gold", 0.84],
  [134, 3, 2, "gold", 0.72], [141, 11, 3, "gold", 1], [151, 5, 1, "cyan", 0.7],
  [160, 20, 2, "gold", 0.9], [178, 12, 1, "blue", 0.7], [196, 22, 2, "cyan", 0.84],
  [218, 15, 1, "gold", 0.82], [236, 23, 2, "gold", 0.92], [255, 12, 2, "blue", 0.72],
  [267, 21, 1, "cyan", 0.76],
];

const particleColor = (role) => role === "gold" ? c.gold : role === "cyan" ? c.cyan : c.blue;

function mirrorVerticalParticles(points) {
  return points.flatMap(([x, y, size, role, opacity], index) => {
    const color = particleColor(role);
    const bottomY = 96 - y - size;
    const mirroredX = index % 3 === 0 ? Math.min(276 - size, x + 4) : x;
    return [
      `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${color}" opacity="${opacity}"/>`,
      `<rect x="${mirroredX}" y="${bottomY}" width="${size}" height="${size}" fill="${color}" opacity="${Math.max(0.48, opacity - 0.12)}"/>`,
    ];
  }).join("");
}

function levelUpSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 96" width="280" height="96" shape-rendering="crispEdges">
    <title>SANDFALL LEVEL UP FEEDBACK HALO</title>
    <path d="M3 39V31H7V25H16M277 39V31H273V25H264" fill="none" stroke="${c.blue}" stroke-width="2"/>
    <path d="M3 57V65H7V71H16M277 57V65H273V71H264" fill="none" stroke="${c.cyan}" stroke-width="2"/>
    <path d="M24 20H92M100 20H118M162 20H180M188 20H256" fill="none" stroke="${c.goldStrong}" stroke-width="2"/>
    <path d="M31 24H73M82 24H111M169 24H198M207 24H249" fill="none" stroke="${c.blue}" stroke-width="1" opacity="0.82"/>
    <path d="M24 76H92M100 76H118M162 76H180M188 76H256" fill="none" stroke="${c.gold}" stroke-width="2" opacity="0.88"/>
    <path d="M31 72H73M82 72H111M169 72H198M207 72H249" fill="none" stroke="${c.cyan}" stroke-width="1" opacity="0.78"/>
    <path d="M122 22H128V16H134V10H146V16H152V22H158" fill="none" stroke="${c.goldStrong}" stroke-width="2"/>
    <path d="M125 74H131V80H136V86H144V80H149V74H155" fill="none" stroke="${c.gold}" stroke-width="2"/>
    <rect x="137" y="4" width="6" height="6" fill="${c.goldStrong}"/><rect x="139" y="1" width="2" height="2" fill="${c.primary}"/>
    <rect x="137" y="86" width="6" height="6" fill="${c.gold}" opacity="0.86"/>
    <rect x="1" y="43" width="3" height="10" fill="${c.goldStrong}"/><rect x="6" y="39" width="2" height="18" fill="${c.blue}" opacity="0.76"/>
    <rect x="276" y="43" width="3" height="10" fill="${c.goldStrong}"/><rect x="272" y="39" width="2" height="18" fill="${c.blue}" opacity="0.76"/>
    ${mirrorVerticalParticles(levelParticles)}
  </svg>`);
}

const chainParticles = [
  [1, 22, 2, 0.56], [5, 30, 2, 0.78], [9, 17, 1, 0.68], [12, 25, 3, 0.96],
  [16, 12, 2, 0.74], [18, 22, 1, 0.88], [2, 70, 2, 0.64], [7, 63, 3, 0.92],
  [12, 76, 1, 0.7], [16, 69, 2, 0.84],
];

function chainSideParticles() {
  return chainParticles.flatMap(([x, y, size, opacity], index) => {
    const rightX = 280 - x - size;
    return [
      `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="#FFFFFF" opacity="${opacity}"/>`,
      `<rect x="${rightX}" y="${Math.min(94 - size, y + (index % 2 === 0 ? 3 : -2))}" width="${size}" height="${size}" fill="#FFFFFF" opacity="${Math.max(0.48, opacity - 0.08)}"/>`,
    ];
  }).join("");
}

function chainMaskSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 96" width="280" height="96" shape-rendering="crispEdges">
    <title>SANDFALL REUSABLE CHAIN FEEDBACK HALO MASK</title>
    <path d="M0 44H7V38H12V31H18M0 52H7V58H12V65H18" fill="none" stroke="#FFFFFF" stroke-width="3"/>
    <path d="M280 44H273V38H268V31H262M280 52H273V58H268V65H262" fill="none" stroke="#FFFFFF" stroke-width="3"/>
    <path d="M20 20H68M76 20H112M124 20H135M145 20H156M168 20H204M212 20H260" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.88"/>
    <path d="M20 76H62M70 76H108M122 76H134M146 76H158M172 76H210M218 76H260" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.72"/>
    <path d="M28 24H54M226 24H252M28 72H54M226 72H252" fill="none" stroke="#FFFFFF" stroke-width="1" opacity="0.48"/>
    <rect x="4" y="42" width="5" height="12" fill="#FFFFFF"/><rect x="12" y="37" width="4" height="22" fill="#FFFFFF" opacity="0.82"/>
    <rect x="271" y="42" width="5" height="12" fill="#FFFFFF"/><rect x="264" y="37" width="4" height="22" fill="#FFFFFF" opacity="0.82"/>
    <rect x="7" y="46" width="3" height="4" fill="#FFFFFF" opacity="0.56"/><rect x="270" y="46" width="3" height="4" fill="#FFFFFF" opacity="0.56"/>
    <path d="M132 20V15H138V10H142V15H148V20M132 76V81H138V86H142V81H148V76" fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.76"/>
    ${chainSideParticles()}
  </svg>`);
}

function checkerboardSvg(width, height, size = 8) {
  const blocks = [];
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      blocks.push(`<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${(x / size + y / size) % 2 === 0 ? "#142033" : "#0B1422"}"/>`);
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
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200">
    <rect width="1800" height="1200" fill="${c.canvas}"/>
    <text x="80" y="76" fill="${c.primary}" font-family="Oxanium, Arial, sans-serif" font-size="44" font-weight="700" letter-spacing="3">SANDFALL FEEDBACK HALO SYSTEM</text>
    <text x="82" y="116" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="20" letter-spacing="2">ART-C06 / C07 · 280×96 · DYNAMIC TEXT REMAINS IN COCOS</text>
    <rect x="82" y="142" width="72" height="8" fill="${c.gold}"/><rect x="162" y="142" width="72" height="8" fill="${c.cyan}"/><rect x="242" y="142" width="72" height="8" fill="${c.blue}"/><rect x="322" y="144" width="1398" height="4" fill="${c.decoration}"/>
    <path d="${steppedPath(60, 188, 780, 338, 14)}" fill="${c.panel}" stroke="${c.idle}" stroke-width="2"/>
    <path d="${steppedPath(960, 188, 780, 338, 14)}" fill="${c.panel}" stroke="${c.idle}" stroke-width="2"/>
    <text x="90" y="224" fill="${c.gold}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">C06 · LEVEL UP · UPWARD REWARD</text>
    <text x="990" y="224" fill="${c.gold}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">C07 · CHAIN · LATERAL REUSABLE MASK</text>
    <text x="450" y="409" text-anchor="middle" fill="${c.primary}" font-family="Oxanium, Arial, sans-serif" font-size="26" font-weight="700">LEVEL 08  ·  NEW COLOR</text>
    <text x="1350" y="409" text-anchor="middle" fill="${c.gold}" font-family="Oxanium, Arial, sans-serif" font-size="26" font-weight="700">CHAIN ×4  ·  +2400</text>
    <text x="450" y="488" text-anchor="middle" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">GOLD + SMALL CYAN / BLUE CONTINUITY</text>
    <text x="1350" y="488" text-anchor="middle" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">WHITE ALPHA MASK · TINT AND OPACITY AT RUNTIME</text>
    <text x="80" y="594" fill="${c.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">1× TRANSPARENT OUTPUT + CHAIN TIER TINT</text>
    <text x="80" y="623" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="16">DASHED SAFE BOXES AND SAMPLE TEXT ARE REVIEW GUIDES ONLY</text>
    <path d="${steppedPath(80, 818, 1640, 300, 16)}" fill="${c.panel}" stroke="${c.idle}" stroke-width="2"/>
    <text x="120" y="863" fill="${c.primary}" font-family="Oxanium, Arial, sans-serif" font-size="19" font-weight="700">COMMON RUNTIME CONTRACT</text>
    <text x="120" y="905" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">VIEWPORT / MASTER</text><text x="1680" y="905" text-anchor="end" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">280×96 / 560×192</text>
    <text x="120" y="943" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">DYNAMIC TEXT SAFE</text><text x="1680" y="943" text-anchor="end" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">X 20–260 · Y 28–68 · ALPHA 0</text>
    <text x="120" y="981" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">C06</text><text x="1680" y="981" text-anchor="end" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">COLORED SPRITE · NORMAL BLEND</text>
    <text x="120" y="1019" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">C07</text><text x="1680" y="1019" text-anchor="end" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">WHITE MASK · SPRITE COLOR CONTROLS TIER</text>
    <path d="M120 1047H1680" stroke="${c.decoration}" stroke-width="2"/>
    <text x="120" y="1085" fill="${c.weak}" font-family="Noto Sans SC, Arial, sans-serif" font-size="16">连锁建议：×2 金色；×3 珊瑚红；×4+ 紫红。缩放、上移和淡出继续沿用现有 1.05 秒反馈动画。</text>
    <text x="80" y="1170" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">NO EMBEDDED WORDS · NO NUMBERS · NO FILLED PANEL · ART-C08 INTEGRATION</text>
  </svg>`);
}

function safeGuideSvg(left, top, scale, accent) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200">
    <rect x="${left + 20 * scale}" y="${top + 28 * scale}" width="${240 * scale}" height="${40 * scale}" fill="none" stroke="${accent}" stroke-width="1.5" stroke-dasharray="7 6" opacity="0.62"/>
  </svg>`);
}

async function tintedMask(maskSvg, color, width, height) {
  const coloredSvg = Buffer.from(maskSvg.toString().replaceAll("#FFFFFF", color));
  return sharp(coloredSvg).resize(width, height).png().toBuffer();
}

async function build() {
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(exportDir, { recursive: true });
  fs.mkdirSync(path.dirname(boardPath), { recursive: true });

  const level = levelUpSvg();
  const chain = chainMaskSvg();
  fs.writeFileSync(path.join(sourceDir, "luosha-feedback-level-up.svg"), level);
  fs.writeFileSync(path.join(sourceDir, "luosha-feedback-chain-mask.svg"), chain);

  await Promise.all([
    sharp(level).resize(280, 96).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-feedback-level-up-280x96.png")),
    sharp(level).resize(560, 192).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-feedback-level-up-560x192.png")),
    sharp(chain).resize(280, 96).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-feedback-chain-mask-280x96.png")),
    sharp(chain).resize(560, 192).png({ compressionLevel: 9 }).toFile(path.join(exportDir, "luosha-feedback-chain-mask-560x192.png")),
  ]);

  const scale = 2.4;
  const largeWidth = Math.round(280 * scale);
  const largeHeight = Math.round(96 * scale);
  const [levelLarge, chainLarge, chainGold, chainCoral, chainPurple] = await Promise.all([
    sharp(level).resize(largeWidth, largeHeight).png().toBuffer(),
    tintedMask(chain, c.primary, largeWidth, largeHeight),
    tintedMask(chain, c.gold, 280, 96),
    tintedMask(chain, c.danger, 280, 96),
    tintedMask(chain, c.purple, 280, 96),
  ]);
  const checkerLarge = checkerboardSvg(largeWidth, largeHeight, 12);
  const checker = checkerboardSvg(280, 96, 8);

  await sharp({ create: { width: 1800, height: 1200, channels: 4, background: c.canvas } })
    .composite([
      { input: boardBaseSvg(), left: 0, top: 0 },
      { input: checkerLarge, left: 114, top: 265 },
      { input: levelLarge, left: 114, top: 265 },
      { input: checkerLarge, left: 1014, top: 265 },
      { input: chainLarge, left: 1014, top: 265 },
      { input: safeGuideSvg(114, 265, scale, c.gold), left: 0, top: 0 },
      { input: safeGuideSvg(1014, 265, scale, c.cyan), left: 0, top: 0 },
      { input: checker, left: 80, top: 660 }, { input: level, left: 80, top: 660 },
      { input: checker, left: 440, top: 660 }, { input: chainGold, left: 440, top: 660 },
      { input: checker, left: 800, top: 660 }, { input: chainCoral, left: 800, top: 660 },
      { input: checker, left: 1160, top: 660 }, { input: chainPurple, left: 1160, top: 660 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(boardPath);
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
