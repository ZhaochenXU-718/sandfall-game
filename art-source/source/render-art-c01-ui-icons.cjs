#!/usr/bin/env node

// Builds the deterministic ART-C01 vector icon set, transparent PNG exports,
// and review boards. Sharp is supplied by the host art-tooling environment so
// it does not become a game runtime dependency.

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

const palette = {
  canvas: "#050D19",
  panel: "#0C121F",
  inset: "#091728",
  border: "#4E7398",
  decoration: "#375373",
  primary: "#EEF3FF",
  defaultIcon: "#B4C2DB",
  weak: "#6F8EB1",
  selected: "#41CDC3",
  blue: "#5B8DEF",
  danger: "#FF636B",
  gold: "#FFC44B",
};

const icons = {
  pause: {
    label: "PAUSE",
    body: '<rect x="16" y="12" width="12" height="40" fill="currentColor"/><rect x="36" y="12" width="12" height="40" fill="currentColor"/>',
  },
  resume: {
    label: "RESUME",
    body: '<path d="M16 12H24V16H32V20H40V24H48V28H52V36H48V40H40V44H32V48H24V52H16Z" fill="currentColor"/>',
  },
  home: {
    label: "HOME",
    body: '<path d="M28 8H36V12H40V16H44V20H48V24H52V32H48V52H36V40H28V52H16V32H12V24H16V20H20V16H24V12H28ZM20 28V48H24V36H40V48H44V28H40V24H36V20H28V24H24V28Z" fill="currentColor" fill-rule="evenodd"/>',
  },
  restart: {
    label: "RESTART",
    body: '<g transform="translate(4 0)"><path d="M16 12H24V16H40V20H44V24H48V40H44V44H40V48H24V44H20V40H16V32H20V36H24V40H40V36H44V28H40V24H24V28H28V32H12V16H16Z" fill="currentColor"/></g>',
  },
  help: {
    label: "HELP",
    body: '<path d="M20 8H44V12H52V20H56V44H52V52H44V56H20V52H12V44H8V20H12V12H20ZM20 12V16H16V20H12V44H16V48H20V52H44V48H48V44H52V20H48V16H44V12Z" fill="currentColor" fill-rule="evenodd"/><path d="M24 20H40V24H44V36H40V40H36V48H28V36H32V32H36V28H32V32H20V24H24ZM28 52H36V56H28Z" fill="currentColor"/>',
  },
  music: {
    label: "MUSIC",
    body: '<path d="M24 16H48V44H44V48H32V40H36V36H44V24H28V48H24V52H12V44H16V40H24ZM28 20V24H44V20Z" fill="currentColor"/>',
  },
  sound: {
    label: "SOUND",
    body: '<path d="M12 28H20V24H24V20H28V16H32V48H28V44H24V40H20V36H12ZM40 24H44V28H48V36H44V40H40V36H44V28H40ZM48 20H52V24H56V40H52V44H48V40H52V24H48Z" fill="currentColor"/>',
  },
  haptics: {
    label: "HAPTICS",
    body: '<path d="M24 12H40V16H44V48H40V52H24V48H20V16H24ZM24 16V48H40V16ZM28 20H36V24H28ZM28 44H36V48H28Z" fill="currentColor" fill-rule="evenodd"/><path d="M12 20H16V24H12V40H16V44H12V40H8V24H12ZM48 20H52V24H56V40H52V44H48V40H52V24H48Z" fill="currentColor"/>',
  },
  share: {
    label: "SHARE",
    body: '<path d="M12 28H24V32H28V24H32V20H36V16H44V12H56V24H44V20H40V24H36V28H32V36H36V40H40V44H44V40H56V52H44V48H36V44H32V40H28V36H24V40H12Z" fill="currentColor"/>',
  },
};

const toggleNames = ["music", "sound", "haptics"];

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function pixelSlash(squareSize) {
  const offset = (squareSize - 4) / 2;
  return Array.from({ length: 10 }, (_, index) => {
    const coordinate = 12 + index * 4 - offset;
    return `<rect x="${coordinate}" y="${coordinate}" width="${squareSize}" height="${squareSize}"/>`;
  }).join("");
}

function iconSvg(name, options = {}) {
  const icon = icons[name.replace(/-off$/, "")];
  if (icon === undefined) {
    throw new Error(`unknown icon: ${name}`);
  }
  const color = options.color ?? "#FFFFFF";
  const opacity = options.opacity ?? 1;
  const shiftY = options.shiftY ?? 0;
  const isOff = name.endsWith("-off");
  const body = isOff
    ? `<defs><mask id="slash-gap"><rect width="64" height="64" fill="white"/><g fill="black">${pixelSlash(12)}</g></mask></defs><g mask="url(#slash-gap)">${icon.body}</g><g fill="currentColor">${pixelSlash(8)}</g>`
    : icon.body;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" color="${color}" shape-rendering="crispEdges">
  <title>${escapeXml(icon.label)}${isOff ? " OFF" : ""}</title>
  <g opacity="${opacity}" transform="translate(0 ${shiftY})">${body}</g>
</svg>`);
}

function chamferedFrame(x, y, width, height, cut, color, fill, strokeWidth = 2) {
  const right = x + width;
  const bottom = y + height;
  return `<path d="M${x + cut} ${y}H${right - cut}L${right} ${y + cut}V${bottom - cut}L${right - cut} ${bottom}H${x + cut}L${x} ${bottom - cut}V${y + cut}Z" fill="${fill}" stroke="${color}" stroke-width="${strokeWidth}"/>`;
}

function boardBaseSvg() {
  const tileWidth = 300;
  const tileHeight = 224;
  const firstRow = Object.keys(icons).slice(0, 5);
  const secondRow = Object.keys(icons).slice(5);
  const tile = (name, index, row) => {
    const count = row === 0 ? firstRow.length : secondRow.length;
    const rowWidth = count * tileWidth + (count - 1) * 18;
    const left = (1800 - rowWidth) / 2 + index * (tileWidth + 18);
    const top = row === 0 ? 178 : 420;
    const frameColor = (index + row) % 2 === 0 ? palette.selected : palette.blue;
    return `<g>
      ${chamferedFrame(left, top, tileWidth, tileHeight, 16, frameColor, palette.panel)}
      <path d="M${left + 12} ${top + 24}V${top + 12}H${left + 24}M${left + tileWidth - 12} ${top + tileHeight - 24}V${top + tileHeight - 12}H${left + tileWidth - 24}" fill="none" stroke="${frameColor}" stroke-width="4"/>
      <rect x="${left + 28}" y="${top + 20}" width="8" height="8" fill="${frameColor}"/>
      <rect x="${left + tileWidth - 38}" y="${top + 20}" width="6" height="6" fill="${palette.danger}"/>
      <text x="${left + 22}" y="${top + 190}" fill="${palette.primary}" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">${icons[name].label}</text>
      <text x="${left + 22}" y="${top + 212}" fill="${palette.weak}" font-family="Arial, sans-serif" font-size="13" letter-spacing="1">64 VIEWPORT · 4 PX PIXEL GRID</text>
    </g>`;
  };

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1300">
    <rect width="1800" height="1300" fill="${palette.canvas}"/>
    <text x="82" y="76" fill="${palette.primary}" font-family="Arial, sans-serif" font-size="46" font-weight="700" letter-spacing="3">SANDFALL FUNCTION ICON SYSTEM</text>
    <text x="84" y="116" fill="${palette.weak}" font-family="Arial, sans-serif" font-size="20" letter-spacing="2">ART-C01 · 4 PX GRID · STEPPED SILHOUETTES · RUNTIME TINTABLE</text>
    <rect x="84" y="142" width="68" height="8" fill="${palette.selected}"/>
    <rect x="160" y="142" width="68" height="8" fill="${palette.blue}"/>
    <rect x="236" y="142" width="68" height="8" fill="${palette.danger}"/>
    <rect x="312" y="142" width="68" height="8" fill="${palette.gold}"/>
    <rect x="388" y="144" width="1328" height="4" fill="${palette.decoration}"/>
    ${firstRow.map((name, index) => tile(name, index, 0)).join("")}
    ${secondRow.map((name, index) => tile(name, index, 1)).join("")}

    <text x="84" y="710" fill="${palette.selected}" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">TOGGLE OFF STATES</text>
    <text x="84" y="741" fill="${palette.weak}" font-family="Arial, sans-serif" font-size="16">Transparent knockout under the slash preserves legibility on every button background.</text>
    ${chamferedFrame(84, 766, 1632, 202, 18, palette.border, palette.inset)}
    <path d="M628 790V944M1172 790V944" stroke="${palette.decoration}" stroke-width="2"/>

    <text x="84" y="1025" fill="${palette.selected}" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">STATE LANGUAGE</text>
    ${chamferedFrame(84, 1050, 1632, 170, 18, palette.selected, palette.panel)}
    <text x="285" y="1193" text-anchor="middle" fill="${palette.defaultIcon}" font-family="Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="2">DEFAULT</text>
    <text x="695" y="1193" text-anchor="middle" fill="${palette.primary}" font-family="Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="2">PRESSED · +2 Y</text>
    <text x="1105" y="1193" text-anchor="middle" fill="${palette.selected}" font-family="Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="2">SELECTED · MARKER</text>
    <text x="1515" y="1193" text-anchor="middle" fill="${palette.weak}" font-family="Arial, sans-serif" font-size="17" font-weight="700" letter-spacing="2">DISABLED · 42%</text>
    <rect x="1160" y="1080" width="8" height="8" fill="${palette.selected}"/>
    <text x="84" y="1265" fill="${palette.weak}" font-family="Arial, sans-serif" font-size="15">WHITE ALPHA MASTERS · TINT IN COCOS · 24 PX MINIMUM DISPLAY · 44 PX MINIMUM TOUCH TARGET</text>
  </svg>`);
}

function smallCheckBaseSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="260">
    <rect width="1200" height="260" fill="${palette.canvas}"/>
    <text x="54" y="54" fill="${palette.primary}" font-family="Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="2">ART-C01 · 24 PX DISPLAY CHECK</text>
    <text x="54" y="84" fill="${palette.weak}" font-family="Arial, sans-serif" font-size="15">Rendered on the 4 px source grid at intended minimum size inside 44 px chamfered controls.</text>
  </svg>`);
}

function sourceName(name) {
  return `luosha-ui-${name}`;
}

async function writeSourcesAndExports() {
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(exportDir, { recursive: true });
  const names = [...Object.keys(icons), ...toggleNames.map((name) => `${name}-off`)];
  for (const name of names) {
    const source = iconSvg(name);
    fs.writeFileSync(path.join(sourceDir, `${sourceName(name)}.svg`), source);
    await sharp(source).resize(64, 64).png({ compressionLevel: 9 }).toFile(
      path.join(exportDir, `${sourceName(name)}-64.png`),
    );
    await sharp(source).resize(32, 32).png({ compressionLevel: 9 }).toFile(
      path.join(exportDir, `${sourceName(name)}-32.png`),
    );
  }
}

async function buildBoard() {
  const mainNames = Object.keys(icons);
  const composites = [{ input: boardBaseSvg(), left: 0, top: 0 }];
  const tileWidth = 300;
  for (const [index, name] of mainNames.entries()) {
    const row = index < 5 ? 0 : 1;
    const rowIndex = row === 0 ? index : index - 5;
    const count = row === 0 ? 5 : 4;
    const rowWidth = count * tileWidth + (count - 1) * 18;
    const left = Math.round((1800 - rowWidth) / 2 + rowIndex * (tileWidth + 18) + 110);
    const top = (row === 0 ? 178 : 420) + 49;
    const color = (rowIndex + row) % 2 === 0 ? palette.selected : palette.blue;
    composites.push({ input: iconSvg(name, { color }), left, top });
  }

  for (const [index, name] of toggleNames.entries()) {
    const groupLeft = 84 + index * 544;
    composites.push({ input: iconSvg(name, { color: palette.defaultIcon }), left: groupLeft + 122, top: 801 });
    composites.push({ input: iconSvg(`${name}-off`, { color: palette.defaultIcon }), left: groupLeft + 334, top: 801 });
    composites.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="544" height="202"><text x="154" y="168" text-anchor="middle" fill="${palette.defaultIcon}" font-family="Arial, sans-serif" font-size="15" font-weight="700">ON</text><text x="366" y="168" text-anchor="middle" fill="${palette.defaultIcon}" font-family="Arial, sans-serif" font-size="15" font-weight="700">OFF</text><text x="272" y="35" text-anchor="middle" fill="${palette.primary}" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="2">${icons[name].label}</text></svg>`),
      left: groupLeft,
      top: 766,
    });
  }

  const stateXs = [253, 663, 1073, 1483];
  composites.push({ input: iconSvg("pause", { color: palette.defaultIcon }), left: stateXs[0], top: 1084 });
  composites.push({ input: iconSvg("pause", { color: palette.primary, shiftY: 2 }), left: stateXs[1], top: 1084 });
  composites.push({ input: iconSvg("pause", { color: palette.selected }), left: stateXs[2], top: 1084 });
  composites.push({ input: iconSvg("pause", { color: palette.weak, opacity: 0.42 }), left: stateXs[3], top: 1084 });

  await sharp({ create: { width: 1800, height: 1300, channels: 4, background: palette.canvas } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(boardPath);
}

async function buildSmallCheck() {
  const composites = [{ input: smallCheckBaseSvg(), left: 0, top: 0 }];
  const names = Object.keys(icons);
  for (const [index, name] of names.entries()) {
    const left = 54 + index * 124;
    const frameColor = index % 2 === 0 ? palette.selected : palette.blue;
    composites.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44"><path d="M9 1H35L43 9V35L35 43H9L1 35V9Z" fill="${palette.panel}" stroke="${frameColor}" stroke-width="2"/><rect x="5" y="7" width="4" height="4" fill="${frameColor}"/></svg>`),
      left,
      top: 118,
    });
    composites.push({
      input: await sharp(iconSvg(name, { color: frameColor })).resize(24, 24).png().toBuffer(),
      left: left + 10,
      top: 128,
    });
    composites.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="108" height="30"><text x="22" y="19" text-anchor="middle" fill="${palette.weak}" font-family="Arial, sans-serif" font-size="11" font-weight="700">${icons[name].label}</text></svg>`),
      left,
      top: 170,
    });
  }
  await sharp({ create: { width: 1200, height: 260, channels: 4, background: palette.canvas } })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(smallCheckPath);
}

(async () => {
  await writeSourcesAndExports();
  await buildBoard();
  await buildSmallCheck();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
