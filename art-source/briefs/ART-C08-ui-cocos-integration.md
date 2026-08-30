# ART-C08：游戏内 UI 资源 Cocos 实装

状态：已完成代码接入、运行资源同步、稳定 SpriteFrame 元数据、构建和自动测试；真机视觉验收归 `ART-C09`。

实现文件：[SandfallGameComponent.ts](../../assets/scripts/cocos/SandfallGameComponent.ts)

资源同步脚本：[sync-art-c08-ui-resources.cjs](../source/sync-art-c08-ui-resources.cjs)

## 1. 接入范围

本项将批次 C 已确认的 UI 规范与运行资源接入现有 Cocos 节点，不新增规则信息、不改变棋盘尺寸，也不改变任何按钮命中区域。

- ART-C01：12 个 `64×64` 白色图标蒙版进入 `assets/resources/art/ui/icons/`；当前已有控件实际加载暂停、继续、重开和首页四种语义。
- ART-C02：SCORE/TIME 与 NEXT 面板继续由 `Graphics` 绘制，但统一改为阶梯切角、双层边、顶部短导线和少量方标。
- ART-C03：通用按钮改为 `ButtonHitArea -> ButtonVisual` 层级；按下只把视觉子节点下移 `2` 设计点，命中 `UITransform` 固定。
- ART-C04/C05：同一个 `ModalDecorationSprite` 根据 `Paused / GameOver` 切换 `286×300` 装饰。
- ART-C06/C07：`ScoreFeedbackDecoration` 位于动态 Label 下方，共用现有位置、缩放、上移和淡出时间轴。

## 2. 运行资源

```text
assets/resources/art/ui/
├── icons/
│   ├── pause.png / resume.png / home.png / restart.png
│   ├── help.png / share.png
│   └── music*.png / sound*.png / haptics*.png
├── modal/
│   ├── pause.png
│   └── game-over.png
└── feedback/
    ├── level-up.png
    └── chain-mask.png
```

- 只复制运行尺寸：图标 `64×64`、弹窗 `286×300`、反馈 `280×96`。
- `2×` 母版、ImageGen 候选和评审板不进入 `assets/resources`。
- 所有 SpriteFrame 使用完整画布、中心锚点、`trimType: none` 和 nearest 采样；透明外带不会被自动裁掉。
- `.meta` UUID 由资源相对路径确定性生成，重复同步不会改变引用。

## 3. HUD 与按钮

`drawHudPanel` 负责深色填充、蓝灰外边、暗色内边、强调色顶线和方标。状态面板使用青色强调，NEXT 使用蓝色强调；动态 Label 与真实下一块绘制逻辑保持不变。

`UiButtonVisual` 支持 `default / pressed / selected / disabled` 四态：

- 默认：深色填充、蓝灰边与次文字色。
- 按下：青色边、主文字色，`ButtonVisual.y=-2`。
- 选中：青色边、延长顶线与右上 `4×4` 方标。
- 禁用：42% 左右透明度，不进入按下状态。

顶部暂停按钮使用青色交互边和 `24×24` 图标；暂停后在同一 Sprite 节点切换为继续图标。弹窗主操作根据阶段切换继续/重开图标，HOME 使用首页图标。图标加载失败时保留原文字/符号作为回退。

## 4. 弹窗

`ModalCard` 底形由圆角矩形改为 `12` 点两级阶梯切角；图片装饰位于底形之上、标题与按钮之下。

- `Paused`：加载 `art/ui/modal/pause`。
- `GameOver`：加载 `art/ui/modal/game-over`。
- 两态共用 `ModalDecorationSprite`、尺寸、锚点和按钮命中节点。
- 动态标题、三行摘要、按钮文本和底部提示继续由 Label 绘制。

## 5. 等级与连锁反馈

`ScoreFeedbackDecoration` 尺寸固定 `280×96`，与现有 `260×40` Label 中心对齐。

- 等级提升：使用彩色 `level-up` Sprite，Label 保持动态 `LEVEL N · NEW COLOR / SPEED UP`。
- 连锁：使用白色 `chain-mask`，`×2 / ×3 / ×4+` 分别着色为 `#FFC857 / #FF636B / #C257B7`，不透明度为 `82% / 92% / 100%`。
- 普通 `+分数` 不启用光环。
- 装饰与文字共用现有 `1.05 s` 强反馈动画、`34` 设计点上移、缩放与淡出。
- 重置、回首页或隐藏 Gameplay Chrome 时同时关闭装饰 Sprite，避免残留。

## 6. 验证

- `npm run build`：通过。
- `npm test`：24 个测试文件、117 个测试通过。
- Cocos 主组件 TypeScript 转译语法检查：通过。
- 16 张运行 PNG：尺寸、alpha、完整画布 SpriteFrame 和 nearest 采样元数据检查通过。
- C01/C04/C05/C06/C07 源文件与运行资源 SHA 同步由脚本保证。

ART-C09 继续检查微信/抖音真机的小尺寸识别、低亮度、平台胶囊安全区、快速连续点击状态恢复和弹窗数据可读性。
