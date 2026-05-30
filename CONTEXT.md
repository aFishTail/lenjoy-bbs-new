# Context

## Domain terms

- Post: 社区内容实体，包含普通帖、资源帖、悬赏帖。
- Resource trade: 资源帖购买后的交易过程，负责解锁隐藏内容和记账。
- Bounty post: 带悬赏金额与有效期的帖子。
- Bounty settlement: 悬赏帖从发布、冻结金额到采纳答案并完成结算的过程。
- Open publication: Open API client 通过保留系统发布用户写入 posts lifecycle 的发布流程。

## Domain rules

- Resource trade grants hidden-content access after a successful purchase.
- Bounty post funds must be frozen when the post is published.
- Bounty settlement pays the accepted answer from frozen funds, not from a fresh available-balance debit at accept time.
- Open publication preserves the submitted post fields after active client authentication and publishes through the reserved system user.
