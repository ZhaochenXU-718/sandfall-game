# ART-E03：横向流光 / 拖尾贴图

状态：已完成 ImageGen 动势参考、确定性分段轨道、白色 alpha 导出和实际尺寸检查；正式尺寸已在 `ART-E06` 合图并接入移动、沙化和消除事件。

规范板：[E03 横向流光 / 拖尾系统](../concepts/art-e03-horizontal-trail-system.png)

尺寸检查：[E03 实际尺寸检查](../concepts/art-e03-horizontal-trail-size-check.png)

生成式参考：[E03 ImageGen 动势候选](../concepts/art-e03-horizontal-trails-imagegen-reference.png)

## 1. 目标

为横向消除、连锁强调、硬降和坍塌提供三种轻量流光/拖尾纹理。正式资源只保存白色 alpha，颜色由当前沙粒色、连锁色或奖励色在运行时注入。

三种纹理都保持窄幅、分段和大量透明空间。它们不是厚实霓虹管，也不使用摄影式运动模糊；能量节奏来自整数像素轨道、量化衰减和稀疏方粒。

## 2. 三种纹理

| 资源 | 正式尺寸 | 主要用途 | 结构 |
| --- | ---: | --- | --- |
| `streak-clear-sweep` | `256×32` | 横向消除、连锁扫光 | 中心窄亮线，双向衰减，四条受控断续轨道 |
| `trail-comet` | `128×32` | 硬降、短距离位移强调 | 右侧阶梯方头，向左收窄的三轨彗尾，可水平翻转 |
| `trail-grain-flow` | `128×24` | 坍塌、砂化流动叠层 | 两至三条松散方粒轨，向右逐渐增密，可水平翻转 |

每种纹理另保留二倍 nearest 归档：`512×64`、`256×64`、`256×48`。E06 只选择正式尺寸进入运行图集。

## 3. 生成方式

正式纹理由 `render-art-e03-horizontal-trails.cjs` 直接生成 RGBA 像素：

- 可见像素 RGB 固定为纯白，连续轨道主体 alpha 量化为 16 档。
- 扫光和彗尾按 `2×2` 单元取样；砂粒流线使用确定性坐标和固定 alpha 档位。
- 扫光以画布中心为亮度峰值，向左右对称衰减；外轨通过固定分段门控产生断点。
- 彗尾和砂粒流线默认指向右侧，运行时通过 `scaleX=-1` 水平翻转复用，不额外制作左向图片。
- 二倍归档采用逐像素 nearest 复制，避免半透明 RGB 预乘产生偏色。

## 4. 透明、采样与混合

- 三张正式 PNG 均为白色 alpha，四角与上下外带透明。
- 扫光/彗尾的量化柔光层可使用 linear 采样，砂粒流线使用 nearest；节点位置保持像素对齐。
- 默认普通 alpha 混合。消除扫光允许短时受控 Additive，峰值不超过 `220 ms`、单层最大不透明度建议 `72%`。
- 不允许铺设全屏或整行不透明白条；扫光透明度必须在两端衰减到 `0`。
- 不允许持续拖尾常驻，也不允许叠加全屏 Bloom。

## 5. E06 接入预算

- 同屏拖尾/扫光节点上限 `3`，低端机降级档为 `1`。
- 横向消除使用一枚 `streak-clear-sweep`，建议宽度 `220～280` 设计点、高度 `12～24` 点，持续 `0.16～0.28 s`。
- `trail-comet` 建议长度 `48～110` 点、持续 `0.12～0.24 s`；根据移动方向水平翻转。
- `trail-grain-flow` 只作 E01 粒子之外的短时补充，持续 `0.18～0.35 s`，单事件最多一层。
- 三种资源不得同时在同一事件满强度叠加；消除优先扫光，位移优先彗尾，坍塌优先砂粒流线。

## 6. 验收

- 6 张导出 PNG 尺寸正确并具有 alpha：三张正式尺寸和三张二倍归档。
- 可见像素 RGB 全为 `255,255,255`，无预烘焙颜色、深色背景或彩边。
- 每张均包含不透明峰值与半透明衰减；四角透明。
- 1× 下三种轮廓仍可区分，扫光两端 alpha 为 `0`，彗尾/砂粒流线的方向明确。
- 当前未复制到 `assets/resources/art/`，包体、Draw Call 和混合性能统一在 E06/E07 验收。

## 7. ImageGen 记录

使用模式：Codex 内置 ImageGen；`stylized-concept`。输入图 1 为 ART-A03 风格板，输入图 2 为 ART-E02 光斑/光环系统，输入图 3 为 ART-C06/C07 反馈光环系统。生成结果保存在 `art-source/concepts/`，只作动势参考。

最终提示词：

```text
Use case: stylized-concept
Asset type: game VFX horizontal streak and trail texture concept sheet for ART-E03
Input images: Image 1 is the approved SANDFALL style board and controls the neon pixel-sand palette discipline, square-grain material, and restrained energy. Image 2 is the approved ART-E02 glow/halo system and controls white-alpha material thinking, quantized falloff, and limited bloom. Image 3 is the approved feedback halo system and controls segmented rails, stepped geometry, and sparse grains.
Primary request: Create exactly three isolated monochrome horizontal energy motifs for a mobile puzzle game: (1) one long symmetric clear-sweep streak, (2) one compact directional comet trail pointing right, and (3) one sparse granular flow line pointing right. These are material concepts for tintable white-alpha textures, with no final color baked into the motifs.
Scene/backdrop: plain deep-ocean navy #050D19 canvas, perfectly front-facing, no environment or perspective.
Subject: three separate white-to-light-gray motifs stacked vertically with generous spacing. The clear sweep is very wide and thin, brightest near its middle, with two or three broken parallel pixel rails and softly quantized fade toward both ends. The comet trail has a compact 6–10 px equivalent stepped square head at the right and a tapered broken tail extending left, with one narrow soft core and several hard pixel fragments. The granular flow line is mostly separated 1–4 px equivalent square grains following two loose horizontal lanes, denser near the right and sparse at the left.
Style/medium: modern high-resolution neon pixel-sand VFX; crisp rectangular modules and stepped rails with limited quantized soft alpha; polished mobile game effect, not retro low-resolution pixel art.
Composition/framing: exactly three isolated horizontal motifs; no overlap; each remains thin with substantial empty space above and below; straight horizontal baseline; right-pointing direction only for the second and third motifs.
Color palette: pure white and neutral gray motifs only on deep navy. No cyan, blue, red, gold, purple, or green inside the motifs.
Lighting/mood: fast, precise kinetic energy; restrained brightness; no broad bloom.
Constraints: exactly three motifs; no text, labels, arrows, UI frames, panels, checkerboard, icons, characters, objects, logo, or watermark. No thick solid neon tube, no continuous full-width rectangle, no curved swoosh, no diagonal perspective, no lens flare, no photographic motion blur, no fuzzy smoke, no colored fringe, no random full-canvas noise.
Avoid: anime speed lines filling the canvas; sci-fi HUD glyphs; lightning bolts; flames; liquid brush strokes; starburst spikes.
```
