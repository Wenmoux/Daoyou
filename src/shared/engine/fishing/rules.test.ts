/**
 * [INPUT]: 垂钓纯规则、环境目录、鱼贸经济与品质常量
 * [OUTPUT]: 验证地图解锁、鱼讯窗口、鱼获品质、成长、鱼贸与灵池概率不回归
 * [POS]: 垂钓领域的跨规则回归网；不触碰数据库或浏览器状态
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { describe, expect, it } from 'vitest';
import {
  experienceForFishingLevel,
  fishingExperienceForCatch,
  fishingLevelFromExperience,
  getAccessibleFishingLocations,
  resolveFishingStrikeOutcome,
  resolveFishCatch,
} from './rules';
import { getFishingBait, resolveFishingEnvironment } from './environment';
import { FISH_SPECIES } from './catalog';
import { DAILY_FISHING_CAST_LIMIT, fishingRewardKey, resolveFishingTierReward } from './rewards';
import { QUALITY_ORDER, QUALITY_VALUES } from '@shared/types/constants';
import { FISHING_BUFF_COSTS, FISH_POINT_REWARDS, POND_MAX_DOMESTICATION, adjacentUpgradeCost, nextPondStage, pondProbability, selectPondTarget } from './economy';

describe('fishing rules', () => {
  it('raises quality when a positive quality bonus is applied', () => {
    const base = resolveFishCatch({ locationId: 'qingxi-shallow', realm: '炼气', speciesRoll: 0, qualityRoll: 0.9, sizeRoll: 0 });
    const boosted = resolveFishCatch({ locationId: 'qingxi-shallow', realm: '炼气', speciesRoll: 0, qualityRoll: 0.9, sizeRoll: 0, qualityBonus: 0.08 });
    expect(QUALITY_ORDER[boosted.quality]).toBeGreaterThan(QUALITY_ORDER[base.quality]);
  });

  it('reserves at most sixty percent of a pond for two target species', () => {
    const weights = [
      { speciesId: 'a', probability: 30, legendaryMultiplier: 2 },
      { speciesId: 'b', probability: 30, legendaryMultiplier: 1 },
    ];
    expect(selectPondTarget(weights, 0.1)?.speciesId).toBe('a');
    expect(selectPondTarget(weights, 0.45)?.speciesId).toBe('b');
    expect(selectPondTarget(weights, 0.75)).toBeNull();
  });

  it('keeps fish economy thresholds deterministic', () => {
    expect(pondProbability(0)).toBe(0);
    expect(pondProbability(99)).toBe(0);
    expect(pondProbability(100)).toBe(5);
    expect(pondProbability(260)).toBe(10);
    expect(pondProbability(560)).toBe(15);
    expect(pondProbability(1040)).toBe(20);
    expect(pondProbability(1640)).toBe(25);
    expect(pondProbability(POND_MAX_DOMESTICATION)).toBe(30);
    expect(nextPondStage(1640)).toEqual({ threshold: 1940, probability: 30 });
    expect(nextPondStage(POND_MAX_DOMESTICATION)).toBeNull();
    expect(
      100 * 1 + 80 * 2 + 60 * 5 + 40 * 12 + 20 * 30 + 10 * 30,
    ).toBe(POND_MAX_DOMESTICATION);
    expect(adjacentUpgradeCost('凡品')).toBe(8);
    expect(adjacentUpgradeCost('神品')).toBeNull();
    expect(FISHING_BUFF_COSTS.legendary_rate).toBe(120);
    expect(FISH_POINT_REWARDS['spirit-worm-pack'].quantity).toBe(10);
  });
  it('only unlocks locations up to the cultivator realm', () => {
    expect(getAccessibleFishingLocations('炼气').map((item) => item.id)).toEqual([
      'qingxi-shallow',
      'lingyue-lake',
    ]);
    expect(getAccessibleFishingLocations('金丹')).toHaveLength(4);
  });

  it('resolves a stable catch from server-provided rolls', () => {
    const result = resolveFishCatch({
      locationId: 'lingyue-lake',
      realm: '炼气',
      speciesRoll: 0.72,
      qualityRoll: 0.1,
      sizeRoll: 0.5,
    });
    expect(result.speciesId).toBe('xuanjia-chenli');
    expect(result.quality).toBe('凡品');
    expect(result.weight).toBe(5.4);
  });

  it('keeps the top roll at divine quality instead of wrapping to common', () => {
    expect(resolveFishCatch({ locationId: 'qingxi-shallow', realm: '炼气', speciesRoll: 0, qualityRoll: 0.999999, sizeRoll: 0 }).quality).toBe('神品');
  });

  it('rejects locked locations', () => {
    expect(() => resolveFishCatch({ locationId: 'leize-deep', realm: '炼气', speciesRoll: 0, qualityRoll: 0, sizeRoll: 0 })).toThrow('尚未解锁');
  });

  it('resolves strike timing on the server-owned bite window', () => {
    expect(resolveFishingStrikeOutcome({ nowMs: 999, biteAtMs: 1000, biteDeadlineAtMs: 1500 })).toBe('early');
    expect(resolveFishingStrikeOutcome({ nowMs: 1200, biteAtMs: 1000, biteDeadlineAtMs: 1500 })).toBe('hooked');
    expect(resolveFishingStrikeOutcome({ nowMs: 1501, biteAtMs: 1000, biteDeadlineAtMs: 1500 })).toBe('late');
  });

  it('keeps fishing experience thresholds and levels monotonic', () => {
    expect(experienceForFishingLevel(1)).toBe(0);
    expect(experienceForFishingLevel(2)).toBe(100);
    expect(fishingLevelFromExperience(0)).toBe(1);
    expect(fishingLevelFromExperience(100)).toBe(2);
    expect(fishingLevelFromExperience(experienceForFishingLevel(5))).toBe(5);
    expect(fishingExperienceForCatch({ quality: QUALITY_VALUES[1], weight: 2, firstDiscovery: true })).toBe(45);
  });

  it('locks a deterministic environment snapshot for the same water and time', () => {
    const now = new Date(2026, 8, 8, 23, 30);
    expect(resolveFishingEnvironment({ locationId: 'leize-deep', now })).toEqual(
      resolveFishingEnvironment({ locationId: 'leize-deep', now }),
    );
    expect(resolveFishingEnvironment({ locationId: 'leize-deep', now })).toMatchObject({
      timePhase: '夜半',
      moonPhase: expect.any(String),
      tideId: expect.any(String),
    });
  });

  it('applies bait and environment metadata to the authoritative catch', () => {
    const catchResult = resolveFishCatch({
      locationId: 'leize-deep',
      realm: '筑基',
      speciesRoll: 0,
      qualityRoll: 0.98,
      sizeRoll: 0.5,
      bait: getFishingBait('thunder-meat') ?? undefined,
      environment: {
        weather: '雷雨',
        timePhase: '夜半',
        moonPhase: '望月',
        tideId: 'thunder-surge',
        tideName: '雷潮',
        anomalyId: 'dragon-shadow',
        anomalyName: '龙影过泽',
      },
    });
    expect(catchResult.baitId).toBe('thunder-meat');
    expect(catchResult.environment.anomalyId).toBe('dragon-shadow');
    expect(catchResult.quality).not.toBe('凡品');
  });

  it('limits daily casts and keeps fish tier rewards idempotent', () => {
    expect(DAILY_FISHING_CAST_LIMIT).toBe(30);
    expect(fishingRewardKey('xiao-qingyu', '凡品')).toBe('xiao-qingyu:凡品');
    expect(fishingRewardKey('xiao-qingyu', '凡品')).toBe(fishingRewardKey('xiao-qingyu', '凡品'));
    expect(fishingRewardKey('xiao-qingyu', '灵品')).not.toBe(fishingRewardKey('xiao-qingyu', '凡品'));
    expect(resolveFishingTierReward({ speciesId: 'xiao-qingyu', quality: '凡品', element: '水' })).toMatchObject({
      cultivationExp: 20,
      attribute: 'spirit',
      attributeGain: 1,
    });
  });

  it('contains an expanded catalogue for long-term discovery', () => {
    expect(FISH_SPECIES.length).toBeGreaterThan(35);
  });

  it('gates advanced bait behind fishing levels', () => {
    expect(getFishingBait('spirit-worm')?.requiredFishingLevel).toBe(1);
    expect(getFishingBait('moonlight-grain')?.requiredFishingLevel).toBe(2);
    expect(getFishingBait('ancient-scale')?.requiredFishingLevel).toBe(5);
  });

});
