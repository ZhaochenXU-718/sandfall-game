# 技术架构文档

## 1. 架构目标

- 一套核心逻辑支持 Web、微信小游戏、抖音小游戏和原生 App。
- 游戏模拟与渲染、输入、平台 SDK 解耦。
- 模拟确定、可回放、可单元测试。
- 在中低端手机上稳定运行，避免每粒沙一个对象或节点。
- 平台能力失败时仍可离线完成核心游戏。

## 2. 技术栈

- 引擎：Cocos Creator 3.8.8
- 语言：TypeScript
- 渲染：Cocos 2D + 单张动态 `Texture2D`
- 核心数据：TypedArray
- 测试：支持 TypeScript 的单元测试框架，具体工具在工程初始化时通过 ADR 确定
- 构建目标：Web Mobile、微信小游戏、抖音小游戏、Android、iOS

## 3. 分层架构

```text
┌───────────────────────────────────────────┐
│                Scene / UI                 │
├───────────────────────────────────────────┤
│ Input │ Rendering │ Audio │ Presentation  │
├───────────────────────────────────────────┤
│              Application Flow             │
│ GameSession / State Machine / Commands    │
├───────────────────────────────────────────┤
│                 Game Core                 │
│ Board / Sand / Pieces / Connectivity      │
│ Randomizer / Score / Rules                │
├───────────────────────────────────────────┤
│             Platform Services             │
│ Web │ WeChat │ Douyin │ Native            │
└───────────────────────────────────────────┘
```

依赖只能由上向下。`core/` 不得导入 Cocos 或任意平台 API。

## 4. 运行时数据模型

### 4.1 沙盘

```ts
type ColorId = number;

interface BoardState {
  readonly width: number;
  readonly height: number;
  readonly cells: Uint8Array;
  readonly movedFlags: Uint8Array;
}
```

- `cells[y * width + x]` 保存颜色编号。
- `0` 表示空单元。
- 默认棋盘有 19,440 个单元，单份颜色数据约 19 KiB。
- 连通访问、删除标记等工作数组在初始化时一次性分配并复用。
- 热路径中避免对象分配、数组扩容和闭包创建。

### 4.2 活动块

活动块使用宏观坐标保存：形状、旋转、位置、颜色、锁定计时。只有锁定时才转换到沙粒坐标。

### 4.3 游戏快照

可序列化快照包含：

- 规则版本和配置版本
- 随机种子及 PRNG 状态
- 棋盘单元
- 当前块和下一块
- 分数、等级、连锁、游戏状态
- 当前模拟 tick

MVP 只要求保存最高分，不要求中途续局；快照接口仍保留给调试和回放。

## 5. 固定时间步长

渲染帧率与模拟频率分离：

```ts
accumulator += Math.min(deltaTime, MAX_FRAME_DELTA);

while (accumulator >= FIXED_STEP && steps < MAX_STEPS_PER_FRAME) {
  gameSession.tick(FIXED_STEP);
  accumulator -= FIXED_STEP;
  steps += 1;
}

renderer.render(gameSession.viewState);
```

- `FIXED_STEP` 默认 `1 / 60` 秒。
- 限制单帧最大补算次数，避免设备恢复前台后出现“死亡螺旋”。
- 应用切后台时暂停，不补算后台经过的时间。

## 6. 游戏状态机

```text
Boot → Menu → Spawning → Falling → LockDelay
                              ↑         ↓
                              └──── Resolving
                                      │
                           ┌──────────┴─────────┐
                         Clearing             GameOver
                           │
                         Resolving
```

`Resolving` 负责沙粒重力和稳定计数；稳定后调用连通模块。存在消除则进入 `Clearing`，否则回到 `Spawning`。

## 7. 沙粒渲染

### 7.1 方案

- CPU 维护 `108 × 180` 的颜色网格。
- 渲染器维护复用的 `Uint8Array(width * height * 4)` RGBA 缓冲。
- 根据脏标记写入颜色值。
- 通过 `Texture2D.uploadData()` 更新一张动态纹理。
- Sprite 使用 nearest 过滤放大到屏幕尺寸。

### 7.2 禁止方案

- 不允许每粒沙创建独立 Node、Sprite 或物理刚体。
- 不引入 Box2D、Matter.js 等逐粒刚体物理。
- MVP 不使用 GPU Compute 或自定义复杂流体模拟。

## 8. 平台适配

平台相关能力通过接口注入：

```ts
interface PlatformService {
  readonly kind: "web" | "wechat" | "douyin" | "native";
  loadSettings(): Promise<PlayerSettings>;
  saveSettings(settings: PlayerSettings): Promise<void>;
  loadHighScore(): Promise<number>;
  saveHighScore(score: number): Promise<void>;
  vibrate(level: "light" | "medium" | "heavy"): void;
  share(result: ShareResult): Promise<ShareOutcome>;
  showRewardedAd(placement: string): Promise<AdOutcome>;
  track(event: AnalyticsEvent): void;
}
```

核心逻辑只发出领域事件，如 `PieceLocked`、`ComponentCleared`、`GameEnded`；表现层和平台层订阅事件完成音效、震动、埋点或分享。

## 9. 事件设计

主要领域事件：

- `GameStarted`
- `PieceSpawned`
- `PieceMoved`
- `PieceRotated`
- `PieceLocked`
- `SandSettled`
- `ComponentsCleared`
- `ChainAdvanced`
- `DangerChanged`
- `ScoreChanged`
- `GameEnded`

事件对象必须是只读数据，不允许订阅者反向修改核心状态。

## 10. 性能预算

| 项目 | MVP 预算 |
|---|---:|
| 物理 tick 平均耗时 | ≤ 2 ms |
| 连通扫描平均耗时 | ≤ 2 ms |
| 单帧主线程总耗时 | ≤ 12 ms（60 FPS 目标） |
| 持续运行内存增长 | 10 分钟内无持续增长 |
| 主场景 Draw Call | ≤ 20 |
| 沙粒渲染 Draw Call | 1～2 |
| 首次可交互时间 | Web/小游戏目标 ≤ 3 秒 |

性能测试以真机发布/预览包为准，不以编辑器模拟器作为最终结论。

## 11. 资源和包体策略

- 首屏只包含必要代码、字体、基础 UI 和少量音效。
- BGM、皮肤和非首屏资源放入 Asset Bundle。
- 图片优先使用图集或程序化图形。
- 音效实例复用，进入后台立即暂停。
- 网络资源必须使用 HTTPS，并配置小游戏平台域名白名单。

## 12. 安全和隐私

- AppSecret、平台私钥和签名证书不得进入客户端仓库。
- 排行榜写入若上线，必须经过服务端校验。
- MVP 不收集不必要的个人信息。
- 数据采集、广告和登录启用前补充隐私政策与授权流程。

## 13. 推荐目录

```text
assets/
├── scenes/
├── scripts/
│   ├── core/
│   ├── application/
│   ├── rendering/
│   ├── input/
│   ├── audio/
│   ├── platform/
│   └── ui/
├── resources/
├── bundles/
└── tests/
docs/
tools/
```
