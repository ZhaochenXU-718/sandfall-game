# ART-C02：HUD 面板视觉规范

状态：已完成材质候选与精确规范，并已在 `ART-C08` 以 Cocos `Graphics` 实装。

视觉方向：C「霓虹像素沙」。

精确规范板：[ART-C02 HUD 面板系统](../concepts/art-c02-hud-panel-system.png)

生成式材质参考：[ImageGen HUD 候选](../concepts/art-c02-hud-material-imagegen-reference.png)

## 1. 结论

HUD 延续首页的深海夜色、切角框、方形角标和青蓝霓虹，但亮度必须低于棋盘中的沙粒与消除反馈。静态信息面板使用蓝灰边界和极少量彩色像素；可点击的暂停按钮才使用完整青色交互边；危险状态只占据棋盘顶边，不增加横跨屏幕的大警告面板。

ImageGen 候选用于确认切角层级、像素角标和危险红材质。它将 SCORE/TIME/CHAIN 拆成了过大的纵向模块，并让危险条占据过多空间，因此不能直接作为布局或运行时图片使用。所有正式尺寸、文字和棋盘关系以精确规范板为准。

## 2. 组件尺寸

| 组件 | 设计尺寸 | 切角 | 外/内线宽 | 说明 |
|---|---:|---:|---:|---|
| SCORE/TIME 状态面板 | `112×98` | `8` | `2 / 1 px` | 保持现有布局，不增加 HUD 高度 |
| NEXT 面板 | `88×98` | `8` | `2 / 1 px` | 预览区保持 `68×58`，显示真实 PieceDefinition |
| 暂停按钮 | `48×38` | `6` | `2 / 1 px` | 视觉图标 `24×24`，点击区域仍由现有节点控制 |
| 棋盘危险导轨 | `280×12` | 不适用 | `2 px` 主线 | 贴合棋盘顶边，不改变棋盘尺寸或触控区域 |

360 设计宽度下继续使用现有位置关系：状态面板中心 `x=-84`、NEXT 中心 `x=96`、暂停按钮中心 `x=0`；三者顶部对齐安全区下缘。棋盘顶边和 HUD 面板底部保留约 `10～12` 设计点间隔。

## 3. 面板材质

- 面板填充：`#0C121F`，目标不透明度 `96%`；文字区不显示背景装饰。
- 外边界：`#4E7398`，`2 px`；保证低亮度下的非文字边界对比度。
- 内装饰线：`#375373`，`1 px`，向内缩进 `2 px`；不承担交互语义。
- 状态面板使用短青色顶部导线和 `2×2` 角标；NEXT 使用蓝色导线和角标。
- 每个面板最多 `3～4` 个彩色装饰像素，禁止铺满随机粒子。
- 静态面板不使用 Bloom、渐变、玻璃高光、投影或预烘焙沙粒纹理。
- 所有框体优先由 Cocos `Graphics` 的切角路径绘制；若后续改九宫格，也必须保持整数像素边界和相同切角。

## 4. 信息排版

字体与字号继承 [ART-A04](ART-A04-typography.md)：

- `SCORE` 与 6 位分数：Oxanium SemiBold，`14 / 18`，主文字 `#EEF3FF`；标签可使用青色强调。
- `TIME` 与 `MM:SS`：Oxanium SemiBold，`13 / 18`，次文字 `#B4C2DB`；标签可使用蓝色强调。
- `LEVEL` / `CLASSIC`：Oxanium SemiBold，`12 / 16`，弱提示 `#6F8EB1`。
- `CHAIN ×N`：无连锁时留空；出现时使用 `#FFD66B`，不在静态面板预留持续金色光晕。
- `NEXT`：Oxanium SemiBold，`13 / 18`，居中。
- 分数固定 6 位、计时固定 `MM:SS`，使用等宽数字，刷新时不改变左右对齐。

NEXT 预览必须继续由真实 `PieceDefinition` 和现有 `PiecePreviewLayout` 绘制；生成候选中的沙丘只是材质提示，不得作为下一块规则图形。

## 5. 暂停按钮

- 容器使用 `#091728` 填充、`#41CDC3` 交互边界和 `6` 点切角。
- 图标直接复用 `ART-C01` 的 `pause` 白色蒙版，显示尺寸 `24×24`，默认着色 `#41CDC3`。
- 暂停状态切换为 `resume`，容器位置和点击区域不变。
- 默认态不加外辉光；按下、选中与禁用的容器变化由 `ART-C03` 统一定义。
- 顶部平台胶囊或安全区变化时继续由 `ResponsiveGameLayout` 下移整个 HUD，不单独偏移图标。

## 6. 危险提示

危险信息同时使用位置、符号和颜色，不能只依赖红色：

1. 正常状态不显示红色导轨，只保留棋盘自身暗色顶边。
2. 进入危险高度后，在棋盘顶边绘制 `2 px` 红色主线、少量阶梯短块和居中的 `!` 方形标记。
3. 危险导轨总高度不超过 `12` 设计点，不覆盖活动方块、下一块或 SCORE/TIME。
4. 允许 `0.8～1.2 Hz` 的低频透明度呼吸，峰值不得整屏泛白；不使用快速闪烁。
5. 顶边危险动态、事件阈值和性能实现归 `ART-E05`；本项只确定静态材质与空间边界。

## 7. Cocos 实现建议

在 `ART-C08` 中将首页已经使用的切角路径方法推广为 HUD 公共绘制函数：

```text
drawHudPanel(graphics, width, height, cut, accent)
drawDangerRail(graphics, boardWidth, active, phase)
```

- `drawHudPanel` 负责深色填充、蓝灰外边、暗色内边、顶部短导线和角标。
- 状态面板与 NEXT 共享材质参数，只切换宽度和强调色。
- 动态文字仍由 `Label` 绘制，不烘焙到图片。
- 暂停图标作为唯一 Sprite；面板、角标、分隔线和危险导轨继续使用 `Graphics`。
- 触摸区域沿用现有 `UITransform`，不根据切角后的透明区域缩小。

ART-C02 不新增 `assets/resources/art/` 运行时图片，因此不会增加小游戏纹理包体。

## 8. 验收标准

- 360 设计宽度下 HUD 不侵入棋盘，三块组件保持现有响应式位置。
- SCORE、TIME、NEXT 在 25% 系统亮度下仍可读，静态边框不与彩沙争夺焦点。
- NEXT 使用真实方块定义，旋转与颜色不由生成图决定。
- 危险态在不看颜色时仍能通过棋盘顶边位置和 `!` 方块识别。
- 静态 HUD 没有持续 Bloom；危险呼吸不超过约 `1.2 Hz`。
- 微信与抖音胶囊安全区变化时，HUD 整体下移且不裁切。

## 9. ImageGen 记录

使用模式：Codex 内置 ImageGen；`ui-mockup`。输入图 1 为用户提供的批准首页截图，用作唯一界面风格锚点；输入图 2 为 ART-A03 风格板，只补充颜色和材质约束。

最终提示词：

```text
Use case: ui-mockup
Asset type: production concept reference board for the in-game HUD of the original portrait mobile puzzle game SANDFALL / 落沙
Primary request: Design a polished landscape HUD material reference board that translates the supplied neon pixel-sand home-screen style into compact gameplay panels. Show four isolated component studies plus one compact 360-design-width top-HUD composition: (1) a status panel for SCORE, TIME, and CHAIN; (2) a NEXT preview panel; (3) a compact pause button using a square pixel pause symbol; (4) a horizontal danger-height warning strip at the top edge. The result is visual-direction reference only, not a final screenshot.
Input images: Image 1 is the approved home-screen style anchor and must control the chamfered geometry, pixel corners, cyan/blue neon edges, sparse colored square grains, and dark ocean background. Image 2 is the approved production style board and supplies palette/material constraints only.
Scene/backdrop: clean dark navy landscape presentation board, straight-on orthographic UI samples, generous spacing.
Style/medium: modern high-resolution neon pixel UI, deterministic-looking hard chamfers and stepped corners, crisp 2D/very light 2.5D layering, graphite-dark opaque panels, restrained inner edge glow, sparse 2-4 px square particles. Not retro low-resolution pixel art and not generic rounded line UI.
Composition/framing: organized component sheet; component proportions should echo the current implementation: status about 112×98, next about 88×98, pause about 48×38, danger strip thin and horizontal. Keep the central gameplay area unobstructed.
Color palette: #050D19 canvas, #0C121F panels, #4E7398 idle border, cyan #41CDC3, blue #5B8DEF, danger red #FF636B, gold #FFC44B only for chain/reward accents, primary text #EEF3FF, secondary #B4C2DB.
Text (verbatim): "SCORE", "TIME", "CHAIN", "NEXT", "DANGER", "HUD MATERIAL STUDY". Render only these labels, each at most once; no numbers or Chinese text.
Materials/textures: mostly flat opaque dark panels; subtle pixel-grid inset and a few colored square corner grains; danger state uses red stepped top edge and restrained pulse impression, not a broad translucent red overlay.
Constraints: match the supplied home screen's visual language; all corners hard-chamfered or stepped; exact game-rule information stays clean and readable; no fixed score, time, level, chain number, or board state; no phone frame; no full game screen; no logo; no glassmorphism; no rounded cards; no glossy plastic; no wide bloom; no gradients behind text; no third-party logos; no trademarked falling-block silhouettes; no watermark; no extra text or random letters.
Avoid: generic sci-fi HUD clutter, circular gauges, hexagon overload, thin rounded outline icons, metallic bevels, dense decoration, noisy backgrounds, illegible typography.
```

生成候选和源提示词保存在 `art-source/`，不进入 Cocos 构建。
