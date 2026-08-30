# ART-C04：暂停弹窗装饰

状态：已完成候选、矢量清理、透明导出与安全区检查，并已在 `ART-C08` 接入共同弹窗节点。

视觉方向：C「霓虹像素沙」。

共同规范板：[ART-C04/C05 弹窗装饰系统](../concepts/art-c04-c05-modal-decoration-system.png)

生成式材质参考：[暂停弹窗 ImageGen 候选](../concepts/art-c04-pause-modal-imagegen-reference.png)

透明运行候选：[暂停装饰 286×300](../exports/modal/luosha-modal-decoration-pause-286x300.png)

## 1. 结论

暂停弹窗使用冷静的青/蓝像素沙装饰，仅占据 `286×300` 弹窗最外侧约 `18 px`。中央标题、数据、按钮和提示区域全部透明，不在图片中烘焙任何文字、数字、按钮或面板底色。

ImageGen 候选用于确定四角颗粒节奏、分段导线和顶部暂停氛围。最终资源已经按 ART-C03 的两级阶梯切角、分段边框和方粒规则重新矢量化，不直接使用候选图像素。

## 2. 输出文件

| 文件 | 尺寸 | 用途 |
|---|---:|---|
| `luosha-modal-decoration-pause.svg` | `286×300` viewBox | 可编辑矢量母版 |
| `luosha-modal-decoration-pause-572x600.png` | `572×600` | `2×` 归档母版和高清检查 |
| `luosha-modal-decoration-pause-286x300.png` | `286×300` | ART-C08 运行时接入候选 |

SVG 位于 `art-source/source/modal/`，PNG 位于 `art-source/exports/modal/`。ART-C08 只把实际使用的 `286×300` 文件复制到 `assets/resources/art/ui/`，不把候选和 `2×` 母版打入包体。

## 3. 共同几何与安全区

弹窗当前设计尺寸为 `286×300`，透明装饰层与 `ModalCard` 完全同尺寸、中心锚点一致。

| 区域 | 自顶部起始 | 高度 | 约束 |
|---|---:|---:|---|
| 标题安全区 | `24` | `52` | PAUSED / GAME OVER 动态 Label |
| 数据安全区 | `76` | `102` | SCORE、TIME、BEST 等三行信息 |
| 按钮安全区 | `190` | `56` | Resume、Play Again、Home 等按钮 |
| 提示安全区 | `254` | `28` | 键盘或移动端提示 |

- 四个安全区横向均从 `x=18` 延伸到 `x=268`，装饰不得进入。
- 主结构使用 `12 px` 两级阶梯切角和 `2 px` 蓝灰外边。
- 边框在顶部、左右和底部使用固定断点，避免完整发光矩形。
- 角落方粒大小为 `1～3 px`，暂停版使用青色、蓝色和蓝灰，不使用危险红。
- 顶部中央的两根短方条位于标题安全区上方，只承担暂停氛围，不替代 Resume 按钮图标。

## 4. Cocos 接入

ART-C08 推荐层级：

```text
ModalCard
├── ModalBaseGraphics       # 深色填充与必要内层
├── ModalDecorationSprite   # 本项透明 PNG，286×300
├── Title / Summary Labels
├── Action Buttons
└── Hint Label
```

- `ModalDecorationSprite` 使用 `SizeMode.CUSTOM`，尺寸固定 `286×300`，不使用九宫格拉伸。
- C04 与 C05 Sprite 共用节点，只根据游戏阶段切换 `spriteFrame`。
- 现有 `Graphics` 卡片的圆角外边在接入时改为阶梯底形；避免和图片外边重复绘制两套亮线。
- 装饰层不接收触摸，不改变现有按钮节点的命中区域。
- 暂停弹窗不使用持续 Bloom；允许整体透明度在出现时用 `120～180 ms` 淡入，但不缩放图片。

## 5. 验收标准

- PNG 具有透明通道，四角外部和中央信息区完全透明。
- `286×300` 下 `1～3 px` 方粒与分段边框仍清晰，无缩放模糊。
- PAUSED、三行数据、Resume 按钮和提示文案没有任何装饰干扰。
- 与 ART-C03 按钮并列时，两级阶梯切角、断点和颗粒密度一致。
- 微信与抖音低亮度下，装饰可见但亮度低于弹窗标题和按钮。

## 6. ImageGen 记录

使用模式：Codex 内置 ImageGen；`ui-mockup`。输入图 1 为 ART-C03 按钮状态板，负责阶梯几何和颗粒密度；输入图 2 为 ART-A03 风格板，负责颜色和材质。

最终提示词：

```text
Use case: ui-mockup
Asset type: visual concept reference for a pause-modal decoration layer in the original portrait mobile puzzle game SANDFALL / 落沙
Primary request: Create one isolated 286:300-proportion pause popup decoration concept, shown large and straight-on against a plain deep-navy preview canvas. It is an ornamental overlay concept only: stepped frame fragments, quiet cyan/blue pixel-sand edge accents, sparse square grains, and restrained inner-edge light. Do not design the final panel fill, title, data, buttons, or text.
Input images: Image 1 is the approved ART-C03 button-state system and controls the exact stepped-corner geometry, segmented borders, edge grains, and restrained pixel-sand density. Image 2 is the approved ART-A03 style board and supplies the deep-ocean palette, crisp square grains, and controlled neon intensity.
Scene/backdrop: plain #050D19 preview background with a single centered popup decoration, no phone frame and no gameplay screen.
Style/medium: modern high-resolution neon pixel-sand UI, crisp 2D vector-like stepped geometry plus sparse granular surface accents; calm paused mood; not retro low-resolution pixel art.
Composition/framing: modal aspect ratio 286×300. Decoration stays within the outermost 18 px equivalent around the perimeter, plus small top and bottom corner clusters. Keep a very large clean central information-safe region and a clean lower button-safe region. The frame may use two-step right-angle chamfers, short broken cyan/blue rails, 1–3 px square grains, and a subtle top-center pause motif made only from two short square bars outside the title-safe region.
Color palette: #050D19 background, graphite #0C121F, idle blue-gray #4E7398, cyan #41CDC3, blue #5B8DEF, secondary #B4C2DB. No red and almost no gold.
Materials/textures: opaque dark graphite frame references, sparse cyan/blue pixel grains concentrated at corners, no glass, no metal, no soft haze.
Text: no text, letters, numbers, labels, icons, or watermark.
Constraints: preserve the exact clean center; no decoration behind title/data/buttons; no complete filled popup card; no button shapes; no embedded pause word; no scores; no clocks; no gameplay pieces; no characters; no logo; no circular ornament; no rounded corners; no continuous diagonal bevel; no broad glow; no dense particles; no random glyphs.
Avoid: generic sci-fi HUD, glassmorphism, ornate fantasy frame, bright bloom, starfield, smoke, symmetrical wings, dense circuitry, blue hologram.
```

生成候选只保存在 `art-source/concepts/`，不进入运行包。
