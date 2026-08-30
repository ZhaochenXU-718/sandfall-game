# ART-A04：字体与排版规范

状态：已完成视觉定调，等待后续 UI 批次统一实装与真机校准。

视觉方向：C「霓虹像素沙」。

排版参考：[ART-A04 字体与排版参考板](../concepts/art-a04-typography-board.png)

适用基准：Cocos 设计宽度 `360`，竖屏手机，微信与抖音小游戏。

## 1. 字体组合

### 中文、正文与按钮：Noto Sans SC

- 字体：`Noto Sans SC`。
- 使用字重：`Regular 400`、`SemiBold 600`。
- 用途：中文标题、模式名称、按钮、正文、操作提示和中文数字混排。
- 选择原因：简体中文覆盖完整，小尺寸清楚，中性几何结构不会与沙粒材质争夺注意力。
- 授权：SIL Open Font License 1.1，可随商业游戏嵌入和再分发；字体文件与子集文件需保留许可证。
- 官方来源：<https://github.com/notofonts/noto-cjk>
- 官方许可证：<https://github.com/googlefonts/noto-cjk/blob/main/Sans/LICENSE>

### 英文 HUD 与数字：Oxanium

- 字体：`Oxanium`。
- 使用字重：`SemiBold 600`。
- 用途：`SANDFALL` 临时字标、`SCORE`、`TIME`、`NEXT`、`CHAIN`、等级、分数、计时和版本号。
- 选择原因：方正、带轻微切角，具有现代游戏 HUD 感；不是低分辨率像素字体，小尺寸仍可读。
- 数字为等宽宽度，分数和计时更新时不会左右跳动。
- 授权：SIL Open Font License 1.1，可随商业游戏嵌入和再分发；字体文件与子集文件需保留许可证。
- 官方来源：<https://github.com/google/fonts/tree/main/ofl/oxanium>
- 官方许可证：<https://github.com/google/fonts/blob/main/ofl/oxanium/OFL.txt>

### 不采用的方案

- 中文正文不使用像素字体：10～14 设计点时笔画容易粘连，真机低亮度下识别明显下降。
- 不依赖 `Arial`、苹方或平台默认字体作为正式品牌字体：微信与抖音、iOS 与 Android 的字形和字宽会不同。
- 不将 Logo 直接等同于字体排字：`ART-B02` 仍需把最终 Logo 人工矢量化并校正字距。

## 2. 字重角色

| 角色 | 字体与字重 | 使用范围 |
|---|---|---|
| `display-latin` | Oxanium SemiBold 600 | Logo 基础、英文大标题、强反馈数字 |
| `hud-latin` | Oxanium SemiBold 600 | SCORE/TIME/NEXT、分数、计时、等级、连锁 |
| `ui-zh-strong` | Noto Sans SC SemiBold 600 | 中文标题、模式卡标题、主要按钮 |
| `ui-zh-regular` | Noto Sans SC Regular 400 | 正文、说明、提示、参数标签 |

仅使用 3 个静态字体切片：Noto Sans SC Regular、Noto Sans SC SemiBold、Oxanium SemiBold。层级主要通过字号、颜色和留白表达，不再额外引入 Medium、Bold 或其他字体家族。

## 3. 360 设计宽度字号层级

| Token | 字号 / 行高 | 字体 | 示例与用途 |
|---|---:|---|---|
| `display-hero` | `36 / 44` | Oxanium 600 | 首页 `SANDFALL`，只允许单行 |
| `title-modal` | `26 / 34` | Oxanium 600 或 Noto 600 | `GAME OVER`、弹窗主标题 |
| `feedback-strong` | `22 / 28` | Oxanium 600 | `CHAIN ×4`、升级和大额加分 |
| `button-primary` | `18 / 24` | Noto 600 | `开始进阶模式`、主要弹窗操作 |
| `card-title` | `16 / 22` | Noto 600 | `进阶模式`、`经典休闲` |
| `body` | `14 / 21` | Noto 400 | 规则解释、难度详情、弹窗摘要 |
| `hud-primary` | `14 / 18` | Oxanium 600 | `SCORE 009528`、主要分数 |
| `hud-secondary` | `13 / 18` | Oxanium 600 | `TIME 01:41`、`NEXT`、等级 |
| `hint` | `12 / 18` | Noto 400 | 手机操作提示、模式副标题 |
| `meta` | `10 / 14` | Oxanium 600 | 仅用于版本号等非交互信息 |

规则：

- 手机上的可操作说明和模式副标题不得低于 `12`；当前首页的 `10`、`11` 号提示在正式 UI 实装时提升到 `12`。
- `meta 10` 只能用于可忽略的版本号，不承载规则、状态或操作信息。
- 同一段文字最多使用一个字号和一个字重，不在一句中混合缩放来制造强调。
- 两行正文使用约 `1.5×` 行高；标题和 HUD 使用约 `1.25～1.35×` 行高。

## 4. 字距、对齐与数字

- Oxanium 大写标题字距：约 `+0.04em`；HUD 标签约 `+0.02em`。
- 中文默认字距为 `0`，短标题最多增加 `+0.02em`，不做宽松海报式排版。
- 分数固定为 6 位：`009528`；计时固定为 `MM:SS`，避免刷新时布局抖动。
- SCORE/TIME 面板左对齐，数字保持等宽；NEXT、弹窗标题和按钮居中。
- 中文与数字混排时保留一个半角空格或使用 `·` 分隔，不连续堆叠多个空格模拟表格。
- 不使用全角英文字母，不使用斜体，不使用下划线作为按钮强调。

## 5. 颜色、描边与辉光

- 主文字：`#EEF3FF`；正文：`#B4C2DB`；弱提示：`#6F8EB1`。
- 强正反馈数字：`#FFD66B`；连锁可增加金色外辉光，但文字主体必须保持锐利。
- 常规正文、HUD 和提示不使用外辉光；只允许关键反馈和 Logo 使用一次轻量辉光。
- 小于 `16` 的文字不加描边。标题需要压在复杂背景上时，优先增加面板不透明度，不用粗描边补救。
- 危险文字使用 `#FF636B`，不能只依靠红色传达状态，还需搭配图标、闪烁节奏或文字内容。

## 6. Cocos 实装策略

Cocos Creator 的动态字体资产使用 TTF。正式实装时不直接放入完整的 Noto Sans SC 可变字体，而是生成 3 个静态子集 TTF：

```text
assets/resources/art/fonts/
├── sandfall-zh-regular.ttf
├── sandfall-zh-semibold.ttf
├── sandfall-hud-semibold.ttf
└── OFL.txt
```

- `sandfall-zh-*`：从 Noto Sans SC 提取当前游戏出现的简体中文、常用标点和 ASCII。
- `sandfall-hud-*`：从 Oxanium 提取大写英文字母、数字和 `+-×:./·` 等 HUD 字符。
- 子集属于字体修改版本；生成时同步修改字体内部 family 名称为 Sandfall 专用名称，并随包保留 OFL 文本。
- 运行时通过 Cocos `Font` 资源赋给 `Label.font`，不要只设置平台 `fontFamily`。
- 新增 UI 文案时必须同步更新字符清单并重新生成子集，否则会出现缺字。
- 如果未来加入玩家昵称、公告或联网动态文本，该区域单独使用系统字体或完整动态中文字库，不扩大当前核心 UI 子集。

包体预算：3 个压缩前字体子集总计目标不超过 `250 KB`；若超出，先检查误收录的 CJK 字符范围和未使用 OpenType 表，不牺牲关键中文字符。

## 7. 当前界面映射

| 当前节点/内容 | 目标样式 |
|---|---|
| 首页正式 Logo 图片 | 使用 `ART-B02` 透明资源，不再叠加副标题文案 |
| 模式卡标题 | `card-title`，Noto 600 |
| 模式卡副标题 | `hint`，Noto 400，提升到 12 |
| 首页开始按钮 | `button-primary`，Noto 600 |
| SCORE/TIME/NEXT | `hud-primary` / `hud-secondary`，Oxanium 600 |
| `CHAIN ×N`、升级、加分 | `feedback-strong`，Oxanium 600 |
| PAUSED/GAME OVER | `title-modal`，Oxanium 600 |
| 弹窗摘要 | `body`，中英分别使用对应字体 |
| 首页键盘提示 | Web 可显示；微信/抖音正式构建隐藏，手机提示不得低于 12 |
| 版本号 | `meta`，Oxanium 600 |

## 8. 验收标准

- 在 360 设计宽度下，所有核心状态文字无需 `SHRINK` 即可完整显示。
- iOS 与 Android 真机的字号、换行和数字宽度一致，无平台默认字体差异。
- SCORE、TIME 连续更新时标签和数字不水平跳动。
- 手机低亮度下仍能分辨 12 号提示；核心操作信息不得使用 10 号字。
- 中文没有缺字、豆腐块或错误回退字体。
- 字体子集和 OFL 许可证均进入构建，3 个字体文件合计满足 `250 KB` 目标。

## 9. 后续使用方式

- `ART-B02` 制作最终 Logo 时，以 Oxanium 的方正比例作为起点，但必须转为人工校正的矢量字形。
- `ART-B08` 首页实装和 `ART-C08` 游戏内 UI 实装时统一接入字体资源与 type token。
- `ART-A05` 将基于本字号层级检查文字色与背景色的对比度。
