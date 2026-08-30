# ART-E06：特效图集与 Cocos 实装

状态：已完成 E01～E04 白色 Alpha 素材合图、Cocos 资源导入、固定节点池、玩法事件接线、自动测试、Web Mobile 构建与浏览器视觉复验；低端真机性能和光敏感性验收归 `ART-E07`。

> `2026-08-30` 变更：[`ART-E03`](ART-E03-horizontal-trail-system.md) 三张拖尾贴图因真机观感不佳废弃。布局由 `12` 枚精灵减至 `9` 枚，节点池由 `31` 降至 `28`，预算改为粒子 `24` + 光环 `4`，`trail` 分类删除。下方带删除线的条目为已下线内容。

图集评审板：[art-e06-vfx-atlas-system.png](../concepts/art-e06-vfx-atlas-system.png)

运行图集：[luosha-vfx-atlas.png](../../assets/resources/art/vfx/luosha-vfx-atlas.png)

布局清单：[luosha-vfx-atlas-layout.json](../../assets/resources/art/vfx/luosha-vfx-atlas-layout.json)

运行控制器：[CocosVfxController.ts](../../assets/scripts/cocos/CocosVfxController.ts)

预算与布局校验：[VfxRuntime.ts](../../assets/scripts/rendering/VfxRuntime.ts)

## 1. 图集合同

- 运行时只加载一张 `512×256` RGBA 图集，布局登记 `9` 枚正式尺寸白色 Alpha 子图（原为 `12` 枚；E03 的三张拖尾已下线，纹理里的对应像素待下次重新合图时清除）。
- 子图之间保留至少 `4 px` 透明间距；生成脚本检查源图尺寸、越界、重叠和透明 padding。
- 纹理固定使用 `nearest`、`clamp-to-edge`、无 mipmap，禁止缩放模糊和边缘串色。
- 颜色不预烘焙。每次发射使用当前沙粒色、连锁强调色或等级金色通过 `Sprite.color` 着色。
- `art-source/exports/vfx/` 保存可审查图集与 JSON；只有正式运行图集和布局进入 `assets/resources/art/vfx/`。

图集可由 [build-art-e06-vfx-atlas.cjs](../source/build-art-e06-vfx-atlas.cjs) 配合 [art-e06-atlas-layout.json](../source/vfx/art-e06-atlas-layout.json) 确定性重建。

## 2. 固定池与性能边界

- `CocosVfxController` 初始化时一次性创建 `28` 个 Sprite 节点，游戏过程中不创建或销毁粒子节点。
- 默认上限为粒子 `24`、光环 `4`，总活跃数不超过 `28`。
- 超过类别或总预算时直接忽略新的次要效果，不抢占已经显示的反馈，也不影响玩法状态。
- 所有子帧共享同一张纹理，连续 VFX 节点可由 Cocos 合批；颜色和透明度只修改顶点色。
- 每个效果使用确定性伪随机序列，便于截图复验和性能回归。
- 暂停时动画冻结；重开、回首页和销毁组件时统一回收池状态。

## 3. 玩法事件映射

| 游戏事件 | 图集元素 | 反馈规则 |
| --- | --- | --- |
| ~~左右移动成功~~ | ~~`comet-trail`~~ | `2026-08-30` 下线，移动只保留触感与音效反馈 |
| 自然落地 / 硬降 | `glow-core` + `dust-impact` | 硬降提高尺寸和粒子数量，但不遮挡新活动块 |
| 方块沙化 | `noise-threshold` / `noise-cluster` + `sand-fall` / `dust-rise` | 每个宏格叠一层低透明像素阈值纹理，并用少量砂粒衔接现有固体淡出（`grain-flow` 叠层 `2026-08-30` 下线） |
| 横跨消除 | `pulse-ring` + `dust-burst` | 按清除包围盒定位；连锁提高强调色和少量粒子数量（`clear-sweep` 扫光 `2026-08-30` 下线） |
| 等级提升 | `diamond-halo` + `dust-rise` | 棋盘中心显示金色阶梯菱形环，与 C06/C07 文本反馈同步 |

E04 没有额外引入独立 Shader 和材质切换；当前采用同图集 Sprite Alpha 蒙版叠加现有固体淡出的低成本路径。这样仍保留两套阈值图的像素破碎语言，并把材质数量、兼容性和低端机风险留在可控范围内。

## 4. 响应式与层级

- `VfxPool` 是 `SandBoard` 的子节点，尺寸始终跟随棋盘 `UITransform`。
- 活动块、落点、清除掩码都换算到棋盘局部坐标，不依赖固定屏幕分辨率。
- VFX 位于动态沙盘、活动块和危险区域之后，游戏弹窗与首页仍由更高层 UI 管理。
- 粒子不接收输入，不参与碰撞、计分、消除或状态机，可按平台安全关闭。

## 5. 验证

- 图集生成后逐子图比较 Alpha 与可见 RGB，`12/12` 与正式源图一致；透明 padding 的 Alpha 为零。
- `VfxRuntime.test.ts` 新增 `5` 项测试，覆盖完整布局、缺图、越界、重叠、类别预算、总预算、释放与重置。
- `npm run typecheck`、`npm run build` 和完整 `26` 个测试文件、`128` 项测试通过。
- Cocos Creator `3.8.8` Web Mobile 构建成功，输出位于 `build/web-mobile-e06/`。
- `390×844` 浏览器复验通过：首页与棋盘布局不回退；移动拖尾、硬降落地和沙化反馈正确显示；干净会话无 error/warn。（移动拖尾一项已随 E03 下线，见文首变更说明。）
- E07 继续检查微信/抖音低端真机帧率、连续消除峰值、危险区叠加、降低屏幕亮度和长时间游玩舒适度。
