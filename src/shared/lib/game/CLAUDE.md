# game/
> L2 | 父级: ../../CLAUDE.md

世界地图适配层。地图 JSON 是节点事实源，`mapSystem.ts` 只负责类型化查询与玩法配置解析；垂钓水域通过卫星节点的 `fishing_config` 暴露给地图动作和服务端校验。

成员清单

mapSystem.ts: 地图节点、卫星节点、宗门地标和副本/垂钓配置的查询适配器，并提供地图垂钓环境摘要。
mapSystem.test.ts: 地图配置、节点层级和垂钓入口约束的纯规则回归测试。
marketConfig.ts: 地图坊市区域配置与市场层级解析。
marketConfig.test.ts: 坊市配置纯规则回归测试。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
