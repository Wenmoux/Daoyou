/**
 * [INPUT]: 已登录角色、垂钓服务与共享请求契约
 * [OUTPUT]: 提供垂钓快照、抛竿、提竿与鱼获结算 API
 * [POS]: `/api/fishing` 的认证边界，所有状态变更委托服务层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { requireActiveCultivatorRef, redisLockErrorResponse } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { FishingServiceError, getFishingSnapshot, startFishingSession, strikeFishingSession } from '@server/lib/services/FishingService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { FishingSessionRequestSchema, FishingStrikeRequestSchema } from '@shared/contracts/fishing';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();

function actor(c: Context<AppEnv>) {
  const ref = c.get('activeCultivatorRef');
  const user = c.get('user');
  if (!ref || !user) throw new FishingServiceError('未授权访问', 401);
  return { userId: user.id, cultivatorId: ref.cultivatorId };
}

router.get('/', requireActiveCultivatorRef(), async (c) => c.json({
  success: true,
  data: await getFishingSnapshot(actor(c), c.req.query('mapNodeId'), c.req.query('pondVisitId')),
}));

async function start(c: Context<AppEnv>) {
  try {
    const input = FishingSessionRequestSchema.parse(await c.req.json());
    return c.json(toPlayerStateMutationResponse(await startFishingSession(actor(c), input)));
  } catch (error) {
    const lockResponse = redisLockErrorResponse(error);
    if (lockResponse) return lockResponse;
    if (error instanceof z.ZodError) return c.json({ success: false, error: error.issues[0]?.message ?? '参数错误' }, 400);
    if (error instanceof FishingServiceError) return c.json({ success: false, error: error.message }, error.status);
    throw error;
  }
}

router.post('/session', requireActiveCultivatorRef(), start);
router.post('/cast', requireActiveCultivatorRef(), start);

router.post('/strike', requireActiveCultivatorRef(), async (c) => {
  try {
    const input = FishingStrikeRequestSchema.parse(await c.req.json());
    return c.json(toPlayerStateMutationResponse(await strikeFishingSession(actor(c), input)));
  } catch (error) {
    const lockResponse = redisLockErrorResponse(error);
    if (lockResponse) return lockResponse;
    if (error instanceof z.ZodError) return c.json({ success: false, error: error.issues[0]?.message ?? '参数错误' }, 400);
    if (error instanceof FishingServiceError) return c.json({ success: false, error: error.message }, error.status);
    throw error;
  }
});

export default router;
