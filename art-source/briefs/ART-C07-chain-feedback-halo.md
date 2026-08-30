# ART-C07：连锁反馈徽记 / 光环

状态：已完成横向能量候选与白色 alpha 蒙版，并已在 `ART-C08` 接入按连锁层级着色的动态反馈。

共同规范板：[C06 / C07 反馈光环系统](../concepts/art-c06-c07-feedback-halo-system.png)

生成式参考：[连锁反馈 ImageGen 候选](../concepts/art-c07-chain-halo-imagegen-reference.png)

透明运行候选：[连锁光环白色蒙版 280×96](../exports/feedback/luosha-feedback-chain-mask-280x96.png)

## 1. 目标

为现有 `CHAIN ×N · +分数` 动态 Label 提供可复用的无字装饰。不同连锁层数共用同一张白色 alpha 蒙版，由 Cocos 的 Sprite 颜色、透明度和现有缩放动画表达强度，不制作 `×2`、`×3` 或 `×4` 固定数字图片。

C07 与 C06 共用视口、中心锚点、动态文字安全区和方粒模数。差异只在运动方向：C06 向上展开，C07 从左右向外传播，形成更快速的连锁反馈。

## 2. 输出文件

| 文件 | 尺寸 | 用途 |
|---|---:|---|
| `luosha-feedback-chain-mask.svg` | `280×96` viewBox | 可编辑白色 alpha 蒙版母版 |
| `luosha-feedback-chain-mask-560x192.png` | `560×192` | `2×` 归档母版和高清检查 |
| `luosha-feedback-chain-mask-280x96.png` | `280×96` | ART-C08 运行时接入候选 |

SVG 位于 `art-source/source/feedback/`，PNG 位于 `art-source/exports/feedback/`。运行文件保持白色 RGB 与分级 alpha，方便 Sprite tint。

## 3. 共同几何与连锁层级

- 视口固定 `280×96`；动态文字安全区固定为 `x=20～260`、`y=28～68`，区域内 alpha 为 `0`。
- 上下使用断续轨道，左右使用外扩阶梯翼和离散方粒；不绘制写实链条或闭合圆环。
- 所有形状都为白色，亮度层级由 alpha 保存，不在资源内固定奖励色。

建议运行时映射：

| 连锁层数 | Sprite Color | 建议不透明度 | 说明 |
|---:|---|---:|---|
| `×2` | `#FFC857` | `82%` | 基础金色奖励 |
| `×3` | `#FF636B` | `92%` | 珊瑚红加速感 |
| `×4+` | `#C257B7` | `100%` | 紫红最高层级 |

颜色只表达反馈等级，不改变文字内容和命中逻辑。若后续需要更多层级，继续复用 `×4+` 配色并通过粒子系统增加瞬时方粒，不新增固定 PNG。

## 4. ART-C08 接入建议

- 新建 `ScoreFeedbackDecoration` Sprite，尺寸 `280×96`，层级位于 `ScoreFeedback` Label 下方。
- `scoreFeedbackShowsChain` 为 true 时启用 C07，并按 `chainLevel` 设置 Sprite color；等级提升时改用 C06。
- Sprite 与 Label 共用当前 `1.05 s` 时间轴、`34` 设计点上移和缩放进度。
- 淡出 alpha 应乘以蒙版原有 alpha；不要把整张矩形设为发光面板。
- 普通 `+分数` 反馈继续仅显示文字，不启用 C07。

## 5. 验收

- `280×96` 与 `560×192` PNG 均为带 alpha 的白色蒙版。
- 所有非透明像素的 RGB 均为白色，可被 Cocos Sprite 正确着色。
- 动态文字安全区最大 alpha 为 `0`。
- 任意 tint 下阶梯断点、侧翼与 `1～3 px` 方粒仍清晰。
- 画面中不含文字、数字、乘号、固定连锁层数、写实链条、按钮或面板底色。

## 6. ImageGen 记录

使用模式：Codex 内置 ImageGen；`stylized-concept`。输入图 1 为 ART-C03 按钮状态板，约束阶梯和方粒语言；输入图 2 为 ART-A03 风格板，约束霓虹像素沙材质。生成稿用于判断横向能量节奏，最终运行资源由确定性白色 SVG 蒙版重建。

最终提示词：

```text
Use case: stylized-concept
Asset type: reusable game UI feedback ornament concept for ART-C07
Input images: Image 1 is the approved ART-C03 button state system and controls stepped geometry, pixel-aligned rail breaks, square-grain scale, and restrained ornament density. Image 2 is the approved ART-A03 neon pixel-sand style board and controls palette, material, and glow discipline.
Primary request: Create one isolated reusable CHAIN feedback badge/halo ornament concept for the SANDFALL mobile puzzle game. The same ornament must support any chain count; dynamic CHAIN text, multiplier, number, and score will be rendered by Cocos and must not appear in the image.
Scene/backdrop: straight-on preview on a plain deep-ocean navy canvas.
Subject: a wide compact 280:96-proportion stepped pixel-sand energy frame around a completely empty central text-safe zone. Use paired interlocking square-corner bracket rhythms at left and right, short broken horizontal rails, outward-propagating square grains, and tiny tierable energy nodes. The silhouette should feel faster and more lateral than the level-up ornament while remaining in the same family.
Style/medium: modern high-resolution neon pixel-sand game UI; crisp 2D vector-like geometry; clean square grains; contemporary polished arcade feedback, not retro low-resolution pixel art.
Composition/framing: one centered ornament with generous padding. Preserve a completely empty central horizontal rectangle covering roughly 72% of width and 42% of height. Keep all visual energy in the perimeter band and side wings. Horizontally balanced, with controlled asymmetric particle release.
Color palette for concept preview: warm gold #FFC857 as main chain reward, small coral #FF636B and purple #C257B7 high-tier accents, cobalt blue #5B8DEF structural continuity. Design the shapes so the final production asset can also work as a single white alpha mask tinted by Cocos.
Materials/textures: hard-edged luminous rails, 1–3 px equivalent square grains, crisp stepped links, restrained sparkle, no glass.
Lighting/mood: escalating combo energy, quick lateral pulse, stronger at the outer tips and clear at the center.
Constraints: no text, no letters, no numbers, no multiplication symbol, no fixed chain count, no filled panel, no button, no circular halo, no literal chain-link illustration, no soft cloudy aura, no broad bloom, no lens flare, no coins, no conventional stars, no characters, no logo, no watermark, no random glyphs. Keep the center fully clean for dynamic text.
```
