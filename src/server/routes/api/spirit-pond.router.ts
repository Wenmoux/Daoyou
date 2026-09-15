/**
 * [INPUT]: 活跃角色、灵池请求契约与灵池服务
 * [OUTPUT]: 灵池查询、喂养、繁殖、开放、拜访与鱼苗集市接口
 * [POS]: `/api/spirit-pond` 的服务端授权边界
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { requireActiveCultivatorRef, redisLockErrorResponse } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { SpiritPondMarketError, buySpiritPondFryListing, cancelSpiritPondFryListing, createSpiritPondFryListing, listSpiritPondFryListings } from '@server/lib/services/SpiritPondMarketService';
import { SpiritPondServiceError, breedSpiritPond, feedSpiritPond, getSpiritPondSnapshot, listFriendSpiritPonds, transferSpiritPondFry, updateSpiritPondAccess, visitSpiritPond } from '@server/lib/services/SpiritPondService';
import { SpiritPondAccessRequestSchema, SpiritPondBreedRequestSchema, SpiritPondFeedRequestSchema, SpiritPondFryListingBuyRequestSchema, SpiritPondFryListingCancelRequestSchema, SpiritPondFryListingCreateRequestSchema, SpiritPondFryTransferRequestSchema, SpiritPondVisitRequestSchema } from '@shared/contracts/spiritPond';
import { Hono, type Context } from 'hono'; import { z } from 'zod';
const router = new Hono<AppEnv>(); router.use('*', requireActiveCultivatorRef());
function actor(c: Context<AppEnv>) { const ref = c.get('activeCultivatorRef'); const user = c.get('user'); if (!ref || !user) throw new SpiritPondServiceError('未授权访问', 401); return { userId: user.id, cultivatorId: ref.cultivatorId }; }
function fail(c: Context<AppEnv>, e: unknown) { const lock = redisLockErrorResponse(e); if (lock) return lock; if (e instanceof z.ZodError) return c.json({ success: false, error: e.issues[0]?.message ?? '参数错误' }, 400); if (e instanceof SpiritPondServiceError || e instanceof SpiritPondMarketError) return c.json({ success: false, error: e.message }, e.status); throw e; }
router.get('/', async c => { try { return c.json({ success: true, data: await getSpiritPondSnapshot(actor(c), c.req.query('ownerCultivatorId') ?? undefined) }); } catch (e) { return fail(c, e); } });
router.get('/friends', async c => { try { return c.json({ success: true, data: await listFriendSpiritPonds(actor(c)) }); } catch (e) { return fail(c, e); } });
router.get('/market', async c => { try { return c.json({ success: true, data: await listSpiritPondFryListings(actor(c)) }); } catch (e) { return fail(c, e); } });
router.post('/feed', async c => { try { return c.json(toPlayerStateMutationResponse(await feedSpiritPond(actor(c), SpiritPondFeedRequestSchema.parse(await c.req.json())))); } catch (e) { return fail(c, e); } });
router.post('/breed', async c => { try { const input = SpiritPondBreedRequestSchema.parse(await c.req.json()); return c.json(toPlayerStateMutationResponse(await breedSpiritPond(actor(c), input.requestId))); } catch (e) { return fail(c, e); } });
router.post('/access', async c => { try { return c.json(toPlayerStateMutationResponse(await updateSpiritPondAccess(actor(c), SpiritPondAccessRequestSchema.parse(await c.req.json())))); } catch (e) { return fail(c, e); } });
router.post('/visit', async c => { try { const input = SpiritPondVisitRequestSchema.parse(await c.req.json()); return c.json({ success: true, data: await visitSpiritPond(actor(c), input.ownerCultivatorId, input.requestId) }); } catch (e) { return fail(c, e); } });
router.post('/fry-transfer', async c => { try { const input = SpiritPondFryTransferRequestSchema.parse(await c.req.json()); return c.json(toPlayerStateMutationResponse(await transferSpiritPondFry(actor(c), input))); } catch (e) { return fail(c, e); } });
router.post('/market/list', async c => { try { const input = SpiritPondFryListingCreateRequestSchema.parse(await c.req.json()); return c.json(toPlayerStateMutationResponse(await createSpiritPondFryListing(actor(c), input))); } catch (e) { return fail(c, e); } });
router.post('/market/buy', async c => { try { const input = SpiritPondFryListingBuyRequestSchema.parse(await c.req.json()); return c.json(toPlayerStateMutationResponse(await buySpiritPondFryListing(actor(c), input))); } catch (e) { return fail(c, e); } });
router.post('/market/cancel', async c => { try { const input = SpiritPondFryListingCancelRequestSchema.parse(await c.req.json()); return c.json(toPlayerStateMutationResponse(await cancelSpiritPondFryListing(actor(c), input))); } catch (e) { return fail(c, e); } });
export default router;
