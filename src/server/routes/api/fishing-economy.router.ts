/**
 * [INPUT]: 登录角色、鱼贸请求与垂钓经济服务
 * [OUTPUT]: 鱼贸快照、鱼获兑换和限时增益接口
 * [POS]: `/api/fishing-economy` 的认证边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { requireActiveCultivatorRef, redisLockErrorResponse } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { FishingEconomyError, getFishingEconomySnapshot, redeemFishingBuff, tradeFishingOffer } from '@server/lib/services/FishingEconomyService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { FishingBuffRequestSchema, FishingTradeRequestSchema } from '@shared/contracts/fishingEconomy';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
const router = new Hono<AppEnv>();
function actor(c: Context<AppEnv>) { const ref = c.get('activeCultivatorRef'); const user = c.get('user'); if (!ref || !user) throw new FishingEconomyError('未授权访问', 401); return { userId: user.id, cultivatorId: ref.cultivatorId }; }
function handleError(c: Context<AppEnv>, error: unknown) { const lock = redisLockErrorResponse(error); if (lock) return lock; if (error instanceof z.ZodError) return c.json({ success: false, error: error.issues[0]?.message ?? '参数错误' }, 400); if (error instanceof FishingEconomyError) return c.json({ success: false, error: error.message }, error.status); throw error; }
router.use('*', requireActiveCultivatorRef());
router.get('/', async (c) => { try { return c.json({ success: true, data: await getFishingEconomySnapshot(actor(c)) }); } catch (e) { return handleError(c, e); } });
router.post('/trade', async (c) => { try { const input = FishingTradeRequestSchema.parse(await c.req.json()); return c.json(toPlayerStateMutationResponse(await tradeFishingOffer(actor(c), input))); } catch (e) { return handleError(c, e); } });
router.post('/buff', async (c) => { try { const input = FishingBuffRequestSchema.parse(await c.req.json()); return c.json(toPlayerStateMutationResponse(await redeemFishingBuff(actor(c), input))); } catch (e) { return handleError(c, e); } });
export default router;
