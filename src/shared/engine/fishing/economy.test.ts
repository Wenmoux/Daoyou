import { describe, expect, it } from 'vitest';
import { POND_DOMESTICATION_BY_QUALITY, POND_MAX_DOMESTICATION, nextPondStage, pondProbability, selectPondTarget } from './economy';

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
});
