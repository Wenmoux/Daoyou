# 垂钓系统方案

## 核心闭环

地图选择水域 → 查看环境 → 选择鱼饵 → 抛竿 → 等待鱼讯 → 在服务端提竿窗口内提竿。

成功提竿后立即在同一玩家事务中结算鱼种、品质、重量、材料、图鉴、垂钓经验及一次性品阶奖励；过早提竿惊鱼，过晚提竿逃脱。

## 会话状态

`idle → cast → waiting_bite → biting → landed`，失败分支为 `escaped / timeout`。

接口：

- `POST /api/fishing/session`
- `POST /api/fishing/session/:id/strike`
- `GET /api/fishing/snapshot?mapNodeId=...`

服务端锁定咬钩时间、截止时间、鱼饵、环境快照和随机结果；客户端只提交“现在提竿”。

## 地图、环境与成长

地图节点负责水域入口；鱼饵改变鱼种权重；天气、时辰、月相、鱼潮与异象在抛竿时锁定；每日垂钓次数有限；鱼种与品质组合只发放一次修为和元素属性奖励；图鉴独立于垂钓页面。

[PROTOCOL]: 变更时更新此文档，然后检查代码与 CLAUDE.md
