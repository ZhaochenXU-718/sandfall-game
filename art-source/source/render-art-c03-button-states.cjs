#!/usr/bin/env node

// Builds the deterministic ART-C03 button-state specification board.

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
const smallCheckPath = path.resolve(argument("--small-check"));

const c = {
  canvas: "#050D19",
  panel: "#0C121F",
  inset: "#091728",
  pressedFill: "#0B1B2C",
  selectedFill: "#102A35",
  idle: "#4E7398",
  decoration: "#375373",
  pressedInner: "#205B61",
  cyan: "#41CDC3",
  blue: "#5B8DEF",
  danger: "#FF636B",
  gold: "#FFC44B",
  goldPressed: "#E2A62E",
  goldDisabled: "#705928",
  primary: "#EEF3FF",
  secondary: "#B4C2DB",
  weak: "#6F8EB1",
  darkText: "#101827",
};

function chamferPath(x, y, width, height, cut) {
  const right = x + width;
  const bottom = y + height;
  const half = cut / 2;
  return `M${x + cut} ${y}H${right - cut}H${right - half}V${y + half}H${right}V${bottom - cut}V${bottom - half}H${right - half}V${bottom}H${x + cut}H${x + half}V${bottom - half}H${x}V${y + cut}V${y + half}H${x + half}V${y}Z`;
}

function darkSurfaceTexture(x, y, width, height, scale, accent) {
  const pixels = [
    [9, 12, 2], [15, 8, 1], [width / scale - 13, 13, 2],
    [11, height / scale - 12, 1], [18, height / scale - 8, 2],
    [width / scale - 21, height / scale - 9, 1],
    [width / scale - 12, height / scale - 15, 2],
  ];
  const grid = Array.from({ length: Math.max(2, Math.floor(width / scale / 20)) }, (_, index) => {
    const left = x + (12 + index * 16) * scale;
    const top = y + (index % 2 === 0 ? 11 : height / scale - 13) * scale;
    return `<rect x="${left}" y="${top}" width="${scale}" height="${scale}"/>`;
  }).join("");
  return `<g fill="${accent}" opacity="0.16">${grid}${pixels.map(([px, py, size]) => `<rect x="${x + px * scale}" y="${y + py * scale}" width="${size * scale}" height="${size * scale}"/>`).join("")}</g>`;
}

function segmentedBorderDetails(x, y, width, height, scale, accent) {
  return `<g>
    <rect x="${x + width * 0.58}" y="${y - scale * 1.1}" width="${5 * scale}" height="${2.2 * scale}" fill="${c.panel}"/>
    <rect x="${x + width * 0.31}" y="${y + height - scale * 1.1}" width="${4 * scale}" height="${2.2 * scale}" fill="${c.panel}"/>
    <rect x="${x + 5 * scale}" y="${y + 8 * scale}" width="${2 * scale}" height="${2 * scale}" fill="${accent}"/>
    <rect x="${x + width - 8 * scale}" y="${y + height - 9 * scale}" width="${3 * scale}" height="${3 * scale}" fill="${accent}"/>
  </g>`;
}

function goldSurfaceTexture(x, y, width, height, disabled, pressed) {
  const highlight = disabled ? c.decoration : pressed ? "#F3C958" : "#FFF0A6";
  const shadow = disabled ? "#243247" : pressed ? "#A96705" : "#B96D00";
  const grainCount = 38;
  const grains = Array.from({ length: grainCount }, (_, index) => {
    const px = x + 13 + ((index * 47 + 19) % Math.max(1, width - 26));
    const py = y + 10 + ((index * 23 + 7) % Math.max(1, height - 20));
    const size = 1 + (index % 3);
    return `<rect x="${px}" y="${py}" width="${size}" height="${size}" fill="${index % 4 < 2 ? highlight : shadow}" opacity="${disabled ? 0.35 : index % 5 === 0 ? 0.82 : 0.56}"/>`;
  }).join("");
  return `<g>
    <rect x="${x + 12}" y="${y + 12}" width="${width - 24}" height="${Math.max(4, height * 0.2)}" fill="${highlight}" opacity="${disabled ? 0.08 : 0.22}"/>
    <rect x="${x + 12}" y="${y + height - 19}" width="${width - 24}" height="9" fill="${shadow}" opacity="${disabled ? 0.1 : 0.2}"/>
    ${grains}
    <rect x="${x + 10}" y="${y + 12}" width="5" height="5" fill="${highlight}"/>
    <rect x="${x + 16}" y="${y + 17}" width="3" height="3" fill="${shadow}"/>
    <rect x="${x + width - 17}" y="${y + 12}" width="5" height="5" fill="${shadow}"/>
    <rect x="${x + width - 21}" y="${y + 18}" width="3" height="3" fill="${highlight}"/>
  </g>`;
}

const states = {
  default: {
    title: "DEFAULT",
    fill: c.inset,
    outer: c.idle,
    inner: c.decoration,
    content: c.secondary,
    opacity: 1,
    shift: 0,
    rail: c.cyan,
    marker: false,
  },
  pressed: {
    title: "PRESSED",
    fill: c.pressedFill,
    outer: c.cyan,
    inner: c.pressedInner,
    content: c.primary,
    opacity: 1,
    shift: 2,
    rail: c.primary,
    marker: false,
  },
  selected: {
    title: "SELECTED",
    fill: c.selectedFill,
    outer: c.cyan,
    inner: c.pressedInner,
    content: c.cyan,
    opacity: 1,
    shift: 0,
    rail: c.cyan,
    marker: true,
  },
  disabled: {
    title: "DISABLED",
    fill: c.panel,
    outer: c.decoration,
    inner: c.decoration,
    content: c.weak,
    opacity: 0.42,
    shift: 0,
    rail: c.decoration,
    marker: false,
  },
};

function iconButton(x, y, scale, stateName) {
  const s = states[stateName];
  const width = 48 * scale;
  const height = 38 * scale;
  const shift = s.shift * scale;
  const top = y + shift;
  return `<g opacity="${s.opacity}">
    ${stateName === "pressed" ? `<path d="${chamferPath(x, y, width, height, 6 * scale)}" fill="none" stroke="${c.decoration}" stroke-width="${scale}" stroke-dasharray="${3 * scale} ${3 * scale}"/>` : ""}
    <path d="${chamferPath(x, top, width, height, 6 * scale)}" fill="${s.fill}" stroke="${s.outer}" stroke-width="${2 * scale}"/>
    <path d="${chamferPath(x + 2 * scale, top + 2 * scale, width - 4 * scale, height - 4 * scale, 4 * scale)}" fill="none" stroke="${s.inner}" stroke-width="${scale}"/>
    ${darkSurfaceTexture(x, top, width, height, scale, s.rail)}
    ${segmentedBorderDetails(x, top, width, height, scale, s.rail)}
    <rect x="${x + 8 * scale}" y="${top + 4 * scale}" width="${(stateName === "selected" ? 22 : 12) * scale}" height="${2 * scale}" fill="${s.rail}"/>
    <rect x="${x + 17 * scale}" y="${top + 9 * scale}" width="${5 * scale}" height="${20 * scale}" fill="${s.content}"/>
    <rect x="${x + 26 * scale}" y="${top + 9 * scale}" width="${5 * scale}" height="${20 * scale}" fill="${s.content}"/>
    ${s.marker ? `<rect x="${x + width - 9 * scale}" y="${top + 5 * scale}" width="${4 * scale}" height="${4 * scale}" fill="${c.cyan}"/>` : ""}
  </g>`;
}

function textButton(x, y, scale, stateName) {
  const s = states[stateName];
  const width = 112 * scale;
  const height = 48 * scale;
  const shift = s.shift * scale;
  const top = y + shift;
  return `<g opacity="${s.opacity}">
    ${stateName === "pressed" ? `<path d="${chamferPath(x, y, width, height, 8 * scale)}" fill="none" stroke="${c.decoration}" stroke-width="${scale}" stroke-dasharray="${3 * scale} ${3 * scale}"/>` : ""}
    <path d="${chamferPath(x, top, width, height, 8 * scale)}" fill="${s.fill}" stroke="${s.outer}" stroke-width="${2 * scale}"/>
    <path d="${chamferPath(x + 2 * scale, top + 2 * scale, width - 4 * scale, height - 4 * scale, 6 * scale)}" fill="none" stroke="${s.inner}" stroke-width="${scale}"/>
    ${darkSurfaceTexture(x, top, width, height, scale, s.rail)}
    ${segmentedBorderDetails(x, top, width, height, scale, s.rail)}
    <rect x="${x + 12 * scale}" y="${top + 5 * scale}" width="${stateName === "selected" ? 34 * scale : 18 * scale}" height="${2 * scale}" fill="${s.rail}"/>
    <text x="${x + width / 2}" y="${top + 31 * scale}" text-anchor="middle" fill="${s.content}" font-family="Oxanium, Arial, sans-serif" font-size="${14 * scale}" font-weight="700">ACTION</text>
    ${s.marker ? `<rect x="${x + width - 12 * scale}" y="${top + 6 * scale}" width="${4 * scale}" height="${4 * scale}" fill="${c.cyan}"/>` : ""}
  </g>`;
}

function stateColumn(stateName, index) {
  const state = states[stateName];
  const x = 80 + index * 420;
  const y = 205;
  const width = 380;
  const scale = 2.4;
  const details = {
    default: ["FILL  #091728", "BORDER  #4E7398", "CONTENT  #B4C2DB", "FEEDBACK  READY"],
    pressed: ["FILL  #0B1B2C", "BORDER  #41CDC3", "CONTENT  #EEF3FF", "VISUAL  +2 Y"],
    selected: ["FILL  #102A35", "BORDER  #41CDC3", "CONTENT  #41CDC3", "MARKER  4×4"],
    disabled: ["FILL  #0C121F", "BORDER  #375373", "CONTENT  #6F8EB1", "OPACITY  42%"],
  }[stateName];
  return `<g>
    <path d="${chamferPath(x, y, width, 560, 18)}" fill="${c.panel}" stroke="${state.outer}" stroke-width="2" opacity="${stateName === "disabled" ? 0.75 : 1}"/>
    <rect x="${x + 12}" y="${y + 18}" width="6" height="6" fill="${state.rail}" opacity="${state.opacity}"/>
    <rect x="${x + width - 20}" y="${y + 18}" width="4" height="4" fill="${c.danger}" opacity="${stateName === "disabled" ? 0.2 : 0.7}"/>
    <rect x="${x + width - 20}" y="${y + 560 - 22}" width="7" height="7" fill="${state.rail}" opacity="${state.opacity}"/>
    <text x="${x + 28}" y="${y + 50}" fill="${stateName === "disabled" ? c.weak : state.content}" font-family="Oxanium, Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="2">0${index + 1} · ${state.title}</text>
    <rect x="${x + 28}" y="${y + 70}" width="${stateName === "selected" ? 142 : 72}" height="6" fill="${state.rail}" opacity="${state.opacity}"/>
    ${iconButton(x + 132, y + 105, scale, stateName)}
    <text x="${x + 190}" y="${y + 220}" text-anchor="middle" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">ICON · 48×38</text>
    ${textButton(x + 56, y + 250, scale, stateName)}
    <text x="${x + 190}" y="${y + 392}" text-anchor="middle" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">TEXT · 112×48</text>
    <path d="M${x + 28} ${y + 420}H${x + width - 28}" stroke="${c.decoration}" stroke-width="2"/>
    ${details.map((line, lineIndex) => `<text x="${x + 30}" y="${y + 458 + lineIndex * 27}" fill="${lineIndex === 3 ? state.content : c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="16" font-weight="${lineIndex === 3 ? 700 : 400}">${line}</text>`).join("")}
  </g>`;
}

function primaryButton(x, y, width, height, stateName) {
  const pressed = stateName === "pressed";
  const disabled = stateName === "disabled";
  const shift = pressed ? 2 : 0;
  const top = y + shift;
  const fill = disabled ? c.goldDisabled : pressed ? c.goldPressed : c.gold;
  const outer = disabled ? c.decoration : "#FFDC45";
  const text = disabled ? c.weak : c.darkText;
  return `<g opacity="${disabled ? 0.52 : 1}">
    ${pressed ? `<path d="${chamferPath(x, y, width, height, 10)}" fill="none" stroke="${c.decoration}" stroke-width="1" stroke-dasharray="4 4"/>` : ""}
    <path d="${chamferPath(x, top, width, height, 10)}" fill="${fill}" stroke="${outer}" stroke-width="3"/>
    <path d="${chamferPath(x + 6, top + 6, width - 12, height - 12, 6)}" fill="none" stroke="${disabled ? c.decoration : "#FFE770"}" stroke-width="1.5"/>
    ${goldSurfaceTexture(x, top, width, height, disabled, pressed)}
    <rect x="${x + width * 0.62}" y="${top - 2}" width="14" height="4" fill="${c.canvas}"/>
    <rect x="${x + width * 0.26}" y="${top + height - 2}" width="11" height="4" fill="${c.canvas}"/>
    <rect x="${x + 14}" y="${top + 11}" width="6" height="6" fill="${disabled ? c.decoration : "#FFF0A6"}"/>
    <rect x="${x + width - 20}" y="${top + height - 17}" width="6" height="6" fill="${disabled ? c.decoration : "#B96D00"}"/>
    <text x="${x + width / 2}" y="${top + height / 2 + 8}" text-anchor="middle" fill="${text}" font-family="Noto Sans SC, Arial, sans-serif" font-size="22" font-weight="700">确认操作</text>
  </g>`;
}

function transitionFlow() {
  const y = 1065;
  const nodes = [
    [80, "DEFAULT / SELECTED", c.idle],
    [430, "TOUCH_START", c.cyan],
    [740, "PRESSED", c.primary],
    [1050, "END INSIDE", c.cyan],
    [1370, "RESTORE / COMMIT", c.blue],
  ];
  return `<g>
    <text x="80" y="1010" fill="${c.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">TOUCH STATE FLOW</text>
    ${nodes.map(([x, label, color], index) => `<g><path d="${chamferPath(x, y, 250, 72, 10)}" fill="${c.panel}" stroke="${color}" stroke-width="2"/><text x="${x + 125}" y="${y + 44}" text-anchor="middle" fill="${color}" font-family="Oxanium, Arial, sans-serif" font-size="17" font-weight="700">${label}</text>${index < nodes.length - 1 ? `<path d="M${x + 260} ${y + 36}H${x + 330}" stroke="${c.decoration}" stroke-width="3"/><path d="M${x + 320} ${y + 28}L${x + 332} ${y + 36}L${x + 320} ${y + 44}" fill="none" stroke="${c.decoration}" stroke-width="3"/>` : ""}</g>`).join("")}
    <text x="80" y="1176" fill="${c.weak}" font-family="Noto Sans SC, Arial, sans-serif" font-size="17">移出命中区或 TOUCH_CANCEL：恢复进入按下前的 DEFAULT / SELECTED；DISABLED 不进入状态流。</text>
    <text x="80" y="1210" fill="${c.weak}" font-family="Noto Sans SC, Arial, sans-serif" font-size="17">视觉子节点移动，UITransform 命中区域固定；成功 END 后再触发 UI 音效与震动。</text>
  </g>`;
}

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1300" shape-rendering="crispEdges">
  <rect width="1800" height="1300" fill="${c.canvas}"/>
  <text x="80" y="78" fill="${c.primary}" font-family="Oxanium, Arial, sans-serif" font-size="46" font-weight="700" letter-spacing="3">SANDFALL BUTTON STATE SYSTEM</text>
  <text x="82" y="118" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="20" letter-spacing="2">ART-C03 · STEPPED CORNERS · PIXEL-SAND SURFACE · FIXED HIT AREA</text>
  <rect x="82" y="144" width="72" height="8" fill="${c.cyan}"/><rect x="162" y="144" width="72" height="8" fill="${c.blue}"/><rect x="242" y="144" width="72" height="8" fill="${c.danger}"/><rect x="322" y="144" width="72" height="8" fill="${c.gold}"/><rect x="402" y="146" width="1318" height="4" fill="${c.decoration}"/>
  ${stateColumn("default", 0)}
  ${stateColumn("pressed", 1)}
  ${stateColumn("selected", 2)}
  ${stateColumn("disabled", 3)}

  <text x="80" y="830" fill="${c.cyan}" font-family="Oxanium, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2">PRIMARY GOLD CTA · SELECTED NOT APPLICABLE</text>
  ${primaryButton(80, 860, 300, 72, "default")}
  ${primaryButton(420, 860, 300, 72, "pressed")}
  ${primaryButton(760, 860, 300, 72, "disabled")}
  <text x="230" y="958" text-anchor="middle" fill="${c.secondary}" font-family="Oxanium, Arial, sans-serif" font-size="16">DEFAULT</text>
  <text x="570" y="958" text-anchor="middle" fill="${c.primary}" font-family="Oxanium, Arial, sans-serif" font-size="16">PRESSED · +2 Y</text>
  <text x="910" y="958" text-anchor="middle" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="16">DISABLED</text>
  <path d="${chamferPath(1130, 850, 590, 120, 16)}" fill="${c.panel}" stroke="${c.idle}" stroke-width="2"/>
  <text x="1160" y="890" fill="${c.primary}" font-family="Oxanium, Arial, sans-serif" font-size="18" font-weight="700">PIXEL RULE</text>
  <text x="1160" y="925" fill="${c.secondary}" font-family="Noto Sans SC, Arial, sans-serif" font-size="17">两级阶梯切角、分段边框、边缘方粒；不缩放。</text>
  <text x="1160" y="953" fill="${c.weak}" font-family="Noto Sans SC, Arial, sans-serif" font-size="16">状态切换保持颗粒坐标不变，只改变颜色、亮度和位移。</text>
  ${transitionFlow()}
  <text x="80" y="1260" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">COCOS GRAPHICS + LABEL/SPRITE TINT · IMPLEMENTATION DEFERRED TO ART-C08</text>
</svg>`);

const smallCheckSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="320" shape-rendering="crispEdges">
  <rect width="1400" height="320" fill="${c.canvas}"/>
  <text x="50" y="48" fill="${c.primary}" font-family="Oxanium, Arial, sans-serif" font-size="27" font-weight="700" letter-spacing="2">ART-C03 · 1× RUNTIME SIZE CHECK</text>
  <text x="50" y="78" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="15">48×38 ICON · 112×48 TEXT · 266×60 GOLD · NO UPSCALE</text>
  ${iconButton(50, 116, 1, "default")}
  ${iconButton(122, 116, 1, "pressed")}
  ${iconButton(194, 116, 1, "selected")}
  ${iconButton(266, 116, 1, "disabled")}
  <text x="74" y="180" text-anchor="middle" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="11">DEFAULT</text>
  <text x="146" y="180" text-anchor="middle" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="11">PRESS</text>
  <text x="218" y="180" text-anchor="middle" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="11">SELECT</text>
  <text x="290" y="180" text-anchor="middle" fill="${c.weak}" font-family="Oxanium, Arial, sans-serif" font-size="11">DISABLE</text>
  ${textButton(360, 108, 1, "default")}
  ${textButton(492, 108, 1, "pressed")}
  ${textButton(624, 108, 1, "selected")}
  ${textButton(756, 108, 1, "disabled")}
  ${primaryButton(920, 102, 266, 60, "default")}
  <path d="${chamferPath(50, 226, 1136, 50, 8)}" fill="${c.panel}" stroke="${c.decoration}" stroke-width="1"/>
  <text x="72" y="257" fill="${c.secondary}" font-family="Noto Sans SC, Arial, sans-serif" font-size="15">检查目标：阶梯角可见、边框断点不破坏轮廓、暗色方粒不干扰文字、金砂颗粒不闪烁。</text>
</svg>`);

Promise.all([
  sharp(svg).png({ compressionLevel: 9 }).toFile(boardPath),
  sharp(smallCheckSvg).png({ compressionLevel: 9 }).toFile(smallCheckPath),
])
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
