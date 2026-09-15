/**
 * [INPUT]: 鱼获品质与灵池喂养贡献
 * [OUTPUT]: 鱼货积分、升阶成本和灵池阶段的纯函数规则
 * [POS]: 垂钓经济与灵池的共享规则层，不依赖数据库或浏览器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { QUALITY_ORDER, type Quality } from '@shared/types/constants';

export const FISH_POINT_BY_QUALITY: Record<Quality, number> = {
  凡品: 1, 灵品: 3, 玄品: 8, 真品: 20, 地品: 50, 天品: 100, 仙品: 220, 神品: 500,
};

export const POND_DOMESTICATION_BY_QUALITY: Record<Quality, number> = {
  凡品: 1, 灵品: 2, 玄品: 5, 真品: 12, 地品: 30, 天品: 70, 仙品: 160, 神品: 400,
};

export const POND_PROBABILITY_STAGES = [
  { threshold: 0, probability: 0 },
  { threshold: 20, probability: 5 },
  { threshold: 60, probability: 10 },
  { threshold: 140, probability: 15 },
  { threshold: 300, probability: 20 },
  { threshold: 600, probability: 25 },
  { threshold: 1000, probability: 30 },
] as const;

export function pondProbability(domestication: number): number {
  const stage = POND_PROBABILITY_STAGES.slice().reverse().find((item) => domestication >= item.threshold);
  return stage?.probability ?? 0;
}

export function adjacentUpgradeCost(quality: Quality): number | null {
  const order = QUALITY_ORDER[quality];
  if (order >= 7) return null;
  return [8, 7, 6, 5, 5, 4, 3][order] ?? null;
}

export function fishPointValue(quality: Quality): number {
  return FISH_POINT_BY_QUALITY[quality];
}

export const FISHING_BUFF_COSTS = {
  legendary_rate: 120,
  double_catch: 160,
} as const;

export const FISH_POINT_REWARDS = {
  'spirit-worm-pack': { name: '灵蚯蚓鱼饵包', baitId: 'spirit-worm', cost: 40, quantity: 10 },
  'moonlight-grain-pack': { name: '月华米鱼饵包', baitId: 'moonlight-grain', cost: 80, quantity: 10 },
} as const;


export type PondSpeciesWeight = {
  speciesId: string;
  probability: number;
  legendaryMultiplier: number;
};

export function selectPondTarget(
  weights: readonly PondSpeciesWeight[],
  roll: number,
): PondSpeciesWeight | null {
  let cursor = Math.min(0.999999, Math.max(0, roll)) * 100;
  for (const weight of weights) {
    const probability = Math.min(30, Math.max(0, weight.probability));
    if (cursor < probability) return weight;
    cursor -= probability;
  }
  return null;
}
