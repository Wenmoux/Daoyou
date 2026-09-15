/**
 * [INPUT]: 活跃角色、鱼获材料、好友关系与灵池表
 * [OUTPUT]: 灵池喂养、周期繁殖、访问权限和短期访问票据
 * [POS]: 洞府灵池应用服务；鱼苗不直接伪造成鱼，好友授权只在服务端判定
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { cultivators, materials, spiritPondSlots, spiritPondVisits, spiritPonds } from '@server/lib/drizzle/schema';
import { areFriends, listFriends } from '@server/lib/services/FriendService';
import { playerCommandExecutor } from '@server/lib/services/CommandExecutors';
import { updateSpiritStones } from '@server/lib/services/cultivator/CultivatorStateRepository';
import { POND_DOMESTICATION_BY_QUALITY, POND_MAX_DOMESTICATION, nextPondStage, normalizeFishQualityCounts, pondProbability } from '@shared/engine/fishing';
import { QUALITY_ORDER, QUALITY_VALUES, type Quality } from '@shared/types/constants';
import { FISH_SPECIES_BY_ID } from '@shared/engine/fishing/catalog';
import { and, asc, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';

export type SpiritPondActor = { userId: string; cultivatorId: string };
export class SpiritPondServiceError extends Error { constructor(message: string, readonly status: 400 | 401 | 403 | 404 | 409 = 400) { super(message); } }

function addQualityCounts(counts: Record<string, number>, quality: string, quantity: number) {
  return { ...counts, [quality]: (counts[quality] ?? 0) + quantity };
}

function transferQualityCounts(source: Record<string, number>, target: Record<string, number>, quantity: number) {
  let remaining = quantity;
  const nextSource = { ...source };
  const nextTarget = { ...target };
  for (const quality of QUALITY_VALUES) {
    if (remaining <= 0) break;
    const moved = Math.min(remaining, nextSource[quality] ?? 0);
    if (!moved) continue;
    nextSource[quality] = (nextSource[quality] ?? 0) - moved;
    nextTarget[quality] = (nextTarget[quality] ?? 0) + moved;
    remaining -= moved;
  }
  return { source: nextSource, target: nextTarget, moved: quantity - remaining };
}

function pickQuality(counts: Record<string, number>): Quality {
  const total = QUALITY_VALUES.reduce((sum, quality) => sum + (counts[quality] ?? 0), 0);
  if (total <= 0) return '凡品';
  let cursor = randomInt(0, total);
  for (const quality of QUALITY_VALUES) {
    cursor -= counts[quality] ?? 0;
    if (cursor < 0) return quality;
  }
  return '凡品';
}

async function loadOwner(actor: SpiritPondActor, tx?: DbTransaction) {
  const q = getExecutor(tx);
  const [row] = await q.select({ id: cultivators.id }).from(cultivators).where(and(eq(cultivators.id, actor.cultivatorId), eq(cultivators.userId, actor.userId), eq(cultivators.status, 'active'))).limit(1);
  if (!row) throw new SpiritPondServiceError('当前没有可用的活跃角色', 404);
}

export async function ensureSpiritPond(cultivatorId: string, tx?: DbTransaction) {
  const q = getExecutor(tx);
  const [existing] = await q.select().from(spiritPonds).where(eq(spiritPonds.ownerCultivatorId, cultivatorId)).limit(1);
  if (existing) return existing;
  const [created] = await q.insert(spiritPonds).values({ ownerCultivatorId: cultivatorId }).onConflictDoNothing({ target: spiritPonds.ownerCultivatorId }).returning();
  if (!created) {
    const [raced] = await q.select().from(spiritPonds).where(eq(spiritPonds.ownerCultivatorId, cultivatorId)).limit(1);
    if (raced) return raced;
  }
  if (!created) throw new SpiritPondServiceError('灵池初始化失败');
  return created;
}

async function consumeFishQuality(tx: DbTransaction, actor: SpiritPondActor, speciesId: string, quality: string, quantity: number) {
  const rows = await tx.select().from(materials).where(and(eq(materials.cultivatorId, actor.cultivatorId), eq(materials.type, 'fish'), eq(materials.rank, quality)));
  const row = rows.find((item) => (item.details as { speciesId?: unknown } | null)?.speciesId === speciesId && item.quantity >= quantity);
  if (!row) throw new SpiritPondServiceError('指定品质的鱼获数量不足', 409);
  if (row.quantity === quantity) await tx.delete(materials).where(eq(materials.id, row.id));
  else await tx.update(materials).set({ quantity: sql`${materials.quantity} - ${quantity}` }).where(eq(materials.id, row.id));
}

export async function getSpiritPondSnapshot(actor: SpiritPondActor, ownerCultivatorId = actor.cultivatorId) {
  await loadOwner(actor);
  const pond = ownerCultivatorId === actor.cultivatorId
    ? await ensureSpiritPond(ownerCultivatorId)
    : await (async () => {
        if (!(await areFriends(actor.cultivatorId, ownerCultivatorId))) {
          throw new SpiritPondServiceError('只有好友才能查看这座灵池', 403);
        }
        const [friendPond] = await getExecutor().select().from(spiritPonds).where(eq(spiritPonds.ownerCultivatorId, ownerCultivatorId)).limit(1);
        if (!friendPond || friendPond.accessMode === 'private') {
          throw new SpiritPondServiceError('这座灵池尚未开放', 403);
        }
        return friendPond;
      })();
  const slots = await getExecutor().select().from(spiritPondSlots).where(eq(spiritPondSlots.pondId, pond.id)).orderBy(asc(spiritPondSlots.slot));
  const [owner] = await getExecutor().select({ name: cultivators.name }).from(cultivators).where(eq(cultivators.id, ownerCultivatorId)).limit(1);
  const fishRows = ownerCultivatorId === actor.cultivatorId
    ? await getExecutor().select().from(materials).where(and(eq(materials.cultivatorId, actor.cultivatorId), eq(materials.type, 'fish')))
    : [];
  const inventory = fishRows.map((row) => ({ speciesId: (row.details as { speciesId?: unknown } | null)?.speciesId, speciesName: row.name, quality: row.rank, quantity: row.quantity })).filter((item): item is { speciesId: string; speciesName: string; quality: string; quantity: number } => typeof item.speciesId === 'string');
  return { pond: { id: pond.id, ownerCultivatorId, isOwner: ownerCultivatorId === actor.cultivatorId, ownerName: owner?.name ?? '道友', accessMode: pond.accessMode, entryFee: pond.entryFee, nextBreedAt: pond.nextBreedAt.toISOString() }, slots: slots.map((slot) => ({ ...slot, fishQualityCounts: normalizeFishQualityCounts(slot.fishQualityCounts ?? {}, slot.fishCount), fryQualityCounts: normalizeFishQualityCounts(slot.fryQualityCounts ?? {}, slot.fryCount), probability: pondProbability(slot.domestication), nextStage: nextPondStage(slot.domestication), speciesName: FISH_SPECIES_BY_ID[slot.speciesId]?.name ?? slot.speciesId })), inventory };
}

export async function listFriendSpiritPonds(actor: SpiritPondActor) {
  await loadOwner(actor);
  const friends = await listFriends(actor.cultivatorId);
  if (!friends.length) return [];
  const ponds = await getExecutor()
    .select({
      ownerCultivatorId: spiritPonds.ownerCultivatorId,
      accessMode: spiritPonds.accessMode,
      entryFee: spiritPonds.entryFee,
    })
    .from(spiritPonds)
    .where(inArray(spiritPonds.ownerCultivatorId, friends.map((friend) => friend.id)));
  const byOwner = new Map(ponds.map((pond) => [pond.ownerCultivatorId, pond]));
  return friends.flatMap((friend) => {
    const pond = byOwner.get(friend.id);
    if (!pond || pond.accessMode === 'private') return [];
    return [{
      ownerCultivatorId: friend.id,
      ownerName: friend.name,
      accessMode: pond.accessMode,
      entryFee: pond.accessMode === 'friends_ticket' ? pond.entryFee : 0,
    }];
  });
}

export async function feedSpiritPond(actor: SpiritPondActor, input: { slot: number; speciesId: string; quality: string; quantity: number; requestId: string }) {
  const species = FISH_SPECIES_BY_ID[input.speciesId];
  const contribution = POND_DOMESTICATION_BY_QUALITY[input.quality as Quality];
  if (!species || !contribution) throw new SpiritPondServiceError('鱼种或品质不存在', 404);
  return playerCommandExecutor.executeWithLock({ userId: actor.userId, cultivatorId: actor.cultivatorId, source: 'spirit_pond_feed', requestId: input.requestId, idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) }, command: async (tx) => {
    await loadOwner(actor, tx);
    const pond = await ensureSpiritPond(actor.cultivatorId, tx);
    if (input.slot < 1 || input.slot > 2) throw new SpiritPondServiceError('only two pond slots');
    const [same] = await tx.select().from(spiritPondSlots).where(and(eq(spiritPondSlots.pondId, pond.id), eq(spiritPondSlots.speciesId, species.id))).limit(1);
    const [slot] = await tx.select().from(spiritPondSlots).where(and(eq(spiritPondSlots.pondId, pond.id), eq(spiritPondSlots.slot, input.slot))).limit(1);
    if (slot && slot.speciesId !== species.id) throw new SpiritPondServiceError('该喂养槽已经绑定其他鱼种', 409);
    if (same && same.slot !== input.slot) throw new SpiritPondServiceError('同一种鱼只能占用一个喂养槽', 409);
    await consumeFishQuality(tx, actor, species.id, input.quality, input.quantity);
    const domestication = Math.min(POND_MAX_DOMESTICATION, (slot?.domestication ?? 0) + contribution * input.quantity);
    const fishQualityCounts = addQualityCounts(slot?.fishQualityCounts ?? {}, input.quality, input.quantity);
    if (slot) await tx.update(spiritPondSlots).set({ domestication, fishCount: sql`${spiritPondSlots.fishCount} + ${input.quantity}`, fishQualityCounts }).where(eq(spiritPondSlots.id, slot.id));
    else await tx.insert(spiritPondSlots).values({ pondId: pond.id, slot: input.slot, speciesId: species.id, domestication, fishCount: input.quantity, fishQualityCounts });
    return { result: { message: `fed x${input.quantity}`, probability: pondProbability(domestication) }, resourceChanges: [{ resourceTopic: 'inventory.materials' as const, eventType: 'inventory.spirit-pond.feed', operation: 'invalidate' as const }] };
  } });
}

export async function breedSpiritPond(actor: SpiritPondActor, requestId: string) {
  return playerCommandExecutor.executeWithLock({ userId: actor.userId, cultivatorId: actor.cultivatorId, source: 'spirit_pond_breed', requestId, idempotency: { key: requestId, fingerprint: requestId }, command: async (tx) => {
    await loadOwner(actor, tx); const pond = await ensureSpiritPond(actor.cultivatorId, tx); const now = new Date();
    if (pond.nextBreedAt > now) throw new SpiritPondServiceError('breeding cooldown', 409);
    const slots = await tx.select().from(spiritPondSlots).where(eq(spiritPondSlots.pondId, pond.id));
    const produced = slots.map((slot) => {
      const fishQualityCounts = normalizeFishQualityCounts(slot.fishQualityCounts ?? {}, slot.fishCount);
      const fryQualityCountsBefore = normalizeFishQualityCounts(slot.fryQualityCounts ?? {}, slot.fryCount);
      const mature = Math.min(slot.fryCount, Math.max(1, Math.floor(slot.fryCount / 5)));
      const matured = transferQualityCounts(fryQualityCountsBefore, fishQualityCounts, mature);
      const domesticationGain = QUALITY_VALUES.reduce((sum, quality) => {
        const maturedCount = (matured.target[quality] ?? 0) - (fishQualityCounts[quality] ?? 0);
        return sum + Math.max(0, maturedCount) * POND_DOMESTICATION_BY_QUALITY[quality];
      }, 0);
      const domestication = Math.min(POND_MAX_DOMESTICATION, slot.domestication + domesticationGain);
      const parentCount = slot.fishCount + mature;
      const quantity = parentCount > 0
        ? Math.min(30, Math.max(1, Math.floor(parentCount / 10) + Math.floor(domestication / 250)))
        : 0;
      let fryQualityCounts = matured.source;
      for (let index = 0; index < quantity; index += 1) {
        fryQualityCounts = addQualityCounts(fryQualityCounts, pickQuality(matured.target), 1);
      }
      return { slotId: slot.id, quantity, mature, domestication, fishQualityCounts: matured.target, fryQualityCounts };
    });
    for (const item of produced) await tx.update(spiritPondSlots).set({ fishCount: sql`${spiritPondSlots.fishCount} + ${item.mature}`, fryCount: sql`${spiritPondSlots.fryCount} - ${item.mature} + ${item.quantity}`, domestication: item.domestication, fishQualityCounts: item.fishQualityCounts, fryQualityCounts: item.fryQualityCounts }).where(eq(spiritPondSlots.id, item.slotId));
    const next = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    await tx.update(spiritPonds).set({ lastBreedAt: now, nextBreedAt: next }).where(eq(spiritPonds.id, pond.id));
    return { result: { message: produced.length ? 'breeding complete' : 'no brood fish', produced }, resourceChanges: [{ resourceTopic: 'player.progress' as const, eventType: 'spirit-pond.breed', operation: 'invalidate' as const }] };
  } });
}

export async function transferSpiritPondFry(actor: SpiritPondActor, input: { targetCultivatorId: string; slot: number; quantity: number; requestId: string }) {
  return playerCommandExecutor.executeWithLock({ userId: actor.userId, cultivatorId: actor.cultivatorId, source: 'spirit_pond_fry_transfer', requestId: input.requestId, idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) }, command: async (tx) => {
    await loadOwner(actor, tx);
    if (input.targetCultivatorId === actor.cultivatorId) throw new SpiritPondServiceError('不能转给自己', 409);
    if (!(await areFriends(actor.cultivatorId, input.targetCultivatorId, tx))) throw new SpiritPondServiceError('只能转给好友', 403);
    const source = await ensureSpiritPond(actor.cultivatorId, tx);
    const target = await ensureSpiritPond(input.targetCultivatorId, tx);
    const [sourceSlot] = await tx.select().from(spiritPondSlots).where(and(eq(spiritPondSlots.pondId, source.id), eq(spiritPondSlots.slot, input.slot))).limit(1);
    if (!sourceSlot || sourceSlot.fryCount < input.quantity) throw new SpiritPondServiceError('鱼苗数量不足', 409);
    const [targetSlot] = await tx.select().from(spiritPondSlots).where(and(eq(spiritPondSlots.pondId, target.id), eq(spiritPondSlots.speciesId, sourceSlot.speciesId))).limit(1);
    const sourceFryQualityCounts = normalizeFishQualityCounts(sourceSlot.fryQualityCounts ?? {}, sourceSlot.fryCount);
    const targetFryQualityCounts = normalizeFishQualityCounts(targetSlot?.fryQualityCounts ?? {}, targetSlot?.fryCount ?? 0);
    const transferred = transferQualityCounts(sourceFryQualityCounts, targetFryQualityCounts, input.quantity);
    if (transferred.moved !== input.quantity) throw new SpiritPondServiceError('鱼苗品质账本不足，请先结算繁殖', 409);
    if (targetSlot) await tx.update(spiritPondSlots).set({ fryCount: sql`${spiritPondSlots.fryCount} + ${input.quantity}`, fryQualityCounts: transferred.target }).where(eq(spiritPondSlots.id, targetSlot.id));
    else {
      const occupied = await tx.select({ slot: spiritPondSlots.slot }).from(spiritPondSlots).where(eq(spiritPondSlots.pondId, target.id));
      const freeSlot = [1, 2].find((slot) => !occupied.some((row) => row.slot === slot));
      if (!freeSlot) throw new SpiritPondServiceError('对方灵池喂养槽已满', 409);
      await tx.insert(spiritPondSlots).values({ pondId: target.id, slot: freeSlot, speciesId: sourceSlot.speciesId, fryCount: input.quantity, fryQualityCounts: transferred.target });
    }
    await tx.update(spiritPondSlots).set({ fryCount: sql`${spiritPondSlots.fryCount} - ${input.quantity}`, fryQualityCounts: transferred.source }).where(eq(spiritPondSlots.id, sourceSlot.id));
    return { result: { message: '鱼苗转移成功', quantity: input.quantity, speciesId: sourceSlot.speciesId }, resourceChanges: [
      { resourceTopic: 'player.progress' as const, eventType: 'spirit-pond.fry-transfer', operation: 'invalidate' as const },
      { scope: { kind: 'cultivator' as const, id: input.targetCultivatorId }, resourceTopic: 'player.progress' as const, eventType: 'spirit-pond.fry-received', operation: 'invalidate' as const },
    ] };
  } });
}

export async function updateSpiritPondAccess(actor: SpiritPondActor, input: { accessMode: 'private' | 'friends_free' | 'friends_ticket'; entryFee: number; requestId: string }) {
  return playerCommandExecutor.executeWithLock({ userId: actor.userId, cultivatorId: actor.cultivatorId, source: 'spirit_pond_access', requestId: input.requestId, idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) }, command: async (tx) => { await loadOwner(actor, tx); const pond = await ensureSpiritPond(actor.cultivatorId, tx); await tx.update(spiritPonds).set({ accessMode: input.accessMode, entryFee: input.accessMode === 'friends_ticket' ? input.entryFee : 0 }).where(eq(spiritPonds.id, pond.id)); return { result: { message: 'access updated' }, resourceChanges: [{ resourceTopic: 'player.progress' as const, eventType: 'spirit-pond.access', operation: 'invalidate' as const }] }; } });
}

export async function visitSpiritPond(actor: SpiritPondActor, ownerCultivatorId: string, requestId: string) {
  const committed = await playerCommandExecutor.executeWithLock({ userId: actor.userId, cultivatorId: actor.cultivatorId, source: 'spirit_pond_visit', requestId, idempotency: { key: requestId, fingerprint: `${ownerCultivatorId}:${requestId}` }, allowEmpty: true, command: async (tx) => {
    await loadOwner(actor, tx);
    const pond = ownerCultivatorId === actor.cultivatorId
      ? await ensureSpiritPond(ownerCultivatorId, tx)
      : await (async () => {
          const [friendPond] = await tx.select().from(spiritPonds).where(eq(spiritPonds.ownerCultivatorId, ownerCultivatorId)).limit(1);
          if (!friendPond) throw new SpiritPondServiceError('好友还没有开辟灵池', 404);
          return friendPond;
        })();
    const now = new Date();
    const [existingVisit] = await tx.select().from(spiritPondVisits).where(and(eq(spiritPondVisits.pondId, pond.id), eq(spiritPondVisits.visitorCultivatorId, actor.cultivatorId), gt(spiritPondVisits.validUntil, now))).orderBy(desc(spiritPondVisits.validUntil)).limit(1);
    if (existingVisit) return { result: { visitId: existingVisit.id, pondId: pond.id, validUntil: existingVisit.validUntil.toISOString(), fee: 0 }, resourceChanges: [] };
    let fee = 0; let ownerUserId: string | null = null;
    if (ownerCultivatorId !== actor.cultivatorId) {
      const [mode] = await tx.select({ accessMode: spiritPonds.accessMode, entryFee: spiritPonds.entryFee }).from(spiritPonds).where(eq(spiritPonds.id, pond.id)).limit(1);
      if (!mode || mode.accessMode === 'private') throw new SpiritPondServiceError('pond is private', 403);
      if (!(await areFriends(actor.cultivatorId, ownerCultivatorId, tx))) throw new SpiritPondServiceError('friends only', 403);
      fee = mode.accessMode === 'friends_ticket' ? mode.entryFee : 0;
      if (fee > 0) { const [owner] = await tx.select({ userId: cultivators.userId }).from(cultivators).where(eq(cultivators.id, ownerCultivatorId)).limit(1); ownerUserId = owner?.userId ?? null; if (!ownerUserId) throw new SpiritPondServiceError('owner not found', 404); await updateSpiritStones(actor.userId, actor.cultivatorId, -fee, tx); await updateSpiritStones(ownerUserId, ownerCultivatorId, fee, tx); }
    }
    const validUntil = new Date(now.getTime() + 60 * 60 * 1000); const [visit] = await tx.insert(spiritPondVisits).values({ pondId: pond.id, visitorCultivatorId: actor.cultivatorId, validUntil, requestId }).onConflictDoNothing().returning();
    return { result: { visitId: visit?.id ?? null, pondId: pond.id, validUntil: validUntil.toISOString(), fee }, resourceChanges: [
      { resourceTopic: 'player.profile' as const, eventType: 'spirit-pond.visit', operation: 'invalidate' as const },
      ...(fee > 0 ? [{ scope: { kind: 'cultivator' as const, id: ownerCultivatorId }, resourceTopic: 'player.profile' as const, eventType: 'spirit-pond.entry-fee', operation: 'invalidate' as const }] : []),
    ] };
  } });
  return committed.result;
}
