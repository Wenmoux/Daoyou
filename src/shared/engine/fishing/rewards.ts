/**
 * [INPUT]: 鱼种元素、品质与垂钓成长规则
 * [OUTPUT]: 每日次数上限与稳定的鱼种品阶奖励解析器
 * [POS]: 垂钓领域的纯规则层；奖励 key 是幂等边界，服务端据此保证一次性奖励
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { QUALITY_ORDER, type ElementType, type Quality } from '@shared/types/constants';

export const DAILY_FISHING_CAST_LIMIT = 30;

export type FishingRewardAttribute =
  | 'vitality'
  | 'strength'
  | 'spirit'
  | 'endurance'
  | 'speed'
  | 'willpower';

export type FishingTierReward = {
  rewardKey: string;
  cultivationExp: number;
  attribute: FishingRewardAttribute;
  attributeGain: number;
};

const ELEMENT_REWARD_ATTRIBUTE: Record<ElementType, FishingRewardAttribute> = {
  金: 'speed',
  木: 'vitality',
  水: 'spirit',
  火: 'strength',
  土: 'endurance',
  风: 'speed',
  雷: 'willpower',
  冰: 'willpower',
};

export function fishingRewardKey(speciesId: string, quality: Quality): string {
  return `${speciesId}:${quality}`;
}

export function resolveFishingTierReward(input: {
  speciesId: string;
  quality: Quality;
  element: ElementType;
}): FishingTierReward {
  const qualityRank = QUALITY_ORDER[input.quality] ?? 0;
  return {
    rewardKey: fishingRewardKey(input.speciesId, input.quality),
    cultivationExp: 20 + qualityRank * 15,
    attribute: ELEMENT_REWARD_ATTRIBUTE[input.element],
    attributeGain: 1,
  };
}
