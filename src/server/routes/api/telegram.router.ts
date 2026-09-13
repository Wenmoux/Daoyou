/**
 * [INPUT]: Telegram webhook 请求与 Bot 更新
 * [OUTPUT]: 安全校验后的 Telegram 更新处理入口
 * [POS]: API 传输适配层；不直接访问游戏数据库或绕过命令注册表
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { AppEnv } from '@server/lib/hono/types';
import { handleTelegramUpdate } from '@server/lib/telegram/commands';
import { claimTelegramUpdate } from '@server/lib/telegram/binding';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();
router.post('/webhook', async (c) => {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return c.json({ success: false, error: 'Telegram webhook 未配置' }, 503);
  if (c.req.header('x-telegram-bot-api-secret-token') !== expected) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const update = await c.req.json();
  if (typeof update?.update_id === 'number' && !(await claimTelegramUpdate(update.update_id))) {
    return c.json({ ok: true, duplicate: true });
  }
  void handleTelegramUpdate(update).catch((error) => console.error('[telegram] update failed', error));
  return c.json({ ok: true });
});
export default router;
