# 模块设计文档

## 1. Core 模块

### 1.1 `Board`

职责：

- 管理沙粒棋盘的尺寸和 TypedArray。
- 提供边界检查、索引转换、读写、交换和批量删除。
- 管理可复用工作缓冲，不暴露可变内部数组给表现层。

不负责：重力规则、连通判定、计分或渲染。

建议接口：

```ts
class Board {
  get(x: number, y: number): ColorId;
  set(x: number, y: number, color: ColorId): void;
  swap(a: number, b: number): void;
  clearMarked(mask: Uint8Array): number;
  canOccupy(indices: readonly number[]): boolean;
}
```

### 1.2 `SandSimulation`

职责：

- 按固定 tick 执行沙粒重力。
- 保证单粒沙每 tick 最多移动一次。
- 交替扫描方向并使用确定性 PRNG 解决左右选择。
- 返回移动数量，供稳定判定和性能统计使用。

输出：

```ts
interface SandStepResult {
  movedCount: number;
  dirtyMinX: number;
  dirtyMinY: number;
  dirtyMaxX: number;
  dirtyMaxY: number;
}
```

### 1.3 `ConnectivityResolver`

职责：

- 使用 BFS/DFS 查找八方向同色连通分量。
- 判断分量是否同时触及左右边界。
- 标记所有符合条件的分量并统一返回。
- 不直接删除棋盘或计算表现效果。

实现约束：

- 访问标记、队列和删除标记全部复用。
- 单次扫描复杂度为 `O(width × height)`。
- 同一单元最多入队一次。

### 1.4 `StableDetector`

职责：根据每次 `SandSimulation.step()` 的移动数量维护连续稳定 tick。

```ts
class StableDetector {
  update(movedCount: number): void;
  get isStable(): boolean;
  reset(): void;
}
```

稳定阈值由 `RulesConfig` 提供，默认 4。

### 1.5 `PieceDefinition`

职责：描述形状在各旋转状态下的宏观格坐标。形状数据使用纯数据配置，不在类中硬编码旋转算法。

```ts
interface PieceDefinition {
  id: string;
  rotations: ReadonlyArray<ReadonlyArray<ReadonlyVec2>>;
}
```

### 1.6 `PieceController`

职责：

- 保存当前块位置、旋转和颜色。
- 尝试移动、旋转、软降和硬降。
- 处理锁定延迟和重置上限。
- 通过 `CollisionService` 检查候选位置。

不负责沙化和生成随机块。

### 1.7 `PieceRasterizer`

职责：将已锁定的宏观格转换为沙粒棋盘单元。一次锁定必须先验证全部目标单元，再一次性写入。

### 1.8 `Randomizer`

职责：

- 实现带种子的 PRNG。
- 维护形状袋和颜色袋。
- 暴露序列化与恢复 PRNG 状态的能力。

核心代码禁止直接使用 `Math.random()`。

### 1.9 `ScoreSystem`

职责：基于领域事件计算分数、等级、连锁倍率和统计项。所有公式来自配置，输出整数并定义舍入方式。

## 2. Application 模块

### 2.1 `GameSession`

游戏应用层入口，持有核心模块并驱动状态机。

主要命令：

```ts
interface GameCommands {
  start(seed?: number): void;
  pause(): void;
  resume(): void;
  moveLeft(): void;
  moveRight(): void;
  rotateCW(): void;
  rotateCCW(): void;
  setSoftDrop(active: boolean): void;
  hardDrop(): void;
  tick(fixedDelta: number): void;
}
```

`GameSession` 是唯一允许改变游戏阶段的模块。

### 2.2 `GameStateMachine`

状态：

- `Idle`
- `Spawning`
- `Falling`
- `LockDelay`
- `Resolving`
- `Clearing`
- `Paused`
- `GameOver`

暂停不销毁原状态，而是保存 `stateBeforePause`。

### 2.3 `RulesConfig`

所有数值集中管理并带版本号：

```ts
interface RulesConfig {
  version: string;
  macroWidth: number;
  macroHeight: number;
  grainsPerCell: number;
  colorCount: number;
  fixedHz: number;
  stableTicks: number;
  lockDelayMs: number;
  maxLockResets: number;
}
```

线上版本不得在不修改版本号的情况下改变影响回放结果的配置。

## 3. Rendering 模块

### 3.1 `SandTextureRenderer`

- 将棋盘颜色转换为 RGBA。
- 复用像素缓冲和动态纹理。
- 支持全量更新，后续再按性能数据决定是否加入脏矩形更新。
- 不读取平台 API。

### 3.2 `PieceRenderer`

- 绘制尚未锁定的活动块、影子落点和下一块预览。
- 视觉上可显示粒状纹理，但逻辑上仍为刚性块。

### 3.3 `EffectController`

- 监听锁定、将要消除、消除、连锁和危险事件。
- 特效对象使用池化。
- 关闭特效不得改变游戏逻辑或计时。

## 4. Input 模块

### 4.1 `InputMapper`

将 Cocos 触控或键盘事件映射成统一命令，不直接修改棋盘。

### 4.2 `GestureRecognizer`

- 区分点击、水平拖动、慢速下滑和快速下滑。
- 使用屏幕 DPI 无关阈值。
- 手势开始在 UI 控件区域时不传给游戏。
- 每次手势只能产生一种最终意图，避免点击旋转与拖动同时发生。

### 4.3 `VirtualControls`

提供可选虚拟按钮，支持按住连发和触控取消。所有操作与手势共用同一 `InputMapper`。

## 5. Platform 模块

### 5.1 平台实现

- `WebPlatformService`
- `WechatPlatformService`
- `DouyinPlatformService`
- `NativePlatformService`
- `MockPlatformService`：自动测试和编辑器预览

### 5.2 平台能力降级

- 分享不可用：隐藏分享按钮，不阻塞结算。
- 广告加载失败：返回失败状态，不扣除奖励机会之外的资源。
- 排行榜不可用：显示本地最高分。
- 震动不可用：静默跳过。
- 网络不可用：游戏核心保持可玩。

## 6. Audio 模块

`AudioService` 管理 BGM、音效池、音量、静音和生命周期。平台进入后台时暂停；恢复后只在玩家允许和系统策略允许时继续。

## 7. Persistence 模块

存储键统一加命名空间和版本：

```text
sandfall.settings.v1
sandfall.high-score.v1
sandfall.analytics-consent.v1
```

读取失败或数据损坏时使用默认值，不得阻止启动。

## 8. Analytics 模块

核心逻辑只产生领域事件。`AnalyticsService` 负责采样、脱敏、缓存、批量发送和失败重试。未经同意或平台规则不允许时禁用采集。

## 9. 模块依赖规则

- `core` 不依赖其他业务层。
- `application` 只依赖 `core` 和抽象接口。
- `rendering/input/ui` 可以依赖 Cocos 和 `application` 的只读状态。
- `platform` 可以调用平台 SDK，但不能直接修改游戏状态。
- 不允许从核心层导入 `wx`、`tt`、浏览器 DOM 或原生桥接代码。

