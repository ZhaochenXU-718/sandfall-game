# Cocos Creator 原型接入

当前仓库已包含 Cocos Creator 3.8.8 的运行组件和可直接构建的 `Game` 场景；以下步骤用于重新创建或调整场景接入。

## 创建最小场景

1. 安装 Cocos Creator 3.8.8。Dashboard 只是版本管理入口，不是运行项目的硬依赖。
2. 使用 Dashboard 导入本仓库根目录，或在 Creator 的项目管理器中直接选择该目录。根目录中的 `package.json` 与 `assets/` 是 Creator 识别项目所需的标志。
3. 等待编辑器完成首次资源导入并生成 `.meta` 文件。
4. 创建一个 2D 场景和 `Canvas`。
5. 在 `Canvas` 下创建带 `Sprite` 的 `SandBoard` 节点，将其 `UITransform` 设为 `300 × 720`，保持 `60:144` 比例。
6. 在 `SandBoard` 下创建位置为 `(0, 0)` 的子节点 `PieceOverlay`，添加 `Graphics` 组件。
7. 将 `SandfallGameComponent` 挂到 `Canvas` 或单独的控制器节点。
8. 把 `SandBoard` 的 `Sprite` 和 `PieceOverlay` 的 `Graphics` 分别拖入组件属性。
9. 保存场景并设为启动场景，然后执行 Web Mobile 预览。

## 键盘操作

- `←/A`、`→/D`：水平移动
- `↓/S`：按住软降
- `↑/X`：顺时针旋转
- `Z`：逆时针旋转
- `Space`：硬降
- `P` / `Esc`：暂停或继续
- `R`：重新开始

## 触屏操作

- 在棋盘上点按：顺时针旋转。
- 在棋盘上左右拖动：按拖动距离连续移动活动块。
- 向下拖动并保持约 `120 ms`：进入软降，松手或触摸取消时停止。
- 在约 `250 ms` 内快速向下滑动至少 `72` 个设计点并松手：硬降。
- 棋盘只跟踪第一根有效手指；暂停、重开等 UI 控件不会把触摸传给游戏手势。

手势阈值使用 `360 × 800` 设计分辨率中的 UI 点，与手机物理像素密度无关。横拖步距、软降保持时间和硬降距离可在 `SandfallGameComponent` 属性面板中调整。

## 验证项

- 棋盘按 nearest filtering 放大，沙粒边缘保持清晰。
- 活动块与沙粒显示方向正确，顶部出生、底部堆积。
- 满棋盘时物理 tick、纹理上传和主线程总耗时满足架构预算。
- 进入后台后调用暂停，恢复前台时不自动继续。

`assets/scripts/cocos/` 依赖编辑器提供的 `cc` 模块；仓库的常规类型检查会读取 Creator 3.8.8 生成的声明，但发布前仍须完成 Creator 构建、移动端浏览器和真机验证。
