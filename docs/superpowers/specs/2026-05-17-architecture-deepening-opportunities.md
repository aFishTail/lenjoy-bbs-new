# 2026-05-17 Architecture Deepening Opportunities

## 背景

本次评估使用以下领域文档作为词汇来源：

- `README.md`
- `需求文档.md`
- `用户故事.md`

当前仓库中已补充 `CONTEXT.md`，但仍未建立 `docs/adr` 目录。

## 进展快照（2026-05-17）

- posts 相关写入/读取已经拆成 `lifecycle`、`resource_trade`、`bounty_settlement`、`read_service`、`engagement` 五个模块，旧的兼容 `service.py` 已删除。
- wallet 已从底层算术接口进一步收敛出 `asset_ledger.py`，当前已接住注册赠币、管理员调账、资源购买记账、悬赏冻结、悬赏结算。
- open_api 已从单个 `service.py` 拆成 `client_management`、`publication`，并进一步把 `client_auth` 与 `publisher_identity` 从发布编排中收口出来。
- 后端架构/回滚/runtime 测试已覆盖这些新的边界，当前 `uv run pytest -q` 结果为 `100 passed`。

## 当前建议排序

1. 前端 session/transport 收敛为 Session transport Module
2. 为 Asset ledger 补充退款/申诉重裁/悬赏退回等后续状态迁移
3. 视产品边界决定 Open publication 是否限制帖子类型与发布来源

## 候选 1：posts Module 拆深

### Status

已完成第一阶段，并且运行时代码已经不再依赖旧的 `posts.service` 兼容层。

### Files

- `apps/api/lenjoy_bbs/modules/posts/lifecycle.py`
- `apps/api/lenjoy_bbs/modules/posts/resource_trade.py`
- `apps/api/lenjoy_bbs/modules/posts/bounty_settlement.py`
- `apps/api/lenjoy_bbs/modules/posts/read_service.py`
- `apps/api/lenjoy_bbs/modules/posts/engagement.py`
- `apps/api/lenjoy_bbs/modules/posts/router.py`

### Problem

当前 posts Module 同时承载：

- 帖子创建、更新、删除
- 资源交易
- 悬赏结算
- 点赞/收藏互动
- 评论可见性与悬赏回答遮罩
- 浏览去重

这个 Interface 很 shallow：调用方和测试仍然要知道帖子类型分支、钱包副作用、消息副作用、采纳规则和读取遮罩规则。删除这个 Module 后，复杂度不会消失，只会重新分散到更多调用方，说明它没有形成足够的 Depth。

### Solution

围绕领域概念拆出更 deep 的 Module：

- Post lifecycle Module
- Resource trade Module
- Bounty settlement Module
- Post read Module

wallet、message、view dedupe 等 Adapter 放在这些 Module 的 Implementation 后面，而不是暴露在外部 Interface 上。

### Benefits

- 更强的 Locality：资源购买和悬赏结算规则集中
- 更高的 Leverage：调用方直接表达领域动作，而不是自己编排副作用
- 更好的可测性：Interface 成为测试面，不再依赖跨文件拼装

### Result

- posts router 已直接依赖拆出的深模块，而不是再透传到巨大的统一入口。
- `Post read Module` 已由 `read_service.py` 实际承接。
- `wallet` 副作用已进一步下沉到 `asset_ledger.py`，posts 模块只保留帖子领域决策与消息副作用。

## 候选 2：wallet Module deepen 成 Asset ledger Module

### Status

已完成第一阶段，当前是后端资产规则的主 Seam。

### Files

- `apps/api/lenjoy_bbs/modules/wallet/service.py`
- `apps/api/lenjoy_bbs/modules/wallet/asset_ledger.py`
- `apps/api/lenjoy_bbs/modules/auth/service.py`
- `apps/api/lenjoy_bbs/modules/posts/lifecycle.py`
- `apps/api/lenjoy_bbs/modules/posts/resource_trade.py`
- `apps/api/lenjoy_bbs/modules/posts/bounty_settlement.py`
- `apps/api/lenjoy_bbs/modules/admin/wallet/service.py`

### Problem

wallet Module 当前更像一个算术 Adapter：负责余额加减和流水写入，但真正的资产规则分散在 auth、posts、admin 中。结果是 Locality 很差，任何资产规则调整都要跨多个 Module 搜索和同步修改。

### Solution

将其 deepen 为 Asset ledger Module，对外 Interface 直接表达：

- 注册发币
- 资源购买扣币/入账
- 悬赏冻结/结算/退回
- 管理员调账

### Benefits

- 资产一致性规则集中
- 幂等和审计更容易收敛
- US-B04 可直接通过 Interface 编写行为测试

### Result

- `grant_registration_gift`
- `apply_admin_adjustment`
- `reserve_bounty_funds`
- `settle_bounty_reward`
- `settle_resource_purchase`

这些高层动作已经落在 `asset_ledger.py`，而 `wallet.service.py` 正在退回为更纯粹的底层钱包原语实现。

## 候选 3：帖子读取链路收敛为 Post read Module

### Status

基本完成第一阶段。

### Files

- `apps/api/lenjoy_bbs/modules/posts/read_service.py`
- `apps/api/lenjoy_bbs/modules/posts/router.py`
- `apps/api/lenjoy_bbs/modules/posts/repository.py`
- `apps/api/lenjoy_bbs/modules/posts/presenters.py`
- `apps/web/app/posts/[postId]/page.tsx`

### Problem

列表和详情读取需要跨 repository、presenters、router 拼接 usernames、stats、tags、viewer state 和悬赏可见性。读取装配逻辑没有被一个 deep Module 真正拥有。

### Solution

形成一个 Post read Module，对外 Interface 收敛为：

- list feed
- read detail
- read comments for viewer

### Benefits

- 读取装配规则集中
- 前端调用更简单
- 可见性规则修改影响面更小

### Result

列表、详情、我的帖子、评论读取已经通过 `read_service.py` 收敛，当前剩余工作主要是继续观察 admin/offline 等特殊状态是否需要进一步收敛读取策略。

## 候选 4：前端 session/transport 收敛为 Session transport Module

### Status

尚未开始，是当前最值得继续推进的候选。

### Files

- `apps/web/lib/server-api.ts`
- `apps/web/actions/auth.ts`
- `apps/web/components/post/client-helpers.ts`
- `apps/web/components/providers/auth-provider.tsx`
- `apps/web/app/layout.tsx`

### Problem

auth 归一化、cookie 策略、请求头构造、旧响应兼容、跨标签页同步散落在多个 shallow Module 中，导致 Interface 外泄。

### Solution

收敛成 Session transport Module，对外只暴露：

- read session
- write session
- clear session
- build authenticated request
- normalize backend envelope

### Benefits

- auth 逻辑有更强 Locality
- 页面和组件有更高 Leverage
- 测试不再横跨 action、provider、helper

## 候选 5：open publication 收敛为 Open publication Module

### Status

已完成第一阶段，并继续把内部规则拆深了一层。

### Files

- `apps/api/lenjoy_bbs/modules/open_api/client_management.py`
- `apps/api/lenjoy_bbs/modules/open_api/publication.py`
- `apps/api/lenjoy_bbs/modules/open_api/client_auth.py`
- `apps/api/lenjoy_bbs/modules/open_api/publisher_identity.py`
- `apps/api/lenjoy_bbs/modules/open_api/router.py`
- `apps/api/lenjoy_bbs/modules/posts/lifecycle.py`

### Problem

开放发布依赖保留系统用户、client key 校验和通用发帖流程，但这些规则没有由一个 deep Module 统一拥有，当前 Seam 偏薄。

### Solution

形成 Open publication Module，对外 Interface 聚焦：

- manage client
- publish as client

### Benefits

- 开放发布规则集中
- 后续扩展 account binding 或机器发帖更容易演进
- 测试更能贴近开放平台行为

### Result

- client 管理与代发帖不再混在同一个浅层 service 中。
- `publication.py` 当前只负责编排发布流程；`client_auth.py` 负责激活 client 校验；`publisher_identity.py` 负责保留系统用户解析。
- open_api 已直接复用 posts lifecycle，而不是依赖旧的 posts 兼容层。
