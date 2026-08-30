# ART-B01：Logo 概念稿

状态：已完成概念探索并确认方向。最终采用 `02 横向贯通 + 01 完整字形骨架`，进入 `ART-B02` 矢量重制。

主视觉方向：C「霓虹像素沙」。

概念板：[ART-B01 Logo 三方向概念板](../concepts/art-b01-logo-concepts.png)

生成方式：Codex 内置 ImageGen。输入图只作为风格参考，不是编辑目标。

- Image 1：[ART-A01 C 方向首页](../concepts/art-a01-direction-c-pixel.png)
- Image 2：[ART-A03 视觉风格参考板](../concepts/art-a03-style-board.png)

## 1. 共同要求

- 中文“落沙”为主标，英文 `SANDFALL` 为可选副标。
- 深海夜色背景、清晰方形沙粒、现代高清像素语言和克制辉光。
- Logo 必须先有强轮廓，再增加沙粒材质；移除颜色和辉光后仍需可辨。
- 不把生成图中的字形直接当作最终 Logo。`ART-B02` 必须重新构造中文笔画、字距、基线和沙粒边缘。
- 最终需要支持纯色、横版、竖版和无英文副标版本。

## 2. 三个方向

### 01：下缘沙化

特征：厚重的中文几何字形，下沿逐渐转为方形颗粒并向下散落。

优点：

- 中文结构最稳，缩小后的识别风险最低。
- 沙化语义直接，适合作为应用启动页和首页主标。
- 容易制作纯色剪影与单色审核版本。

风险：

- 与常见“文字粒子化”表现较接近，需要在字形比例和颗粒节奏上建立自己的识别点。
- 两字分别使用冷暖色时整体容易断开，矢量稿需要加强统一基线。

### 02：横向贯通（推荐）

特征：两字由一条细窄的彩色沙流贯穿，从“落”的动作横向延伸至“沙”的主体，强调横跨与连通。

优点：

- 最直接对应游戏核心规则：同色路径横向贯通后消除。
- 横版轮廓强，适合首页顶部、安全区下方和分享卡标题。
- 中间沙流可以独立做短动画，也可作为加载进度或页面分隔的品牌元素。

风险：

- 沙流穿过笔画时会降低中文识别，最终稿必须让主体笔画连续，不允许中线切断字形。
- 竖版和小图标版本不能照搬长横线，需要准备压缩变体。

### 03：坠落切角

特征：中文笔画带明显像素切角，右下角形成短促向下坠落的彩色颗粒瀑布。

优点：

- 动势最强，适合连锁、消除和宣传画面。
- 轮廓更具街机气质，能强化霓虹像素沙的个性。

风险：

- 切角和颗粒同时出现会使字形复杂，小尺寸识别风险最高。
- 容易向复古像素字靠拢，与“现代高清像素影响”的定位冲突。

## 3. 推荐路线

已确认以 `02 横向贯通` 为主结构，同时吸收 `01` 的完整中文骨架和克制下缘沙化：

1. 中文主体使用完整、厚实的现代几何笔画。
2. 横向沙流从两字中下部经过，但不切断主笔画。
3. 只在“沙”的右下方保留少量向下颗粒，形成方向终点。
4. 英文副标使用 ART-A04 选定的 Oxanium SemiBold，并重新排字，不使用生成图中的字母。
5. 主版优先使用青 → 蓝 → 珊瑚红 → 金色的水平过渡；第五色紫红只作为极少量连接颗粒。

## 4. ART-B02 重制要求

- 先制作黑白纯色版本，通过后再上色和增加沙粒。
- 中文字形必须人工校正，不依赖生成模型的笔画细节。
- 360 设计宽度下，首页横版 Logo 建议可视宽度 `220～270`，中文主标高度不低于 `48`。
- 导出最小测试尺寸：宽 `160 px`；在该尺寸下仍应一眼识别“落沙”。
- 颗粒最小视觉尺寸不得小于 `2 px`，避免真机缩放后闪烁或消失。
- 横向沙流和下落颗粒应拆为独立图层，以便 Cocos 做短动画。
- 最终输出 SVG 源稿，以及 1×/2× PNG 预览；正式运行时优先评估 Sprite 与代码粒子混合实现。

## 5. 概念生成提示词（已按新名称同步）

```text
Use case: logo-brand
Asset type: 16:9 landscape logo concept exploration sheet for the original mobile falling-sand puzzle game Sandfall
Input images: Image 1 is the approved C-direction home-screen style reference. Image 2 is the approved visual-style board. Use only their deep-ocean palette, crisp square sand-grain material, modern geometric construction, and restrained neon glow; do not copy their full layouts.
Primary request: Create three clearly different, original, production-minded logo directions for the Chinese game title “落沙”, with a small optional English subtitle “SANDFALL”. This is a composition and material exploration sheet; the Chinese glyphs must remain recognizable, balanced, and suitable for later manual vector reconstruction.
Composition/framing: one clean landscape sheet divided into three equal vertical concept panels with generous margins. Each panel contains one centered Chinese primary wordmark and a much smaller English subtitle below. Show each logo once, large enough to compare silhouettes. Flat straight-on presentation, no phone frame and no UI mockup.
Direction 1: bold modern geometric Chinese glyphs with crisp square-grain erosion only along the lower edges, as if the letters are beginning to become sand and fall.
Direction 2: two compact Chinese glyphs connected by a thin horizontal stream of square sand grains, expressing a color path crossing through sand; strongest horizontal silhouette.
Direction 3: bold glyphs with controlled pixel-cut corners and a short downward cascade of grains from one lower corner, expressing falling and chain reaction without becoming an illustration.
Style/medium: vector-friendly logo concept art, modern high-resolution pixel influence rather than retro low-resolution pixel art, strong silhouette, clean negative space, limited material detail, practical for manual SVG reconstruction.
Color palette: deep navy background #050D19; turquoise cyan, cobalt blue, coral red, warm golden yellow, and very limited magenta #C257B7. Keep the logo readable in one-color silhouette even when multicolor accents are removed.
Materials/textures: compact tiny square sand grains, crisp edges, slight inner luminance variation, restrained bloom. No glass, clay, felt, sponge, smoke, dust clouds, or fuzzy edges.
Text (verbatim): Render “落沙” exactly once in each of the three panels. Render “SANDFALL” exactly once under each Chinese wordmark. No other words or letters. Small numeric labels “01”, “02”, and “03” are allowed once each.
Constraints: prioritize correct recognizable Chinese structure; simple scalable geometry; balanced spacing; original design; no extra symbols unless integrated as square sand grains; no gradients except very subtle emissive edge light; no trademarked falling-block shapes; no existing game-logo imitation.
Avoid: 3D cubes, gameplay screenshots, buttons, decorative frames, landscapes, people, mascots, coins, app icons, random letters, extra Chinese characters, slogans, watermark, excessive bloom, noisy particle fields, fully disintegrated unreadable text.
```

## 6. 中文名称修订提示词

最终概念板使用内置 ImageGen 对原概念板进行定向修订，只替换中文名称：

```text
Use case: text-localization
Asset type: revised 16:9 landscape logo concept exploration sheet
Input images: Image 1 is the edit target and must otherwise be preserved.
Primary request: Change only the Chinese primary wordmark in each of the three concept panels from “沙落” to “落沙”. The first character must be 落 and the second character must be 沙 in all three panels.
Text (verbatim): Render “落沙” exactly once in panel 01, exactly once in panel 02, and exactly once in panel 03. Preserve “SANDFALL” exactly once below each logo. Preserve the numeric labels “01”, “02”, and “03”. No other text.
Invariants: keep the same 16:9 canvas, three equal panels, concept 01 lower-edge sand erosion, concept 02 horizontal connecting sand stream, concept 03 pixel-cut falling cascade, deep navy background, all colors, glow strength, scale, spacing, English subtitles, separators, and margins unchanged. Maintain recognizable correct Chinese glyph structure.
Constraints: change only the Chinese character order and reconstruct the affected glyph artwork cleanly in the same square-grain style. No new objects, no layout changes, no extra particles, no extra text, no watermark.
```
