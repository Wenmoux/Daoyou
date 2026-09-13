/**
 * [INPUT]: 世界消息广播与 Telegram 绑定偏好
 * [OUTPUT]: 面向开启通知用户的 best-effort 世界消息推送
 * [POS]: Telegram 推送适配器；失败不回滚游戏事务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { and, eq } from 'drizzle-orm';
import { getExecutor } from '@server/lib/drizzle/db';
import { telegramBindings } from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import { subscribeWorldChatMessages } from '@server/lib/services/worldChatBroadcaster';
import { sendTelegramMessage } from './client';

export function startTelegramWorldPush() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return () => undefined;
  return subscribeWorldChatMessages((message) => {
    void (async () => {
      if (message.channel !== 'system') return;
      const claimed = await redis.set(
        `telegram:world-push:${message.id}`,
        '1',
        'EX',
        24 * 60 * 60,
        'NX',
      );
      if (claimed !== 'OK') return;
      const rows = await getExecutor().select({ chatId: telegramBindings.telegramChatId })
        .from(telegramBindings).where(and(
          eq(telegramBindings.worldPushEnabled, true),
          eq(telegramBindings.status, 'active'),
        ));
      const payloadText =
        'text' in message.payload && typeof message.payload.text === 'string'
          ? message.payload.text
          : '';
      const text = `【世界消息】${message.textContent ?? payloadText}`.slice(0, 3900);
      for (let index = 0; index < rows.length; index += 20) {
        await Promise.allSettled(
          rows.slice(index, index + 20).map((row) =>
            sendTelegramMessage(row.chatId, text),
          ),
        );
      }
    })().catch((error) => console.warn('[telegram-world-push] failed', error));
  });
}
