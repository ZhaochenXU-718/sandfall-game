# 激励广告变现接入方案

记录日期：2026-08-30

状态：暂缓实现；等待微信与抖音流量主开通后再启动编码

## 1. 当前结论

首个变现版本只做**激励视频广告**（IAA），不做内购（IAP）。

理由是资质门槛而非收益高低。内购必须以企业或个体工商户主体注册，并额外提供广电总局版号批文；版号为配额制，审批以月计且不保证通过。落沙是纯技巧向休闲消除，没有养成和数值成长，缺少内购的承载物，硬加皮肤或道具反而破坏调性。为此走一遍公司注册加版号申请，投入产出比不成立。

激励视频用个人主体即可上线，是该品类的标准解法。等留存数据跑出来，再决定是否值得为内购补齐资质。

本方案不改变游戏规则、计分公式和棋盘数据。所有广告奖励必须满足 [09 数据与运营设计](09-data-and-analytics.md) 的公平性约束。

## 2. 前置条件（阻塞项）

编码前必须先完成，否则代码无法联调——没有广告位 ID 时，预览环境调用只会返回错误码。

其中资质材料的周期以月计，是整条路径上最长的一环，应最先启动。

### 2.1 资质材料

三样东西容易混淆，先分清：

| | 软著 | 版号 | 小程序备案 |
|---|---|---|---|
| 全称 | 计算机软件著作权登记证书 | 网络游戏出版物号 | ICP 备案 |
| 发证方 | 中国版权保护中心 | 国家新闻出版署 | 平台代提交至通管局 |
| 性质 | 权属登记，材料合规即发证 | 内容审批，配额制，可能不批 | 强制备案 |
| 个人主体可办 | 可以 | 不可以，须企业主体 | 可以 |
| 本方案是否需要 | **需要（抖音上架要求）** | 不需要（不做内购） | 需要 |
| 周期 | 约 40–45 个工作日；加急约 30–35 个工作日（付费） | 以月计，不保证通过 | 约 7–20 个工作日 |

两个平台对个人主体的要求不同，这决定了先上哪个平台：

- **微信**：个人主体目前只需实名信息，不要求软著。门槛更低。
- **抖音**：要求提供计算机软件著作权登记证书。

因此若想尽早拿到留存数据，可以先上微信验证，软著办理与微信上线并行推进。

#### 软著要点

著作权在代码写完时自动产生，登记只是备案取证，不是审批，材料格式正确即发证。

**官方登记免费。** 依据财政部与发改委 [财税〔2017〕20 号文](https://www.gov.cn/gongbao/content/2017/content_5227827.htm)，自 2017 年 4 月 1 日起停征软件著作权登记费。市面代办机构收取的是服务费而非官费，自行在官网提交零成本。

**唯一官方入口是 `ccopyright.com.cn`（中国版权保护中心）**，全程线上提交、电子回执、证书邮寄。该领域存在大量高仿域名和 SEO 引流的代办站（例如 `ccopyright.ai`），不要在非官方站点填写身份证信息。

需提交四项材料：

1. 计算机软件著作权登记申请表
2. 身份证明——个人为身份证复印件加独立开发声明
3. 源代码——前 30 页加后 30 页共 60 页，每页不少于 50 行，Word 格式；不足 60 页则全部提交
4. 文档——用户手册或设计说明书，同样按前后各 30 页规则

本项目的材料储备情况：

- 源代码：`assets/scripts` 下 TypeScript 共约 7300 行，按每页 50 行计约 146 页，远超 60 页要求。
- 用户手册：可由 [01 产品设计](01-product-design.md) 与 [02 游戏规则规范](02-game-rules.md) 改写。

两个格式细节：源代码需删除注释中的作者与版权信息、去除空行；软件名称与版本号（如「落沙 V1.0」）在所有材料中必须完全一致，并标注在申请表左上角。

### 2.2 流量主开通

| 平台 | 操作路径 | 产出 |
|---|---|---|
| 微信 | mp 后台 → 流量主 → 开通（需主体资质认证 + 银行账户）→ 新建广告位 | 形如 `adunit-xxxxxxxx` 的广告位 ID |
| 抖音 | 开放平台 → 商业化 → 流量主 → 申请开通（需主体资质认证 + 银行账户验证）→ 新建广告位 | 抖音侧广告位 ID |

两个平台的流量主开通都有审核周期，应尽早提交，不要等代码写完再申请。

### 2.3 关键路径

抖音一侧存在串行依赖，总周期不短：

```text
软著（约 2 个月）→ 抖音提审上架 → 流量主开通 → 广告位 ID → 联调
```

微信一侧无软著依赖，可并行：

```text
小程序备案（7–20 工作日）→ 微信提审上架 → 流量主开通 → 广告位 ID → 联调
```

软著是其中唯一可以立即动手、且不依赖任何外部审核结果的环节——代码已完成，材料随时可整理。建议优先启动。

## 3. 代码现状与缺口

截至本文记录日期，仓库内与广告相关的实现为零：

- 没有 `assets/scripts/platform/` 目录，[04 模块设计](04-module-design.md) 中的 `WechatPlatformService` / `DouyinPlatformService` / 平台服务工厂均为设计稿，未实现。
- 全仓搜不到 `createRewardedVideoAd`、`requestMidasPayment` 等平台 API 调用。
- 环境配置机制本身也不存在：没有 `.env.example`，代码中无任何 env 读取。而 [06 开发指南](06-development-guide.md) 已规定「AppID、服务端地址和广告位 ID 通过环境配置注入，不硬编码到核心模块」，这块要与广告服务一起建立。
- [ART-P05 激励广告奖励弹窗](12-art-asset-production-list.md) 仍是未完成状态，UI 资源缺位。

## 4. 模块设计

### 4.1 沿用 HapticsService 的范式

[`assets/scripts/audio/HapticsService.ts`](../assets/scripts/audio/HapticsService.ts) 是仓库内已经在调用 `wx.*` / `tt.*` 的平台服务，广告服务照它的形状做，不要另起炉灶。关键三点：

1. **接口与实现分离**：先定 `AdService` 接口，再写 `PlatformAdService` 实现。
2. **平台全局对象从构造函数注入，默认取 `globalThis`**。这是能否单测的分水岭——[`tests/audio/HapticsService.test.ts`](../tests/audio/HapticsService.test.ts) 靠直接传入 `{ wx: { vibrateShort: vi.fn() } }` 在 Node 环境验证所有分支，不需要真机。
3. **为平台 API 写最小化类型声明**，不使用 `any`，参照 `WeChatVibrationApi` / `DouyinVibrationApi` 的写法。

### 4.2 建议接口

新增 `assets/scripts/platform/AdService.ts`：

```ts
export type AdPlacement = "settlement-double" | "daily-skin";

/** 三态结果：奖励发放、用户提前关闭、广告不可用。 */
export type AdResult = "rewarded" | "dismissed" | "unavailable";

export interface AdService {
  /** 提前加载，避免 show() 时冷启动等待。 */
  preload(placement: AdPlacement): void;
  /** 广告关闭后 resolve；任何失败都归为 unavailable，绝不 reject。 */
  show(placement: AdPlacement): Promise<AdResult>;
}
```

`AdResult` 必须区分 `dismissed` 与 `unavailable`：前者是玩家主动放弃，可以消耗当次机会；后者是平台侧故障，按 [04 模块设计](04-module-design.md) 的要求「不扣除奖励机会之外的资源」，应允许重试。把两者合并成布尔值会直接违反这条约束。

微信与抖音的激励视频接口签名一致，一套类型声明即可覆盖两端：

```ts
interface RewardedVideoAd {
  load(): Promise<void>;
  show(): Promise<void>;
  onClose(handler: (result?: { readonly isEnded: boolean }) => void): void;
  offClose(handler: (result?: { readonly isEnded: boolean }) => void): void;
  onError(handler: (error: unknown) => void): void;
  destroy(): void;
}

interface RewardedVideoAdHost {
  createRewardedVideoAd(options: { readonly adUnitId: string }): RewardedVideoAd;
}

export interface AdPlatformGlobals {
  readonly wx?: RewardedVideoAdHost;
  readonly tt?: RewardedVideoAdHost;
}
```

### 4.3 环境配置

广告位 ID 按平台和环境注入，不写死在模块里：

```ts
export interface AdUnitConfig {
  readonly wechat: Readonly<Record<AdPlacement, string>>;
  readonly douyin: Readonly<Record<AdPlacement, string>>;
}
```

区分 `development` / `staging` / `production` 三套，与 [06 开发指南](06-development-guide.md) 第 8 节的环境划分对齐。

## 5. 投放点

### 5.1 首版做

| 位置 | 触发 | 奖励 | 说明 |
|---|---|---|---|
| 结算加倍 | 游戏结束弹窗上的可选按钮 | 本局得分翻倍 | 玩家主动点击，不打断流程 |
| 每日外观奖励 | 首页每日一次 | 外观类奖励 | 不影响任何数值 |

两者都来自 [09 数据与运营设计](09-data-and-analytics.md) 第 58 行既有结论：「不影响公平性的激励广告，例如结算加倍或每日外观奖励」。

### 5.2 首版明确不做

**观看广告原地复活。** [09 数据与运营设计](09-data-and-analytics.md) 第 60 行已给出结论：它会改变生存模式的分数公平性。若后续要加，必须与无复活排行榜分开统计。

**Banner 与插屏。** 落沙是连续操作的下落类游戏，误触代价高；且 Banner 在小屏上会挤压棋盘可视区域。激励视频占小游戏广告收入的绝大部分，先把它做好。

### 5.3 结算加倍与最高分的关系

需要在实施时明确：翻倍后的分数**是否计入本地最高分**。

倾向是**不计入**——最高分应反映纯操作水平，否则 [10 排行榜公平性备忘](10-ranking-fairness.md) 里「相同规则版本下可比」的前提被破坏，将来接线上排行榜时会留下脏数据。翻倍分可以单独展示为本局收益。这一条实施前需确认。

## 6. 平台 API 与已知坑

以下依据[微信官方文档](https://developers.weixin.qq.com/minigame/dev/api/ad/wx.createRewardedVideoAd.html)确认：

```js
const ad = wx.createRewardedVideoAd({ adUnitId })
ad.load()
ad.onClose(res => { if (res && res.isEnded) grantReward() })
ad.show()
```

- **同一 `adUnitId` 多次调用 `createRewardedVideoAd` 返回同一实例。** 必须创建一次并复用，不能每次弹窗都新建。
- **`onClose` 会重复绑定。** 重复注册会导致奖励发放多次，需用 `offClose` 成对管理，或在服务内只注册一次并通过内部状态派发。
- **必须判 `res.isEnded`。** 用户提前关闭时该值为 `false`，不得发放奖励。
- **提前 `load()` 预加载。** 等用户点击后才加载会有数秒空窗。
- **用完调用 `destroy()`** 释放内存。

抖音的 `tt.createRewardedVideoAd` 签名与微信一致，但上述单例与事件累积行为需在抖音真机上单独复验，不要假设两端实现细节相同。

## 7. 降级要求

来自 [04 模块设计](04-module-design.md) 与 [08 测试与验收](08-testing-and-acceptance.md)：

- 广告加载失败返回失败状态，不扣除奖励机会之外的资源。
- 广告不可用时 UI 正确降级：隐藏或禁用入口，不显示报错弹窗，不阻塞结算流程。
- 广告相关的任何失败都不得终止游戏（[06 开发指南](06-development-guide.md) 第 62 行）。
- Web 构建没有 `wx` / `tt`，`AdService` 应返回 `unavailable`，入口隐藏。

## 8. 测试要求

照 [`tests/audio/HapticsService.test.ts`](../tests/audio/HapticsService.test.ts) 的方式，在 Node 环境注入桩对象覆盖：

- 微信路径、抖音路径、两者都不存在（Web）三种分支
- `isEnded` 为 `true` / `false` / 回调无参数三种结果
- `createRewardedVideoAd` 抛异常、`load()` reject、`show()` reject
- 同一 placement 重复 `show()` 不重复绑定 `onClose`
- 奖励只发放一次

## 9. 实施顺序

资质与流量主的审核周期很长（见 2.3），编码不必等它。拆成两段，前半段不依赖任何外部审核结果：

**第一阶段（现在就能做）**：`AdService` 接口 + `MockAdService` + 完整单元测试 + 环境配置骨架。这部分纯代码，无平台依赖。

**第二阶段（流量主开通后）**：填入真实广告位 ID、`PlatformAdService` 实现、ART-P05 弹窗 UI、两端真机验收。

与此并行的行政事项（不占用开发时间，但决定第二阶段何时能开始）：提交软著登记、完成小程序备案、申请流量主。三者都应在第一阶段编码期间同步推进。

## 10. 验收清单

- [ ] 软著已下证（抖音上架前置，见 2.1）
- [ ] 小程序备案已通过
- [ ] 微信、抖音流量主均已开通，广告位 ID 已录入环境配置
- [ ] `AdService` 单元测试覆盖第 8 节全部分支，全量测试通过
- [ ] 两端真机验证：完整观看发放奖励、提前关闭不发放、无网络时入口降级
- [ ] 确认结算加倍分数是否计入本地最高分（见 5.3）
- [ ] ART-P05 激励广告奖励弹窗已实装
- [ ] 广告位 ID 未硬编码在核心模块中
- [ ] 隐私政策与授权流程已补充（[03 技术架构](03-technical-architecture.md) 第 196 行要求广告启用前完成）

## 11. 参考

- [wx.createRewardedVideoAd - 微信官方文档](https://developers.weixin.qq.com/minigame/dev/api/ad/wx.createRewardedVideoAd.html)
- [2026 年微信小游戏广告变现激励政策](https://developers.weixin.qq.com/minigame/introduction/commercialization/guide/ad-monetization.html)
- [了解抖音小游戏 - 抖音开放平台](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/introduction)

资质相关：

- [计算机软件著作权登记办法 - 国家版权局](https://www.ncac.gov.cn/xxfb/flfg/bmgz/202410/P020241015604759788122.pdf)
- [财税〔2017〕20 号：停征软件著作权登记费 - 中国政府网](https://www.gov.cn/gongbao/content/2017/content_5227827.htm)
- [计算机软件著作权登记初审 - 北京市政务服务](http://banshi.beijing.gov.cn/pubtask/task/1/110000000000/3e283672-76be-4c8c-98e8-0bebe9bd06bf.html)
- [小游戏基础信息审核规范 - 抖音开放平台](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/operation1/norms/game-info-audit)

### 分成比例参考

微信侧数据来自上方官方文档链接，可信度高；**抖音侧仅有媒体与社区二手来源，官方文档未公布比例，签约前必须以后台协议为准**。

| 平台 | 广告分成 | 来源可信度 |
|---|---|---|
| 微信 | 激励政策：IAA 游戏可获 1–30 天广告流水 40%，或 1–180 天 35%（2026-08-20 起实施）。注意这是叠加在基础分成之上的买量场景激励，非基础流量主分成 | 官方文档 |
| 抖音 | 约 60%，加入抖音小游戏联盟后可达 60%–70% | 二手来源，待核实 |

政策变动频繁，实施时需重新核对。
