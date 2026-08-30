# ART-A03：霓虹像素沙视觉规范

状态：已完成。

主方向：C「霓虹像素沙」。

视觉参考：[ART-A03 风格参考板](../concepts/art-a03-style-board.png)

风格来源：[ART-A01 C 方向稿](../concepts/art-a01-direction-c-pixel.png)

生成方式：Codex 内置 ImageGen，使用 C 方向稿作为唯一风格参考。

## 1. 核心定义

视觉关键词：深海夜色、方形细沙、现代街机、清晰几何、克制辉光、强正向反馈。

这不是复古低分辨率像素画。UI 的排版、间距和轮廓保持现代高清，只在沙粒材质、边角装饰和少量特效中使用像素语言。

## 2. 颜色规范

### 基础环境色

| 用途 | 色值 | 说明 |
|---|---|---|
| 画布背景 | `#050D19` | 首页和页面最深背景 |
| 棋盘背景 | `#111827` | 保持彩沙高对比 |
| 主面板 | `#0C121F` | 建议 92%～96% 不透明度 |
| 次级面板 | `#091728` | 首页参数区和深层容器 |
| 未选中描边 | `#4E7398` | 重要交互边界，低亮度、无明显外发光 |
| 装饰暗线 | `#375373` | 只用于不可操作分隔线和背景纹理 |

### 彩沙与反馈色

| 用途 | 色值 | 说明 |
|---|---|---|
| 青色沙粒 | `#4ECDC4` | 主要品牌识别色之一 |
| 青色 UI 强调 | `#41CDC3` | 选中框、次按钮和关键线条 |
| 蓝色沙粒/UI | `#5B8DEF` | 第二主强调色 |
| 红色沙粒 | `#FF6B6B` | 沙粒本体 |
| 红色 UI 强调 | `#FF636B` | 危险、失败和警示 |
| 黄色沙粒 | `#FFC857` | 沙粒本体和奖励反馈 |
| 金色主按钮 | `#FFC44B` | 主要 CTA，不用于大面积背景 |
| 第五色紫红 | `#C257B7` | LV4 解锁后出现，首页只作极少量点缀 |

### 文字色

| 用途 | 色值 |
|---|---|
| 主文字 | `#EEF3FF` |
| 次文字 | `#B4C2DB` |
| 弱提示 | `#6F8EB1` |
| 金色按钮文字 | `#101827` |

## 3. 沙粒材质

- 基础颗粒为清晰的小方粒，允许轻微圆角，但圆角不超过颗粒边长的 15%。
- 颗粒高光来自左上方，右下方只做轻微暗部，不制作透明玻璃折射。
- 单个方块的主体轮廓必须完整，表面颗粒密集；边缘允许约 5%～10% 的松散颗粒。
- 沙粒之间需要有明暗差异，不能成为一整块纯色塑料，也不能出现毛毡、黏土或海绵质感。
- 规则画面中的沙粒继续由动态纹理生成；参考板材质主要用于 Hero、Logo、图标和宣传资源。

## 4. 面板与按钮

- 360 设计宽度下，面板描边建议为 `1～2 px`，圆角建议为 `12～14 px`。
- 未选中面板使用深色填充和低亮度蓝灰描边，不添加大范围光晕。
- 选中面板使用青色或蓝色描边，内部可增加 10%～20% 同色透明填充；未选中交互面板使用 `#4E7398`。
- 允许四角使用 1～3 个小像素作为装饰，但同一面板不超过 12 个装饰像素。
- 主按钮使用金色，深色文字；外发光半径应克制，不能覆盖相邻文字。
- 次按钮使用青色或蓝色，不与主按钮竞争视觉优先级。
- 面板背景保持足够不透明，方向稿中的背景装饰不得透过文字区造成噪声。

## 5. 光照与阴影

- 辉光只用于 Logo、当前选中项、主按钮、消除核心和连锁奖励。
- 常规面板只允许细边光，不使用玻璃高光和大面积模糊阴影。
- 青、蓝辉光表现科技与流动；金色辉光表现开始、奖励和升级；红色辉光只表现危险和失败。
- 同一屏幕最多保留一个最高亮度焦点：首页为主按钮或 Hero，游戏页为正在消除的区域。
- 禁止全屏泛白、持续高亮和多种颜色同时大面积 Bloom。

## 6. 粒子与背景装饰

- UI 装饰粒子使用方形像素，大小控制在 1～3 个设计点。
- 首页静态背景的装饰像素覆盖率应低于约 3%，中央文字区进一步降低。
- Hero 周围可以出现少量散落颗粒，但不能形成烟雾或星空主体。
- 普通反馈建议同时存在 `8～20` 个可见粒子；强连锁可短时提高，但必须快速衰减。
- 横向消除流光保持细长、快速、同色，不使用宽白色激光束。
- 顶部危险效果使用红色短线、像素抖动或边缘呼吸，不使用固定大图遮罩。

## 7. 图形与字体方向

- Logo 可以使用由方形沙粒构成的字面或笔画，但最终必须人工清理边缘与字距。
- 标题字可以带有限的像素切角；正文、参数和说明文字保持现代无衬线字体。
- 中文正文不使用低分辨率像素字体，避免小尺寸难以阅读。
- 功能图标使用清晰几何线条，像素装饰只是辅助手段。
- 字体与字号采用 [ART-A04 字体与排版规范](ART-A04-typography.md)：中文为 Noto Sans SC，英文 HUD 与数字为 Oxanium。

## 8. DO / DON'T

### DO

- 使用清晰方粒表现沙子。
- 使用深色高对比背景。
- 保持模式、参数、最高分和按钮的层级清楚。
- 只在关键交互和正反馈上增加辉光。
- 保持可在 Cocos `Graphics`、Sprite 和粒子系统中复现。

### DON'T

- 不使用大面积玻璃面板或透明折射。
- 不使用黏土、毛毡、海绵和玩具塑料材质。
- 不使用模糊柔焦作为主要视觉语言。
- 不在背景铺满随机彩色像素。
- 不把复古像素字体用于中文正文。
- 不预烘焙动态分数、等级、连锁数字和模式参数。
- 不模仿现有落块游戏的 Logo、方块轮廓或经典界面构图。

## 9. ART-A03 最终生成提示词

```text
Use case: stylized-concept
Asset type: landscape game art-direction reference board for production
Input images: Image 1 is the approved visual-style reference only. Extract its design language, palette, pixel-sand material, controlled glow, and UI framing; do not recreate the full portrait home screen.
Primary request: Create a polished 16:9 visual style guide board for the original mobile puzzle game SANDFALL, showing a coherent production system based on modern neon pixel-sand.
Layout: clean landscape presentation board with a title area; one large material study of four compact cubes built from tiny square sand grains; a five-color palette strip; dark navy background samples; UI component samples including dark panel, selected card, unselected card, gold primary button, cyan secondary button, thin luminous border and corner treatment; an FX strip showing fine sand particles, restrained halo, horizontal clear streak, chain sparkle and danger accent; a small DO versus DON'T visual comparison.
Text (verbatim): "SANDFALL VISUAL STYLE", "COLOR", "MATERIAL", "UI", "FX", "DO", "DON'T". Render each label exactly once and no other text.
Style/medium: professional game art-direction sheet, contemporary clean UI presentation, crisp geometric edges, modern high-resolution pixel influence rather than retro low-resolution pixel art, practical for Cocos implementation.
Color palette: deep ocean near-black navy; turquoise cyan, cobalt blue, coral red, warm golden yellow; purple only as a small optional fifth-color accent.
Materials/textures: compact square sand grains with readable density; graphite-dark panels; thin cyan or blue edge light; restrained bloom; clean flat layered depth.
DO sample: clear hierarchy, sparse pixel decoration, crisp square grains, controlled glow.
DON'T sample: excessive bloom, glass panels, clay texture, fuzzy edges, noisy background, too many decorative pixels.
Composition/framing: straight-on organized design board, generous margins, large readable samples, no phone frame and no app screen mockup.
Constraints: preserve the approved reference's core visual identity; no people, characters, landscapes, coins, store elements, third-party logos, trademarked game shapes, watermark, paragraphs, random letters, or extra decoration.
```

## 10. 后续使用方式

- 每次生成新美术资源时，将本规范和 C 方向稿作为约束。
- 新资源如与色值、材质或禁用项冲突，以本文字规范为准。
- `ART-A04` 确定字体后，将排版规范补充到本文件。
- 首页正式资源完成并实装后，再根据真机画面校准辉光和装饰密度。
