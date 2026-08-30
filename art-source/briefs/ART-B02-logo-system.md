# ART-B02：落沙 Logo 颗粒矢量系统

状态：已按概念稿重新完成，等待 `ART-B08` 首页实装和双平台真机校准。

确认方向：`02 横向贯通 + 01 完整字形骨架`。

总览：[ART-B02 Logo 系统预览板](../concepts/art-b02-logo-system.png)

## 1. 核心设计

- 中文“落沙”不是平滑字体填色，而是由 `28×28` 方形颗粒网格重新构成。
- Noto Sans SC Bold 只用于生成完整字形骨架；最终 SVG 中每一粒沙都是独立矩形，不含中文字体或平滑字形 Path。
- “落”从金砂黄经过橙色过渡到珊瑚红；“沙”从海盐青经过天蓝过渡到深海蓝。
- 每颗方粒包含主色、顶部微高光、右侧与底部微阴影，在保留像素边缘的同时形成概念稿中的立体发光颗粒。
- 两字中部由一条起伏的主沙流和上下两层离散颗粒横向贯通，形成约 `30` 设计点宽的破碎流带；颜色依次经过红、紫、蓝和青。
- 主字形保持完整，不通过挖空或删笔画表现沙化；只有字外的独立颗粒继续下落。
- 英文 `SANDFALL` 使用 Oxanium SemiBold 路径，逐字沿用青、蓝、紫、红、黄的游戏色谱。
- 辉光只作为字形背后的克制软光，不改变方形颗粒的清晰轮廓。

## 2. 矢量源文件

| 文件 | 画布 | 用途 |
|---|---:|---|
| [中文横版](../source/logo/luosha-logo-horizontal.svg) | `640×260` | 首页主标、加载页、横向宣传区域 |
| [中英横版](../source/logo/luosha-logo-lockup.svg) | `640×320` | 分享卡、宣传图、品牌说明 |
| [竖版组合](../source/logo/luosha-logo-vertical.svg) | `420×420` | 竖版海报、较窄容器和平台后台素材 |
| [纯图形标记](../source/logo/luosha-logo-mark.svg) | `256×256` | 小尺寸品牌角标；不是最终平台应用图标 |
| [浅色单色版](../source/logo/luosha-logo-monochrome.svg) | `640×260` | 深色背景、审核用单色版本 |
| [深色单色版](../source/logo/luosha-logo-monochrome-dark.svg) | `640×260` | 浅色背景和黑白印刷 |

纯图形标记把两个相向的颗粒结构用细沙流连接，并让右侧颗粒继续下落。最终微信、抖音应用图标仍在 `ART-B03` 单独设计，不能直接把该标记当作平台图标提交。

## 3. PNG 导出

透明 PNG 位于 `art-source/exports/logo/`，每个版本均提供 1× 与 2×：

```text
luosha-logo-horizontal.png / @2x.png
luosha-logo-lockup.png / @2x.png
luosha-logo-vertical.png / @2x.png
luosha-logo-mark.png / @2x.png
luosha-logo-monochrome.png / @2x.png
luosha-logo-monochrome-dark.png / @2x.png
```

这些文件目前是美术导出，不进入 Cocos 构建。`ART-B08` 只把实际使用的 1～2 个压缩版本复制到 `assets/resources/art/home/`，避免候选尺寸重复占用小游戏包体。

## 4. 尺寸与安全空间

- 首页推荐使用中文横版，设计宽度 `240～270`，保持原始宽高比。
- 中文横版最低显示宽度为 `160`；已在 `160×65` 下检查，“落沙”仍可识别。
- 带英文副标版本最低显示宽度为 `220`；更小时隐藏英文，而不是继续缩小。
- 安全空间以横版中文字形高度的 `0.25×` 为基准，四周不得放置按钮、胶囊、分数或高亮图标。
- 不允许拉伸、压扁、旋转、交换两字顺序，或把方粒平滑成普通字体轮廓。
- 不允许把贯通沙流替换为连续色带；它必须保持由独立方形颗粒构成。
- 不允许增加白色描边或覆盖颗粒边缘的大面积 Bloom。

## 5. 背景与配色

- 首选背景：`#050D19` 或 `#0C121F`。
- 深色背景使用彩色版或浅色单色版。
- 浅色背景只使用深色单色版，避免黄色颗粒失去对比。
- 紫红色只用于连接流、英文副标和少量落粒，不作为中文整笔画主色。
- SVG 内的软光服务于静态品牌预览；若首页需要呼吸光，由 Cocos 独立实现并控制强度和性能。

## 6. 动画拆分建议

`ART-B08` 实装时建议拆成三个层级：

1. `WordmarkBase`：完整“落沙”静态 Sprite，不参与持续抖动或溶解。
2. `BridgeGrains`：中部多层横向颗粒带依次升亮，时长 `0.45～0.65s`，亮度峰值从暖色端向冷色端移动；上下离散粒允许有轻微相位差。
3. `FallingGrains`：字形下方颗粒做不超过 `14` 设计点的缓慢漂落与淡出，尺寸较小的颗粒稍晚启动。

若小游戏包体或 Draw Call 不允许拆层，直接使用预烘焙横版 PNG；不应为保留动画牺牲首页帧率。

## 7. 字体来源与生成方式

- 中文构形参考：Noto Sans SC Bold 700，SIL OFL 1.1。
- 英文骨架：Oxanium SemiBold 600，SIL OFL 1.1。
- 中文先缩采样为 `28×28` 二值骨架，再由构建脚本逐格生成方形矢量颗粒。
- 英文字形由 [extract-font-glyphs.swift](../source/extract-font-glyphs.swift) 转换为自包含 SVG Path。
- Logo 构建工具：[build-art-b02-logo.py](../source/build-art-b02-logo.py)。
- PNG 与预览板工具：[render-art-b02-logo.cjs](../source/render-art-b02-logo.cjs)。

生成文件不嵌入完整字体，不含 SVG `<text>` 节点。源字体许可证和运行时字体子集仍按 `ART-A04` 规范管理。

## 8. 重新生成

```bash
python art-source/source/build-art-b02-logo.py \
  --noto /path/to/NotoSansSC[wght].ttf \
  --oxanium /path/to/Oxanium[wght].ttf \
  --output-dir art-source/source/logo

node art-source/source/render-art-b02-logo.cjs \
  --sharp /path/to/sharp \
  --source-dir art-source/source/logo \
  --export-dir art-source/exports/logo \
  --board art-source/concepts/art-b02-logo-system.png
```

上述命令只属于美术生产流程，不加入游戏运行依赖。

## 9. 后续验收

- `ART-B08` 首页实装后检查安全区、静态清晰度、呼吸动画和启动包体。
- 微信与抖音分别在 25%、50% 和 100% 屏幕亮度下观察黄色顶部颗粒和中部多层沙流。
- 分享卡和平台素材使用中英横版时，确认英文副标没有被平台裁切。
- 正式发布前对“落沙 / SANDFALL”名称和图形标记进行商标检索。
