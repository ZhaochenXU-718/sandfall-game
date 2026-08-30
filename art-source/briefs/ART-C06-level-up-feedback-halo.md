# ART-C06：等级提升徽记 / 光环

状态：已完成能量候选、矢量清理、透明导出与安全区检查，并已在 `ART-C08` 接入动态反馈时间轴。

共同规范板：[C06 / C07 反馈光环系统](../concepts/art-c06-c07-feedback-halo-system.png)

生成式参考：[等级提升 ImageGen 候选](../concepts/art-c06-level-up-halo-imagegen-reference.png)

透明运行候选：[等级提升光环 280×96](../exports/feedback/luosha-feedback-level-up-280x96.png)

## 1. 目标

为现有 `ScoreFeedback` 动态 Label 增加不含文字的等级提升装饰。资源只表现奖励能量、像素轨道和上升方粒；`LEVEL`、等级数字、`NEW COLOR`、`SPEED UP` 仍由 Cocos 动态渲染。

最终资源没有完整面板底色，也没有封闭厚框。它从 ImageGen 候选中保留金色像素能量和向上节奏，再按 ART-C03 的阶梯线、断点和方粒密度重新构造，以免与 HUD、按钮和弹窗系统脱节。

## 2. 输出文件

| 文件 | 尺寸 | 用途 |
|---|---:|---|
| `luosha-feedback-level-up.svg` | `280×96` viewBox | 可编辑矢量母版 |
| `luosha-feedback-level-up-560x192.png` | `560×192` | `2×` 归档母版和高清检查 |
| `luosha-feedback-level-up-280x96.png` | `280×96` | ART-C08 运行时接入候选 |

SVG 位于 `art-source/source/feedback/`，PNG 位于 `art-source/exports/feedback/`。ART-C08 只复制 `280×96` 运行候选到 `assets/resources/art/ui/feedback/`。

## 3. 构图与安全区

- 视口固定 `280×96`，中心锚点与当前 `ScoreFeedback` Label 一致。
- 动态文字安全区为 `x=20～260`、`y=28～68`，运行 PNG 在该矩形内 alpha 必须为 `0`。
- 上下断续轨道位于安全区之外；左右能量端点限制在约 `18 px` 外带。
- 顶部中央使用开放式阶梯冠光和向上方粒，不使用圆环、奖杯、金币或固定等级图标。
- 金色 `#FFC857 / #FFC44B` 为主，青色 `#41CDC3` 与蓝色 `#5B8DEF` 只用于保持品牌连续性。
- 颗粒为 `1～3 px` 方粒，辉光不烘焙为宽模糊边。

## 4. ART-C08 接入建议

```text
GameplayRoot
├── ScoreFeedbackDecoration   # Sprite，280×96，位于文字下方
└── ScoreFeedback             # 当前动态 Label，260×40
```

- `ScoreFeedbackDecoration` 使用 `Sprite.SizeMode.CUSTOM`，不做九宫格拉伸。
- 等级提升时启用 C06；普通加分和连锁时不启用。
- 装饰与 Label 共用当前 `feedbackX / feedbackY`、上移、缩放与淡出进度，持续时间继续使用现有 `1.05 s`。
- Sprite 位于 Label 下方，混合模式保持普通 alpha；不使用持续 Additive Bloom。
- `NEW COLOR` 与 `SPEED UP` 共用同一资源，不制作文字变体。

## 5. 验收

- `280×96` 与 `560×192` PNG 均有 alpha 通道。
- 四角透明，动态文字安全区最大 alpha 为 `0`。
- `1×` 下仍可识别阶梯断点和 `1～3 px` 方粒。
- 画面中不含文字、数字、按钮、完整面板、圆环或传统奖章图形。
- 与 C07 使用相同视口、锚点和安全区。

## 6. ImageGen 记录

使用模式：Codex 内置 ImageGen；`stylized-concept`。输入图 1 为 ART-C03 按钮状态板，约束阶梯几何、断点和颗粒密度；输入图 2 为 ART-A03 风格板，约束配色、方粒材质与辉光强度。生成稿只作为能量方向参考，最终运行资源由确定性 SVG 重建。

最终提示词：

```text
Use case: stylized-concept
Asset type: game UI feedback ornament concept for ART-C06
Input images: Image 1 is the approved ART-C03 button state system and controls the exact stepped-corner geometry, segmented pixel rails, square-grain scale, and restrained neon density. Image 2 is the approved ART-A03 neon pixel-sand style board and controls palette, materials, and glow discipline.
Primary request: Create one isolated LEVEL-UP badge/halo ornament concept for the SANDFALL mobile puzzle game. This is a decoration layer only; dynamic words and level numbers will be rendered by Cocos and must not appear in the image.
Scene/backdrop: straight-on preview on a plain deep-ocean navy canvas.
Subject: a wide compact 280:96-proportion pixel-energy halo framing an empty central text-safe zone, with a broken stepped diamond/radiant badge structure, short horizontal rails, crisp upward-moving square sand grains, and a restrained reward flash.
Style/medium: modern high-resolution neon pixel-sand game UI; crisp 2D vector-like stepped geometry; clean square grains; contemporary and polished, not retro low-resolution pixel art.
Composition/framing: one centered ornament, generous outer padding. Preserve a completely empty central horizontal rectangle covering roughly 72% of width and 42% of height. Keep decoration concentrated in the outer 12–20 px equivalent and at the left/right tips; symmetrical foundation with slight controlled grain asymmetry. No filled panel behind the center.
Color palette: warm reward gold #FFC857 and #FFC44B as primary; turquoise cyan #41CDC3 and cobalt blue #5B8DEF only as small continuity accents; deep blue-gray structural fragments.
Materials/textures: hard-edged luminous rails, 1–3 px equivalent square grains, restrained pixel sparkle, no glass.
Lighting/mood: celebratory upward energy, bright but tightly controlled; one focal flash only.
Constraints: no text, no letters, no numbers, no icons with literal arrows, no button, no solid card, no circular halo, no soft cloudy aura, no broad bloom, no lens flare, no coins, no stars as conventional five-point shapes, no trophies, no characters, no logo, no watermark, no random glyphs. Keep the center fully clean for dynamic text.
```
