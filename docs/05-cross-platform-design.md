# 跨平台设计文档

## 1. 平台策略

开发目标是共用游戏规则、渲染场景和输入代码，只为存储、生命周期、分享、广告、排行榜和发布过程编写平台适配。

推荐发布顺序：

1. Web Mobile：快速验证玩法。
2. 微信小游戏：验证社交传播与小游戏性能。
3. 抖音小游戏：接入平台分享、视频和运营能力。
4. iOS / Android：核心数据验证后再投入商店发布。

## 2. 产品形态选择

- 微信侧使用“微信小游戏”，不使用普通微信小程序承载实时游戏主循环。
- 抖音侧使用“抖音小游戏”，不使用普通抖音小程序承载实时游戏主循环。
- Web 目标为移动端 H5，同时保留桌面键盘调试能力。
- 原生移动端通过 Cocos 构建 Android/iOS 工程。

## 3. 能力矩阵

| 能力 | Web | 微信小游戏 | 抖音小游戏 | 原生 App |
|---|---|---|---|---|
| 核心模拟 | 共用 | 共用 | 共用 | 共用 |
| Cocos 场景 | 共用 | 共用 | 共用 | 共用 |
| 触控 | Cocos 输入 | Cocos 输入 | Cocos 输入 | Cocos 输入 |
| 本地存储 | Web 实现 | `wx` 实现 | `tt` 实现 | 原生实现 |
| 生命周期 | 页面事件 | 微信事件 | 抖音事件 | 应用事件 |
| 分享 | Web Share/链接 | 微信分享 | 抖音分享/视频 | 系统分享 |
| 排行榜 | 自建 | 微信开放能力 | 抖音开放能力 | 自建/平台服务 |
| 广告 | Web 广告平台 | 微信广告 | 抖音广告 | 移动广告 SDK |
| 更新 | 即时部署 | 审核发布 | 审核发布 | 商店审核 |

## 4. 运行环境差异

### 4.1 Web

- 存在 DOM、`window`、标准 Canvas 和 Web Audio。
- 需要处理浏览器缩放、地址栏高度、横竖屏切换和音频自动播放限制。
- 页面失焦或隐藏时自动暂停。

### 4.2 微信小游戏

- 不是完整浏览器环境，不应在业务代码中依赖 DOM 或 WebView。
- 平台能力通过 `wx.*` 提供。
- 需要微信开发者工具、AppID、域名配置、真机预览和平台审核。
- 排行榜等好友数据可能涉及开放数据域，需要单独适配和性能测试。

### 4.3 抖音小游戏

- 真机是没有 DOM/BOM 的 JavaScript VM，平台能力通过 `tt.*` 提供。
- 创建 Canvas、触摸、存储、音频、登录和分享均有平台 API。
- 网络请求和远程音频需要配置合法 HTTPS 域名。
- 需要在前后台事件中暂停/恢复游戏和音频。

### 4.4 原生 App

- Cocos 负责渲染和脚本运行适配。
- 平台登录、支付、广告、隐私、签名和商店审核需要原生配置。
- 不应把原生 SDK 直接暴露给游戏核心。

## 5. 屏幕适配

- 默认纵屏设计，逻辑画布以固定宽高比布局。
- 游戏容器保持固定比例，额外空间用于背景和 UI，不拉伸棋盘。
- 使用 SafeArea 保护关键按钮。
- 微信/抖音顶部平台胶囊区域不得放置分数、暂停等关键交互。
- 旋转、返回前台、分屏和异形屏必须重新计算布局。

## 6. 性能分级

启动时读取设备能力并选择表现档位：

| 档位 | 目标 | 调整 |
|---|---|---|
| Low | 低端设备 | 30 FPS 表现、减少粒子和屏幕震动 |
| Medium | 主流设备 | 60 FPS、标准特效 |
| High | 高端设备 | 60 FPS、增强后处理和粒子 |

核心物理仍以固定 tick 运行，表现降级不得改变规则结果。

## 7. 包体和资源

- 微信小游戏主包目标控制在 4 MB 以内，额外内容使用 Asset Bundle、分包或远程资源。
- 抖音小游戏主包目标控制在 4 MB 以内，总包和分包遵循平台当前限制。
- 具体限制可能变化，发布前必须重新核对官方文档和开发者工具校验结果。
- 首包只保留启动页、主场景、核心脚本、基础字体和必要音效。
- BGM、皮肤、教程视频和活动资源进入后加载包。

## 8. 生命周期规范

所有平台统一映射为：

```ts
type LifecycleEvent = "foreground" | "background" | "memoryWarning";
```

- `background`：立即暂停模拟、输入和音频，保存必要状态。
- `foreground`：显示暂停层，等待玩家主动继续。
- `memoryWarning`：回收缓存纹理、非必要音频和未使用 Bundle。

## 9. 输入一致性

- 手势阈值使用设计分辨率换算，不直接依赖物理像素。
- 同一次触控由触控 ID 跟踪。
- 触控被平台弹窗、系统手势或来电取消时，清理按住状态。
- 桌面 Web 和小游戏 PC 版本补充键盘与鼠标映射。

## 10. 平台服务工厂

构建时选择平台实现，不在运行中到处判断：

```ts
function createPlatformService(): PlatformService {
  if (isWechatGame()) return new WechatPlatformService();
  if (isDouyinGame()) return new DouyinPlatformService();
  if (isNative()) return new NativePlatformService();
  return new WebPlatformService();
}
```

只允许平台模块读取 `wx`、`tt` 或原生桥接对象。

## 11. 发布检查

每个平台发布前至少检查：

- 真机帧率、内存和启动时间。
- 安全区域、胶囊按钮和横竖屏。
- 后台暂停、音频恢复和来电中断。
- 弱网、离线和资源下载失败。
- 存档升级和损坏恢复。
- 分享、广告、登录和排行榜降级。
- 隐私弹窗、权限文案和平台审核材料。

## 12. 官方参考

- [Cocos Creator 跨平台发布](https://docs.cocos.com/creator/3.8/manual/en/editor/publish/index.html)
- [Cocos Creator 发布到 Web](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-web.html)
- [Cocos Creator 发布到微信小游戏](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html)
- [Cocos Creator 发布到抖音小游戏](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-bytedance-mini-game.html)
- [Cocos Creator 小游戏分包](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/subpackage.html)
- [抖音小游戏开发指南](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/guide/dev-guide/bytedance-mini-game)
