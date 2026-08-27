# 开发指南

## 1. 环境要求

- Cocos Creator 4.0 LTS
- Git
- Node.js 版本使用 Cocos Creator 当前支持的版本
- 微信开发者工具（构建微信小游戏时）
- 抖音开发者工具（构建抖音小游戏时）
- Xcode（构建 iOS 时）
- Android Studio 和对应 SDK/NDK（构建 Android 时）

具体版本在创建工程时记录到 `docs/environment.md`，CI 与本地保持一致。

## 2. 初始化步骤

1. 使用 Cocos Creator 创建 2D TypeScript 项目。
2. 保留本仓库 `.git`，将 Cocos 工程内容创建在仓库根目录。
3. 按《技术架构》创建脚本目录。
4. 先实现不依赖 Cocos 的 `core` 包和单元测试。
5. 再接入 Cocos 场景、动态纹理、触控和平台适配。

## 3. 分支策略

- `main`：始终保持可构建。
- 功能分支：`feat/<name>`。
- 修复分支：`fix/<name>`。
- 文档分支：`docs/<name>`。
- 发布标签：`vMAJOR.MINOR.PATCH`。

MVP 小团队不建立长期 `develop` 分支，减少合并成本。

## 4. 提交约定

采用清晰的 Conventional Commits 风格：

```text
feat(core): add deterministic sand gravity
fix(input): prevent rotate gesture after drag
test(connectivity): cover diagonal edge spanning
docs(rules): clarify simultaneous clearing
```

一次提交只解决一个逻辑问题；生成目录和本机配置不得提交。

## 5. 编码约定

- TypeScript 开启严格模式。
- 核心代码优先纯函数、只读输入和显式输出。
- 热路径使用 TypedArray，避免每 tick 分配对象。
- 不使用魔法数字；规则值集中到 `RulesConfig`。
- 核心随机数只能来自带种子的 `Randomizer`。
- 平台 API 只能出现在 `platform/`。
- 领域模块不得依赖场景节点路径或 UI 文案。
- 对公共接口、边界算法和非直观优化添加说明性注释。

## 6. 错误处理

- 核心不吞掉不变量错误；开发构建应快速失败并记录种子和 tick。
- 平台服务使用结构化结果表示成功、取消、不支持和失败。
- 存档损坏使用默认值并记录非致命错误。
- 网络、广告、分享和排行榜失败不能终止游戏。

## 7. 调试能力

开发构建提供可关闭的调试面板：

- 当前 FPS、物理耗时、连通扫描耗时。
- 活动沙粒数量、移动数量、稳定 tick。
- 当前状态机状态、种子和模拟 tick。
- 暂停后单步执行一个物理 tick。
- 显示连通分量、左右边界和删除标记。
- 导出/导入游戏快照和输入回放。

发布构建移除或关闭调试入口。

## 8. 构建配置

至少维护以下环境：

- `development`：日志、调试面板、未压缩资源。
- `staging`：接近发布配置，使用测试平台账号。
- `production`：关闭调试，启用正式平台配置。

AppID、服务端地址和广告位 ID 通过环境配置注入，不硬编码到核心模块。

## 9. 代码审查清单

- 是否改变规则或确定性？若是，是否更新规则版本和文档？
- 是否在 tick 中产生不必要的对象或数组？
- 是否引入平台 API 到核心层？
- 是否包含边界、失败和降级路径测试？
- 是否在低帧率、暂停和恢复时行为一致？
- 是否影响包体、启动时间或隐私权限？

## 10. Definition of Done

一项功能完成需满足：

- 行为符合产品和规则文档。
- 核心逻辑有自动测试。
- 编辑器和至少一台真机验证通过。
- 无新增 TypeScript、构建或运行时错误。
- 性能未超过预算，或记录了接受偏差的理由。
- 相关文档、配置和埋点已同步更新。

