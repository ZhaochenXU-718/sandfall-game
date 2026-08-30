# ART-E04：沙化细碎纹理 / 噪声图

状态：已完成 ImageGen 材质参考、两张确定性可平铺阈值图、二倍归档、沙化进度演示和实际尺寸检查；正式尺寸已在 `ART-E06` 合图，并以低成本 Sprite Alpha 蒙版接入沙化过渡。

规范板：[E04 沙化细碎纹理系统](../concepts/art-e04-sand-dissolve-texture-system.png)

尺寸检查：[E04 实际尺寸与平铺检查](../concepts/art-e04-sand-dissolve-size-check.png)

生成式参考：[E04 ImageGen 材质候选](../concepts/art-e04-sand-dissolve-imagegen-reference.png)

## 1. 目标

为活动方块锁定后的“固体变成沙粒”过程提供稳定、轻量、可重复的空间阈值。正式资源不保存具体沙粒颜色，只保存白色 alpha；运行时材质把 alpha 当作溶解次序，而不是直接当作最终透明度。

E04 不制作固定屏幕尺寸遮罩，也不依赖逐帧随机数。相同方块、相同 UV 和相同进度始终得到相同碎裂结果，避免闪烁、游泳噪声和回放不一致。

## 2. 两张纹理

| 资源 | 正式尺寸 | 用途 | 结构 |
| --- | ---: | --- | --- |
| `noise-sand-threshold` | `64×64` | 控制细粒逐点消失顺序 | `2×2` 方格、均匀排名、无中心或亮边 |
| `noise-sand-cluster` | `64×64` | 把相邻细粒组织成不规则碎块 | 周期控制场、开放负空间、保留微粒扰动 |

两张纹理各保留 `128×128` nearest 二倍归档。E06 只选择 `64×64` 正式尺寸进入运行图集。

## 3. 生成方式

正式纹理由 `render-art-e04-sand-dissolve-textures.cjs` 直接生成 RGBA 像素：

- 可见像素 RGB 固定为纯白，alpha 量化为 16 档。
- `noise-sand-threshold` 对全部 `32×32` 个逻辑格进行确定性排序，再扩展为 `2×2` 方粒；各档覆盖近似均匀。
- `noise-sand-cluster` 使用 `8×8` 环形控制网格生成周期低频场，再叠加少量稳定细噪声并重新排名。
- 平铺边界与内部边界遵循同一周期采样关系，不设置人为描边、亮角或中心焦点。
- 二倍归档采用逐像素 nearest 复制，避免半透明 RGB 预乘产生偏色。

## 4. E06 材质合同

建议材质按以下逻辑组合两张阈值图：

```text
threshold = fineAlpha * 0.38 + clusterAlpha * 0.62
remaining = saturate(1 - progress - localY * progress * 0.22)
visible = threshold < remaining
```

- `progress=0` 必须强制完全可见，`progress=1` 必须完全不可见。
- `localY` 从方块上缘 `0` 到下缘 `1`，仅用于让下缘略早破碎；它不是固定屏幕坐标。
- 两张纹理都设置 `Wrap Mode: Repeat`、`Filter Mode: Nearest`、关闭 mipmap，并保持像素对齐。
- 方块颜色来自现有 `DEFAULT_SAND_PALETTE`；不得在贴图或材质中预烘焙青、蓝、红、金。
- 若低端机不启用自定义材质，回退到当前 `PieceVisualAnimator` 的透明度淡出，不阻塞游戏逻辑。

## 5. 动画与性能预算

- 沙化总时长沿用当前约 `180 ms`，建议可调范围 `160～240 ms`。
- 每个锁定事件最多处理当前活动块的四个宏格，不创建全屏中间纹理。
- 噪声 UV 在单次沙化内保持静止；允许按方块格坐标做整数偏移，禁止每帧滚动。
- 纹理只参与一次阈值采样；若双纹理采样在低端机成本过高，可离线合并为一张阈值图，视觉权重保持 `38/62`。
- 破碎阶段可触发 E01 的少量下落砂迹，但 E01 粒子与 E04 材质不得同时满强度堆叠。

## 6. 验收

- 4 张导出 PNG 尺寸正确并具有 alpha：两张 `64×64` 正式纹理和两张 `128×128` 归档。
- 可见像素 RGB 全为 `255,255,255`，无预烘焙颜色、深色底或彩边。
- 每张正式纹理包含 16 个 alpha 档，覆盖分布近似均匀；不出现单一大面积纯白或纯透明区域。
- `2×` 归档与 `1×` 主图严格最近邻一致。
- `4×2` 重复预览中没有固定边框、亮角或中央焦点；运行时以 Repeat + Nearest 采样。
- 当前未复制到 `assets/resources/art/`，材质接入、Draw Call、真机表现和回退策略统一在 E06/E07 验收。

## 7. ImageGen 记录

使用模式：Codex 内置 ImageGen；`stylized-concept`。输入图 1 为 ART-A03 风格板，输入图 2 为 ART-E01 粒子系统，输入图 3 为 ART-E03 横向拖尾系统。生成结果保存在 `art-source/concepts/`，只作颗粒密度、聚散和下缘破碎节奏参考。

最终提示词：

```text
Use case: stylized-concept
Asset type: game VFX tileable pixel-sand dissolve texture concept sheet for ART-E04
Input images: Image 1 is the approved SANDFALL visual style board and controls the deep navy presentation, restrained neon pixel-sand language, crisp square modules, and palette discipline. Image 2 is the approved ART-E01 particle sprite system and controls the scale and character of tiny square sand fragments. Image 3 is the approved ART-E03 horizontal trail system and controls white-alpha material thinking, segmented rhythm, and limited quantized softness.
Primary request: Create exactly three isolated square monochrome material studies for a mobile puzzle game's sandification dissolve: (1) a fine evenly distributed threshold-noise field made of tiny square cells, (2) a clustered breakup field where small square grains gather into irregular islands with open gaps, and (3) a vertical edge-fray study showing a solid block disintegrating downward into sparse square grains. These are material and motion references only for later deterministic white-alpha texture generation.
Scene/backdrop: plain deep-ocean navy #050D19 canvas, perfectly front-facing, no environment or perspective.
Subject: three separate square studies arranged horizontally with generous spacing. The first has balanced white, light gray, medium gray, and dark gray square cells with no dominant center or stripe. The second has several loose granular clusters and negative-space channels, but no large solid blob. The third has a crisp upper block edge breaking into stepped square fragments that become sparse toward the bottom.
Style/medium: modern high-resolution neon pixel-sand VFX material study; crisp 2–8 px equivalent rectangular modules; limited quantized alpha; polished mobile game effect, not retro low-resolution pixel art.
Composition/framing: exactly three isolated square studies, equal visual scale, no overlap, straight-on orthographic view, ample empty navy margins.
Color palette: pure white and neutral gray motifs only on deep navy. No cyan, blue, red, gold, purple, or green inside the motifs.
Lighting/mood: precise, tactile granular breakup; restrained brightness; no broad bloom.
Constraints: exactly three studies; no text, labels, arrows, UI frames, panels, checkerboard, icons, characters, objects, logo, or watermark. The fine and clustered studies should visually suggest seamless repeat with no obvious bright border or central focal point.
Avoid: photographic sand, dust clouds, smoke, soft airbrush noise, liquid splashes, cracks, stone surfaces, thick neon tubes, gradients covering the whole square, colored fringe, random full-canvas noise, lens flare, motion blur.
```
