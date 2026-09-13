/**
 * [INPUT]: 服务端抛竿时刻、地图水域与垂钓静态目录
 * [OUTPUT]: 鱼饵、鱼潮、天气、时辰、月相和稀有异象的确定性快照
 * [POS]: 垂钓环境规则层；只使用传入时间，不读取数据库、浏览器或随机源
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type {
  FishingAnomalyDefinition,
  FishingBaitDefinition,
  FishingEnvironmentSnapshot,
  FishingMoonPhase,
  FishingTimePhase,
  FishingTideDefinition,
  FishingWeather,
} from './types';

export const FISHING_BAITS: readonly FishingBaitDefinition[] = [
  {
    id: 'spirit-worm',
    name: '灵草蚯蚓',
    description: '以灵草根茎养出的蚯蚓，适合溪湾与浅水鱼种。',
    requiredFishingLevel: 1,
    speciesWeightMultipliers: { 'xiao-qingyu': 1.35, 'qingbo-lingji': 1.45, 'chitail-jinli': 1.2, 'da-caoyu': 1.25 },
    qualityBonus: 0,
    biteDelayMultiplier: 0.92,
  },
  {
    id: 'moonlight-grain',
    name: '月华灵谷',
    description: '晒过月光的灵谷，月相越明，越容易引来灵鲤。',
    requiredFishingLevel: 2,
    speciesWeightMultipliers: { 'qing-lingyu': 1.45, 'yuewen-lu': 1.5, 'wenyao-yueli': 1.25, 'taiyin-yuekun': 1.12 },
    qualityBonus: 0.015,
    biteDelayMultiplier: 1,
  },
  {
    id: 'thunder-meat',
    name: '雷纹血饵',
    description: '封存微弱雷意的血饵，雷雨中会引来凶猛水族。',
    requiredFishingLevel: 3,
    speciesWeightMultipliers: { 'leize-gui': 1.7, 'chiru-yilin': 1.35, 'da-heiyu': 1.3, 'liuwen-jialongyu': 1.2 },
    qualityBonus: 0.02,
    biteDelayMultiplier: 1.08,
  },
  {
    id: 'ancient-scale',
    name: '古鳞香屑',
    description: '以旧鳞磨成的香屑，只有深潭与古泽才会回应。',
    requiredFishingLevel: 5,
    speciesWeightMultipliers: { 'liuwen-jialongyu': 1.55, 'goumang-muyu': 1.3, 'taixu-yinli': 1.32, 'xuanming-zuao': 1.18 },
    qualityBonus: 0.035,
    biteDelayMultiplier: 1.16,
  },
] as const;

export const FISHING_TIDES: readonly FishingTideDefinition[] = [
  { id: 'still-water', name: '平潮', description: '水面平缓，常鱼按平日规律游动。', locationIds: [], speciesWeightMultipliers: {}, qualityBonus: 0 },
  { id: 'green-surge', name: '青潮', description: '木水灵气随潮上涨，灵鲫与草木鱼种更活跃。', locationIds: ['qingxi-shallow', 'lingyue-lake'], speciesWeightMultipliers: { 'qingbo-lingji': 1.35, 'da-caoyu': 1.25, 'qing-lingyu': 1.2 }, qualityBonus: 0.01 },
  { id: 'thunder-surge', name: '雷潮', description: '深潭底部传来闷雷，雷泽鱼种短暂浮上水层。', locationIds: ['leize-deep'], speciesWeightMultipliers: { 'leize-gui': 1.55, 'chiru-yilin': 1.25, 'da-heiyu': 1.2 }, qualityBonus: 0.025 },
  { id: 'moon-pull', name: '月引潮', description: '月华牵引水脉，月纹与文鳐灵鱼更容易咬钩。', locationIds: ['lingyue-lake', 'yunmeng-secret'], speciesWeightMultipliers: { 'yuewen-lu': 1.45, 'wenyao-yueli': 1.3, 'taiyin-yuekun': 1.15 }, qualityBonus: 0.02 },
] as const;

export const FISHING_ANOMALIES: readonly FishingAnomalyDefinition[] = [
  { id: 'starfall-rift', name: '星河倒映', description: '水面映出并不存在的星河，星象鱼种的踪迹被放大。', locationIds: ['yunmeng-secret'], speciesWeightMultipliers: { 'taixu-yinli': 2.4, 'taiyin-yuekun': 1.5 }, qualityBonus: 0.08, rarity: 'mythic' },
  { id: 'dragon-shadow', name: '龙影过泽', description: '云层下掠过无角龙影，假龙与古血鱼种纷纷出水。', locationIds: ['leize-deep', 'yunmeng-secret'], speciesWeightMultipliers: { 'liuwen-jialongyu': 2.2, 'chiru-yilin': 1.6 }, qualityBonus: 0.06, rarity: 'mythic' },
  { id: 'lotus-bloom', name: '灵莲开水', description: '水底灵莲一夜齐放，木系鱼种与灵田相关鱼获大增。', locationIds: ['qingxi-shallow', 'yunmeng-secret'], speciesWeightMultipliers: { 'goumang-muyu': 1.8, 'qing-lingyu': 1.35 }, qualityBonus: 0.04, rarity: 'rare' },
] as const;

export function getFishingBait(id: string): FishingBaitDefinition | null {
  return FISHING_BAITS.find((bait) => bait.id === id) ?? null;
}

export function getFishingTide(id: string): FishingTideDefinition | null {
  return FISHING_TIDES.find((tide) => tide.id === id) ?? null;
}

export function getFishingAnomaly(id: string | null): FishingAnomalyDefinition | null {
  return id ? FISHING_ANOMALIES.find((anomaly) => anomaly.id === id) ?? null : null;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4_294_967_296;
}

export function resolveFishingTimePhase(hour: number): FishingTimePhase {
  if (hour < 6) return '夜半';
  if (hour < 10) return '清晨';
  if (hour < 18) return '白昼';
  if (hour < 22) return '黄昏';
  return '夜半';
}

export function resolveFishingMoonPhase(date: Date): FishingMoonPhase {
  const dayInCycle = Math.floor(date.getTime() / 86_400_000) % 30;
  if (dayInCycle < 4) return '朔月';
  if (dayInCycle < 11) return '上弦';
  if (dayInCycle < 19) return '望月';
  return '下弦';
}

export function resolveFishingEnvironment(input: {
  locationId: string;
  now: Date;
}): FishingEnvironmentSnapshot {
  const { locationId, now } = input;
  const dayKey = now.toISOString().slice(0, 10);
  const weatherRoll = stableHash(`${dayKey}:weather:${locationId}`);
  const weather: FishingWeather = weatherRoll < 0.44 ? '晴' : weatherRoll < 0.66 ? '阴' : weatherRoll < 0.84 ? '雨' : weatherRoll < 0.94 ? '雾' : '雷雨';
  const timePhase = resolveFishingTimePhase(now.getHours());
  const moonPhase = resolveFishingMoonPhase(now);
  const tideSlot = Math.floor(now.getTime() / (6 * 3_600_000));
  const tideCandidates = FISHING_TIDES.filter((tide) => tide.id === 'still-water' || tide.locationIds.includes(locationId));
  const tide = tideCandidates[Math.floor(stableHash(`${locationId}:${tideSlot}:tide`) * tideCandidates.length)] ?? FISHING_TIDES[0]!;
  const anomalyRoll = stableHash(`${dayKey}:${Math.floor(now.getHours() / 4)}:${locationId}:anomaly`);
  const anomaly = anomalyRoll < 0.025
    ? FISHING_ANOMALIES.find((item) => item.id === 'starfall-rift' && item.locationIds.includes(locationId))
      ?? FISHING_ANOMALIES.find((item) => item.id === 'dragon-shadow' && item.locationIds.includes(locationId))
      ?? FISHING_ANOMALIES.find((item) => item.locationIds.includes(locationId))
    : anomalyRoll < 0.07
      ? FISHING_ANOMALIES.find((item) => item.rarity === 'rare' && item.locationIds.includes(locationId))
      : undefined;
  return {
    weather,
    timePhase,
    moonPhase,
    tideId: tide.id,
    tideName: tide.name,
    anomalyId: anomaly?.id ?? null,
    anomalyName: anomaly?.name ?? null,
  };
}
