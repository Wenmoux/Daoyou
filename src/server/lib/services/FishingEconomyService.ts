/**
 * [INPUT]: 活跃角色、鱼类材料背包与垂钓档案
 * [OUTPUT]: 鱼贸报价、鱼货积分兑换和限时垂钓增益
 * [POS]: 垂钓经济应用服务，所有资产变化经过角色锁、事务与幂等协调
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { fishingProfiles, materials } from '@server/lib/drizzle/schema';
import { playerCommandExecutor } from '@server/lib/services/CommandExecutors';
import { updateSpiritStones } from '@server/lib/services/cultivator/CultivatorStateRepository';
import { addMaterialStackToInventory } from '@server/lib/services/materialInventory';
import { FISH_SPECIES_BY_ID, FISHING_BUFF_COSTS, FISH_POINT_REWARDS, adjacentUpgradeCost, fishPointValue } from '@shared/engine/fishing';
import { QUALITY_ORDER, QUALITY_VALUES, type Quality } from '@shared/types/constants';
import { and, eq, sql } from 'drizzle-orm';

export type FishingEconomyActor = { userId: string; cultivatorId: string };
export class FishingEconomyError extends Error { constructor(message: string, readonly status: 400 | 401 | 404 | 409 = 400) { super(message); } }

function parseFish(row: typeof materials.$inferSelect) {
  const details = row.details as { speciesId?: unknown } | null;
  const speciesId = typeof details?.speciesId === 'string' ? details.speciesId : null;
  return row.type === 'fish' && speciesId && FISH_SPECIES_BY_ID[speciesId] ? { ...row, speciesId } : null;
}

async function readFish(actor: FishingEconomyActor, tx?: DbTransaction) {
  const rows = await getExecutor(tx).select().from(materials).where(and(eq(materials.cultivatorId, actor.cultivatorId), eq(materials.type, 'fish')));
  return rows.map(parseFish).filter((row): row is NonNullable<ReturnType<typeof parseFish>> => Boolean(row));
}

export async function getFishingEconomySnapshot(actor: FishingEconomyActor) {
  const q = getExecutor();
  const [profile] = await q.select({ fishPoints: fishingProfiles.fishPoints, fishingBuffs: fishingProfiles.fishingBuffs, merchantAvailableUntil: fishingProfiles.merchantAvailableUntil }).from(fishingProfiles).where(eq(fishingProfiles.cultivatorId, actor.cultivatorId)).limit(1);
  const fish = await readFish(actor);
  const inventory = fish.map((row) => ({ speciesId: row.speciesId, speciesName: row.name, quality: row.rank as Quality, quantity: row.quantity }));
  const offers: Array<Record<string, unknown>> = [];
  for (const stack of inventory) {
    const points = fishPointValue(stack.quality);
    const cost = adjacentUpgradeCost(stack.quality);
    const nextQuality = QUALITY_VALUES[QUALITY_ORDER[stack.quality] + 1];
    offers.push({ id: `points:${stack.speciesId}:${stack.quality}`, kind: 'points', speciesId: stack.speciesId, speciesName: stack.speciesName, quality: stack.quality, inputQuantity: 1, output: { points } });
    offers.push({ id: `stones:${stack.speciesId}:${stack.quality}`, kind: 'stones', speciesId: stack.speciesId, speciesName: stack.speciesName, quality: stack.quality, inputQuantity: 1, output: { spiritStones: Math.max(2, points * 3) } });
    if (cost && nextQuality) offers.push({ id: `upgrade:${stack.speciesId}:${stack.quality}`, kind: 'upgrade', speciesId: stack.speciesId, speciesName: stack.speciesName, quality: stack.quality, inputQuantity: cost, output: { quality: nextQuality } });
    if (QUALITY_ORDER[stack.quality] >= 1) offers.push({ id: `mission_legendary:${stack.speciesId}:${stack.quality}`, kind: 'mission_legendary', speciesId: stack.speciesId, speciesName: stack.speciesName, quality: stack.quality, inputQuantity: 8, output: { buff: 'legendary_rate', durationMinutes: 60 } });
    if (QUALITY_ORDER[stack.quality] >= 2) offers.push({ id: `mission_double:${stack.speciesId}:${stack.quality}`, kind: 'mission_double', speciesId: stack.speciesId, speciesName: stack.speciesName, quality: stack.quality, inputQuantity: 12, output: { buff: 'double_catch', durationMinutes: 60 } });
  }
  for (const [itemId, item] of Object.entries(FISH_POINT_REWARDS)) {
    offers.push({ id: `item:${itemId}`, kind: 'item', speciesId: '', quality: '', inputQuantity: item.cost, output: { item: item.name, quantity: item.quantity } });
  }
  const merchantAvailableUntil = profile?.merchantAvailableUntil?.toISOString() ?? null;
  return { merchantAvailable: Boolean(profile?.merchantAvailableUntil && profile.merchantAvailableUntil > new Date()), merchantAvailableUntil, points: profile?.fishPoints ?? 0, buffs: (profile?.fishingBuffs ?? []).filter((buff) => Date.parse(buff.expiresAt) > Date.now()), inventory, offers };
}

async function requireMerchant(tx: DbTransaction, actor: FishingEconomyActor) {
  const [profile] = await tx.select({ merchantAvailableUntil: fishingProfiles.merchantAvailableUntil }).from(fishingProfiles).where(eq(fishingProfiles.cultivatorId, actor.cultivatorId)).limit(1);
  if (!profile?.merchantAvailableUntil || profile.merchantAvailableUntil <= new Date()) throw new FishingEconomyError('鱼贸商人已离开，请等待下一次云游', 409);
}

async function consumeExactFish(tx: DbTransaction, actor: FishingEconomyActor, speciesId: string, quality: Quality, quantity: number) {
  const rows = await tx.select().from(materials).where(and(eq(materials.cultivatorId, actor.cultivatorId), eq(materials.type, 'fish'), eq(materials.rank, quality)));
  const candidates = rows.filter((row) => parseFish(row)?.speciesId === speciesId);
  const row = candidates.find((item) => item.quantity >= quantity);
  if (!row) throw new FishingEconomyError('指定鱼获数量不足', 409);
  if (row.quantity === quantity) await tx.delete(materials).where(eq(materials.id, row.id));
  else await tx.update(materials).set({ quantity: sql`${materials.quantity} - ${quantity}` }).where(eq(materials.id, row.id));
}

export async function tradeFishingOffer(actor: FishingEconomyActor, input: { offerId: string; quantity: number; requestId: string }) {
  const [kind, speciesId, qualityValue] = input.offerId.split(':');
  if (kind === 'item') {
    const reward = FISH_POINT_REWARDS[speciesId as keyof typeof FISH_POINT_REWARDS];
    if (!reward || input.quantity !== 1) throw new FishingEconomyError('offer not found', 404);
    return playerCommandExecutor.executeWithLock<unknown>({ userId: actor.userId, cultivatorId: actor.cultivatorId, source: 'fishing_economy_item', requestId: input.requestId, idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) }, command: async (tx) => {
      await requireMerchant(tx, actor);
      const [profile] = await tx.select().from(fishingProfiles).where(eq(fishingProfiles.cultivatorId, actor.cultivatorId)).limit(1);
      if (!profile || profile.fishPoints < reward.cost) throw new FishingEconomyError('鱼货积分不足', 409);
      const baitStock = { ...(profile.baitStock ?? {}) };
      baitStock[reward.baitId] = (baitStock[reward.baitId] ?? 0) + reward.quantity;
      await tx.update(fishingProfiles).set({ fishPoints: sql`${fishingProfiles.fishPoints} - ${reward.cost}`, baitStock }).where(eq(fishingProfiles.cultivatorId, actor.cultivatorId));
      return { result: { message: `兑换${reward.name}`, item: reward.name, quantity: reward.quantity }, resourceChanges: [{ resourceTopic: 'player.progress' as const, eventType: 'fishing.economy.item', operation: 'invalidate' as const }] };
    } });
  }
  const quality = qualityValue as Quality;
  if (!['points', 'stones', 'upgrade', 'mission_legendary', 'mission_double'].includes(kind ?? '')) throw new FishingEconomyError('offer not found', 404);
  const species = FISH_SPECIES_BY_ID[speciesId ?? ''];
  if (!species || !QUALITY_VALUES.includes(quality)) throw new FishingEconomyError('offer not found', 404);
  if (kind === 'upgrade' && (!adjacentUpgradeCost(quality) || !QUALITY_VALUES[QUALITY_ORDER[quality] + 1])) throw new FishingEconomyError('神品鱼获无法继续升阶', 409);
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 99) throw new FishingEconomyError('invalid quantity');
  return playerCommandExecutor.executeWithLock<unknown>({ userId: actor.userId, cultivatorId: actor.cultivatorId, source: 'fishing_economy_trade', requestId: input.requestId, idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) }, command: async (tx) => {
    await requireMerchant(tx, actor);
    if ((kind === 'mission_legendary' || kind === 'mission_double') && input.quantity !== 1) throw new FishingEconomyError('鱼贸委托每次只能完成一次', 409);
    const missionCost = kind === 'mission_double' ? 12 : 8;
    const amount = kind === 'upgrade' ? (adjacentUpgradeCost(quality) ?? 0) * input.quantity : kind.startsWith('mission_') ? missionCost : input.quantity;
    await consumeExactFish(tx, actor, species.id, quality, amount);
    const changes = [{ resourceTopic: 'inventory.materials' as const, eventType: 'inventory.fishing.trade', operation: 'invalidate' as const }];
    if (kind === 'points') {
      const points = fishPointValue(quality) * input.quantity;
      await tx.update(fishingProfiles).set({ fishPoints: sql`${fishingProfiles.fishPoints} + ${points}` }).where(eq(fishingProfiles.cultivatorId, actor.cultivatorId));
      return { result: { message: `鱼获兑换鱼货积分 +${points}`, points }, resourceChanges: changes };
    }
    if (kind === 'stones') {
      const spiritStones = Math.max(2, fishPointValue(quality) * 3) * input.quantity;
      await updateSpiritStones(actor.userId, actor.cultivatorId, spiritStones, tx);
      return { result: { message: `鱼获兑换灵石 +${spiritStones}`, spiritStones }, resourceChanges: [{ ...changes[0], resourceTopic: 'player.profile' as const }] };
    }
    if (kind === 'upgrade') {
      const nextQuality = QUALITY_VALUES[QUALITY_ORDER[quality] + 1] as Quality;
      await addMaterialStackToInventory(actor.cultivatorId, { name: species.name, type: 'fish', rank: nextQuality, element: species.element, description: species.description, details: { speciesId: species.id, tier: species.tier, traded: true }, quantity: input.quantity }, tx);
      return { result: { message: `upgrade x${input.quantity}`, quality: nextQuality }, resourceChanges: changes };
    }
    if (kind === 'mission_legendary' || kind === 'mission_double') {
      const [profile] = await tx.select().from(fishingProfiles).where(eq(fishingProfiles.cultivatorId, actor.cultivatorId)).limit(1);
      if (!profile) throw new FishingEconomyError('垂钓档案不存在', 404);
      const type = kind === 'mission_double' ? 'double_catch' : 'legendary_rate';
      const now = Date.now();
      const buffs = (profile.fishingBuffs ?? []).filter((buff) => Date.parse(buff.expiresAt) > now);
      if (buffs.some((buff) => buff.type === type)) throw new FishingEconomyError('同类鱼贸委托增益仍在生效', 409);
      buffs.push({ type, expiresAt: new Date(now + 60 * 60 * 1000).toISOString(), source: 'fish-merchant-mission' });
      await tx.update(fishingProfiles).set({ fishingBuffs: buffs }).where(eq(fishingProfiles.cultivatorId, actor.cultivatorId));
      return { result: { message: type === 'double_catch' ? '鱼贸委托完成：双倍鱼获生效一小时' : '鱼贸委托完成：珍稀鱼运生效一小时', buffs }, resourceChanges: changes };
    }
    throw new FishingEconomyError('未知鱼贸操作');
  } });
}

export async function redeemFishingBuff(actor: FishingEconomyActor, input: { type: 'legendary_rate' | 'double_catch'; cost?: number; requestId: string }) {
  const requiredCost = FISHING_BUFF_COSTS[input.type];
  if (input.cost !== undefined && input.cost !== requiredCost) throw new FishingEconomyError('该增益的鱼货积分价格已固定', 409);
  return playerCommandExecutor.executeWithLock<unknown>({ userId: actor.userId, cultivatorId: actor.cultivatorId, source: 'fishing_economy_buff', requestId: input.requestId, idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) }, command: async (tx) => {
    await requireMerchant(tx, actor);
    const [profile] = await tx.select().from(fishingProfiles).where(eq(fishingProfiles.cultivatorId, actor.cultivatorId)).limit(1);
    if (!profile || profile.fishPoints < requiredCost) throw new FishingEconomyError('鱼货积分不足', 409);
    const now = Date.now();
    const buffs = (profile.fishingBuffs ?? []).filter((buff) => Date.parse(buff.expiresAt) > now);
    buffs.push({ type: input.type, expiresAt: new Date(now + 60 * 60 * 1000).toISOString(), source: 'fish-merchant' });
    await tx.update(fishingProfiles).set({ fishPoints: sql`${fishingProfiles.fishPoints} - ${requiredCost}`, fishingBuffs: buffs }).where(eq(fishingProfiles.cultivatorId, actor.cultivatorId));
    return { result: { message: input.type === 'double_catch' ? 'double catch enabled' : 'legendary rate enabled', buffs }, resourceChanges: [{ resourceTopic: 'player.progress' as const, eventType: 'fishing.buff.redeemed', operation: 'invalidate' as const }] };
  } });
}
