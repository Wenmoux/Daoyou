/**
 * [INPUT]: Telegram update 与现有修仙领域服务
 * [OUTPUT]: 可扩展的 Bot 命令注册表与统一执行入口
 * [POS]: Telegram 应用层；绑定、权限和业务命令在此编排，领域规则仍由服务层执行
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { and, eq } from 'drizzle-orm';
import { getExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { getRankingList } from '@server/lib/redis/rankings';
import { executeRetreatCommand } from '@server/lib/services/RetreatApplicationService';
import { executeYieldCommand } from '@server/lib/services/YieldApplicationService';
import { bindTelegramAccount, findTelegramBinding, revokeTelegramBinding, setTelegramWorldPush, touchTelegramBinding } from './binding';
import { sendTelegramMessage } from './client';

type TelegramMessage = { chat?: { id?: number; type?: string }; from?: { id?: number; username?: string }; text?: string };
type TelegramUpdate = { update_id?: number; message?: TelegramMessage };

const HELP = '可用命令：\n/bind <用户中心密钥> 绑定账号\n/unbind 解除绑定\n/me 查询角色信息\n/retreat [年数] 闭关（默认 1 年）\n/yield 领取修为\n/rank 查看炼气榜\n/notify on|off 世界消息推送';

async function activeCultivator(userId: string) {
  const [row] = await getExecutor().select().from(cultivators).where(and(eq(cultivators.userId, userId), eq(cultivators.status, 'active'))).limit(1);
  return row ?? null;
}

function formatCultivator(c: typeof cultivators.$inferSelect) {
  const progress = c.cultivation_progress && typeof c.cultivation_progress === 'object'
    ? c.cultivation_progress as { cultivation_exp?: number; exp_cap?: number; comprehension_insight?: number }
    : {};
  return `【${c.name}】\n境界：${c.realm}·${c.realm_stage}\n年龄：${c.age}/${c.lifespan}\n修为：${progress.cultivation_exp ?? 0}/${progress.exp_cap ?? 0}\n感悟：${progress.comprehension_insight ?? 0}\n灵石：${c.spirit_stones}`;
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message;
  const chatId = message?.chat?.id; const telegramUserId = message?.from?.id;
  if (!chatId || !telegramUserId || !message?.text) return;
  if (message.chat?.type && message.chat.type !== 'private') {
    await sendTelegramMessage(String(chatId), '为保护账号安全，请在 Bot 私聊中使用绑定和游戏命令。');
    return;
  }
  const [command, ...args] = message.text.trim().split(/\s+/);
  const name = command?.toLowerCase();
  if (name === '/start' || name === '/help') { await sendTelegramMessage(String(chatId), HELP); return; }
  if (name === '/bind') {
    if (!args[0]) { await sendTelegramMessage(String(chatId), '请先在用户中心生成密钥，再发送 /bind 密钥'); return; }
    try {
      const binding = await bindTelegramAccount({ token: args[0], telegramUserId: String(telegramUserId), telegramChatId: String(chatId), telegramUsername: message.from?.username });
      const c = binding ? await activeCultivator(binding.userId) : null;
      await sendTelegramMessage(String(chatId), c ? `绑定成功，当前角色：${c.name}` : '绑定成功，但当前账号暂无启用角色');
    } catch (error) { await sendTelegramMessage(String(chatId), error instanceof Error ? error.message : '绑定失败'); }
    return;
  }
  const binding = await findTelegramBinding(String(telegramUserId));
  if (!binding) { await sendTelegramMessage(String(chatId), '尚未绑定账号。请在用户中心生成密钥后发送 /bind 密钥'); return; }
  await touchTelegramBinding(binding.id);
  if (name === '/unbind') { await revokeTelegramBinding(binding.userId); await sendTelegramMessage(String(chatId), '已解除 Telegram 绑定'); return; }
  if (name === '/notify') {
    const enabled = args[0] === 'on'; if (!['on', 'off'].includes(args[0] ?? '')) { await sendTelegramMessage(String(chatId), '用法：/notify on 或 /notify off'); return; }
    await setTelegramWorldPush(binding.userId, enabled); await sendTelegramMessage(String(chatId), enabled ? '世界消息推送已开启' : '世界消息推送已关闭'); return;
  }
  const c = await activeCultivator(binding.userId);
  if (!c) { await sendTelegramMessage(String(chatId), '当前账号没有启用中的角色'); return; }
  try {
    if (name === '/me') { await sendTelegramMessage(String(chatId), formatCultivator(c)); return; }
    if (name === '/yield') {
      const { result } = await executeYieldCommand({ userId: binding.userId, cultivatorId: c.id });
      await sendTelegramMessage(String(chatId), `领取完成：修为 +${result.expGain}，感悟 +${result.insightGain}，灵石 +${result.amount}`);
      return;
    }
    if (name === '/retreat') {
      const years = Math.max(1, Math.min(200, Number(args[0] ?? 1) || 1));
      const execution = await executeRetreatCommand({ userId: binding.userId, cultivatorId: c.id, action: 'cultivate', years });
      const summary = execution.committed.result.summary as { exp_gained?: number; yearsSpent?: number };
      await sendTelegramMessage(String(chatId), `闭关 ${summary.yearsSpent ?? years} 年完成，修为 +${summary.exp_gained ?? '若干'}。`);
      return;
    }
    if (name === '/rank') { const rows = await getRankingList(c.realm as never); await sendTelegramMessage(String(chatId), rows.length ? rows.slice(0, 10).map((r) => `${r.rank}. ${r.name}（${r.realm}·${r.realm_stage}）`).join('\n') : '当前境界暂无排行数据'); return; }
    await sendTelegramMessage(String(chatId), HELP);
  } catch (error) { await sendTelegramMessage(String(chatId), error instanceof Error ? error.message : '操作失败，请稍后重试'); }
}
