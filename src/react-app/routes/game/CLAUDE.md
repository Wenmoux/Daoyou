# game/
> L2 | 父级: ../../CLAUDE.md

游戏场景页面层，负责把服务端快照编排成可操作的修仙场景；随机结算、权限与资源扣除留在服务端。

成员清单

fishing/route.tsx: 垂钓会话、鱼讯动画、提竿结算和地图水域入口。
fishing/codex/route.tsx: 独立鱼类图鉴页面。
fishing/merchant/route.tsx: 鱼贸商人状态、鱼获换积分/灵石/升阶与限时垂钓增益入口。
spirit-pond/route.tsx: 洞府灵池喂养槽、繁殖、开放权限、好友拜访和鱼苗集市入口。
map/route.tsx: 世界地图与节点选择，垂钓动作由地图节点驱动。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
