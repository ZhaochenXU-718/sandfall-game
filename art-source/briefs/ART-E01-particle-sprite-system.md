# ART-E01：细沙尘粒子贴图组

状态：已完成 ImageGen 轮廓候选、确定性像素重建、透明导出和 `1×` 尺寸检查；正式 `32×32` 版本已在 `ART-E06` 合图并接入固定运行池。

规范板：[E01 粒子贴图系统](../concepts/art-e01-particle-sprite-system.png)

小尺寸检查：[32 px 运行尺寸检查](../concepts/art-e01-particle-sprite-1x-check.png)

生成式参考：[ImageGen 去背候选](../concepts/art-e01-particle-sprite-alpha-raw.png)

## 1. 目标

为落地、沙化、消除、连锁和坍塌提供一组轻量、可复用的细沙尘粒子。资源不预烘焙青、蓝、红、金等具体颜色，只保存白色 alpha 形状，最终颜色、透明度、缩放、旋转和速度由 Cocos 控制。

正式贴图不直接使用生成稿。ImageGen 只确定四种运动轮廓，最终资源由整数坐标 SVG 重建，保证方粒尺度、透明度层级、透明边界和 nearest 采样稳定。

## 2. 四种粒子

| 资源 | 主要用途 | 轮廓特征 |
| --- | --- | --- |
| `dust-impact` | 落地、硬降接触 | 扁平紧凑核心，少量向外颗粒 |
| `dust-rise` | 沙化、等级提升 | 由下至上收窄的阶梯尘缕 |
| `dust-burst` | 消除、连锁强调 | 中心小核心与稀疏放射方粒 |
| `sand-fall` | 坍塌、下落拖砂 | 顶部稍宽、向下断续收窄 |

每枚贴图均使用 `32×32` 完整画布和中心锚点。外沿保留透明像素，运行时不依赖自动裁切改变粒子中心。

## 3. 输出文件

- SVG 母版：`art-source/source/vfx/luosha-particle-*.svg`。
- `32×32` 正式候选：`art-source/exports/vfx/luosha-particle-*-32.png`。
- `64×64` 二倍归档：`art-source/exports/vfx/luosha-particle-*-64.png`。
- ImageGen 色键源与去背稿保存在 `art-source/concepts/`，只作轮廓追溯，不进入运行包。

当前不复制到 `assets/resources/art/`。`ART-E06` 将只选择 `32×32` 版本进入特效图集，并统一写入 Cocos SpriteFrame 元数据。

## 4. 像素与透明度规范

- 几何只使用整数像素矩形；基础颗粒为 `1×1 / 2×2 / 3×3`，紧凑核心允许组合为更宽的阶梯块。
- 白色 RGB 固定为 `255,255,255`，通过约 `24%～100%` alpha 建立核心、次颗粒和远端颗粒层级。
- 无模糊滤镜、圆形 bokeh、云雾笔刷、预烘焙辉光、阴影或彩边。
- 采样使用 nearest；默认普通 alpha 混合。Additive 只允许在 E06 对短时奖励反馈受控开启。
- 单枚贴图不得填满画布，避免放大后形成遮挡棋盘的白团。

## 5. E06 接入预算

- 同屏活跃粒子建议上限 `48`，低端机降级档上限 `24`。
- 普通落地使用 `dust-impact` 3～6 枚；消除/连锁可混合 `dust-burst` 和 `dust-rise`，不应一次铺满整行。
- 粒子初始尺寸建议 `6～18` 设计点，持续 `0.25～0.65 s`，透明度在生命周期末段快速衰减。
- 颜色从当前沙粒色或反馈色采样；不得让所有事件统一变成白色或金色爆闪。
- E06 合图后保持完整 rect 与中心 pivot，禁止线性缩放模糊。

## 6. 验收

- 8 张 PNG 均为 RGBA：4 张 `32×32` 与 4 张 `64×64`。
- 四角 alpha 为 `0`，每枚贴图均同时包含不透明核心和半透明次颗粒。
- `1×` 检查中四种轮廓仍可区分，没有连续软边或绿色色键残留。
- 正式 PNG 只包含白色 RGB 与透明度变化，可由 Sprite Color 无偏色着色。
- 未提前进入 Cocos 运行资源，包体变化延后到 E06 统一评估。

## 7. ImageGen 记录

使用模式：Codex 内置 ImageGen；`stylized-concept`。输入图 1 为 ART-A03 风格板，约束方形沙粒、配色纪律和现代像素质感；输入图 2 为 ART-C06/C07 反馈系统，约束硬边阶梯像素与低模糊密度。生成图使用绿色色键并按 imagegen 技能流程本地去背，之后仅作为轮廓参考。

最终提示词摘要：

```text
Use case: stylized-concept
Asset type: game VFX particle sprite concept sheet for ART-E01
Primary request: exactly four isolated monochrome fine-sand dust particle silhouettes: compact impact puff, rising stepped wisp, sparse outward burst, and narrow falling sand trail.
Style/medium: crisp modern pixel-sand VFX with hard 2 px / 4 px / 6 px equivalent rectangular modules; no retro 8-bit look and no realistic smoke.
Scene/backdrop: perfectly flat #00FF00 chroma-key background for local removal.
Constraints: no text, frames, checkerboard, soft cloudy smoke, bokeh, bloom, lens flare, painterly texture, watermark, or green inside the subjects.
```
