/**
 * [INPUT]: 用户 ID、Telegram 更新中的账号信息与数据库执行器
 * [OUTPUT]: 绑定密钥生成、Telegram 绑定解析、解绑和通知偏好管理
 * [POS]: Telegram 适配层的持久化边界；不承载 Bot 命令业务规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { getExecutor } from '@server/lib/drizzle/db';
import { telegramBindTokens, telegramBindings, telegramUpdates } from '@server/lib/drizzle/schema';

const TOKEN_TTL_MS = 10 * 60 * 1000;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createTelegramBindToken(userId: string) {
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await getExecutor().transaction(async (tx) => {
    await tx.delete(telegramBindTokens).where(and(
      eq(telegramBindTokens.userId, userId),
      isNull(telegramBindTokens.usedAt),
    ));
    await tx.insert(telegramBindTokens).values({ userId, tokenHash: hashToken(token), expiresAt });
  });
  return { token, expiresAt };
}

export async function getTelegramBinding(userId: string) {
  const [row] = await getExecutor().select().from(telegramBindings)
    .where(and(eq(telegramBindings.userId, userId), eq(telegramBindings.status, 'active'))).limit(1);
  return row ?? null;
}

export async function bindTelegramAccount(args: {
  token: string; telegramUserId: string; telegramChatId: string; telegramUsername?: string | null;
}) {
  const now = new Date();
  return getExecutor().transaction(async (tx) => {
    const [candidate] = await tx.select().from(telegramBindTokens).where(and(
      eq(telegramBindTokens.tokenHash, hashToken(args.token)),
      isNull(telegramBindTokens.usedAt),
    )).limit(1);
    if (!candidate || candidate.expiresAt.getTime() <= now.getTime()) throw new Error('绑定密钥无效或已过期');
    const [existingTelegram] = await tx.select().from(telegramBindings).where(eq(telegramBindings.telegramUserId, args.telegramUserId)).limit(1);
    if (existingTelegram && existingTelegram.userId !== candidate.userId) throw new Error('该 Telegram 已绑定其他账号');
    const consumed = await tx.update(telegramBindTokens).set({ usedAt: now }).where(and(
      eq(telegramBindTokens.id, candidate.id),
      isNull(telegramBindTokens.usedAt),
    )).returning({ id: telegramBindTokens.id });
    if (consumed.length === 0) throw new Error('绑定密钥已被使用');
    // 先清理旧的 active/revoked 记录，保证解绑后可以再次绑定同一个 Telegram。
    await tx.delete(telegramBindings).where(eq(telegramBindings.userId, candidate.userId));
    const [binding] = await tx.insert(telegramBindings).values({
      userId: candidate.userId, telegramUserId: args.telegramUserId, telegramChatId: args.telegramChatId,
      telegramUsername: args.telegramUsername ?? null, status: 'active', boundAt: now, lastSeenAt: now,
    }).returning();
    return binding;
  });
}

export async function findTelegramBinding(telegramUserId: string) {
  const [row] = await getExecutor().select().from(telegramBindings).where(and(
    eq(telegramBindings.telegramUserId, telegramUserId), eq(telegramBindings.status, 'active'),
  )).limit(1);
  return row ?? null;
}

export async function touchTelegramBinding(bindingId: string) {
  await getExecutor().update(telegramBindings).set({ lastSeenAt: new Date() })
    .where(and(eq(telegramBindings.id, bindingId), eq(telegramBindings.status, 'active')));
}

export async function revokeTelegramBinding(userId: string) {
  const [row] = await getExecutor().update(telegramBindings).set({ status: 'revoked', revokedAt: new Date(), worldPushEnabled: false })
    .where(and(eq(telegramBindings.userId, userId), eq(telegramBindings.status, 'active'))).returning();
  return row ?? null;
}

export async function claimTelegramUpdate(updateId: number) {
  if (!Number.isSafeInteger(updateId) || updateId < 0) return true;
  const inserted = await getExecutor().insert(telegramUpdates).values({ updateId })
    .onConflictDoNothing({ target: telegramUpdates.updateId })
    .returning({ updateId: telegramUpdates.updateId });
  // 清理旧 update，避免长期运行后表无限增长；失败不影响当前命令。
  void getExecutor().delete(telegramUpdates)
    .where(lt(telegramUpdates.receivedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
    .catch(() => undefined);
  return inserted.length > 0;
}

export async function setTelegramWorldPush(userId: string, enabled: boolean) {
  const [row] = await getExecutor().update(telegramBindings).set({ worldPushEnabled: enabled, updatedAt: new Date() })
    .where(and(eq(telegramBindings.userId, userId), eq(telegramBindings.status, 'active'))).returning();
  return row ?? null;
}
