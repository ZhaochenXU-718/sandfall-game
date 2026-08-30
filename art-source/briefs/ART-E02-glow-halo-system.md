# ART-E02：柔光光斑与光环贴图

状态：已完成 ImageGen 材质参考、确定性量化距离场、白色 alpha 导出和实际尺寸检查；正式尺寸已在 `ART-E06` 合图并用于落地、消除和升级反馈。

规范板：[E02 光斑 / 光环系统](../concepts/art-e02-glow-halo-system.png)

尺寸检查：[E02 实际尺寸检查](../concepts/art-e02-glow-halo-size-check.png)

生成式参考：[E02 ImageGen 材质候选](../concepts/art-e02-glow-halo-imagegen-reference.png)

## 1. 目标

为消除接触、连锁脉冲和等级提升提供三枚轻量光能纹理。所有正式资源均为白色 alpha，运行时由 Cocos 注入沙粒色或反馈色，不预烘焙青、蓝、红、金、紫等具体颜色。

本项允许有限柔光，但柔光由 `2×2` 像素单元上的量化距离场生成，而不是连续高斯模糊。这样既保留 A03 的现代像素质感，也能在较短动画中提供比 E01 方粒更平滑的能量过渡。

## 2. 三种纹理

| 资源 | 正式尺寸 | 主要用途 | 结构 |
| --- | ---: | --- | --- |
| `glow-core` | `64×64` | 落地、消除接触点 | 小型不透明核心，分级径向衰减，四枚低 alpha 方粒 |
| `halo-pulse-ring` | `128×128` | 连锁、消除脉冲 | 中心透明，四向断开的薄环与轴向方粒 |
| `halo-diamond` | `128×128` | 等级提升、强奖励 | 中心透明，阶梯菱形环与四角低 alpha 方粒 |

每种纹理另保留二倍归档：核心 `128×128`，两枚光环 `256×256`。E06 只选择正式尺寸进入运行图集。

## 3. 生成方式

正式纹理由 `render-art-e02-glow-halos.cjs` 直接生成 RGBA 像素：

- RGB 固定为纯白；主体距离场 alpha 量化为 16 档，轴向/四角方粒使用受控固定档位。
- 距离场按 `2×2` 单元取样，核心与轮廓不会出现亚像素漂移。
- 核心光斑使用径向距离；脉冲环使用圆形环带距离并切出四个可控缺口；菱形环使用曼哈顿距离形成阶梯斜边。
- 二倍归档使用 nearest 扩大，不重新计算软边。

ImageGen 候选只用于确认“分级核心、断环、阶梯菱形”三种能量层次，不参与正式透明度提取，因此不存在深色背景或彩边污染。

## 4. 透明与混合规范

- 三张正式 PNG 均为白色 alpha 蒙版，四角 alpha 为 `0`。
- 两枚光环中心 `24×24` 区域 alpha 必须为 `0`，不会覆盖棋盘信息或动态文字。
- 默认使用普通 alpha 混合；只有消除/升级峰值阶段可短时使用受控 Additive。
- Additive 峰值建议不超过 `180 ms`，单层最大不透明度建议 `70%`，禁止多层持续叠亮。
- 光斑允许 linear 采样以保持量化柔光过渡，但节点位置与缩放必须像素对齐；不得使用全屏 Bloom。

## 5. E06 接入预算

- 同屏同时存在的光环上限 `4`；低端机降级档为 `2`。
- 普通落地只使用核心光斑，初始尺寸 `18～34` 设计点，持续 `0.12～0.25 s`。
- 连锁脉冲环建议从 `0.72` 缩放至 `1.12`，持续 `0.28～0.42 s`，中心保持透明。
- 等级提升菱形环建议从 `0.82` 缩放至 `1.08`，持续 `0.35～0.55 s`，与 C06 文字反馈错开峰值约 `60 ms`。
- 不允许把光环扩展为整屏闪白，也不允许在 Idle 状态常驻。

## 6. 验收

- 6 张导出 PNG 尺寸正确并具有 alpha：核心 `64/128`，圆环与菱形环 `128/256`。
- 可见像素 RGB 全为 `255,255,255`，无预烘焙颜色或深色背景。
- 每张均包含不透明峰值和半透明衰减；四角透明。
- 两枚光环中心安全区完全透明，1× 下环带、缺口和阶梯轮廓清晰。
- 当前未复制到 `assets/resources/art/`，包体、Draw Call 与混合性能统一在 E06/E07 验收。

## 7. ImageGen 记录

使用模式：Codex 内置 ImageGen；`stylized-concept`。输入图 1 为 ART-A03 风格板，输入图 2 为 ART-E01 粒子系统，输入图 3 为 ART-C06/C07 反馈光环系统。生成结果保存在 `art-source/concepts/`，只作材质参考。

最终提示词：

```text
Use case: stylized-concept
Asset type: game VFX glow and halo texture concept sheet for ART-E02
Input images: Image 1 is the approved SANDFALL style board and controls the neon pixel-sand material and restrained glow. Image 2 is the approved ART-E01 particle system and controls the clean production-sheet discipline, pixel scale, and sparse square grains. Image 3 is the approved feedback halo system and controls stepped geometry, segmented rails, and controlled empty space.
Primary request: Create exactly three isolated monochrome glow motifs for a mobile puzzle game: (1) one compact soft core glow spot, (2) one thin broken circular pulse ring, and (3) one stepped diamond-shaped halo. These are material concepts for tintable white-alpha textures; no final color should be baked into the motifs.
Scene/backdrop: plain deep-ocean navy #050D19 canvas, perfectly front-facing, no environment and no perspective.
Subject: three separate white-to-light-gray energy motifs arranged in one horizontal row with generous spacing. The soft core glow must have a bright compact center and visibly quantized square falloff bands. The circular pulse ring must be mostly empty in the center, thin, broken at four controlled points, and include only a few square grains. The diamond halo must use crisp staircase diagonals with a restrained inner soft edge and four small corner sparks.
Style/medium: modern high-resolution neon pixel VFX, vector-like hard stepped geometry combined with limited soft alpha falloff; polished mobile game effect, not retro 8-bit.
Composition/framing: exactly three equally weighted isolated motifs, no overlap, large clear margins, no visible cards or cell borders.
Color palette: pure white and neutral gray motifs only on deep navy. No cyan, blue, red, gold, purple, or green inside the motifs.
Lighting/mood: precise reward energy, luminous but controlled; each motif has one brightest focal band and no broad bloom.
Constraints: exactly three motifs; no text, labels, numbers, arrows, UI frames, buttons, panels, checkerboard, characters, objects, logos, or watermark. No lens flare, photographic bokeh, cloudy smoke, fuzzy airbrush, starburst spikes, solid discs, filled centers in either halo, random full-canvas noise, or colored fringe.
Avoid: continuous Gaussian blur that erases the pixel structure; thick donut rings; magic-circle runes; sci-fi HUD glyphs; conventional five-point stars.
```
