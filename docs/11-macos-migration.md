# macOS 开发环境迁移指南

本文用于将 Sandfall Game 从一台 Mac 迁移到另一台 Mac，尤其适用于从 Apple Silicon Mac 切换到 Intel Mac。项目源码和配置通过 Git 同步，本机依赖、编辑器缓存和平台开发工具在目标电脑重新安装。

## 1. 迁移原则

- 两台电脑统一使用 Cocos Creator `3.8.8`。
- 项目固定使用 Node.js `24.20.0`，版本记录在 `.node-version`。
- 切换电脑前先提交并推送；开始工作前先拉取最新提交。
- 不复制 `node_modules/`、`library/`、`local/`、`temp/` 或 `build/`。
- 不提交 AppSecret、代码上传密钥、账号密码或本机私有平台配置。

上述生成目录已经由 `.gitignore` 排除。Creator 首次打开项目时会重建编辑器缓存，`npm ci` 会重建 Node.js 依赖。

## 2. 克隆项目

在目标 Mac 上安装 Git，然后执行：

```bash
git clone https://github.com/ZhaochenXU-718/sandfall-game.git
cd sandfall-game
git status
```

`git status` 应显示当前位于 `main`，并且工作区没有未提交修改。

如果目标电脑已经存在项目目录，则进入目录后执行：

```bash
git switch main
git pull --ff-only
```

## 3. 安装 Node.js 环境

推荐继续使用 `fnm` 管理 Node.js：

```bash
brew install fnm
eval "$(fnm env --use-on-cd --shell zsh)"
fnm install 24.20.0
fnm use
npm ci
```

可将下面一行加入目标电脑的 `~/.zshrc`，使新终端自动启用 `fnm`：

```bash
eval "$(fnm env --use-on-cd --shell zsh)"
```

验证环境：

```bash
node --version
npm test
npm run typecheck
npm run build
```

`node --version` 应显示 `v24.20.0`。完整的命令行环境说明见 [`environment.md`](environment.md)。

## 4. 安装 Cocos Creator

1. 从 [Cocos Creator 官方下载页](https://www.cocos.com/creator-download) 下载 Cocos Dashboard 的 macOS 安装包。
2. Intel Mac 选择 `macOS Intel/x64`；若官网只提供统一 macOS 包，则安装官网提供的通用版本。
3. 将 `CocosDashboard.app` 拖入“应用程序”并登录原来的 Cocos 账号。
4. 在 Dashboard 的编辑器安装列表中安装 **Cocos Creator 3.8.8**。
5. 不要把 Apple Silicon Mac 上的 `/Applications/Cocos` 目录复制到 Intel Mac，也不要使用其他 Creator 版本打开项目。
6. 在 Dashboard 中选择“导入项目”，导入克隆后的 `sandfall-game` 根目录，并指定 Creator 3.8.8 打开。

首次打开时，Creator 会重新导入资源并生成 `library/`、`local/` 和 `temp/`，耗时比日常启动更长属于正常现象。

如果 macOS 阻止启动官方安装包，可在 Finder 中右键应用并选择“打开”，或前往“系统设置 → 隐私与安全性 → 仍要打开”。不要关闭系统级安全校验，也不要复制另一台电脑已经手动放行过的应用目录。

## 5. 验证 Cocos 项目

1. 在 Creator 中打开 `assets/scenes/Game.scene`。
2. 等待资源导入和脚本编译完成，确认控制台没有错误。
3. 使用浏览器预览，验证首页、开始游戏、触屏输入、音效、暂停和 Game Over。
4. 在“项目 → 构建发布”中执行一次 Web Mobile 构建。
5. 打开构建产物完成一局冒烟测试。

上述步骤通过后，目标电脑即可继续日常功能开发。

## 6. 安装微信开发者工具

微信账号、小游戏和 AppID 属于平台账号，不需要因更换电脑重新注册；开发者工具需要重新安装。

1. 从[微信开发者工具官方下载页](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)下载 macOS Intel/x64 稳定版。
2. 安装后，使用该小游戏的管理员或已授权开发者微信扫码登录。
3. 在 Cocos Creator 的“偏好设置 → 外部程序”中配置微信开发者工具路径。
4. 后续使用 Cocos 构建微信小游戏，再由开发者工具导入生成的 `wechatgame` 目录。

如果登录后看不到小游戏，检查当前微信是否已在微信公众平台中被添加为管理员或开发者。

## 7. 安装抖音开发者工具

1. 从[抖音开发者工具官方下载页](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/developer-instrument-update-and-download)选择 `Mac x64` 安装包。
2. 使用原来的手机号、邮箱或抖音账号登录。
3. 确认工具中的 AppID 列表能够找到已创建的小游戏。
4. 后续使用 Cocos 构建抖音小游戏，再由开发者工具导入生成的 `bytedance-mini-game` 目录。

测试号可以用于预览调试，但正式上传必须使用已创建小游戏的 AppID。

## 8. 日常双机切换流程

结束一台电脑上的工作时：

```bash
git status
git add <本次修改的文件>
git commit -m "<提交说明>"
git push origin main
```

在另一台电脑继续前：

```bash
git status
git pull --ff-only
fnm use
npm ci
```

只有 `package-lock.json` 发生变化时才必须重新执行 `npm ci`，日常仅修改游戏代码时可以省略。Creator 的 `library/` 等本机缓存不得通过 Git 或网盘在两台电脑之间同步。

## 9. 迁移验收清单

- [ ] `git status` 工作区干净且已同步 `origin/main`
- [ ] `node --version` 为 `v24.20.0`
- [ ] `npm test`、`npm run typecheck`、`npm run build` 通过
- [ ] Cocos Creator 版本为 `3.8.8`
- [ ] `Game.scene` 能打开并完成 Web Mobile 构建
- [ ] 首页和完整对局可以正常运行
- [ ] 微信开发者工具使用 Intel/x64 版本并已登录
- [ ] 抖音开发者工具使用 Mac x64 版本并已登录
- [ ] 没有把 AppSecret、上传密钥或账号凭据写入仓库
