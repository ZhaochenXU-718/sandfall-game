# Cocos Creator 原型接入

当前仓库已包含 Cocos Creator 3.8.8 的运行组件。场景资源和 Web 构建仍需在编辑器中完成。

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
- `P`：暂停或继续
- `R`：重新开始

## 验证项

- 棋盘按 nearest filtering 放大，沙粒边缘保持清晰。
- 活动块与沙粒显示方向正确，顶部出生、底部堆积。
- 满棋盘时物理 tick、纹理上传和主线程总耗时满足架构预算。
- 进入后台后调用暂停，恢复前台时不自动继续。

`assets/scripts/cocos/` 依赖编辑器提供的 `cc` 模块，因此不进入独立 Node.js 类型检查；必须在 Creator 编辑器完成最终编译和预览验证。
