import { describe, expect, it } from 'vitest';
import {
  ALL_FORCE_DISPOSITIONS,
  getFixedEligibleSecondaryCards,
  getLayoutsForMatchup,
  getRecommendedDispositions,
  isMissionItemActiveInRound,
  resolvePrimaryMissions,
} from '../missionEngine';
import type { Detachment } from '../../types/rules';

describe('11th Edition Mission & Map Engine', () => {
  it('resolves all 25 directional combinations of Force Dispositions', () => {
    for (const d1 of ALL_FORCE_DISPOSITIONS) {
      for (const d2 of ALL_FORCE_DISPOSITIONS) {
        const { yourMission, opponentMission } = resolvePrimaryMissions(d1, d2);
        expect(yourMission).toBeDefined();
        expect(yourMission.mission).toBeTruthy();
        expect(Array.isArray(yourMission.score)).toBe(true);

        expect(opponentMission).toBeDefined();
        expect(opponentMission.mission).toBeTruthy();
        expect(Array.isArray(opponentMission.score)).toBe(true);
      }
    }
  });

  it('correctly resolves Purge the Foe vs Disruption to Punishment vs Delaying Action', () => {
    const { yourMission, opponentMission } = resolvePrimaryMissions('Purge the Foe', 'Disruption');
    expect(yourMission.mission).toBe('Punishment');
    expect(yourMission.setup).toContain('CONDEMNED');
    expect(opponentMission.mission).toBe('Delaying Action');
  });

  it('finds 3 layouts (A, B, C) for every unordered pair of dispositions', () => {
    for (let i = 0; i < ALL_FORCE_DISPOSITIONS.length; i++) {
      for (let j = i; j < ALL_FORCE_DISPOSITIONS.length; j++) {
        const d1 = ALL_FORCE_DISPOSITIONS[i];
        const d2 = ALL_FORCE_DISPOSITIONS[j];
        const layouts = getLayoutsForMatchup(d1, d2);
        expect(layouts.length).toBe(3);
        expect(layouts.map((l) => l.layout)).toEqual(['A', 'B', 'C']);
        layouts.forEach((l) => {
          expect(l.page).toBeGreaterThanOrEqual(9);
          expect(l.page).toBeLessThanOrEqual(53);
          expect(l.file).toMatch(/\.jpg$/);
        });
      }
    }
  });

  it('resolves Page 27 Layout A for Purge the Foe vs Disruption', () => {
    const layouts = getLayoutsForMatchup('Purge the Foe', 'Disruption');
    const layoutA = layouts.find((l) => l.layout === 'A');
    expect(layoutA).toBeDefined();
    expect(layoutA?.page).toBe(27);
    expect(layoutA?.file).toBe('purge-the-foe__disruption__A.jpg');
    expect(layoutA?.attacker.disposition).toBe('Purge the Foe');
    expect(layoutA?.defender.disposition).toBe('Disruption');
  });

  it('filters 4 fixed-eligible secondary cards out of 18', () => {
    const fixed = getFixedEligibleSecondaryCards();
    expect(fixed.length).toBe(4);
    const names = fixed.map((c) => c.name);
    expect(names).toContain('Assassination');
    expect(names).toContain('Bring it Down');
    expect(names).toContain('A Grievous Blow');
    expect(names).toContain('Engage on All Fronts');
  });

  it('correctly evaluates round-scoped active items', () => {
    expect(isMissionItemActiveInRound('R1-2 (end of your turn)', 1)).toBe(true);
    expect(isMissionItemActiveInRound('R1-2 (end of your turn)', 2)).toBe(true);
    expect(isMissionItemActiveInRound('R1-2 (end of your turn)', 3)).toBe(false);

    expect(isMissionItemActiveInRound('R2+ (Cmd phase / R5)', 1)).toBe(false);
    expect(isMissionItemActiveInRound('R2+ (Cmd phase / R5)', 2)).toBe(true);
    expect(isMissionItemActiveInRound('R2+ (Cmd phase / R5)', 5)).toBe(true);

    expect(isMissionItemActiveInRound('End of battle', 4)).toBe(false);
    expect(isMissionItemActiveInRound('End of battle', 5)).toBe(true);
  });

  it('recommends dispositions based on selected detachments', () => {
    const dummyDets: Detachment[] = [
      {
        id: 'det-1',
        factionId: 'SM',
        name: 'Godhammer Assault Force',
        legend: '',
        type: '',
        dp: 2,
        forceDisposition: 'Purge the Foe',
        abilities: [],
      },
      {
        id: 'det-2',
        factionId: 'SM',
        name: 'Wrathful Procession',
        legend: '',
        type: '',
        dp: 1,
        forceDisposition: 'Take and Hold',
        abilities: [],
      },
    ];

    const recommended = getRecommendedDispositions(['det-1', 'det-2'], dummyDets);
    expect(recommended).toEqual(['Purge the Foe', 'Take and Hold']);
  });
});
