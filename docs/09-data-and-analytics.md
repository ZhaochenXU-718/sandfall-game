# 数据与运营设计

## 1. 原则

- MVP 只采集验证玩法和稳定性所需的最小数据。
- 不采集棋盘逐帧内容、输入文本或不必要的设备标识。
- 采集前遵守目标平台隐私和授权要求。
- 所有事件带 `game_version`、`rules_version` 和 `platform`。

## 2. 核心事件

| 事件 | 触发时机 | 关键字段 |
|---|---|---|
| `app_open` | 进入游戏 | platform, version |
| `tutorial_start` | 开始教程 | tutorial_version |
| `tutorial_complete` | 完成教程 | duration_ms |
| `game_start` | 开始一局 | session_id, seed, mode |
| `first_clear` | 本局首次消除 | elapsed_ms, piece_count |
| `components_clear` | 一次统一消除 | colors, components, grains, chain |
| `danger_enter` | 首次进入危险高度 | elapsed_ms, score |
| `game_end` | 游戏结束 | score, duration_ms, pieces, clears, max_chain |
| `restart` | 结算后重开 | previous_duration_ms |
| `share_result` | 发起分享 | score, platform, outcome |
| `performance_sample` | 低频性能采样 | fps, physics_ms, scan_ms, grain_count |
| `fatal_error` | 无法继续的错误 | state, tick, seed, error_code |

## 3. 核心指标

- 教程完成率。
- 首局首次消除率。
- 首次消除耗时中位数。
- 首局时长中位数。
- 游戏结束后的即时重开率。
- 平均消除次数和最高连锁分布。
- 第 1 日回访率。
- 低帧率会话比例和崩溃率。

## 4. 平衡诊断

若首局首次消除率过低，依次检查：

1. 教程是否清楚表达“横跨而非整行”。
2. 颜色数量是否过多。
3. 颜色袋是否造成关键颜色断档。
4. 下落速度和锁定延迟是否过快。
5. 八方向连接的视觉提示是否不明显。

若平均单局过长且缺少压力，优先调整下落速度曲线、出生区域和预览数量，不直接降低消除收益。

## 5. 后续运营能力

核心玩法验证后再考虑：

- 每日固定种子挑战。
- 平台排行榜（实现前见[排行榜公平性备忘](10-ranking-fairness.md)）。
- 主题皮肤和季节视觉。
- 分享挑战码或回放摘要。
- 不影响公平性的激励广告，例如结算加倍或每日外观奖励。

不建议在首版加入“观看广告原地复活”，因为它会改变生存模式的分数公平性；若后续加入，应与无复活排行榜分开。
