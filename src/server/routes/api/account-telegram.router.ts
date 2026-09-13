/**
 * [INPUT]: 当前登录用户与绑定操作请求
 * [OUTPUT]: Telegram 绑定状态、一次性密钥生成与解绑 API
 * [POS]: 账号设置后端入口；密钥明文只在生成响应中出现一次
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { requireUser } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { createTelegramBindToken, getTelegramBinding, revokeTelegramBinding } from '@server/lib/telegram/binding';
import { Hono } from 'hono';
const router = new Hono<AppEnv>();
router.get('/', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ success: false, error: '未授权访问' }, 401);
  return c.json({ success: true, data: { binding: await getTelegramBinding(user.id) } });
});
router.post('/token', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ success: false, error: '未授权访问' }, 401);
  return c.json({ success: true, data: await createTelegramBindToken(user.id) });
});
router.delete('/', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ success: false, error: '未授权访问' }, 401);
  return c.json({ success: true, data: { binding: await revokeTelegramBinding(user.id) } });
});
export default router;
