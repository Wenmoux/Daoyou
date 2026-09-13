# game/
> L2 | 父级: ../../CLAUDE.md

GameViewportLayout 下的主流程场景。路由页面组织当前任务，跨场景入口统一交给 game shell 或地图动作策略。

成员清单

fishing/route.tsx: 垂钓会话交互与图鉴展示，只提交抛竿和提竿动作，不在浏览器侧结算随机结果。
fishing/codex/route.tsx: 独立只读鱼图鉴页面，展示鱼种发现与品阶奖励进度。
map/route.tsx: 可缩放世界地图与节点选择，垂钓节点动作由 map/mapActions.ts 生成。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
