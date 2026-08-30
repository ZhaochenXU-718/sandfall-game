# ART-C05：Game Over 弹窗装饰

状态：已完成同结构变体、矢量清理、透明导出与安全区检查，并已在 `ART-C08` 接入共同弹窗节点。

视觉方向：C「霓虹像素沙」。

共同规范板：[ART-C04/C05 弹窗装饰系统](../concepts/art-c04-c05-modal-decoration-system.png)

生成式材质参考：[Game Over ImageGen 候选](../concepts/art-c05-game-over-modal-imagegen-reference.png)

透明运行候选：[Game Over 装饰 286×300](../exports/modal/luosha-modal-decoration-game-over-286x300.png)

## 1. 结论

Game Over 装饰与暂停弹窗严格共用 `286×300` 视口、阶梯轮廓、边框断点、信息安全区和基础颗粒坐标。失败氛围只通过顶部/四角危险红导线、少量红色坠落方粒和较暗的珊瑚红碎边表达，不更换弹窗结构，不扩大装饰密度，不遮挡结算数据。

红色不是整框覆盖：蓝灰仍承担结构，蓝色和极少量青色维持与游戏其余 UI 的连续性。禁止血液、火焰、爆炸、骷髅或恐怖图形。

## 2. 输出文件

| 文件 | 尺寸 | 用途 |
|---|---:|---|
| `luosha-modal-decoration-game-over.svg` | `286×300` viewBox | 可编辑矢量母版 |
| `luosha-modal-decoration-game-over-572x600.png` | `572×600` | `2×` 归档母版和高清检查 |
| `luosha-modal-decoration-game-over-286x300.png` | `286×300` | ART-C08 运行时接入候选 |

文件位置与 C04 相同：`art-source/source/modal/` 和 `art-source/exports/modal/`。只有 `286×300` 运行候选可在 ART-C08 进入 `assets/`。

## 3. 与 C04 的不变量

- 完全相同的视口、锚点、`12 px` 两级阶梯切角和安全区。
- 完全相同的蓝灰结构边、边框断点和基础角粒坐标。
- 标题、数据、按钮和提示安全区保持完全透明。
- 同一个 `ModalDecorationSprite` 节点切换资源，不创建第二套弹窗节点。
- 不改变暂停/Game Over 的触摸区域、按钮布局、数据行数或字体。

## 4. 失败态差异

- 危险红：`#FF636B`；暗珊瑚红：`#A83F4D`。
- 红色主要集中于顶部导线、上角和少量底角，结构面积占比控制在约三分之一以内。
- 在 `x≈34～40` 与 `x≈244～250` 的外沿安全带增加少量向下坠落方粒，大小 `2～3 px`。
- 顶部中央使用短红线和三枚向下递进方块，不使用固定感叹号或失败文字。
- 不使用持续强红 Bloom；出现时允许一次 `160～220 ms` 的红色边缘增强，随后回落到静态亮度。

动态坠落粒子若在 ART-C08/E05 中实现，应复用固定少量节点或单个 `Graphics` 批量绘制，不为每个像素创建永久节点。

## 5. 数据可读性

Game Over 的数据密度高于暂停弹窗，因此本资源必须遵守 C04 的全部安全区：

- `GAME OVER` 标题区无颗粒。
- SCORE/BEST、TIME/LEVEL、CLEARS/MAX CHAIN 三行摘要区无颗粒和发光。
- `PLAY AGAIN` 与 `HOME` 两个按钮区无装饰。
- 底部 `R 重新开始` 或移动端提示区无底边亮粒穿过文字。

## 6. 验收标准

- C04/C05 叠加比较时框体和基础粒子位置一致，只看到情绪色与额外坠落粒子的差异。
- 红色占比克制，静态失败弹窗不会成为全屏最高亮度区域。
- 三行结算数据、两个按钮和提示在 25% 系统亮度下仍清晰。
- PNG 中央保持透明，红色方粒不进入四个信息安全区。
- 微信与抖音真机上红色没有过饱和溢出或大范围 Bloom。

## 7. ImageGen 记录

使用模式：Codex 内置 ImageGen；`ui-mockup`。输入图 1 为 C04 暂停候选，负责严格保持结构；输入图 2 为 ART-C03 状态板，负责阶梯与像素构造。

最终提示词：

```text
Use case: ui-mockup
Asset type: visual concept reference for a Game Over modal decoration layer in the original portrait mobile puzzle game SANDFALL / 落沙
Primary request: Create one isolated Game Over popup decoration concept by preserving the exact structure and proportions of Image 1, the approved pause-decoration candidate. Keep the same 286:300 aspect, same stepped frame fragments, same large clean information-safe region, and same clean lower button-safe region. Change only the emotional accent: introduce restrained danger red edge segments and a few downward-falling square grains to suggest failure, while retaining blue-gray structural rails and a small amount of cyan/blue continuity.
Input images: Image 1 is the structural reference and must be preserved: same perimeter-only decoration density, same open center, same corner cluster positions, same frame thickness and stepped silhouette. Image 2 is the approved ART-C03 state board and controls two-step pixel corners, segmented borders, square grains, and no-scale crispness.
Scene/backdrop: plain #050D19 preview background with a single centered popup decoration, no phone frame and no gameplay screen.
Style/medium: modern high-resolution neon pixel-sand UI, crisp 2D stepped geometry, sparse granular edge debris, controlled failed-state mood; not retro low-resolution pixel art.
Composition/framing: decoration stays within the outermost 18 px equivalent around the perimeter. Keep the central title/data area and lower button area completely clean. Add red emphasis mainly to the top edge, upper corners, and a few bottom-falling particles; do not fill the entire frame red.
Color palette: #050D19 background, graphite #0C121F, structural blue-gray #4E7398, danger red #FF636B, dim coral #A83F4D, small residual blue #5B8DEF and cyan #41CDC3. No gold.
Materials/textures: opaque dark graphite frame references, square pixel grains 1–3 px, a few broken red rail segments, no glass, no metal, no smoke.
Text: no text, letters, numbers, labels, icons, skulls, or watermark.
Constraints: preserve Image 1 structure and empty center; change only accent color balance and sparse falling debris; no decoration behind title/data/buttons; no complete filled popup card; no button shapes; no scores; no gameplay pieces; no characters; no logo; no circular ornament; no rounded corners; no continuous diagonal bevel; no broad red glow; no dense particles; no random glyphs.
Avoid: horror imagery, blood, fire, explosion, skull, warning tape, generic sci-fi HUD, glassmorphism, ornate fantasy frame, bright bloom, smoke, dense circuitry.
```

生成候选只用于材质和情绪参考，不直接进入运行包。
