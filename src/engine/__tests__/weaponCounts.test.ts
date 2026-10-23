import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import defaultRosterJson from '../../config/defaultRoster.json';
import { buildCompositeUnits } from '../compositeUnitBuilder';
import { importFromPlainTextList, matchEquippedWeaponData } from '../../importers/rosterImporter';
import type { Datasheet, Detachment, Enhancement, LiveUnitState, SavedRoster } from '../../types/rules';

describe('Weapon Quantity Resolution and Display Pipeline', () => {
  const smDataRaw = fs.readFileSync(
    path.resolve(process.cwd(), 'public/data/wahapedia-11ed/factions/SM.json'),
    'utf8'
  );
  const smData = JSON.parse(smDataRaw);
  const dsMap = new Map<string, Datasheet>(smData.datasheets.map((d: Datasheet) => [d.id, d]));
  const enhMap = new Map<string, Enhancement>(smData.enhancements.map((e: Enhancement) => [e.id, e]));
  const detList = smData.detachments as Detachment[];

  it('correctly resolves 9 Storm Bolters on the 10-man Terminator Squad in default Crimson Fists roster', () => {
    const roster = defaultRosterJson as unknown as SavedRoster;
    const termUnit = roster.units.find((u) => u.instanceId === 'cf2k_unit_10')!;
    expect(termUnit).toBeDefined();

    const liveStates = new Map<string, LiveUnitState>();
    const compositeUnits = buildCompositeUnits(roster, undefined, dsMap, enhMap, []);

    const termComposite = compositeUnits.find((cu) => cu.primaryUnit.instanceId === 'cf2k_unit_10');
    expect(termComposite).toBeDefined();

    // Check equipped ranged weapons on the composite squad
    const squadStormBolter = termComposite!.equippedRangedWeapons.find(
      (w) => w.weapon.name === 'Storm Bolter' && w.ownerName === 'Terminator Squad'
    );
    expect(squadStormBolter).toBeDefined();
    expect(squadStormBolter!.count).toBe(9);

    const squadAssaultCannon = termComposite!.equippedRangedWeapons.find(
      (w) => w.weapon.name === 'Assault Cannon'
    );
    expect(squadAssaultCannon).toBeDefined();
    expect(squadAssaultCannon!.count).toBe(1);

    const squadCycloneFrag = termComposite!.equippedRangedWeapons.find(
      (w) => w.weapon.name === 'Cyclone Missile Launcher - Frag'
    );
    expect(squadCycloneFrag).toBeDefined();
    expect(squadCycloneFrag!.count).toBe(1);

    // Attached Leaders
    const captainStormBolter = termComposite!.equippedRangedWeapons.find(
      (w) => w.weapon.name === 'Storm Bolter' && w.ownerName === 'Captain In Terminator Armour'
    );
    expect(captainStormBolter).toBeDefined();
    expect(captainStormBolter!.count).toBe(1);

    const ancientStormBolter = termComposite!.equippedRangedWeapons.find(
      (w) => w.weapon.name === 'Storm Bolter' && w.ownerName === 'Ancient In Terminator Armour'
    );
    expect(ancientStormBolter).toBeDefined();
    expect(ancientStormBolter!.count).toBe(1);

    // Melee weapons
    const squadPowerFist = termComposite!.equippedMeleeWeapons.find(
      (w) => w.weapon.name === 'Power Fist' && w.ownerName === 'Terminator Squad'
    );
    expect(squadPowerFist).toBeDefined();
    expect(squadPowerFist!.count).toBe(10);
  });

  it('uses intelligent fallback heuristics when equippedWeaponCounts is omitted', () => {
    const termDs = dsMap.get('000001183')!; // Terminator Squad
    expect(termDs).toBeDefined();

    const dummyRoster: SavedRoster = {
      id: 'test_roster',
      name: 'Test Roster',
      factionId: 'SM',
      battleSize: 'incursion',
      detachmentIds: ['000000780'],
      totalPoints: 390,
      totalDetachmentPoints: 1,
      units: [
        {
          instanceId: 'test_term',
          datasheetId: termDs.id,
          startingModels: 10,
          startingWoundsPerModel: 3,
          points: 390,
          // Notice: NO equippedWeaponCounts provided!
          equippedWeaponIds: [
            '000001183_1_1', // Assault Cannon (non-base)
            '000001183_5_1', // Storm Bolter (base)
          ],
          enhancementIds: [],
        },
      ],
      updatedAt: Date.now(),
    };

    const composites = buildCompositeUnits(dummyRoster, undefined, dsMap, enhMap, []);
    const comp = composites[0];

    const stormBolter = comp.equippedRangedWeapons.find((w) => w.weapon.name === 'Storm Bolter');
    expect(stormBolter).toBeDefined();
    // 10 models minus 1 non-base replacement = 9
    expect(stormBolter!.count).toBe(9);

    const assaultCannon = comp.equippedRangedWeapons.find((w) => w.weapon.name === 'Assault Cannon');
    expect(assaultCannon).toBeDefined();
    expect(assaultCannon!.count).toBe(1);
  });

  it('parses weapon counts correctly during plain-text army list import', () => {
    const rawText = `
Terminator Squad (10 models) (390 pts)
• 1x Terminator Sergeant w/ Storm Bolter, Power Fist
• 1x Terminator w/ Assault Cannon, Power Fist
• 1x Terminator w/ Cyclone Missile Launcher, Storm Bolter, Power Fist
• 7x Terminator w/ Storm Bolter, Power Fist
    `;

    const imported = importFromPlainTextList(rawText, 'SM', Array.from(dsMap.values()), detList, []);
    expect(imported.units).toHaveLength(1);
    const unit = imported.units[0];

    expect(unit.startingModels).toBe(10);
    expect(unit.equippedWeaponCounts).toBeDefined();

    // Assault Cannon: 1
    const acId = '000001183_1_1';
    expect(unit.equippedWeaponCounts![acId]).toBe(1);

    // Storm Bolter: 1 + 1 + 7 = 9
    const sbId = '000001183_5_1';
    expect(unit.equippedWeaponCounts![sbId]).toBe(9);

    // Power Fist: 1 + 1 + 1 + 7 = 10
    const pfId = '000001183_8_1';
    expect(unit.equippedWeaponCounts![pfId]).toBe(10);
  });
});
