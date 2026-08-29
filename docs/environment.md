# 开发环境记录

记录日期：2026-08-28

## 当前命令行环境

- Node.js：24.20.0 LTS（由 `.node-version` 固定）
- npm：11.19.0
- Node 版本管理器：fnm 1.39.0
- TypeScript：由 `package-lock.json` 固定
- 测试：Vitest，由 `package-lock.json` 固定

首次打开终端时启用 fnm，然后进入仓库并切换到项目版本：

```bash
eval "$(fnm env --use-on-cd --shell zsh)"
fnm use
npm install
```

若希望每个新终端自动启用 fnm，可将第一行加入 `~/.zshrc`。该文件属于个人环境，不纳入仓库。

## Cocos Creator

- 目标版本：Cocos Creator 3.8.8（Cocos 官网当前提供的最新稳定下载）
- Dashboard：2.2.1，安装于 `/Applications/CocosDashboard.app`
- Creator：3.8.8，安装于 `/Applications/Cocos/Creator/3.8.8/CocosCreator.app`
- 当前状态：引擎无关代码可通过 Node.js 构建和测试；Cocos 适配组件已通过已安装 3.8.8 引擎的 `cc.d.ts` 静态类型检查、Web Mobile 构建与本地浏览器预览。真机兼容性和手感仍需在 iOS / Android 浏览器验证

注意：`codesign --verify --deep --strict` 在当前 macOS 26.1 上仍报告厂商应用签名无效；本机由用户通过 macOS 手动例外完成安装。不要将本机安装目录或安装包直接分发给其他开发者，其他机器应从 Cocos 官网独立下载并完成自身安全检查。

### 小游戏渲染分辨率

- 微信构建通过 `build-templates/wechatgame/game.ejs` 将初始 Canvas 渲染倍率限制为 `2`，与抖音构建保持一致。
- 该模板会在每次 Cocos 构建时自动生效；不要只修改 `build/wechatgame/game.js`，因为生成目录会在下次构建时被覆盖。

## 桌面基准

在当前机器执行 `npm run benchmark`，`112 × 192`、约 90% 填充棋盘的一次参考结果：

| 项目 | 平均耗时 |
|---|---:|
| 单次沙粒子步 | 0.2946 ms |
| 沙粒固定 tick（2 子步） | 0.5792 ms |
| 八方向连通扫描 | 1.2607 ms |
| 全量 RGBA 缓冲更新 | 1.4444 ms |

该结果仅用于发现明显回退，不代替 Creator 动态纹理上传、Web Mobile 构建或中低端手机真机性能验收。
