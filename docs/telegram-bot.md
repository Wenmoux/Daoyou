# Telegram Bot 绑定与基础操作

> [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

## 启用

在 API 运行环境注入：

```env
TELEGRAM_BOT_TOKEN=从 BotFather 获取的 token
TELEGRAM_BOT_USERNAME=你的 bot 用户名
TELEGRAM_WEBHOOK_SECRET=随机生成的长字符串
TELEGRAM_WEBHOOK_URL=https://api.example.com/api/telegram/webhook
```

执行业务迁移 `0039_telegram_bindings.sql`（生产环境使用项目既有 Drizzle migrate 流程），重启 API 后使用 Telegram Bot API 的 `setWebhook`：

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H 'content-type: application/json' \
  -d "{\"url\":\"${TELEGRAM_WEBHOOK_URL}\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\"}"
```

Webhook 只接受 POST，并要求 `X-Telegram-Bot-Api-Secret-Token` 完全匹配。建议通过 HTTPS 反向代理暴露 API，不要把 Bot token 写入仓库或前端构建产物。

## 绑定流程

1. 登录游戏，打开“用户中心 → 账号设置 → Telegram Bot”。
2. 点击“生成绑定密钥”，复制显示的 `/bind <密钥>`。密钥只显示一次，10 分钟有效，生成新密钥会使旧密钥失效。
3. 在 Bot 私聊中发送该命令；群聊命令会被拒绝，避免绑定密钥或角色操作暴露。绑定成功后 Bot 只会使用当前账号的 active 角色。
4. 使用 `/unbind` 可立即解除绑定并关闭世界消息推送。

## 当前命令

`/me` 查询角色境界、年龄、修为、感悟和灵石；`/retreat [年数]` 调用现有闭关服务（1～200 年）；`/yield` 领取可领取收益；`/rank` 查询当前境界前十名；`/notify on|off` 开关系统世界消息推送；`/help` 查看帮助。

Bot 不直接写角色表，闭关和收益均复用服务层的 Redis 锁、幂等和资源校验。后续新增 `/fishing`、`/alchemy` 时，只需在 Telegram 命令编排层增加适配器并调用对应领域服务。
