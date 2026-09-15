/**
 * [INPUT]: 宸茶璇佽鑹层€佸瀭閽撶洰褰曘€佹寔涔呭寲浼氳瘽涓庣帺瀹剁姸鎬佸懡浠ゆ墽琛屽櫒
 * [OUTPUT]: 鍨傞挀蹇収銆佸挰閽╀細璇濄€佹彁绔裤€佹敹绾跨粨绠椼€侀奔鑾锋潗鏂欍€佸浘閴翠笌缁忛獙鎴愰暱
 * [POS]: 鍨傞挀棰嗗煙鐨勬湇鍔＄搴旂敤灞傦紱鏃堕棿绐楀彛銆佸紶鍔涚姸鎬併€侀殢鏈烘暟涓庡鍔卞潎鍦ㄦ閿佸畾锛屽墠绔彧鎻愪氦鍔ㄤ綔
 * [PROTOCOL]: 鍙樻洿鏃舵洿鏂版澶撮儴锛岀劧鍚庢鏌?CLAUDE.md
 */
import { getExecutor, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import {
  cultivators,
  fishCodexEntries,
  fishingProfiles,
  fishingSessions,
  spiritPondSlots,
  spiritPondVisits,
  spiritPonds,
} from '@server/lib/drizzle/schema';
import { playerCommandExecutor } from '@server/lib/services/CommandExecutors';
import { addMaterialStackToInventory } from '@server/lib/services/materialInventory';
import {
  DAILY_FISHING_CAST_LIMIT,
  FISH_SPECIES,
  FISHING_BAITS,
  getFishingAnomaly,
  getFishingBait,
  getFishingTide,
  resolveFishingEnvironment,
  fishingExperienceForCatch,
  fishingLevelFromExperience,
  getAccessibleFishingLocations,
  getFishingLocation,
  resolveFishingStrikeOutcome,
  resolveFishCatch,
  resolveFishingTierReward,
  pondProbability,
  selectPondTarget,
  type FishCodexEntry,
  type FishCatch,
  type FishingProfile,
  type FishingEnvironmentSnapshot,
  type FishingSessionState,
  type FishingSessionView,
} from '@shared/engine/fishing';
import { QUALITY_ORDER, REALM_ORDER, type Quality, type RealmStage, type RealmType } from '@shared/types/constants';
import { getOrInitCultivationProgress, stripExpCapForStorage } from '@server/utils/cultivationUtils';
import type { FishingSessionRequest, FishingStrikeRequest } from '@shared/contracts/fishing';
import { getFishingMapConfig } from '@shared/lib/game/mapSystem';
import { and, asc, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';

export type FishingActor = { userId: string; cultivatorId: string };

export class FishingServiceError extends Error {
  constructor(message: string, readonly status: 400 | 401 | 404 | 409 | 429 = 400) {
    super(message);
  }
}

type FishingSessionRow = typeof fishingSessions.$inferSelect;
type FishingStrikeResult =
  | { outcome: 'early' | 'late'; message: string }
  | {
      outcome: 'hooked';
      catch: FishCatch;
      experienceGained: number;
      firstDiscovery: boolean;
      rewardUnlocked: boolean;
      cultivationExpGained: number;
      attributeReward?: { attribute: string; amount: number };
      newlyUnlockedBaitIds: string[];
      dailyCastsRemaining: number;
      catchQuantity: number;
      merchantAvailableUntil: string | null;
      merchantEncountered: boolean;
    };

async function loadActorCultivator(actor: FishingActor, q: DbExecutor = getExecutor()) {
  const [row] = await q
    .select({ id: cultivators.id, realm: cultivators.realm })
    .from(cultivators)
    .where(
      and(
        eq(cultivators.id, actor.cultivatorId),
        eq(cultivators.userId, actor.userId),
        eq(cultivators.status, 'active'),
      ),
    )
    .limit(1);
  if (!row) throw new FishingServiceError('当前没有可用的活跃角色', 404);
  return { ...row, realm: row.realm as RealmType };
}

function mapCodexEntry(row: typeof fishCodexEntries.$inferSelect): FishCodexEntry {
  return {
    speciesId: row.speciesId,
    caughtCount: row.caughtCount,
    highestQuality: row.highestQuality as Quality,
    largestWeight: row.largestWeight,
    firstCaughtAt: row.firstCaughtAt.toISOString(),
    lastCaughtAt: row.lastCaughtAt.toISOString(),
    bestBaitId: row.bestBaitId,
    bestWeather: (row.bestWeather as FishCodexEntry['bestWeather']) ?? null,
    bestMoonPhase: (row.bestMoonPhase as FishCodexEntry['bestMoonPhase']) ?? null,
    bestAnomalyId: row.bestAnomalyId,
  };
}

function mapFishingProfile(row: typeof fishingProfiles.$inferSelect): FishingProfile {
  const level = fishingLevelFromExperience(row.experience);
  const dailyCasts = row.dailyCasts ?? 0;
  return {
    level,
    experience: row.experience,
    experienceToNextLevel: 100 * Math.pow(level, 1.35) - row.experience,
    totalCasts: row.totalCasts,
    successfulCatches: row.successfulCatches,
    escapedFish: row.escapedFish,
    largestWeight: row.largestWeight,
    dailyCasts,
    dailyLimit: DAILY_FISHING_CAST_LIMIT,
    remainingCasts: Math.max(0, DAILY_FISHING_CAST_LIMIT - dailyCasts),
    unlockedBaitIds: row.unlockedBaitIds ?? ['spirit-worm'],
    baitStock: row.baitStock ?? { 'spirit-worm': 30 },
    unlockedRewardKeys: row.unlockedRewardKeys ?? [],
    fishPoints: row.fishPoints,
    fishingBuffs: (row.fishingBuffs ?? []).filter((buff) => Date.parse(buff.expiresAt) > Date.now()),
    merchantAvailableUntil: row.merchantAvailableUntil?.toISOString() ?? null,
  };
}

function mapSession(row: FishingSessionRow, now: Date): FishingSessionView {
  const nowMs = now.getTime();
  const state: FishingSessionState =
    row.state === 'waiting_bite' && nowMs >= row.biteAt.getTime()
      ? 'biting'
      : (row.state as FishingSessionState);
  return {
    id: row.id,
    locationId: row.locationId,
    locationName: row.pondId ? '洞府灵池' : (getFishingLocation(row.locationId)?.name ?? row.locationId),
    state,
    castAt: row.castAt.toISOString(),
    biteAt: row.biteAt.toISOString(),
    biteDeadlineAt: row.biteDeadlineAt.toISOString(),
    now: now.toISOString(),
    baitId: row.baitId,
    pondVisitId: row.pondVisitId,
    environment: {
      weather: row.weather as FishingEnvironmentSnapshot['weather'],
      timePhase: row.timePhase as FishingEnvironmentSnapshot['timePhase'],
      moonPhase: row.moonPhase as FishingEnvironmentSnapshot['moonPhase'],
      tideId: row.tideId,
      tideName: getFishingTideName(row.tideId),
      anomalyId: row.anomalyId,
      anomalyName: getFishingAnomaly(row.anomalyId)?.name ?? null,
    },
  };
}

function getFishingTideName(tideId: string): string {
  return getFishingTide(tideId)?.name ?? tideId;
}

async function readFishingProfile(cultivatorId: string, q: DbExecutor) {
  const [existing] = await q
    .select()
    .from(fishingProfiles)
    .where(eq(fishingProfiles.cultivatorId, cultivatorId))
    .limit(1);
  return existing ?? {
    cultivatorId,
    experience: 0,
    totalCasts: 0,
    successfulCatches: 0,
    escapedFish: 0,
    largestWeight: 0,
    dailyCasts: 0,
    dailyResetAt: new Date(0),
    unlockedBaitIds: ['spirit-worm'],
    baitStock: { 'spirit-worm': 30 },
    unlockedRewardKeys: [],
    unlockedWaterIds: [],
    fishPoints: 0,
    fishingBuffs: [],
    merchantAvailableUntil: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function isSameUtcDay(left: Date, right: Date): boolean {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

async function resetDailyFishingCastsIfNeeded(
  cultivatorId: string,
  profile: typeof fishingProfiles.$inferSelect,
  now: Date,
  tx: DbExecutor,
) {
  if (isSameUtcDay(profile.dailyResetAt, now)) return profile;
  const [reset] = await tx
    .update(fishingProfiles)
    .set({ dailyCasts: 0, dailyResetAt: now })
    .where(eq(fishingProfiles.cultivatorId, cultivatorId))
    .returning();
  return reset ?? { ...profile, dailyCasts: 0, dailyResetAt: now };
}

async function syncUnlockedBaits(
  profile: typeof fishingProfiles.$inferSelect,
  tx: DbExecutor,
) {
  const level = fishingLevelFromExperience(profile.experience);
  const levelUnlocked = FISHING_BAITS
    .filter((bait) => bait.requiredFishingLevel <= level)
    .map((bait) => bait.id);
  const unlocked = [...new Set([...(profile.unlockedBaitIds ?? []), ...levelUnlocked])];
  if (unlocked.length === (profile.unlockedBaitIds ?? []).length && unlocked.every((id) => (profile.unlockedBaitIds ?? []).includes(id))) {
    return profile;
  }
  const [updated] = await tx
    .update(fishingProfiles)
    .set({ unlockedBaitIds: unlocked })
    .where(eq(fishingProfiles.cultivatorId, profile.cultivatorId))
    .returning();
  return updated ?? { ...profile, unlockedBaitIds: unlocked };
}

async function consumeFishingBait(
  profile: typeof fishingProfiles.$inferSelect,
  baitId: string,
  tx: DbExecutor,
) {
  const stock = { ...(profile.baitStock ?? { 'spirit-worm': 30 }) };
  const quantity = stock[baitId] ?? 0;
  if (quantity < 1) {
    throw new FishingServiceError('鎵€閫夐奔楗靛簱瀛樹笉瓒筹紝璇峰厛琛ュ厖楸奸サ', 409);
  }
  stock[baitId] = quantity - 1;
  const [updated] = await tx
    .update(fishingProfiles)
    .set({ baitStock: stock })
    .where(eq(fishingProfiles.cultivatorId, profile.cultivatorId))
    .returning();
  return updated ?? { ...profile, baitStock: stock };
}

async function ensureFishingProfile(cultivatorId: string, q: DbExecutor) {
  const existing = await readFishingProfile(cultivatorId, q);
  if (existing.createdAt.getTime() !== 0) return existing;
  const [created] = await q
    .insert(fishingProfiles)
    .values({ cultivatorId })
    .returning();
  return created;
}

async function getActiveSession(cultivatorId: string, q: DbExecutor) {
  const [row] = await q
    .select()
    .from(fishingSessions)
    .where(
      and(
        eq(fishingSessions.cultivatorId, cultivatorId),
        inArray(fishingSessions.state, ['waiting_bite', 'biting']),
      ),
    )
    .orderBy(desc(fishingSessions.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getFishingSnapshot(actor: FishingActor, mapNodeId?: string, pondVisitId?: string) {
  const q = getExecutor();
  const cultivator = await loadActorCultivator(actor, q);
  const [entries, profile, activeSession] = await Promise.all([
    q
      .select()
      .from(fishCodexEntries)
      .where(eq(fishCodexEntries.cultivatorId, actor.cultivatorId))
      .orderBy(asc(fishCodexEntries.firstCaughtAt)),
    readFishingProfile(actor.cultivatorId, q),
    getActiveSession(actor.cultivatorId, q),
  ]);
  const normalizedProfile = profile.createdAt.getTime() === 0
    ? profile
    : await syncUnlockedBaits(
        await resetDailyFishingCastsIfNeeded(actor.cultivatorId, profile, new Date(), q),
        q,
      );
  const accessible = new Set(
    getAccessibleFishingLocations(cultivator.realm).map((location) => location.id),
  );
  const allLocations = getAccessibleFishingLocations('渡劫');
  const [pondVisit] = pondVisitId
    ? await q.select({ pondId: spiritPondVisits.pondId, validUntil: spiritPondVisits.validUntil }).from(spiritPondVisits).where(and(eq(spiritPondVisits.id, pondVisitId), eq(spiritPondVisits.visitorCultivatorId, actor.cultivatorId))).limit(1)
    : [];
  if (pondVisitId && (!pondVisit || pondVisit.validUntil <= new Date())) throw new FishingServiceError('灵池访问票据已失效', 409);
  const [pond] = pondVisit ? await q.select({ locationId: spiritPonds.locationId }).from(spiritPonds).where(eq(spiritPonds.id, pondVisit.pondId)).limit(1) : [];
  const mappedLocationId = pond?.locationId ?? (mapNodeId ? getFishingMapConfig(mapNodeId)?.water_id : undefined);
  if (mapNodeId && !mappedLocationId) {
    throw new FishingServiceError('璇ュ湴鍥捐妭鐐规病鏈夊彲鍨傞挀姘村煙', 404);
  }
  const now = new Date();
  const fishingLevel = fishingLevelFromExperience(normalizedProfile.experience);
  const selectedMapConfig = mapNodeId ? getFishingMapConfig(mapNodeId) : undefined;
  const selectedLocationUnlocked = Boolean(
    mappedLocationId &&
      (!selectedMapConfig || fishingLevel >= selectedMapConfig.fishing_level_required),
  );
  const selectedLocationId = mappedLocationId ?? null;
  return {
    player: { realm: cultivator.realm },
    profile: mapFishingProfile(normalizedProfile),
    activeSession: activeSession ? mapSession(activeSession, now) : null,
    selectedLocationId,
    selectedLocationUnlocked: pondVisitId ? true : selectedLocationUnlocked,
    selectedLocationRequiredLevel: selectedMapConfig?.fishing_level_required ?? null,
    environment: selectedLocationId
      ? resolveFishingEnvironment({ locationId: selectedLocationId, now })
      : null,
    baits: FISHING_BAITS.map((bait) => ({
      ...bait,
      unlocked: normalizedProfile.unlockedBaitIds.includes(bait.id),
      stock: normalizedProfile.baitStock[bait.id] ?? 0,
    })),
    locations: getAccessibleFishingLocations(cultivator.realm).map((location) => ({
      ...location,
      unlocked: true,
    })),
    lockedLocations: allLocations
      .filter((location) => !accessible.has(location.id))
      .map((location) => ({ ...location, unlocked: false })),
    species: FISH_SPECIES.map((species) => ({
      ...species,
      discovered: entries.some((entry) => entry.speciesId === species.id),
    })),
    codex: entries.map(mapCodexEntry),
  };
}

async function upsertCodexEntry(
  tx: DbTransaction,
  cultivatorId: string,
  caught: FishCatch,
  now: Date,
) {
  const [existing] = await tx
    .select()
    .from(fishCodexEntries)
    .where(
      and(
        eq(fishCodexEntries.cultivatorId, cultivatorId),
        eq(fishCodexEntries.speciesId, caught.speciesId),
      ),
    )
    .limit(1);
  const highestQuality =
    existing && QUALITY_ORDER[existing.highestQuality as Quality] > QUALITY_ORDER[caught.quality]
      ? (existing.highestQuality as Quality)
      : caught.quality;
  const largestWeight = Math.max(existing?.largestWeight ?? 0, caught.weight);
  const isBestWeight = !existing || caught.weight > existing.largestWeight;
  if (!existing) {
    await tx.insert(fishCodexEntries).values({
      cultivatorId,
      speciesId: caught.speciesId,
      caughtCount: 1,
      highestQuality,
      largestWeight,
      bestBaitId: caught.baitId,
      bestWeather: caught.environment.weather,
      bestMoonPhase: caught.environment.moonPhase,
      bestAnomalyId: caught.environment.anomalyId,
      firstCaughtAt: now,
      lastCaughtAt: now,
    });
    return true;
  }
  await tx
    .update(fishCodexEntries)
    .set({
      caughtCount: sql`${fishCodexEntries.caughtCount} + 1`,
      highestQuality,
      largestWeight,
      ...(isBestWeight
        ? {
            bestBaitId: caught.baitId,
            bestWeather: caught.environment.weather,
            bestMoonPhase: caught.environment.moonPhase,
            bestAnomalyId: caught.environment.anomalyId,
          }
        : {}),
      lastCaughtAt: now,
    })
    .where(
      and(
        eq(fishCodexEntries.cultivatorId, cultivatorId),
        eq(fishCodexEntries.speciesId, caught.speciesId),
      ),
    );
  return false;
}

export async function startFishingSession(
  actor: FishingActor,
  input: FishingSessionRequest,
) {
  const initial = await loadActorCultivator(actor);
  const location = getFishingLocation(input.locationId);
  if (!location) throw new FishingServiceError('垂钓水域不存在', 404);
  const bait = getFishingBait(input.baitId);
  if (!bait) throw new FishingServiceError('鎵€閫夐奔楗典笉瀛樺湪', 404);
  if (REALM_ORDER[initial.realm] < REALM_ORDER[location.minRealm]) {
    throw new FishingServiceError('当前境界尚未解锁此水域', 409);
  }
  if (!input.mapNodeId && !input.pondVisitId) {
    throw new FishingServiceError('璇峰厛浠庡湴鍥鹃€夋嫨鍨傞挀姘村煙', 409);
  }
  if (input.mapNodeId && getFishingMapConfig(input.mapNodeId)?.water_id !== input.locationId) {
    throw new FishingServiceError('鍨傞挀姘村煙涓庡湴鍥捐妭鐐逛笉鍖归厤', 409);
  }

  const biteDelayMs = Math.round(randomInt(3_000, 7_001) * bait.biteDelayMultiplier);
  const biteWindowMs = randomInt(1_400, 2_601);
  return playerCommandExecutor.executeWithLock({
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'fishing_session_start',
    requestId: input.requestId,
    idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) },
    allowEmpty: true,
    command: async (tx) => {
      await loadActorCultivator(actor, tx);
      const active = await getActiveSession(actor.cultivatorId, tx);
      if (active) throw new FishingServiceError('你已经在等待鱼讯', 409);
      const now = new Date();
      const profile = await ensureFishingProfile(actor.cultivatorId, tx);
      const normalizedProfile = await resetDailyFishingCastsIfNeeded(
        actor.cultivatorId,
        profile,
        now,
        tx,
      );
      const profileWithBaits = await syncUnlockedBaits(normalizedProfile, tx);
      const fishingLevel = fishingLevelFromExperience(profileWithBaits.experience);
      if (!input.pondVisitId) {
        const mapConfig = getFishingMapConfig(input.mapNodeId!);
        if (!mapConfig || mapConfig.water_id !== input.locationId) {
          throw new FishingServiceError('垂钓水域与地图节点不匹配', 409);
        }
        if (fishingLevel < mapConfig.fishing_level_required) {
          throw new FishingServiceError(`垂钓等级达到 ${mapConfig.fishing_level_required} 级后才能进入此水域`, 409);
        }
      }
      if (!profileWithBaits.unlockedBaitIds.includes(bait.id)) {
        throw new FishingServiceError(`垂钓等级达到 ${bait.requiredFishingLevel} 级后才能使用此鱼饵`, 409);
      }
      if (profileWithBaits.dailyCasts >= DAILY_FISHING_CAST_LIMIT) {
        throw new FishingServiceError('今日垂钓次数已用尽，请明日再来', 429);
      }
      const profileWithConsumedBait = await consumeFishingBait(profileWithBaits, bait.id, tx);
      const environment = resolveFishingEnvironment({ locationId: input.locationId, now });
      let pondId: string | null = null;
      let pondSpeciesWeights: Array<{ speciesId: string; probability: number; legendaryMultiplier: number }> = [];
      if (input.pondVisitId) {
        const [visit] = await tx
          .select({ pondId: spiritPondVisits.pondId, validUntil: spiritPondVisits.validUntil })
          .from(spiritPondVisits)
          .where(and(eq(spiritPondVisits.id, input.pondVisitId), eq(spiritPondVisits.visitorCultivatorId, actor.cultivatorId), gt(spiritPondVisits.validUntil, now)))
          .limit(1);
        if (!visit) throw new FishingServiceError('灵池访问票据已失效，请重新进入灵池', 409);
        pondId = visit.pondId;
        const [pond] = await tx.select({ locationId: spiritPonds.locationId }).from(spiritPonds).where(eq(spiritPonds.id, pondId)).limit(1);
        if (!pond || pond.locationId !== input.locationId) throw new FishingServiceError('垂钓水域与灵池位置不匹配', 409);
        const slots = await tx.select().from(spiritPondSlots).where(eq(spiritPondSlots.pondId, pondId));
        pondSpeciesWeights = slots.map((slot) => ({ speciesId: slot.speciesId, probability: Math.min(30, pondProbability(slot.domestication)), legendaryMultiplier: pondProbability(slot.domestication) >= 30 ? 2 : 1 }));
      }
      const biteAt = new Date(now.getTime() + biteDelayMs);
      const biteDeadlineAt = new Date(biteAt.getTime() + biteWindowMs);
      const [session] = await tx
        .insert(fishingSessions)
        .values({
          cultivatorId: actor.cultivatorId,
          locationId: input.locationId,
          mapNodeId: input.mapNodeId ?? null,
          baitId: bait.id,
          weather: environment.weather,
          timePhase: environment.timePhase,
          moonPhase: environment.moonPhase,
          tideId: environment.tideId,
          anomalyId: environment.anomalyId,
          pondId,
          pondVisitId: input.pondVisitId ?? null,
          pondSpeciesWeights,
          state: 'waiting_bite',
          castAt: now,
          biteAt,
          biteDeadlineAt,
        })
        .returning();
      await tx
        .update(fishingProfiles)
        .set({
          totalCasts: sql`${fishingProfiles.totalCasts} + 1`,
          dailyCasts: sql`${fishingProfiles.dailyCasts} + 1`,
        })
        .where(eq(fishingProfiles.cultivatorId, actor.cultivatorId));
      return {
        result: { session: mapSession(session, now), baitStock: profileWithConsumedBait.baitStock },
        resourceChanges: [
          {
            resourceTopic: 'player.progress' as const,
            eventType: 'fishing.session.started',
            operation: 'invalidate' as const,
          },
        ],
      };
    },
  });
}

export async function strikeFishingSession(
  actor: FishingActor,
  input: FishingStrikeRequest,
) {
  const initial = await loadActorCultivator(actor);
  return playerCommandExecutor.executeWithLock<FishingStrikeResult>({
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'fishing_session_strike',
    requestId: input.requestId,
    idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) },
    allowEmpty: true,
    command: async (tx) => {
      const [session] = await tx
        .select()
        .from(fishingSessions)
        .where(
          and(
            eq(fishingSessions.id, input.sessionId),
            eq(fishingSessions.cultivatorId, actor.cultivatorId),
          ),
        )
        .limit(1);
      if (!session) throw new FishingServiceError('垂钓会话不存在', 404);
      if (!['waiting_bite', 'biting'].includes(session.state)) {
        throw new FishingServiceError('杩欐楸艰宸茬粡缁撶畻杩囦簡', 409);
      }
      const now = new Date();
      const outcome = resolveFishingStrikeOutcome({
        nowMs: now.getTime(),
        biteAtMs: session.biteAt.getTime(),
        biteDeadlineAtMs: session.biteDeadlineAt.getTime(),
      });
      if (outcome !== 'hooked') {
        const nextState = outcome === 'early' ? 'escaped' : 'timeout';
        const result = { outcome, message: outcome === 'early' ? '提竿太早，鱼讯被惊散了。' : '鱼讯已过，鱼吞饵逃开了。' };
        await tx
          .update(fishingSessions)
          .set({ state: nextState, resolvedAt: now, result })
          .where(eq(fishingSessions.id, session.id));
        await tx
          .update(fishingProfiles)
          .set({ escapedFish: sql`${fishingProfiles.escapedFish} + 1` })
          .where(eq(fishingProfiles.cultivatorId, actor.cultivatorId));
        return {
          result,
          resourceChanges: [{ resourceTopic: 'player.progress' as const, eventType: 'fishing.session.escaped', operation: 'invalidate' as const }],
        };
      }

      const [profile] = await tx.select().from(fishingProfiles).where(eq(fishingProfiles.cultivatorId, actor.cultivatorId)).limit(1);
      if (!profile) throw new FishingServiceError('垂钓档案不存在', 404);
      const activeBuffs = (profile.fishingBuffs ?? []).filter((buff) => Date.parse(buff.expiresAt) > now.getTime());
      const pondTarget = selectPondTarget(session.pondSpeciesWeights ?? [], randomInt(0, 1_000_000) / 1_000_000);
      const legendaryBoost = activeBuffs.some((buff) => buff.type === 'legendary_rate') ? 0.03 : 0;
      const pondQualityBoost = pondTarget?.legendaryMultiplier === 2 ? 0.015 : 0;
      const caught = resolveFishCatch({
        locationId: session.locationId,
        realm: initial.realm,
        bait: getFishingBait(session.baitId) ?? undefined,
        environment: {
          weather: session.weather as FishingEnvironmentSnapshot['weather'],
          timePhase: session.timePhase as FishingEnvironmentSnapshot['timePhase'],
          moonPhase: session.moonPhase as FishingEnvironmentSnapshot['moonPhase'],
          tideId: session.tideId,
          tideName: getFishingTideName(session.tideId),
          anomalyId: session.anomalyId,
          anomalyName: getFishingAnomaly(session.anomalyId)?.name ?? null,
        },
        speciesRoll: randomInt(0, 1_000_000) / 1_000_000,
        qualityRoll: randomInt(0, 1_000_000) / 1_000_000,
        sizeRoll: randomInt(0, 1_000_000) / 1_000_000,
        forcedSpeciesId: pondTarget?.speciesId,
        qualityBonus: legendaryBoost + pondQualityBoost,
      });
      const firstDiscovery = await upsertCodexEntry(tx, actor.cultivatorId, caught, now);
      const experienceGained = fishingExperienceForCatch({ quality: caught.quality, weight: caught.weight, firstDiscovery });
      const catchQuantity = activeBuffs.some((buff) => buff.type === 'double_catch') ? 2 : 1;
      await addMaterialStackToInventory(actor.cultivatorId, {
        name: caught.speciesName, type: 'fish', rank: caught.quality, element: caught.element,
        description: caught.description, details: { speciesId: caught.speciesId, tier: caught.tier, firstDiscovery }, quantity: catchQuantity,
      }, tx);
      const reward = resolveFishingTierReward({ speciesId: caught.speciesId, quality: caught.quality, element: caught.element });
      const unlockedRewardKeys = profile.unlockedRewardKeys ?? [];
      const rewardUnlocked = !unlockedRewardKeys.includes(reward.rewardKey);
      if (rewardUnlocked) {
        const [cultivator] = await tx.select({ realm: cultivators.realm, realmStage: cultivators.realm_stage, cultivationProgress: cultivators.cultivation_progress }).from(cultivators).where(eq(cultivators.id, actor.cultivatorId)).limit(1);
        if (!cultivator) throw new FishingServiceError('当前角色不存在', 404);
        const progress = getOrInitCultivationProgress((cultivator.cultivationProgress ?? {}) as Parameters<typeof getOrInitCultivationProgress>[0], cultivator.realm as RealmType, cultivator.realmStage as RealmStage);
        progress.cultivation_exp += reward.cultivationExp;
        await tx.update(cultivators).set({ cultivation_progress: stripExpCapForStorage(progress), [reward.attribute]: sql`${cultivators[reward.attribute]} + ${reward.attributeGain}` }).where(eq(cultivators.id, actor.cultivatorId));
        await tx.update(fishingProfiles).set({ unlockedRewardKeys: [...unlockedRewardKeys, reward.rewardKey] }).where(eq(fishingProfiles.cultivatorId, actor.cultivatorId));
      }
      const merchantWasAvailable = Boolean(profile.merchantAvailableUntil && profile.merchantAvailableUntil > now);
      const merchantAvailableUntil = merchantWasAvailable
        ? profile.merchantAvailableUntil
        : randomInt(0, 100) < 12
          ? new Date(now.getTime() + 30 * 60 * 1000)
          : null;
      await tx.update(fishingProfiles).set({ experience: sql`${fishingProfiles.experience} + ${experienceGained}`, successfulCatches: sql`${fishingProfiles.successfulCatches} + 1`, largestWeight: sql`GREATEST(${fishingProfiles.largestWeight}, ${caught.weight})`, fishingBuffs: activeBuffs, merchantAvailableUntil }).where(eq(fishingProfiles.cultivatorId, actor.cultivatorId));
      const [profileAfterCatch] = await tx.select().from(fishingProfiles).where(eq(fishingProfiles.cultivatorId, actor.cultivatorId)).limit(1);
      if (!profileAfterCatch) throw new FishingServiceError('垂钓档案不存在', 404);
      const previousBaitIds = new Set(profile.unlockedBaitIds ?? []);
      const profileWithBaits = await syncUnlockedBaits(profileAfterCatch, tx);
      const newlyUnlockedBaitIds = profileWithBaits.unlockedBaitIds.filter((baitId) => !previousBaitIds.has(baitId));
      const result = { outcome: 'hooked' as const, catch: caught, catchQuantity, experienceGained, firstDiscovery, rewardUnlocked, cultivationExpGained: rewardUnlocked ? reward.cultivationExp : 0, attributeReward: rewardUnlocked ? { attribute: reward.attribute, amount: reward.attributeGain } : undefined, newlyUnlockedBaitIds, dailyCastsRemaining: Math.max(0, DAILY_FISHING_CAST_LIMIT - profileAfterCatch.dailyCasts), merchantAvailableUntil: merchantAvailableUntil?.toISOString() ?? null, merchantEncountered: !merchantWasAvailable && Boolean(merchantAvailableUntil) };
      await tx.update(fishingSessions).set({ state: 'landed', resolvedAt: now, result }).where(eq(fishingSessions.id, session.id));
      return {
        result,
        resourceChanges: [
          { resourceTopic: 'inventory.materials' as const, eventType: 'inventory.fishing.catch', operation: 'invalidate' as const },
          { resourceTopic: 'player.progress' as const, eventType: 'fishing.profile.updated', operation: 'invalidate' as const },
          { resourceTopic: 'player.profile' as const, eventType: 'fishing.reward.unlocked', operation: 'invalidate' as const },
        ],
      };
    },
  });
}

/** 鏃х増鎶涚鍏ュ彛淇濈暀涓衡€滃紑濮嬩細璇濃€濓紝閬垮厤鏃ч摼鎺ョ洿鎺ュけ鏁堛€?*/
export const castFishingRod = startFishingSession;
