# routes/api/
> L2 | 父级: ../../../CLAUDE.md

Hono API 路由边界。垂钓路由在此完成 active cultivator 鉴权、Zod 输入校验和服务层委托；不在路由中生成随机数或直接写数据库。

成员清单

fishing.router.ts: 垂钓快照、开始会话与提竿接口，复用 FishingService 和玩家状态变更响应。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
