# 2026-05-17 Posts Module Deepening Design

## 目标

把当前过宽的 posts Module deepen 成更少泄漏领域复杂度的 Module 组合，提高 Locality 和 Leverage，并让 Interface 成为稳定测试面。

## 实施状态（截至 2026-05-17）

这份设计已经完成第一阶段落地：

- `lifecycle.py` 承接创建、更新、删除和发布时悬赏冻结。
- `resource_trade.py` 承接资源帖购买资格、交易记录与消息副作用。
- `bounty_settlement.py` 承接采纳答案、状态迁移与消息副作用。
- `read_service.py` 承接 feed/detail/comments/my-posts 的读取装配。
- `engagement.py` 承接评论、点赞、收藏、浏览去重。
- 旧的 `posts.service` 兼容层已删除。
- wallet 副作用已继续下沉到 `wallet/asset_ledger.py`，posts 模块不再直接持有大部分钱包原语编排。
- 当前后端测试结果为 `100 passed`。

## 当前 Problem Space

### 现在这个 Module 同时承担的职责

- Post lifecycle：创建、更新、删除
- Resource trade：购买资源帖、生成交易、副作用通知
- Bounty settlement：采纳答案、结算赏金、状态迁移
- Interaction：点赞、收藏
- View counting：浏览去重与计数
- Post read shaping：详情、评论、viewer state、悬赏回答可见性

### 直接摩擦点

1. 一个调用路径要跨 router、repository、presenters、service 才能看完整业务。
2. `purchase_post` 和 `accept_bounty_answer` 都在 posts Module 内直接编排 wallet 和 message 副作用，说明资源交易与悬赏结算并没有自己的 Seam。
3. 悬赏回答的可见性规则落在 presenters 中，读取规则和结算规则分离，导致同一领域概念没有 Locality。
4. admin posts 和 open_api 都在复用 posts 写流程，但它们的领域约束不同，当前 Interface 对这些差异没有建模。

## 依赖分类

### In-process

- 帖子类型判断
- 悬赏状态迁移
- 评论可接受性判断
- 资源帖购买资格判断

这些都适合直接收进 deep Module 的 Implementation。

### Local-substitutable

- SQLAlchemy + Postgres/SQLite
- Redis view dedupe

这些依赖可以通过现有本地测试替身或 SQLite 方式测试，不需要为了外部 Interface 再额外引入 port。

### 现有 Adapter

- wallet Adapter：`asset_ledger` 高层动作 + `wallet.service` 底层原语
- message Adapter：`create_site_message`
- view dedupe Adapter：`PostViewStore`

其中 wallet 当前已经进一步被 `asset_ledger.py` 吸收为更高层的资产动作 Interface；message 和 view dedupe 仍然保持为 posts 领域可见的 Adapter。

## 设计约束

新 Interface 至少要满足下面这些约束：

1. 资源交易和悬赏结算必须是显式领域动作，而不是 posts Module 的分支。
2. 读取侧的悬赏可见性规则不能继续散落在 presenters 与写入逻辑之间。
3. 不要为了抽象而抽象。只有当新的 Seam 能提升 Locality 和测试面时才成立。
4. router 不应该继续手工装配 feed/detail/comments 的读模型。
5. admin 和 open_api 的特殊写入入口，应该复用清晰的领域 Module，而不是共享一个巨大的浅层入口。

## 粗略 Interface 草图

以下只是用于固定约束的示意，不是最终方案：

```python
class PostLifecycleModule:
    async def publish_post(self, draft, actor_id) -> Post
    async def revise_post(self, post_id, patch, actor_id) -> Post
    async def remove_post(self, post_id, actor_id) -> None

class ResourceTradeModule:
    async def purchase_resource(self, post_id, buyer_id) -> ResourcePurchase

class BountySettlementModule:
    async def accept_answer(self, post_id, comment_id, actor_id) -> PostComment
    async def read_answers_for_viewer(self, post_id, viewer_id) -> list[CommentView]

class PostReadModule:
    async def list_feed(self, query, viewer_id=None) -> FeedPage
    async def read_detail(self, post_id, viewer_id=None) -> PostView
```

这个草图表达的不是最终类名，而是目标：把领域动作和读模型装配从当前 posts Module 的宽 Interface 中切出来。

## 初步判断

### 建议的主 Seam

第一步最值得建立的主 Seam 不是“再切一个 application 层”，而是先把 posts Module 内部最重的两个领域动作独立出来：

- Resource trade Module
- Bounty settlement Module

理由：

- 它们已经拥有自己的状态机和副作用编排
- 它们最符合 deletion test
- 它们比“先拆 create/update/delete”更能立刻提升 Locality

### 建议的拆分顺序

1. 先抽出 Resource trade Module
2. 再抽出 Bounty settlement Module
3. 然后收敛 Post read Module
4. 最后把剩余 posts Module 缩成真正的 Post lifecycle Module

这个顺序的原因是：前两者的业务规则最浓、测试价值最高，也最容易形成 deep Interface。

## 已确认与待确认的问题

1. 已确认：悬赏发布时冻结，采纳时从冻结余额结算；这一点已落地，并写入 `CONTEXT.md`。
2. 仍待确认：资源交易是否未来会出现退款、申诉重裁、卖家扣回；如果会，`ResourceTradeModule` 和 `asset_ledger` 需要补状态迁移。
3. 仍待确认：管理员下架资源帖或悬赏帖后，读取可见性规则是否要受影响；这决定 `PostReadModule` 和交易/结算 Module 的关系边界。
4. 当前事实：open_api 发布链路已经独立成专门模块，并且现有实现会保留资源帖字段；是否限制帖子类型仍是产品决策，而不是当前技术限制。

## Alternative Interfaces

### 方案 A：极小 Interface

- `PostLifecycleModule.write(command)`
- `PostSettlementModule.settle(command)`
- `PostReadModule.read(query)`

优点：Interface 最小，Depth 很高，router 非常薄。

缺点：`write(command)` 和 `settle(command)` 会吞掉太多不同领域动作，如果后续资源交易和悬赏结算继续增长，命令分支会再次变宽。

### 方案 B：按领域动作拆成四个 Module

- `PostLifecycleModule`
- `ResourceTradeModule`
- `BountySettlementModule`
- `PostReadModule`

优点：Locality 最好。资源交易和悬赏结算各自拥有自己的 Interface、状态迁移和副作用编排，最符合 deletion test。

缺点：Interface 比方案 A 稍宽，需要多一个 Module 名称让调用方学习。

### 方案 C：按调用方优化

- `posts.read.*`
- `posts.workflow.*`
- `posts.lifecycle.*`
- `posts.admin.*`

优点：对 router 和前端调用最友好，默认调用路径很短。

缺点：`workflow` 这个 Module 名称不够贴近领域概念，长期容易再次变 shallow。

### 方案 D：以 ports/adapters 收口副作用

保留方案 B 的主体，同时明确：

- wallet 是 Adapter
- site message 是 Adapter
- view dedupe 是 Adapter

而 repository / ORM 仍然留在 Implementation 内部，不新增假想 Seam。

优点：Seam 更克制，不会为了抽象而抽象。

缺点：如果未来 wallet 或 message 需要多 Adapter 形态，再补公共 port 会产生一次额外迁移。

## Recommendation

我建议采用方案 B + 方案 D 的组合：

- `PostLifecycleModule`
- `ResourceTradeModule`
- `BountySettlementModule`
- `PostReadModule`

并且只把下面三个依赖视为真实 Adapter：

- wallet
- site message
- view dedupe

原因：

1. `purchase_post` 和 `accept_bounty_answer` 已经证明资源交易和悬赏结算是两个真实存在的领域 Module，而不是 posts Module 里的普通分支。
2. 悬赏回答可见性目前在 presenters，悬赏结算目前在 service，这正是同一概念缺乏 Locality 的典型信号。`BountySettlementModule` 应该同时拥有结算规则和读取可见性规则。
3. `PostReadModule` 值得单独成立，因为 router 当前在手工装配 feed/detail/comments 的读模型，这说明现有 Seam 不够 deep。
4. `PostLifecycleModule` 先保持克制，只接住创建、更新、删除、上下架和发布来源规则，不把资源交易和悬赏结算继续塞回去。

## 实施后的模块边界

- `PostLifecycleModule` 对应 `apps/api/lenjoy_bbs/modules/posts/lifecycle.py`
- `ResourceTradeModule` 对应 `apps/api/lenjoy_bbs/modules/posts/resource_trade.py`
- `BountySettlementModule` 对应 `apps/api/lenjoy_bbs/modules/posts/bounty_settlement.py`
- `PostReadModule` 对应 `apps/api/lenjoy_bbs/modules/posts/read_service.py`
- `Interaction + View counting` 对应 `apps/api/lenjoy_bbs/modules/posts/engagement.py`
- `Asset ledger Adapter` 对应 `apps/api/lenjoy_bbs/modules/wallet/asset_ledger.py`
- `Open publication` 已通过 `apps/api/lenjoy_bbs/modules/open_api/publication.py` 复用 lifecycle，而不是共享旧的大入口

## First Refactor Cut

第一刀已经按原计划落地，并且后续继续完成了剩余几刀。

已完成的顺序如下：

1. 抽出 `ResourceTradeModule`
2. 抽出 `BountySettlementModule`
3. 收敛 `PostReadModule`
4. 收敛 `engagement.py`
5. 删除旧的 `posts.service` 兼容层
6. 把 wallet 副作用继续下沉到 `asset_ledger.py`

这说明最初的拆分顺序判断是正确的：先处理最重的领域动作，能够最快形成稳定的深模块，再把剩余的 posts 能力收敛回更清晰的边界。
