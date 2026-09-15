# services/
> L2 | 父级: ../../../CLAUDE.md

服务层承载需要事务、锁与领域规则协作的玩家命令。路由只负责认证和输入契约，资源变更必须经服务层完成并发布统一失效事件。

成员清单

FishingService.ts: 垂钓快照、持久化会话、鱼获库存与提竿结算，使用角色锁和请求幂等保证状态机一致。
FishingEconomyService.ts: 鱼获兑换鱼货积分、灵石、相邻品阶升阶与限时垂钓增益，复用材料库存和灵石服务。
SpiritPondService.ts: 洞府灵池初始化、两槽喂养、鱼苗繁殖、好友访问权限与限时垂钓票据，服务端验证鱼获和好友关系。
SpiritPondMarketService.ts: 鱼苗挂牌托管、成交结算、撤单回池和公开行情，所有灵石与鱼苗转移在角色锁内完成。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

Telegram 适配层位于 ../telegram/：binding 管理密钥和绑定关系，commands 编排领域服务，worldPush 负责系统消息订阅，client 负责 Bot API 传输。
