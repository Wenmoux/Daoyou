# services/
> L2 | 父级: ../../../CLAUDE.md

服务层承载需要事务、锁与领域规则协作的玩家命令。

成员清单

FishingService.ts: 垂钓快照、持久化会话、鱼饵库存与提竿即结算，使用 playerCommandExecutor 保证锁、幂等与资源事件。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
