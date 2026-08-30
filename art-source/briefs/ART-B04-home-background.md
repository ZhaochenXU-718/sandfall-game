# ART-B04：首页背景底图

状态：已完成正式 9:16 母版、运行时版本、低规格 base 与 `360×800` 长屏 cover 检查。

正式母版：[首页背景 1080×1920](../exports/home/luosha-home-bg-composite-1080x1920.png)

长屏预览：[360×800 cover 裁切检查](../exports/home/luosha-home-bg-cover-preview-360x800.png)

生成方式：Codex 内置 ImageGen。参考图只用于约束深海夜色、现代像素沙语言和装饰密度，不复制其中的 UI、文字或主视觉。

- Image 1：[ART-A01 C 方向首页](../concepts/art-a01-direction-c-pixel.png)
- Image 2：[ART-A03 视觉风格参考板](../concepts/art-a03-style-board.png)

## 1. 设计目标

- 为 Logo、首页 Hero、两张模式卡、参数面板、最高分和开始按钮提供统一深色背景。
- 中央 `70%` 宽度保持低纹理、低对比，不与文字和交互控件竞争。
- 顶部 `10%` 保持最暗，适配刘海、微信/抖音胶囊和平台状态区。
- 仅在左右最外侧使用稀疏方形沙粒、断续竖向像素列和短线装饰。
- 底部两角保留极低的方粒沙丘轮廓；中央按钮区仍为空。
- 背景唯一的大尺度光效是上中部很弱的青蓝环境晕光，最终亮度焦点仍留给 Hero 或主按钮。

## 2. 输出文件

| 文件 | 尺寸 | 用途 |
|---|---:|---|
| [ImageGen 原始稿](../concepts/art-b04-home-background-source.png) | `941×1672` | 原始生成结果，仅用于追溯 |
| [正式复合母版](../exports/home/luosha-home-bg-composite-1080x1920.png) | `1080×1920` | 宣传、高清预览和后续平台尺寸派生 |
| [运行时复合图](../exports/home/luosha-home-bg-runtime-720x1280.png) | `720×1280` | `ART-B08` 默认接入候选 |
| [低规格 base](../exports/home/luosha-home-bg-base-1080x1920.png) | `1080×1920` | 仅渐变、暗角和弱晕光；包体或启动性能回退 |
| [长屏 cover 预览](../exports/home/luosha-home-bg-cover-preview-360x800.png) | `360×800` | 对应当前 Cocos 设计画布，不进入构建 |

所有图像均为 RGB PNG，无透明通道。背景属于完整画面，不需要透明边缘。

## 3. 长屏与安全裁切

- 母版采用 `9:16`，运行时以 `cover` 方式铺满屏幕，不进行非等比拉伸。
- 当前 `360×800` 设计画布会裁掉 9:16 图像左右约 `20%` 的内容；装饰只位于边缘且均为非必要信息，因此裁切安全。
- 不以 `contain` 方式显示，避免长屏上下或左右出现空带。
- Logo、Hero、模式卡和按钮继续由安全区布局控制，不能依赖背景中的任何像素定位。
- 若横向装饰在特别窄的设备上完全被裁掉，也视为允许结果；中心可读性优先于装饰完整性。

## 4. 运行时建议

- `ART-B08` 默认测试 `720×1280` 复合图，作为单个全屏 Sprite，减少 Draw Call。
- 若微信或抖音启动包体、解码时间或低端机显存出现问题，改用 `1080×1920` base 并在构建导入时限制最大纹理尺寸；base 文件本身仅约几十 KB。
- 不建议把当前稀疏边缘装饰强行提取成半透明叠层：细小像素经过透明滤边与纹理压缩后容易产生色边，且会增加一个全屏 Draw Call。
- 后续 B05 Hero 的辉光强度必须高于背景晕光；背景不得再次增亮以补偿 Hero。
- Cocos 导入时使用线性过滤；如果边缘方粒在真机上出现闪烁，再测试 nearest 或降低装饰对比度，不扩大颗粒密度。

## 5. 禁止事项

- 不加入星空、星球、城市、海底、地平线或任何具象环境。
- 不加入 Logo、文字、按钮、面板、方块、Hero 或玩法容器。
- 不在中央铺设彩色像素、扫描线或可见网格。
- 不增加白色光源、大面积 Bloom、多色雾或中心光柱。
- 不为保留边缘装饰而缩小背景，安全裁切优先。

## 6. 最终生成提示词

```text
Use case: stylized-concept
Asset type: final full-bleed portrait home-screen background artwork for the original mobile puzzle game Sandfall / 落沙
Input images: Image 1 is the approved C-direction home-screen style reference. Image 2 is the approved production visual-style board. Extract only their deep-ocean navy atmosphere, modern pixel-sand language, subtle scanline/grid texture, dark graphite depth, restrained cyan/blue edge glow, and sparse square-grain decoration. Do not copy any UI panels, title, text, logo, cubes, buttons, or gameplay objects.
Primary request: Create one clean 9:16 portrait background layer intended to sit behind a dense Cocos mobile home screen. It must be visually polished but deliberately low-interference so that a logo, central hero, two mode cards, settings panel, score line, and large start button can all be placed over it.
Scene/backdrop: full-bleed deep navy-to-near-black vertical atmosphere. The top 10% is especially dark and quiet for notch/capsule safety. A very soft, low-contrast cyan-to-cobalt ambient halo may sit behind the upper-middle hero zone around 35% of the canvas height, but it must have no defined object or bright center. The entire central 70% width remains smooth, dark, and uncluttered.
Edge decoration: only along the far left and right 8% margins, add sparse tiny square pixel-sand grains, faint broken vertical grid columns, and occasional short cyan or blue line fragments. Keep total decorative coverage under 3%. Near the bottom corners, allow two very low dark sand-dune silhouettes made from square grains, no higher than 8% of canvas height, with only a few muted cyan, blue, coral, and gold grains. Everything must tolerate side cropping.
Style/medium: premium modern neon pixel-sand background; crisp tiny square details at the edges, subtle layered depth, contemporary mobile game finish, not retro low-resolution pixel art, not a gameplay screenshot.
Lighting/mood: calm deep-ocean night, precise and energetic but restrained. Cyan and cobalt are the only visible ambient glows. Coral and gold appear only as a handful of dim edge or bottom grains. No white glow and no bright focal object.
Color palette: dominant #050D19, #071322, #0C1A2D, #10243A; restrained accents #24D6CF and #286DF2; extremely sparse #FF5F5F and #FFC247; almost no magenta.
Composition/framing: exact portrait 9:16, straight-on flat background, full bleed with no border frame. Preserve clear low-detail zones at top 0–18%, center 18–82%, and bottom center 82–100% for overlaid UI. Edge accents must stay nonessential and safely crop on narrower devices.
Constraints: background only. Absolutely no words, Chinese characters, English letters, numbers, logos, watermarks, app icon, cubes, blocks, sand-filled objects, buttons, cards, panels, containers, characters, icons, interface labels, gameplay board, phone frame, border around the full canvas, horizon, landscape, stars, planets, or central symbol. No important detail in the middle. No more than one faint ambient halo.
Avoid: busy particle field, starry sky, cyberpunk city, space scene, underwater scenery, fog clouds, bright gradients, large bloom, strong vignette that crushes corners, noisy texture behind text, centered light beam, white particles, realistic beach sand, glass, clay, metallic machinery, decorative frames.
```
