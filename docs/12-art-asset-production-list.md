# 美术资源制作与实装清单

本文档是 Sandfall 美术工作的唯一进度清单。后续按批次完成“设计确认 → 制作 → 导出 → Cocos 实装 → 微信/抖音真机验收”，完成后直接更新对应复选框。

## 1. 状态与制作方式

状态：

- `[ ]`：待制作
- `[-]`：制作中
- `[x]`：已制作、已实装并通过真机验收
- `[!]`：需要返工

制作方式：

- `G`：适合直接使用 GPT-Image-2 生成候选图。
- `G+`：适合 GPT-Image-2 生成基础稿，但必须人工清理、排版或矢量化。
- `C`：应使用 Cocos、代码、Shader 或矢量工具精确制作，不依赖生成图片。
- `M`：混合方式，生成式美术负责氛围或装饰，规则信息由代码或矢量图保证准确。

## 2. 统一制作规范

- 延续当前方向：深海夜色、高饱和彩沙、柔和辉光、轻度 2.5D。
- 生成图片中不直接嵌入最终中文、分数、等级等动态文字。
- 游戏规则相关图形必须保持准确；沙粒颜色、方块形状和连通关系不得由生成模型随意修改。
- Logo、功能图标和小尺寸符号最终应使用可控的矢量稿或代码绘制版本。
- 带透明背景的运行时素材导出为 PNG；大幅无透明背景图优先评估 JPG，避免无意义的透明通道。
- 首页关键内容必须避开顶部平台胶囊、刘海和底部手势区域，并保留横向裁切余量。
- 每批资源实装后都要比较微信与抖音构建包体、启动时间、内存和真机清晰度。
- 第一阶段新增运行时美术的压缩后预算目标为 `1.5 MB` 以内；超出时优先压缩背景、合并小图和移除未使用候选稿。
- 生成过程中的候选图和源文件不放入 Cocos `assets/`；只有最终运行时导出文件进入游戏包。

建议目录：

```text
art-source/                    # 提示词、候选图、源文件，不参与 Cocos 构建
├── briefs/
├── concepts/
└── source/
assets/resources/art/          # 游戏运行时最终资源
├── home/
├── ui/
├── tutorial/
└── vfx/
distribution/art/              # 平台图标、分享图、宣传图，不进入游戏包
```

运行时资源统一使用小写 kebab-case，例如 `home-background.jpg`、`mode-progressive.png`。

## 3. 批次 A：视觉定调

本批次只做方向确认，不立即实装。未选定视觉方向前，不开始批量生产后续资源。

- [x] `ART-A01` 三套首页视觉方向稿（`G`）
  - 同一竖屏首页结构，分别探索三种材质和光照表现。
  - 必须使用相同的核心彩沙配色，便于直接比较。
  - 已输出：[A 星砂玻璃](../art-source/concepts/art-a01-direction-a-glass.png)、[B 柔体彩沙](../art-source/concepts/art-a01-direction-b-clay.png)、[C 霓虹像素沙](../art-source/concepts/art-a01-direction-c-pixel.png)。
- [x] `ART-A02` 选定最终视觉方向（人工决策）
  - 确认背景氛围、彩沙材质、辉光强度和 2.5D 程度。
  - 已选择：C「霓虹像素沙」为主方向；允许少量吸收 A 的柔和辉光，不引入 B 的黏土材质。
- [x] `ART-A03` 美术风格参考板（`G+`）
  - 包含颜色、材质、阴影、轮廓、粒子、按钮和禁用示例。
  - 已输出：[视觉参考板](../art-source/concepts/art-a03-style-board.png)与[精确视觉规范](../art-source/briefs/ART-A03-style-guide.md)。
- [x] `ART-A04` 字体与排版规范（`C`）
  - 选择可商用中英文字体。
  - 定义标题、数字、正文、按钮和提示文字的层级。
  - 已输出：[字体与排版参考板](../art-source/concepts/art-a04-typography-board.png)与[精确排版规范](../art-source/briefs/ART-A04-typography.md)。
- [x] `ART-A05` 核心色彩与可读性检查（`C`）
  - 确认 2～5 种沙粒颜色、背景色、危险色和高亮色。
  - 在手机低亮度和常见色觉差异条件下检查区分度。
  - 已输出：[色彩与可读性测试板](../art-source/concepts/art-a05-color-accessibility-board.png)与[精确色彩规范](../art-source/briefs/ART-A05-color-accessibility.md)。

批次退出条件：方向稿已选定，风格板、字体和核心颜色可以指导后续所有资源。

## 4. 批次 B：首页与品牌资源

- [x] `ART-B01` 游戏 Logo 概念稿（`G+`）
  - 中文“落沙”为主，英文 `SANDFALL` 作为可选副标。
  - 生成阶段只探索构图和材质，最终文字必须重新排版。
  - 已输出：[三方向概念板](../art-source/concepts/art-b01-logo-concepts.png)与[方向分析和生成提示词](../art-source/briefs/ART-B01-logo-concepts.md)。
- [x] `ART-B02` Logo 最终矢量稿与横竖版导出（`C`）
  - 输出纯图形、中文横版、中文加英文三个版本。
  - 已输出：[Logo 系统预览板](../art-source/concepts/art-b02-logo-system.png)、[矢量与导出规范](../art-source/briefs/ART-B02-logo-system.md)、横版/竖版/纯图形/单色 SVG 和透明 PNG。
- [x] `ART-B03` 游戏图标母版（`G+`）
  - 正方形构图，无细小文字，缩小后仍能识别彩沙主题。
  - 平台最终尺寸在提交前按微信、抖音控制台要求分别导出。
  - 最终采用 `03-A 四角方块向中央沙化`；已输出 [1024 正式母版](../art-source/exports/icon/luosha-app-icon-1024.png)、`512/256/128/64` 检查稿与[完整方向记录](../art-source/briefs/ART-B03-app-icon-concepts.md)。
- [x] `ART-B04` 首页背景底图（`G`）
  - 竖屏、无文字，中部低干扰，四周允许安全裁切。
  - 建议拆成底色层和可选辉光/沙丘装饰层。
  - 已输出 [1080×1920 正式母版](../art-source/exports/home/luosha-home-bg-composite-1080x1920.png)、`720×1280` 运行时图、低规格 base、`360×800` cover 检查与[生成/接入规范](../art-source/briefs/ART-B04-home-background.md)。
- [x] `ART-B05` 首页彩沙主视觉（`G+`）
  - 替换当前代码绘制的 `HomeHero` 占位方块。
  - 输出透明背景版本，并评估拆成 2～4 层用于漂浮和呼吸动画。
  - 已输出 [透明正式母版](../art-source/exports/home/luosha-home-hero-1024x896.png)、`512×448` 运行时图、`220×190` 合成检查与[去背/动画拆层规范](../art-source/briefs/ART-B05-home-hero.md)；最终实装必须采用主体 Sprite + 常驻悬浮粒子场 + 漂移粒子三层结构，常态可见约 `32～56` 颗彩砂粒。
- [x] `ART-B06` 进阶模式图标（`G+`）
  - 表达升级、颜色解锁和难度递增。
  - 已改为直接采用已确认首页方向稿中的 [2D 青蓝沙丘](../art-source/exports/mode-icons/luosha-mode-progressive-128.png)，并输出 `1024/256/128/64/48` 透明版本和[提取/实装规范](../art-source/briefs/ART-B06-progressive-mode-icon.md)。
- [x] `ART-B07` 经典模式图标（`G+`）
  - 表达自由选择颜色和速度的休闲体验。
  - 已直接采用已确认首页方向稿中的 [2D U 形彩砂槽](../art-source/exports/mode-icons/luosha-mode-classic-128.png)，并输出 `1024/256/128/64/48` 透明版本和[提取/实装规范](../art-source/briefs/ART-B07-classic-mode-icon.md)。
- [x] `ART-B08` 首页资源 Cocos 实装（`C`）
  - 替换背景、Logo、Hero 和模式图标。
  - 保留现有响应式安全区和 Hero 动画逻辑。
  - 已将五张正式运行时图片接入 `assets/resources/art/`，保留安全区缩放、Hero 漂浮/点击反馈，并以单个 `Graphics` 批量实现 `42 + 12` 颗常驻与漂移彩砂；模式卡、难度区、调节按钮与金砂开始按钮统一为双层切角像素组件。Cocos Creator 3.8.8 Web Mobile 构建和 `390×844` 浏览器预览通过，进阶/经典模式切换正常。
- [x] `ART-B09` 首页微信/抖音真机验收
  - 检查刘海、胶囊、裁切、清晰度、启动速度和包体变化。
  - `2026-08-30` 验收通过：微信 AppID `wx80d45d2a90444f56`，构建目录由 `2,595,252` 增至 `3,922,884` 字节（约 `3.74 MiB`）；抖音 AppID `tt59de2f63c7a5fea202`，构建目录由 `2,569,596` 增至 `3,897,228` 字节（约 `3.72 MiB`）。两端均包含 5 张首页正式资源，微信 `2×` 渲染倍率模板仍生效；微信与抖音扫码真机确认刘海/胶囊避让、裁切、清晰度、启动速度和首页交互无阻断问题。

批次退出条件：首页已形成正式品牌观感，两个平台真机显示一致且不影响启动性能。

## 5. 批次 C：游戏内 UI

- [x] `ART-C01` 功能图标统一规范（`C`）
  - 暂停、继续、首页、重开、帮助、音乐、音效、震动、分享。
  - 统一视口、线宽、圆角和高亮状态。
  - 已按首页霓虹像素方向返工并输出 [功能图标规范板](../art-source/concepts/art-c01-function-icon-system.png)、[24 px 小尺寸检查](../art-source/concepts/art-c01-function-icon-24px-check.png)与[矢量/状态/接入规范](../art-source/briefs/ART-C01-function-icon-system.md)；共 `9` 个基础语义图标、`3` 个设置关闭态，统一为 `64×64` 视口、`4 px` 像素模数、直角阶梯轮廓和可由 Cocos 着色的白色透明蒙版。
- [x] `ART-C02` HUD 面板视觉规范（`G+`）
  - SCORE/TIME、NEXT、暂停按钮和危险提示的材质参考。
  - 最终面板优先继续使用 Cocos `Graphics` 或九宫格实现。
  - 已输出 [ImageGen 材质候选](../art-source/concepts/art-c02-hud-material-imagegen-reference.png)、[精确 HUD 规范板](../art-source/concepts/art-c02-hud-panel-system.png)与[尺寸/排版/Cocos 实现规范](../art-source/briefs/ART-C02-hud-panel-system.md)；保持现有 `112×98 / 88×98 / 48×38` 组件尺寸，静态面板使用蓝灰切角边和少量青蓝角标，危险提示收束为棋盘顶边 `280×12` 阶梯导轨，不新增运行时图片。
- [x] `ART-C03` 按钮状态规范（`C`）
  - 默认、按下、选中、禁用四种状态。
  - 已根据视觉复核返工并输出 [四态规范板](../art-source/concepts/art-c03-button-state-system.png)、[1× 运行尺寸检查](../art-source/concepts/art-c03-button-state-1x-check.png)与[几何/像素材质/触摸状态流规范](../art-source/briefs/ART-C03-button-state-system.md)；按钮统一两级阶梯切角、分段边框、边缘方粒与固定颗粒坐标，按下态只移动视觉子节点 `2` 设计点且保持命中区域固定，选中态增加延长导线与 `4×4` 方标，禁用态取消交互反馈。
- [x] `ART-C04` 暂停弹窗装饰（`G+`）
  - 不包含最终文字和按钮，保证信息区干净。
  - 已输出 [ImageGen 材质候选](../art-source/concepts/art-c04-pause-modal-imagegen-reference.png)、[共同弹窗规范板](../art-source/concepts/art-c04-c05-modal-decoration-system.png)、[透明运行候选](../art-source/exports/modal/luosha-modal-decoration-pause-286x300.png)与[安全区/接入规范](../art-source/briefs/ART-C04-pause-modal-decoration.md)；装饰限制在 `286×300` 外沿约 `18 px`，中央标题、数据、按钮与提示区完全透明。
- [x] `ART-C05` Game Over 弹窗装饰（`G+`）
  - 与暂停弹窗共用结构，增加失败氛围但不遮挡数据。
  - 已输出 [同结构 ImageGen 候选](../art-source/concepts/art-c05-game-over-modal-imagegen-reference.png)、[透明运行候选](../art-source/exports/modal/luosha-modal-decoration-game-over-286x300.png)与[共同结构/失败态规范](../art-source/briefs/ART-C05-game-over-modal-decoration.md)；与 C04 共用视口、安全区、断点和基础颗粒坐标，只增加受控危险红与少量外沿坠落方粒。
- [x] `ART-C06` 等级提升徽记/光环（`G+`）
  - 文字仍由 Cocos 动态渲染。
  - 已输出 [ImageGen 能量方向候选](../art-source/concepts/art-c06-level-up-halo-imagegen-reference.png)、[C06/C07 共同规范板](../art-source/concepts/art-c06-c07-feedback-halo-system.png)、[等级提升透明运行候选](../art-source/exports/feedback/luosha-feedback-level-up-280x96.png)与[安全区/接入规范](../art-source/briefs/ART-C06-level-up-feedback-halo.md)；使用 `280×96` 开放式金色冠光和上升方粒，中央动态文字区完全透明。
- [x] `ART-C07` 连锁反馈徽记/光环（`G+`）
  - 支持不同连锁层数复用，不制作固定数字图片。
  - 已输出 [横向能量候选](../art-source/concepts/art-c07-chain-halo-imagegen-reference.png)、[可着色白色 alpha 蒙版](../art-source/exports/feedback/luosha-feedback-chain-mask-280x96.png)与[层级复用规范](../art-source/briefs/ART-C07-chain-feedback-halo.md)；与 C06 共用 `280×96` 视口和文字安全区，建议由 Cocos 按 `×2 / ×3 / ×4+` 分别着色为金、珊瑚红和紫红。
- [x] `ART-C08` UI 资源 Cocos 实装（`C`）
  - 接入图标、弹窗装饰和反馈资源。
  - 所有点击区域仍由现有 UI 节点控制，不以图片透明区决定触控范围。
  - 已完成 [Cocos 实装与资源同步规范](../art-source/briefs/ART-C08-ui-cocos-integration.md)：运行资源统一进入 `assets/resources/art/ui/`，HUD 改为阶梯切角 `Graphics`，按钮使用固定命中区与下移 `2` 点的视觉子节点，暂停/Game Over 共用弹窗装饰 Sprite，等级/连锁光环复用现有 `1.05 s` 动态反馈时间轴；构建与 `117` 个自动测试通过。
- [x] `ART-C09` 游戏内 UI 微信/抖音真机验收
  - 检查小尺寸识别、文字对比度、安全区和低亮度表现。
  - 2026-08-30 已完成 [C09 三端构建与真机验收](../art-source/briefs/ART-C09-device-build-validation.md)：Cocos Creator 3.8.8 的 Web Mobile、微信与抖音构建均成功；两个小游戏产物的入口、AppID、`2×` 微信模板和 16 张新 UI 运行资源已核对。用户确认微信/抖音扫码真机视觉验证完成，批次 C 关闭。

批次退出条件：HUD、按钮和弹窗风格统一，游戏信息可读性不低于当前代码绘制版本。

## 6. 批次 D：新手教学资源

- [ ] `ART-D01` 左右拖动教学图（`M`）
- [ ] `ART-D02` 点击旋转教学图（`M`）
- [ ] `ART-D03` 长按软降教学图（`M`）
- [ ] `ART-D04` 快速下滑硬降教学图（`M`）
- [ ] `ART-D05` 同色横跨消除教学图（`M`）
  - 连通路径必须来自真实棋盘或代码生成示例，不使用模型虚构沙粒规则。
- [ ] `ART-D06` 坍塌与连锁教学图（`M`）
- [ ] `ART-D07` 危险高度/Game Over 教学图（`M`）
- [ ] `ART-D08` 教学页面背景与装饰（`G`）
- [ ] `ART-D09` 首局教学 Cocos 实装（`C`）
  - 支持跳过、仅首次自动出现，并可从首页帮助入口重新查看。
- [ ] `ART-D10` 无口头说明试玩验收
  - 玩家能理解移动、旋转、沙化和横跨消除目标。

批次退出条件：新玩家无需外部解释即可完成第一次有效消除。

## 7. 批次 E：游戏特效素材

- [ ] `ART-E01` 细沙尘粒子贴图组（`G+`）
  - 2～4 枚透明单色粒子，运行时着色复用。
- [ ] `ART-E02` 柔光光斑与光环贴图（`G+`）
  - 用于消除、连锁和等级提升，避免预烘焙具体颜色。
- [ ] `ART-E03` 横向流光/拖尾贴图（`G+`）
- [ ] `ART-E04` 沙化细碎纹理或噪声图（`G+`）
- [ ] `ART-E05` 顶部危险区域动态效果（`C`）
  - 优先代码或 Shader，不制作固定屏幕尺寸遮罩。
- [ ] `ART-E06` 特效图集与 Cocos 实装（`C`）
  - 合并小图、减少 Draw Call，限制同屏粒子数量。
- [ ] `ART-E07` 低端机性能与光敏感性验收
  - 微信、抖音真机检查帧率、闪光强度和长时间游玩舒适度。

批次退出条件：特效明显增强正向反馈，同时不遮挡棋盘、不降低操作帧率。

## 8. 批次 F：分享与平台宣传资源

这些资源放在 `distribution/art/`，默认不进入小游戏运行包。

- [ ] `ART-F01` 通用分享卡背景（`G`）
  - 不包含固定分数，预留运行时数据区域。
- [ ] `ART-F02` 高连锁分享卡变体（`G`）
- [ ] `ART-F03` 微信分享卡适配与数据叠加（`M`）
- [ ] `ART-F04` 抖音分享卡适配与数据叠加（`M`）
- [ ] `ART-F05` 平台加载/启动图（`G+`）
- [ ] `ART-F06` 微信小游戏封面与宣传图（`G+`）
- [ ] `ART-F07` 抖音小游戏封面与宣传图（`G+`）
- [ ] `ART-F08` 商店/平台截图模板（`G+`）
  - 实际游戏画面必须使用真机截图，生成模型只负责边框和氛围装饰。
- [ ] `ART-F09` 平台素材尺寸、文字与审核规范复核

批次退出条件：微信与抖音后台要求的图片齐全，宣传画面与真实游戏一致。

## 9. 暂缓资源

以下内容不进入当前美术生产排期：

- [ ] `ART-P01` 多套沙粒皮肤
- [ ] `ART-P02` 节日主题首页
- [ ] `ART-P03` 特殊方块和技能图标
- [ ] `ART-P04` 排行榜头像框与段位徽章
- [ ] `ART-P05` 激励广告奖励弹窗
- [ ] `ART-P06` 原生 App Store / Google Play 完整商店套图

只有在基础版本完成试玩验证后，才决定是否启用这些项目。

## 10. 单项完成标准

每个运行时或平台资源只有同时满足以下条件，才能从 `[ ]` 更新为 `[x]`；概念稿和规范类项目只执行其中适用的条目：

1. 视觉方向已经确认，不再使用未授权字体、商标或参考作品元素。
2. 源文件与提示词已保存到 `art-source/`。
3. 最终导出尺寸、透明通道和颜色空间正确。
4. 只有最终使用版本进入 `assets/resources/art/`。
5. Cocos 中完成锚点、缩放、九宫格或图集配置。
6. Web 预览无布局和清晰度问题。
7. 微信与抖音至少各完成一次扫码真机测试。
8. 包体、启动速度、内存和帧率没有不可接受的回退。

## 11. 下一步

批次 C 已完成：C01～C08 的霓虹像素游戏内 UI 规范、运行资源与 Cocos 实装均已落地，C09 的 Web Mobile、微信与抖音构建及真机验收通过。下一项为批次 D 的 `ART-D01` 左右拖动教学图。
