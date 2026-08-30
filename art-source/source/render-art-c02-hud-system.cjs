#!/usr/bin/env node

// Builds the deterministic ART-C02 HUD specification board. The ImageGen
// candidate is kept separately as a material reference; this board owns all
// production dimensions, typography placement, and rule-facing geometry.

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
const boardPath = path.resolve(argument("--board"));

const colors = {
  canvas: "#050D19",
  board: "#111827",
  panel: "#0C121F",
  inset: "#091728",
  idle: "#4E7398",
  decoration: "#375373",
  cyan: "#41CDC3",
  blue: "#5B8DEF",
  danger: "#FF636B",
  gold: "#FFC44B",
  reward: "#FFD66B",
  primary: "#EEF3FF",
  secondary: "#B4C2DB",
  weak: "#6F8EB1",
};

function chamferPath(x, y, width, height, cut) {
  const right = x + width;
  const bottom = y + height;
  return `M${x + cut} ${y}H${right - cut}L${right} ${y + cut}V${bottom - cut}L${right - cut} ${bottom}H${x + cut}L${x} ${bottom - cut}V${y + cut}Z`;
}

function panel(x, y, width, height, cut, accent, scale = 1) {
  const inset = 2 * scale;
  const pixel = 2 * scale;
  return `<g>
    <path d="${chamferPath(x, y, width, height, cut)}" fill="${colors.panel}" stroke="${colors.idle}" stroke-width="${2 * scale}"/>
    <path d="${chamferPath(x + inset, y + inset, width - inset * 2, height - inset * 2, Math.max(1, cut - inset))}" fill="none" stroke="${colors.decoration}" stroke-width="${scale}"/>
    <path d="M${x + cut} ${y}H${x + width * 0.42}" stroke="${accent}" stroke-width="${2 * scale}"/>
    <rect x="${x + cut + 2 * scale}" y="${y + 4 * scale}" width="${pixel}" height="${pixel}" fill="${accent}"/>
    <rect x="${x + width - cut - 4 * scale}" y="${y + 4 * scale}" width="${pixel}" height="${pixel}" fill="${colors.blue}"/>
    <rect x="${x + width - cut - 2 * scale}" y="${y + height - 6 * scale}" width="${pixel}" height="${pixel}" fill="${accent}"/>
  </g>`;
}

function pauseButton(x, y, scale) {
  const width = 48 * scale;
  const height = 38 * scale;
  const cut = 6 * scale;
  return `<g>
    <path d="${chamferPath(x, y, width, height, cut)}" fill="${colors.inset}" stroke="${colors.cyan}" stroke-width="${2 * scale}"/>
    <path d="${chamferPath(x + 2 * scale, y + 2 * scale, width - 4 * scale, height - 4 * scale, 4 * scale)}" fill="none" stroke="${colors.decoration}" stroke-width="${scale}"/>
    <rect x="${x + 17 * scale}" y="${y + 9 * scale}" width="${5 * scale}" height="${20 * scale}" fill="${colors.cyan}"/>
    <rect x="${x + 26 * scale}" y="${y + 9 * scale}" width="${5 * scale}" height="${20 * scale}" fill="${colors.cyan}"/>
    <rect x="${x + 5 * scale}" y="${y + 6 * scale}" width="${2 * scale}" height="${2 * scale}" fill="${colors.cyan}"/>
  </g>`;
}

function dangerRail(x, y, width, scale, active) {
  const railHeight = 12 * scale;
  const color = active ? colors.danger : colors.decoration;
  const blocks = Array.from({ length: 11 }, (_, index) => {
    const blockWidth = (index % 3 === 0 ? 8 : 4) * scale;
    const left = x + 18 * scale + index * 22 * scale;
    const top = y + (index % 2 === 0 ? 2 : 6) * scale;
    return `<rect x="${left}" y="${top}" width="${blockWidth}" height="${2 * scale}" fill="${color}" opacity="${active ? 0.95 : 0.45}"/>`;
  }).join("");
  return `<g>
    <rect x="${x}" y="${y}" width="${width}" height="${2 * scale}" fill="${color}"/>
    <rect x="${x}" y="${y + 4 * scale}" width="${10 * scale}" height="${4 * scale}" fill="${color}"/>
    <rect x="${x + width - 10 * scale}" y="${y + 4 * scale}" width="${10 * scale}" height="${4 * scale}" fill="${color}"/>
    ${blocks}
    ${active ? `<rect x="${x + width / 2 - 8 * scale}" y="${y - 5 * scale}" width="${16 * scale}" height="${16 * scale}" fill="${colors.panel}" stroke="${color}" stroke-width="${2 * scale}"/><rect x="${x + width / 2 - 2 * scale}" y="${y - 2 * scale}" width="${4 * scale}" height="${7 * scale}" fill="${color}"/><rect x="${x + width / 2 - 2 * scale}" y="${y + 7 * scale}" width="${4 * scale}" height="${3 * scale}" fill="${color}"/>` : ""}
  </g>`;
}

function nextPiece(x, y, scale) {
  const cell = 12 * scale;
  const cells = [[1, 0], [0, 1], [1, 1], [2, 1]];
  return cells.map(([column, row]) => {
    const left = x + column * cell;
    const top = y + row * cell;
    return `<g><rect x="${left}" y="${top}" width="${cell - scale}" height="${cell - scale}" fill="${colors.blue}"/><rect x="${left + 2 * scale}" y="${top + 2 * scale}" width="${3 * scale}" height="${3 * scale}" fill="#7EB0FF"/><rect x="${left + 7 * scale}" y="${top + 7 * scale}" width="${3 * scale}" height="${3 * scale}" fill="#315FB8"/></g>`;
  }).join("");
}

function componentStudies() {
  const scale = 3;
  const statusX = 80;
  const statusY = 225;
  const nextX = 452;
  const nextY = statusY;
  const pauseX = 754;
  const pauseY = 278;
  return `<g>
    <text x="80" y="192" fill="${colors.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">EXACT COMPONENT STUDIES · 3×</text>
    ${panel(statusX, statusY, 112 * scale, 98 * scale, 8 * scale, colors.cyan, scale)}
    <text x="${statusX + 30}" y="${statusY + 66}" fill="${colors.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="36" font-weight="700">SCORE</text>
    <text x="${statusX + 306}" y="${statusY + 66}" text-anchor="end" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="42" font-weight="700">000000</text>
    <path d="M${statusX + 28} ${statusY + 91}H${statusX + 308}" stroke="${colors.decoration}" stroke-width="3"/>
    <text x="${statusX + 30}" y="${statusY + 142}" fill="${colors.blue}" font-family="Oxanium, Arial, sans-serif" font-size="34" font-weight="700">TIME</text>
    <text x="${statusX + 306}" y="${statusY + 142}" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="38" font-weight="700">00:00</text>
    <path d="M${statusX + 28} ${statusY + 169}H${statusX + 308}" stroke="${colors.decoration}" stroke-width="3"/>
    <text x="${statusX + 30}" y="${statusY + 228}" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="31" font-weight="700">LEVEL 1</text>
    <text x="${statusX + 306}" y="${statusY + 228}" text-anchor="end" fill="${colors.reward}" font-family="Oxanium, Arial, sans-serif" font-size="31" font-weight="700">CHAIN ×2</text>
    <text x="${statusX}" y="${statusY + 326}" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="17">112×98 · CUT 8 · STATIC BORDER</text>

    ${panel(nextX, nextY, 88 * scale, 98 * scale, 8 * scale, colors.blue, scale)}
    <text x="${nextX + 132}" y="${nextY + 61}" text-anchor="middle" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="36" font-weight="700" letter-spacing="2">NEXT</text>
    <path d="M${nextX + 36} ${nextY + 84}H${nextX + 228}" stroke="${colors.decoration}" stroke-width="3"/>
    ${nextPiece(nextX + 78, nextY + 124, scale)}
    <text x="${nextX}" y="${nextY + 326}" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="17">88×98 · EXACT T ROTATION 0</text>

    ${pauseButton(pauseX, pauseY, scale)}
    <text x="${pauseX + 72}" y="${pauseY + 150}" text-anchor="middle" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="17">48×38</text>

    <text x="970" y="246" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="20" font-weight="700">NORMAL · HIDDEN / DECORATIVE</text>
    ${dangerRail(970, 268, 720, 2.4, false)}
    <text x="970" y="372" fill="${colors.danger}" font-family="Oxanium, Arial, sans-serif" font-size="20" font-weight="700">DANGER · BOARD-TOP RAIL</text>
    ${dangerRail(970, 402, 720, 2.4, true)}
    <text x="970" y="500" fill="${colors.weak}" font-family="Noto Sans SC, Arial, sans-serif" font-size="18">不增加宽警告面板，不覆盖棋盘信息；红色只占顶边约 12 设计点。</text>
  </g>`;
}

function topComposition() {
  const x = 80;
  const y = 670;
  const scale = 3;
  const width = 360 * scale;
  const height = 150 * scale;
  const statusX = x + 40 * scale;
  const nextX = x + 232 * scale;
  const panelY = y + 9 * scale;
  const boardX = x + 40 * scale;
  const boardY = y + 118 * scale;
  return `<g>
    <text x="${x}" y="${y - 28}" fill="${colors.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">360 DESIGN WIDTH · TOP 150 PT · 3×</text>
    <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#07111F" stroke="${colors.decoration}" stroke-width="2"/>
    <path d="M${x} ${y + 24}H${x + width}" stroke="${colors.decoration}" stroke-width="2" stroke-dasharray="10 8"/>
    <text x="${x + 16}" y="${y + 18}" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="13">TOP SAFE EDGE</text>

    ${panel(statusX, panelY, 112 * scale, 98 * scale, 8 * scale, colors.cyan, scale)}
    <text x="${statusX + 24}" y="${panelY + 60}" fill="${colors.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="32" font-weight="700">SCORE</text>
    <text x="${statusX + 310}" y="${panelY + 60}" text-anchor="end" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="35" font-weight="700">000000</text>
    <text x="${statusX + 24}" y="${panelY + 132}" fill="${colors.blue}" font-family="Oxanium, Arial, sans-serif" font-size="29" font-weight="700">TIME</text>
    <text x="${statusX + 310}" y="${panelY + 132}" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="32" font-weight="700">00:00</text>
    <text x="${statusX + 24}" y="${panelY + 220}" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="28" font-weight="700">LEVEL 1</text>
    <text x="${statusX + 310}" y="${panelY + 220}" text-anchor="end" fill="${colors.reward}" font-family="Oxanium, Arial, sans-serif" font-size="28" font-weight="700">CHAIN ×2</text>

    ${panel(nextX, panelY, 88 * scale, 98 * scale, 8 * scale, colors.blue, scale)}
    <text x="${nextX + 132}" y="${panelY + 56}" text-anchor="middle" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="31" font-weight="700">NEXT</text>
    ${nextPiece(nextX + 78, panelY + 112, scale)}
    ${pauseButton(x + 156 * scale, y + 14 * scale, scale)}

    <rect x="${boardX}" y="${boardY}" width="${280 * scale}" height="${32 * scale}" fill="${colors.board}"/>
    ${dangerRail(boardX, boardY, 280 * scale, scale, true)}
    <path d="M${boardX} ${boardY}V${boardY + 96}M${boardX + 840} ${boardY}V${boardY + 96}" stroke="${colors.decoration}" stroke-width="3"/>
  </g>`;
}

function tokenPanel() {
  const x = 1210;
  const y = 670;
  const width = 510;
  return `<g>
    <text x="${x}" y="${y - 28}" fill="${colors.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">PRODUCTION TOKENS</text>
    <path d="${chamferPath(x, y, width, 450, 18)}" fill="${colors.panel}" stroke="${colors.idle}" stroke-width="2"/>
    <text x="${x + 30}" y="${y + 52}" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="19" font-weight="700">PANEL FILL</text>
    <text x="${x + width - 30}" y="${y + 52}" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="19">#0C121F · 96%</text>
    <text x="${x + 30}" y="${y + 101}" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="19" font-weight="700">OUTER / INNER</text>
    <text x="${x + width - 30}" y="${y + 101}" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="19">2 PX / 1 PX</text>
    <text x="${x + 30}" y="${y + 150}" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="19" font-weight="700">CUT</text>
    <text x="${x + width - 30}" y="${y + 150}" text-anchor="end" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="19">8 PANEL · 6 BUTTON</text>
    <path d="M${x + 30} ${y + 174}H${x + width - 30}" stroke="${colors.decoration}" stroke-width="2"/>
    <rect x="${x + 30}" y="${y + 204}" width="84" height="34" fill="${colors.idle}"/><text x="${x + 130}" y="${y + 229}" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">IDLE BORDER</text>
    <rect x="${x + 30}" y="${y + 254}" width="84" height="34" fill="${colors.cyan}"/><text x="${x + 130}" y="${y + 279}" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">CYAN INTERACT</text>
    <rect x="${x + 30}" y="${y + 304}" width="84" height="34" fill="${colors.blue}"/><text x="${x + 130}" y="${y + 329}" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">BLUE INFO</text>
    <rect x="${x + 30}" y="${y + 354}" width="84" height="34" fill="${colors.danger}"/><text x="${x + 130}" y="${y + 379}" fill="${colors.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="17">DANGER ONLY</text>
    <text x="${x + 30}" y="${y + 423}" fill="${colors.weak}" font-family="Noto Sans SC, Arial, sans-serif" font-size="17">静态 HUD 无 Bloom；只有危险导轨低频呼吸。</text>
  </g>`;
}

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1300" shape-rendering="geometricPrecision">
  <rect width="1800" height="1300" fill="${colors.canvas}"/>
  <text x="80" y="78" fill="${colors.primary}" font-family="Oxanium, Arial, sans-serif" font-size="46" font-weight="700" letter-spacing="3">SANDFALL HUD PANEL SYSTEM</text>
  <text x="82" y="118" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="20" letter-spacing="2">ART-C02 · NEON PIXEL-SAND · EXACT COCOS GRAPHICS GEOMETRY</text>
  <rect x="82" y="144" width="72" height="8" fill="${colors.cyan}"/><rect x="162" y="144" width="72" height="8" fill="${colors.blue}"/><rect x="242" y="144" width="72" height="8" fill="${colors.danger}"/><rect x="322" y="144" width="72" height="8" fill="${colors.gold}"/><rect x="402" y="146" width="1318" height="4" fill="${colors.decoration}"/>
  ${componentStudies()}
  <path d="M80 590H1720" stroke="${colors.decoration}" stroke-width="2"/>
  ${topComposition()}
  ${tokenPanel()}
  <text x="80" y="1248" fill="${colors.weak}" font-family="Oxanium, Arial, sans-serif" font-size="16">NO RUNTIME BITMAP · PANELS IN COCOS GRAPHICS · ART-C01 PAUSE SPRITE · DANGER MOTION DEFERRED TO ART-E05</text>
</svg>`);

sharp(svg)
  .png({ compressionLevel: 9 })
  .toFile(boardPath)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
