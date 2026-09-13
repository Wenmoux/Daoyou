# Daoyou - 修仙世界中的角色、资源与场景游戏

Hono + React SPA + Bun + PostgreSQL/Drizzle + Redis/NATS + Better Auth

<directory>
src/shared/ - 纯领域规则、共享类型与前后端契约
src/server/ - Hono API、服务层、持久化与基础设施
src/react-app/ - React 游戏场景、路由与交互组件
drizzle/ - wanjiedaoyou_* 业务迁移
docs/ - 设计与架构语义地图
</directory>
<config>
src/server/lib/drizzle/schema.ts - 业务数据模型
src/shared/types/constants.ts - 元素、品质、境界与材料类型
src/react-app/router.tsx - React Router 游戏场景注册
</config>

法则：共享规则先行·服务端守边界·状态写入可追溯·文档与代码同构

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

