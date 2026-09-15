import { describe, expect, it } from 'vitest';
import { POND_DOMESTICATION_BY_QUALITY, POND_MAX_DOMESTICATION, nextPondStage, normalizeFishQualityCounts, pondProbability, selectPondTarget } from './economy';

describe('fishing economy rules', () => {
  it('matches the six-stage spirit pond feeding ladder', () => {
    const stages = [
      ['凡品', 100, 5],
      ['灵品', 80, 10],
      ['玄品', 60, 15],
      ['真品', 40, 20],
      ['地品', 20, 25],
      ['地品', 10, 30],
    ] as const;
    let domestication = 0;
    for (const [quality, count, probability] of stages) {
      domestication += POND_DOMESTICATION_BY_QUALITY[quality] * count;
      expect(pondProbability(domestication)).toBe(probability);
    }
    expect(domestication).toBe(POND_MAX_DOMESTICATION);
  });

  it('keeps two pond targets capped at sixty percent', () => {
    const weights = [
      { speciesId: 'a', probability: 30, legendaryMultiplier: 2 },
      { speciesId: 'b', probability: 30, legendaryMultiplier: 2 },
    ];
    expect(selectPondTarget(weights, 0.59)?.speciesId).toBe('b');
    expect(selectPondTarget(weights, 0.6)).toBeNull();
    expect(nextPondStage(POND_MAX_DOMESTICATION)).toBeNull();
  });

  it('repairs legacy quality ledgers without creating or losing fish', () => {
    expect(normalizeFishQualityCounts({}, 4)).toEqual({ 凡品: 4 });
    expect(normalizeFishQualityCounts({ 灵品: 2 }, 5)).toEqual({ 灵品: 2, 凡品: 3 });
    expect(normalizeFishQualityCounts({ 凡品: 5, 神品: 2 }, 3)).toEqual({ 神品: 2, 凡品: 1 });
    expect(Object.values(normalizeFishQualityCounts({ 凡品: 99 }, 7)).reduce((sum, count) => sum + count, 0)).toBe(7);
  });
});
