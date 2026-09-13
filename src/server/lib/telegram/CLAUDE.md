# telegram/
> L2 | 父级: ../CLAUDE.md

Telegram 适配层将外部 Bot 更新转换为现有领域命令，并维护第三方绑定与通知偏好。传输、命令编排、绑定持久化和世界消息投递彼此分离，后续可按同一边界增加垂钓、炼丹等命令。

成员清单
binding.ts: 一次性绑定密钥、绑定关系、解绑、通知偏好和 webhook update 去重；密钥只保存哈希。
client.ts: Telegram Bot API 文本消息传输；不包含领域逻辑。
commands.ts: 私聊命令解析与现有闭关、收益、排行服务编排；不直接写角色数据。
worldPush.ts: 订阅系统世界消息并向开启通知的 active 绑定 best-effort 投递。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
