/**
 * [INPUT]: 依赖鱼种目录、垂钓水域、品质与境界排序
 * [OUTPUT]: 提供可测试的水域解锁、鱼种抽取、品质和体型判定
 * [POS]: 垂钓玩法的纯领域规则，服务端调用但不依赖数据库、Redis 或浏览器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { FISH_SPECIES_BY_ID, FISHING_LOCATIONS, FISHING_LOCATIONS_BY_ID } from './catalog';
import { getFishingAnomaly, getFishingBait, getFishingTide } from './environment';
import type {
  FishCatch,
  FishSpeciesDefinition,
  FishingBaitDefinition,
  FishingEnvironmentSnapshot,
  FishingLocationDefinition,
  FishingStrikeOutcome,
} from './types';
import { QUALITY_ORDER, QUALITY_VALUES, REALM_ORDER, type Quality, type RealmType } from '@shared/types/constants';

export function getAccessibleFishingLocations(realm: RealmType): readonly FishingLocationDefinition[] {
  return FISHING_LOCATIONS.filter((location) => REALM_ORDER[realm] >= REALM_ORDER[location.minRealm]);
}

export function getFishingLocation(locationId: string): FishingLocationDefinition | null {
  return FISHING_LOCATIONS_BY_ID[locationId] ?? null;
}

function clampRoll(value: number): number {
  return Math.min(0.999999, Math.max(0, value));
}

function pickWeighted<T extends { weight: number }>(items: readonly T[], roll: number): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = clampRoll(roll) * total;
  for (const item of items) {
    cursor -= item.weight;
    if (cursor < 0) return item;
  }
  return items[items.length - 1]!;
}

function qualityFromRoll(roll: number, bonus: number): Quality {
  const adjusted = clampRoll(roll - bonus);
  const thresholds = [0.52, 0.78, 0.91, 0.97, 0.99, 0.997, 0.999];
  const index = thresholds.findIndex((threshold) => adjusted < threshold);
  return index === -1 ? '神品' : QUALITY_VALUES[index]!;
}

function speciesEnvironmentMultiplier(
  species: FishSpeciesDefinition,
  environment: FishingEnvironmentSnapshot,
): number {
  let multiplier = 1;
  if (environment.weather === '雷雨' && species.element === '雷') multiplier *= 1.35;
  if (environment.weather === '雨' && species.element === '水') multiplier *= 1.12;
  if (environment.weather === '雾' && (species.behavior === 'cunning' || species.behavior === 'ancient')) multiplier *= 1.16;
  if (environment.weather === '晴' && species.behavior === 'calm') multiplier *= 1.05;
  if (environment.timePhase === '夜半' && (species.behavior === 'cunning' || species.behavior === 'ancient')) multiplier *= 1.15;
  if (environment.moonPhase === '望月' && (species.id.includes('yue') || species.id.includes('wenyao'))) multiplier *= 1.3;
  if (environment.moonPhase === '朔月' && species.behavior === 'ancient') multiplier *= 1.12;
  return multiplier;
}

const DEFAULT_ENVIRONMENT: FishingEnvironmentSnapshot = {
  weather: '晴',
  timePhase: '白昼',
  moonPhase: '上弦',
  tideId: 'still-water',
  tideName: '平潮',
  anomalyId: null,
  anomalyName: null,
};

export function resolveFishCatch(input: {
  locationId: string;
  realm: RealmType;
  speciesRoll: number;
  qualityRoll: number;
  sizeRoll: number;
  bait?: FishingBaitDefinition;
  baitId?: string;
  environment?: FishingEnvironmentSnapshot;
}): FishCatch {
  const location = getFishingLocation(input.locationId);
  if (!location) throw new Error('垂钓水域不存在');
  if (REALM_ORDER[input.realm] < REALM_ORDER[location.minRealm]) throw new Error('当前境界尚未解锁此水域');
  const environment = input.environment ?? DEFAULT_ENVIRONMENT;
  const bait = input.bait ?? (input.baitId ? getFishingBait(input.baitId) : null);
  const tide = getFishingTide(environment.tideId);
  const anomaly = getFishingAnomaly(environment.anomalyId);
  const candidates = location.speciesIds
    .map((id) => FISH_SPECIES_BY_ID[id])
    .filter((species): species is FishSpeciesDefinition => Boolean(species))
    .map((species) => ({
      ...species,
      weight: species.weight
        * (bait?.speciesWeightMultipliers[species.id] ?? 1)
        * (tide?.speciesWeightMultipliers[species.id] ?? 1)
        * (anomaly?.speciesWeightMultipliers[species.id] ?? 1)
        * speciesEnvironmentMultiplier(species, environment),
    }));
  if (candidates.length === 0) throw new Error('水域尚未配置鱼种');
  const species = pickWeighted(candidates, input.speciesRoll);
  const qualityBonus = location.qualityBonus + (bait?.qualityBonus ?? 0) + (tide?.qualityBonus ?? 0) + (anomaly?.qualityBonus ?? 0);
  const quality = qualityFromRoll(input.qualityRoll, qualityBonus);
  const [minWeight, maxWeight] = species.sizeRange;
  const weight = Number((minWeight + (maxWeight - minWeight) * clampRoll(input.sizeRoll)).toFixed(2));
  return {
    speciesId: species.id,
    speciesName: species.name,
    tier: species.tier,
    quality,
    element: species.element,
    weight,
    description: species.description,
    baitId: bait?.id ?? 'spirit-worm',
    environment,
  };
}

export function getFishSpecies(speciesId: string): FishSpeciesDefinition | null {
  return FISH_SPECIES_BY_ID[speciesId] ?? null;
}

export function compareFishQuality(left: Quality, right: Quality): number {
  return QUALITY_ORDER[left] - QUALITY_ORDER[right];
}

export function experienceForFishingLevel(level: number): number {
  const normalizedLevel = Math.max(1, Math.floor(level));
  if (normalizedLevel <= 1) return 0;
  return Math.round(100 * Math.pow(normalizedLevel - 1, 1.35));
}

export function fishingLevelFromExperience(experience: number): number {
  const normalizedExperience = Math.max(0, Math.floor(experience));
  let level = 1;
  while (level < 100 && experienceForFishingLevel(level + 1) <= normalizedExperience) {
    level += 1;
  }
  return level;
}

export function resolveFishingStrikeOutcome(input: {
  nowMs: number;
  biteAtMs: number;
  biteDeadlineAtMs: number;
}): FishingStrikeOutcome {
  if (input.nowMs < input.biteAtMs) return 'early';
  if (input.nowMs > input.biteDeadlineAtMs) return 'late';
  return 'hooked';
}

export function fishingExperienceForCatch(input: {
  quality: Quality;
  weight: number;
  firstDiscovery: boolean;
}): number {
  const qualityXp = Math.max(1, QUALITY_ORDER[input.quality] + 1) * 8;
  const weightXp = Math.min(40, Math.max(0, Math.round(input.weight * 2)));
  return qualityXp + weightXp + (input.firstDiscovery ? 25 : 0);
}
