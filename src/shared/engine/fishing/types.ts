/**
 * [INPUT]: 依赖共享的元素、品质与境界类型
 * [OUTPUT]: 提供垂钓水域、鱼种、鱼获和图鉴所需的领域类型
 * [POS]: 垂钓领域的稳定契约层，被服务端规则、API 与前端展示共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { ElementType, Quality, RealmType } from '@shared/types/constants';

export const FISH_TIERS = [
  '凡种',
  '灵种',
  '玄种',
  '真种',
  '地脉种',
  '天脉种',
  '仙裔种',
  '神遗种',
] as const;
export type FishTier = (typeof FISH_TIERS)[number];

export const FISH_BEHAVIORS = [
  'calm',
  'swift',
  'cunning',
  'fierce',
  'ancient',
] as const;
export type FishBehavior = (typeof FISH_BEHAVIORS)[number];

export const FISHING_SESSION_STATES = [
  'waiting_bite',
  'biting',
  'landed',
  'escaped',
  'timeout',
] as const;
export type FishingSessionState = (typeof FISHING_SESSION_STATES)[number];

export type FishingStrikeOutcome = 'early' | 'hooked' | 'late';

export const FISHING_WEATHER_VALUES = ['晴', '阴', '雨', '雷雨', '雾'] as const;
export type FishingWeather = (typeof FISHING_WEATHER_VALUES)[number];

export const FISHING_TIME_PHASE_VALUES = ['清晨', '白昼', '黄昏', '夜半'] as const;
export type FishingTimePhase = (typeof FISHING_TIME_PHASE_VALUES)[number];

export const FISHING_MOON_PHASE_VALUES = ['朔月', '上弦', '望月', '下弦'] as const;
export type FishingMoonPhase = (typeof FISHING_MOON_PHASE_VALUES)[number];

export interface FishingBaitDefinition {
  id: string;
  name: string;
  description: string;
  requiredFishingLevel: number;
  /** 目标鱼种权重倍率，未列出的鱼种保持 1。 */
  speciesWeightMultipliers: Readonly<Record<string, number>>;
  qualityBonus: number;
  biteDelayMultiplier: number;
}

export interface FishingTideDefinition {
  id: string;
  name: string;
  description: string;
  locationIds: readonly string[];
  speciesWeightMultipliers: Readonly<Record<string, number>>;
  qualityBonus: number;
}

export interface FishingAnomalyDefinition {
  id: string;
  name: string;
  description: string;
  locationIds: readonly string[];
  speciesWeightMultipliers: Readonly<Record<string, number>>;
  qualityBonus: number;
  rarity: 'rare' | 'mythic';
}

export interface FishingEnvironmentSnapshot {
  weather: FishingWeather;
  timePhase: FishingTimePhase;
  moonPhase: FishingMoonPhase;
  tideId: string;
  tideName: string;
  anomalyId: string | null;
  anomalyName: string | null;
}

export interface FishSpeciesDefinition {
  id: string;
  name: string;
  description: string;
  tier: FishTier;
  element: ElementType;
  behavior: FishBehavior;
  minRealm: RealmType;
  habitats: readonly string[];
  sizeRange: readonly [number, number];
  effectTags: readonly string[];
  alchemyTags: readonly string[];
  weight: number;
}

export interface FishingLocationDefinition {
  id: string;
  name: string;
  description: string;
  minRealm: RealmType;
  speciesIds: readonly string[];
  qualityBonus: number;
}

export interface FishCatch {
  speciesId: string;
  speciesName: string;
  tier: FishTier;
  quality: Quality;
  element: ElementType;
  weight: number;
  description: string;
  baitId: string;
  environment: FishingEnvironmentSnapshot;
}

export interface FishCodexEntry {
  speciesId: string;
  caughtCount: number;
  highestQuality: Quality;
  largestWeight: number;
  firstCaughtAt: string;
  lastCaughtAt: string;
  bestBaitId: string | null;
  bestWeather: FishingWeather | null;
  bestMoonPhase: FishingMoonPhase | null;
  bestAnomalyId: string | null;
}

export interface FishingProfile {
  level: number;
  experience: number;
  experienceToNextLevel: number;
  totalCasts: number;
  successfulCatches: number;
  escapedFish: number;
  largestWeight: number;
  dailyCasts: number;
  dailyLimit: number;
  remainingCasts: number;
  unlockedBaitIds: readonly string[];
  baitStock: Readonly<Record<string, number>>;
  unlockedRewardKeys: readonly string[];
}

export interface FishingSessionView {
  id: string;
  locationId: string;
  locationName: string;
  state: FishingSessionState;
  castAt: string;
  biteAt: string;
  biteDeadlineAt: string;
  now: string;
  baitId: string;
  environment: FishingEnvironmentSnapshot;
}
