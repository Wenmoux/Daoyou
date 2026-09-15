# routes/api/
> L2 | 父级: ../../../CLAUDE.md

Hono API 路由边界。垂钓路由在此完成 active cultivator 鉴权、Zod 输入校验和服务层委托；不在路由中生成随机数或直接写数据库。

成员清单

fishing.router.ts: 垂钓快照、开始会话与提竿接口，复用 FishingService 和玩家状态变更响应。
fishing-economy.router.ts: 鱼贸交易、鱼货积分与限时垂钓增益接口，所有写操作委托经济服务。
spirit-pond.router.ts: 灵池喂养、繁殖、开放、好友访问与鱼苗集市接口，服务端验证角色关系和交易资产。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

Telegram 路由：`telegram.router.ts` 负责带 secret header 校验的 webhook；`account-telegram.router.ts` 负责登录用户的绑定密钥、状态查询和解绑。
