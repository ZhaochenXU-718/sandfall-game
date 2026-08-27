# Sandfall Game

一款面向手机端的彩色沙粒堆叠消除游戏。玩家控制单色块下落；色块锁定后转化为沙粒并受重力影响。同色沙粒形成从容器左侧到右侧的八方向连通分量，且连续稳定 4 个物理 tick 后，整个连通分量被消除。消除引发的坍塌可以继续触发连锁。

## 当前状态

项目处于设计阶段。本仓库目前保存产品、规则、架构、模块、跨平台、开发计划和测试验收文档，尚未初始化 Cocos Creator 工程。

## 目标平台

- Web Mobile / H5
- 微信小游戏
- 抖音小游戏
- iOS / Android（验证留存后再发布）

## 技术方向

- Cocos Creator 4.0 LTS
- TypeScript
- `Uint8Array` 沙盘数据
- 固定时间步长的二维元胞自动机
- 单张动态纹理渲染沙粒
- 平台能力适配层隔离 `wx.*`、`tt.*` 和原生 SDK

## 文档索引

1. [产品设计](docs/01-product-design.md)
2. [游戏规则规范](docs/02-game-rules.md)
3. [技术架构](docs/03-technical-architecture.md)
4. [模块设计](docs/04-module-design.md)
5. [跨平台设计](docs/05-cross-platform-design.md)
6. [开发指南](docs/06-development-guide.md)
7. [开发计划](docs/07-development-plan.md)
8. [测试与验收](docs/08-testing-and-acceptance.md)
9. [数据与运营设计](docs/09-data-and-analytics.md)

## MVP 范围

- 纵屏单人无尽模式
- 单色下落块
- 沙粒重力、稳定检测、八方向连通消除和连锁
- 下一块预览、分数、存活时间、暂停、重开
- 触屏操作与键盘调试操作
- 本地最高分
- Web、微信小游戏、抖音小游戏构建

排行榜、账号、广告、付费、皮肤和原生 App 商店发布不属于首个可玩版本。

