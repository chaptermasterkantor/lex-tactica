import { describe, it, expect } from 'vitest';
import {
  calculateMathhammer,
  computeFinalDamagePMF,
  computeHitProbabilities,
  computeSaveFailureProbability,
  computeWoundProbabilities,
  convolvePMFs,
  getDiceExpressionPMF,
  getNextAllocationState,
  getSingleDiePMF,
  parseDiceExpression,
  type DefenderCombatProfile,
  type WeaponCombatProfile,
} from '../mathhammerEngine';

describe('mathhammerEngine — Discrete Probability Math', () => {
  describe('Dice PMFs and Convolutions', () => {
    it('parses static numbers, D3, D6, and expressions correctly', () => {
      expect(parseDiceExpression('3')).toEqual({
        numDice: 0,
        dieSides: 0,
        modifier: 3,
        rawString: '3',
      });
      expect(parseDiceExpression('D6')).toEqual({
        numDice: 1,
        dieSides: 6,
        modifier: 0,
        rawString: 'D6',
      });
      expect(parseDiceExpression('2D6+3')).toEqual({
        numDice: 2,
        dieSides: 6,
        modifier: 3,
        rawString: '2D6+3',
      });
      expect(parseDiceExpression('D3+2')).toEqual({
        numDice: 1,
        dieSides: 3,
        modifier: 2,
        rawString: 'D3+2',
      });
    });

    it('computes single D6 and D3 PMFs accurately', () => {
      const d6 = getSingleDiePMF(6, false);
      expect(d6.length).toBe(7);
      expect(d6[0]).toBe(0);
      for (let i = 1; i <= 6; i++) {
        expect(d6[i]).toBeCloseTo(1 / 6, 6);
      }
    });

    it('re-rolls damage below mean correctly for Eradicator Total Obliteration', () => {
      const d6ReRoll = getSingleDiePMF(6, true);
      // Re-rolling 1, 2, 3 gives expected value 4.25
      let mean = 0;
      for (let i = 1; i <= 6; i++) {
        mean += i * d6ReRoll[i];
      }
      expect(mean).toBeCloseTo(4.25, 4);

      const d3ReRoll = getSingleDiePMF(3, true);
      // Re-rolling 1 on D3 gives expected value 7/3 ~= 2.333
      let meanD3 = 0;
      for (let i = 1; i <= 3; i++) {
        meanD3 += i * d3ReRoll[i];
      }
      expect(meanD3).toBeCloseTo(7 / 3, 4);
    });

    it('convolves 2D6 into exact triangular distribution with mean 7.0', () => {
      const pmf2d6 = getDiceExpressionPMF({
        numDice: 2,
        dieSides: 6,
        modifier: 0,
        rawString: '2D6',
      });
      expect(pmf2d6.length).toBe(13); // indices 0 to 12
      expect(pmf2d6[2]).toBeCloseTo(1 / 36, 6);
      expect(pmf2d6[7]).toBeCloseTo(6 / 36, 6);
      expect(pmf2d6[12]).toBeCloseTo(1 / 36, 6);

      let mean = 0;
      let sum = 0;
      for (let i = 0; i < pmf2d6.length; i++) {
        sum += pmf2d6[i];
        mean += i * pmf2d6[i];
      }
      expect(sum).toBeCloseTo(1.0, 6);
      expect(mean).toBeCloseTo(7.0, 6);
    });
  });

  describe('Hit Roll Probabilities', () => {
    it('handles Torrent / Auto-hit', () => {
      const res = computeHitProbabilities('3+', true, false, 0, 6, 'none');
      expect(res.pNormHit).toBe(1.0);
      expect(res.pMiss).toBe(0.0);
      expect(res.pCritHit).toBe(0.0);
    });

    it('handles standard BS 3+ without modifiers', () => {
      // 1, 2 miss (2/6); 3, 4, 5 norm hit (3/6); 6 crit hit (1/6)
      const res = computeHitProbabilities('3+', false, false, 0, 6, 'none');
      expect(res.pMiss).toBeCloseTo(2 / 6, 6);
      expect(res.pNormHit).toBeCloseTo(3 / 6, 6);
      expect(res.pCritHit).toBeCloseTo(1 / 6, 6);
    });

    it('caps hit roll modifiers at +1 and -1', () => {
      // +2 modifier should be clamped to +1: BS 4+ becomes 3+
      const resPlus2 = computeHitProbabilities('4+', false, false, 2, 6, 'none');
      // Roll 1 fails; 2 fails; 3,4,5 succeed; 6 crit -> miss 2/6, norm 3/6, crit 1/6
      expect(resPlus2.pMiss).toBeCloseTo(2 / 6, 6);
      expect(resPlus2.pNormHit).toBeCloseTo(3 / 6, 6);
    });

    it('handles Fire Overwatch (only 6 hits, critical)', () => {
      const res = computeHitProbabilities('2+', false, true, 0, 6, 'none');
      expect(res.pCritHit).toBeCloseTo(1 / 6, 6);
      expect(res.pNormHit).toBe(0);
      expect(res.pMiss).toBeCloseTo(5 / 6, 6);
    });

    it('handles Re-roll 1s to Hit', () => {
      // BS 3+: 1 re-rolls. Re-rolled 1 has 4/6 chance to become a hit!
      const res = computeHitProbabilities('3+', false, false, 0, 6, 'ones');
      // Original miss 2/6 - 1/6 + 1/6*(2/6) = 1/6 + 2/36 = 8/36 = 2/9
      expect(res.pMiss).toBeCloseTo(8 / 36, 6);
      expect(res.pNormHit + res.pCritHit).toBeCloseTo(28 / 36, 6);
    });
  });

  describe('Wound Roll & Save Roll', () => {
    it('computes S vs T correctly across brackets', () => {
      // S8 vs T4 (S >= 2T -> 2+ to wound)
      const res2p = computeWoundProbabilities(8, 4, 0, 6, 'none');
      expect(res2p.pNormWound + res2p.pCritWound).toBeCloseTo(5 / 6, 6);

      // S5 vs T4 (S > T -> 3+ to wound)
      const res3p = computeWoundProbabilities(5, 4, 0, 6, 'none');
      expect(res3p.pNormWound + res3p.pCritWound).toBeCloseTo(4 / 6, 6);

      // S4 vs T4 (S == T -> 4+ to wound)
      const res4p = computeWoundProbabilities(4, 4, 0, 6, 'none');
      expect(res4p.pNormWound + res4p.pCritWound).toBeCloseTo(3 / 6, 6);

      // S3 vs T4 (S < T -> 5+ to wound)
      const res5p = computeWoundProbabilities(3, 4, 0, 6, 'none');
      expect(res5p.pNormWound + res5p.pCritWound).toBeCloseTo(2 / 6, 6);

      // S2 vs T4 (2S <= T -> 6+ to wound)
      const res6p = computeWoundProbabilities(2, 4, 0, 6, 'none');
      expect(res6p.pNormWound + res6p.pCritWound).toBeCloseTo(1 / 6, 6);
    });

    it('handles Anti-Keyword X+ lowering crit threshold to X+', () => {
      // Anti-Vehicle 4+: rolls of 4, 5, 6 are Critical Wounds (3/6)
      const resAnti4 = computeWoundProbabilities(4, 10, 0, 4, 'none');
      expect(resAnti4.pCritWound).toBeCloseTo(3 / 6, 6);
    });

    it('enforces 40k Cover rule (3+ save against AP 0 cannot improve with cover)', () => {
      // Sv 3+ vs AP 0 with Cover: does NOT improve, save is still 3+ (fail on 1, 2 = 2/6)
      const pFail = computeSaveFailureProbability(3, null, 0, true, false);
      expect(pFail).toBeCloseTo(2 / 6, 6);

      // Sv 4+ vs AP 0 with Cover: DOES improve to 3+ (fail on 1, 2 = 2/6)
      const pFail4 = computeSaveFailureProbability(4, null, 0, true, false);
      expect(pFail4).toBeCloseTo(2 / 6, 6);

      // Sv 3+ vs AP -1 with Cover: improves to 3 - (-1) - 1 = 3+
      const pFailAP1 = computeSaveFailureProbability(3, null, -1, true, false);
      expect(pFailAP1).toBeCloseTo(2 / 6, 6);
    });

    it('uses Invulnerable save when armor save is degraded past it', () => {
      // Sv 3+, Invuln 4+ vs AP -3: armor is 6+, invuln 4+ taken (fail on 1, 2, 3 = 3/6)
      const pFail = computeSaveFailureProbability(3, 4, -3, false, false);
      expect(pFail).toBeCloseTo(3 / 6, 6);
    });
  });

  describe('1D Multi-Wound Allocation State Machine', () => {
    it('wastes excess damage on dead model without spillover', () => {
      // Unit of 3 models with 2 wounds each (total 6 wounds).
      // Active model has 2 wounds. Hit deals 3 damage.
      // Model dies (2 wounds lost), excess 1 damage is lost.
      const hNext = getNextAllocationState(6, 3, 2);
      expect(hNext).toBe(4); // Exactly 4 wounds remaining (2 living models)

      // Next hit deals 1 damage to fresh model (2 wounds remaining -> 1 remaining, total 3)
      const hNext2 = getNextAllocationState(4, 1, 2);
      expect(hNext2).toBe(3);

      // Next hit deals 4 damage to wounded model (1 wound remaining -> model dies, excess 3 wasted)
      const hNext3 = getNextAllocationState(3, 4, 2);
      expect(hNext3).toBe(2); // Exactly 2 wounds remaining (1 living model)
    });
  });

  describe('Full Combat Simulation & Invariants', () => {
    it('simulates Bolters vs Space Marine Intercessors accurately', () => {
      // 5 Intercessors: 10 shots, BS 3+, S4, AP 0, D1 vs T4, Sv 3+, 5 models, W2
      const weapons: WeaponCombatProfile[] = [
        {
          id: 'bolt_rifle',
          name: 'Bolt Rifle',
          count: 5,
          A: '2',
          BS_WS: '3+',
          S: 4,
          AP: 0,
          D: '1',
        },
      ];
      const defender: DefenderCombatProfile = {
        name: 'Intercessors',
        models: 5,
        woundsPerModel: 2,
        currentModelWounds: 2,
        T: 4,
        Sv: 3,
      };

      const result = calculateMathhammer(weapons, defender);

      // Verify probabilities sum to 1.000
      let totalProb = 0;
      for (const d of result.modelsKilled.distribution) {
        totalProb += d.probability;
      }
      expect(totalProb).toBeGreaterThanOrEqual(99.0); // Rounded to 1 decimal place, should be ~100%

      // Law of Total Expectation on Quartile Bands:
      // 0.25 * bottom25.bandMean + 0.5 * middle50.bandMean + 0.25 * top25.bandMean == expectedMean
      const reconstitutedMean =
        0.25 * result.modelsKilled.bottom25.bandMean +
        0.5 * result.modelsKilled.middle50.bandMean +
        0.25 * result.modelsKilled.top25.bandMean;
      expect(reconstitutedMean).toBeCloseTo(result.modelsKilled.expectedMean, 1);
    });

    it('simulates Eradicators Melta Rifles - Hunter vs Vehicle with Damage Re-roll', () => {
      // 3 Eradicators: 3 Melta Rifles (D: D3+2, Melta 2 at half range -> D3+4),
      // BS 2+ (Hunter), S12, AP -3 vs T10, Sv 3+, Inv 5+, W12 Vehicle
      const weapons: WeaponCombatProfile[] = [
        {
          id: 'melta_rifle_hunter',
          name: 'Melta Rifle (🎯 Hunter)',
          count: 3,
          A: '1',
          BS_WS: '2+',
          S: 12,
          AP: -3,
          D: 'D3+2',
          meltaVal: 2, // Half range melta 2
          reRollDamage: true, // Total Obliteration
        },
      ];
      const defender: DefenderCombatProfile = {
        name: 'Gladiator Tank',
        models: 1,
        woundsPerModel: 12,
        currentModelWounds: 12,
        T: 10,
        Sv: 3,
        invSv: 5,
      };

      const result = calculateMathhammer(weapons, defender);

      expect(result.killProbabilityPercent).toBeGreaterThanOrEqual(0);
      expect(result.killProbabilityPercent).toBeLessThanOrEqual(100);
      expect(result.effectiveWoundsInflicted.expectedMean).toBeGreaterThan(4);
    });

    it('verifies Feel No Pain 5+ reduces expected damage by 1/3', () => {
      // Weapon: 1 Attack dealing static 6 damage, BS 2+ auto-wound auto-fail save
      const rawD = new Float64Array(7);
      rawD[6] = 1.0;
      const fnpResult = computeFinalDamagePMF(rawD, 'none', 0, 0, 5); // FNP 5+ ignores 2/6 = 1/3

      let meanDamage = 0;
      for (let k = 0; k < fnpResult.length; k++) {
        meanDamage += k * fnpResult[k];
      }
      // Out of 6 damage, (2/3) should get through = 4.0
      expect(meanDamage).toBeCloseTo(4.0, 5);
    });
  });
});
