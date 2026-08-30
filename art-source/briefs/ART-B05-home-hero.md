# ART-B05：首页彩沙主视觉

状态：已完成透明母版、运行时导出和当前 `220×190` Hero 区域合成检查，等待 `ART-B08` 实装。

透明母版：[首页彩沙 Hero 1024×896](../exports/home/luosha-home-hero-1024x896.png)

首页合成检查：[360×800 背景 + 220×190 Hero](../concepts/art-b05-home-hero-layout-check.png)

生成方式：Codex 内置 ImageGen，先生成纯洋红抠像背景，再使用 imagegen 技能提供的本地去背工具生成 RGBA PNG。

- Image 1：[ART-A01 C 方向首页](../concepts/art-a01-direction-c-pixel.png)
- Image 2：[ART-A03 视觉风格参考板](../concepts/art-a03-style-board.png)

## 1. 设计结构

- 主体由四个紧凑彩沙立方块组成：青色位于后左、蓝色位于后右、红色位于前左、金色位于前右。
- 使用略微俯视的 2.5D 视角，顶部颗粒更亮、正面保持饱和、侧面压暗。
- 方块主体保持完整稳定，只在下缘释放少量方形颗粒，避免 Hero 看起来正在完全崩塌。
- 四块共同形成一个整体轮廓，不通过横线连接，也不使用现成俄罗斯方块组合。
- 不预烘焙落地阴影、外部辉光和长距离粒子尾，避免透明边缘污染并给 Cocos 动画留下空间。

## 2. 输出文件

| 文件 | 尺寸 | 用途 |
|---|---:|---|
| [洋红抠像原稿](../concepts/art-b05-home-hero-chroma-source.png) | `1347×1167` | ImageGen 原始输出，仅用于追溯与重新去背 |
| [原始透明去背稿](../concepts/art-b05-home-hero-alpha-raw.png) | `1347×1167` | 未裁切 RGBA 中间结果 |
| [透明正式母版](../exports/home/luosha-home-hero-1024x896.png) | `1024×896` | 后续尺寸派生与宣传使用 |
| [运行时透明图](../exports/home/luosha-home-hero-runtime-512x448.png) | `512×448` | `ART-B08` 默认接入候选 |
| [设计尺寸预览](../exports/home/luosha-home-hero-preview-220x190.png) | `220×190` | 当前 Cocos Hero 区域检查，不直接进构建 |

所有正式输出均为 RGBA PNG，四角 alpha 为 `0`。透明母版的可见区域保留约 `4%～6%` 内边距，呼吸缩放时不应裁切松散颗粒。

## 3. 去背方式与验证

- 抠像背景选择 `#FF00FF`，避免绿色抠像影响青色方块。
- 生成时禁止主体使用洋红色、外部辉光、投影、地面和反射。
- 使用 `remove_chroma_key.py` 的 `border auto-key + soft matte + despill` 流程。
- 实际采样 key 为 `#F303F3`，四角完全透明。
- 已在透明查看器、白色背景和 B04 深色背景上检查：青色边缘完整，没有可见洋红色边线。
- 若后续重新生成，必须重复白底与深色底双背景检查，不能只看透明棋盘格。

## 4. 动画拆层评估

不建议把四个方块拆为四张 Sprite。它们存在明确遮挡关系，分拆后容易产生缝隙，并会增加 Draw Call、动画状态和适配复杂度。

推荐 `3` 层运行结构。参考首页方向稿中围绕彩砂主体的大范围粒子场，悬浮沙粒是主视觉的一部分，不是可选点缀：

1. `HomeHeroBody`：使用 `512×448` 透明 Sprite，包含四块和紧贴边缘的静态松散颗粒。继续复用当前漂浮、轻摆、呼吸缩放和点击弹跳。
2. `HomeHeroGrainHalo`：保持约 `24～40` 颗可见方粒分布在主体四周，重点覆盖左右外缘、顶部空隙和下方尾部；以慢速漂浮、轻微明暗变化形成持续的“彩砂场”。
3. `HomeHeroDriftGrains`：对象池循环 `8～16` 颗远距离颗粒，缓慢下落或短暂上浮、轻微横向漂移并淡出。点击 Hero 或模式切换时可额外短促喷发一次，但总量受池上限控制。

三层合计的常态可见悬浮粒子目标为 `32～56` 颗；低性能设备可降至 `20～32` 颗，但不能完全关闭。应使用一个批量 Graphics、自定义 Mesh 或单个粒子系统承载，禁止为每颗粒子建立独立 Node。

可选第四层 `HeroHalo` 当前不需要单独贴图：B04 背景已经包含弱环境晕光。若 B08 真机显示主体分离不足，优先用一个低透明青蓝圆形 Graphics 或小型加色 Sprite 补光，而不是修改 Hero PNG。

## 5. Cocos 实装建议

- 保留现有 `HomeHero` wrapper 节点及 `renderHomeScreen()` 的 bob、sway、scale 和点击 impulse 逻辑。
- 把当前 `Graphics` 占位绘制替换为 `HomeHeroBody` Sprite；设计显示尺寸继续以 `220×190` 为起点。
- 动态粒子场跟随 wrapper 的位置但不必完全跟随其旋转；轻微相位滞后会更像松散沙粒。粒子分布必须包围整个主体，不能只集中在方块下沿。
- 不在每帧重建 SpriteFrame，不用 CPU 修改纹理像素。
- 微信和抖音分别检查 `512×448` 纹理解码、首屏启动时间和小尺寸颗粒闪烁。
- 如果运行时文件过大，优先在 Cocos 导入设置中限制最大尺寸或使用平台纹理压缩，不直接降低母版质量。
- `ART-B08` 首页验收截图必须能一眼看到主体周围持续存在的大量彩色悬浮方粒；若只剩零星 `6～12` 颗则视为未完成。

## 6. 最终生成提示词

```text
Use case: stylized-concept
Asset type: final isolated transparent-ready home-screen hero artwork for the original mobile puzzle game Sandfall / 落沙
Input images: Image 1 is the approved C-direction home-screen reference and defines the four-cube hero concept and color arrangement. Image 2 is the approved visual-style board and defines the crisp square-grain material, palette, controlled highlights, restrained depth, and modern neon pixel-sand finish. Use them as style and composition references; do not copy any UI, text, logo, panels, or background.
Primary request: Create one compact floating hero cluster made from exactly four large sand-filled cubes. Cyan cube at back-left, cobalt-blue cube at back-right, coral-red cube at front-left, warm-gold cube at front-right. Arrange them as one balanced shallow diamond cluster viewed from a slightly elevated three-quarter angle, with clear overlap and a strong readable silhouette suitable for a 220×190 design-space home-screen sprite.
Subject detail: each cube is densely constructed from crisp small square sand grains. The top plane is brighter and granular, the front plane is saturated, and the side plane is darker. Keep cube edges mostly straight and solid, but let only the lower outer edges loosen into 6–12 clearly separated square grains close to the cluster. No long particle tail; distant falling grains will be animated in Cocos. Do not connect the cubes with a line or band.
Style/medium: premium modern high-resolution pixel-sand game art; polished 2.5D depth; shallow cube relief; clean silhouette; crisp grains; subtle internal luminance variation; not photorealistic and not retro low-resolution pixel art.
Composition/framing: single centered subject on a landscape 4:3 canvas, filling about 72% of the width and 70% of the height, with generous empty padding on every side. Keep the full subject and every detached grain inside the canvas. No cropping.
Lighting/mood: energetic colored material with restrained highlights. Lighting is contained inside the subject; no large external glow, no cast shadow, no floor shadow, no reflection.
Color palette: turquoise cyan #24D6CF, cobalt blue #286DF2, coral red #FF5F5F, warm golden yellow #FFC247, darker shaded faces based on the same hues. Do not use magenta, green, white blocks, or extra colors.
Chroma-key background: place the subject on one perfectly flat, uniform solid #FF00FF background for local background removal. The entire background must be exactly one color with no gradient, texture, noise, shadows, glow spill, floor plane, vignette, reflection, or lighting variation. Do not use #FF00FF or any magenta anywhere in the subject.
Constraints: exactly four cubes and one compact cluster. No words, Chinese characters, English letters, numbers, logo, watermark, app icon, buttons, panels, UI frame, gameplay board, phone mockup, container, landscape, character, coins, or extra object. No cast shadow or contact shadow. Crisp subject edges for chroma-key removal.
Avoid: glass transparency, smoke, soft dust, fuzzy edges, realistic beach sand, clay, felt, stone, plastic toy look, excessive 3D perspective, large bloom, white flash, magenta highlights, tiny noisy particle cloud, trademarked falling-block shapes, recognizable existing game composition.
```
