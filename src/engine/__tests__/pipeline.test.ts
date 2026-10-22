import { describe, expect, it } from 'vitest';
import { parseWahapediaPipeCsv, stripHtmlToText } from '../csvParser';
import {
  analyzeAbilityText,
  normalizeAbilityCategory,
  normalizeCoreActionPhases,
  normalizeStratagemPhase,
  normalizeStratagemTurn,
  parseDamagedThreshold,
  parseDatasheetCosts,
  parseSupportLeaderOverride,
} from '../phaseNormalizer';
import { getExpectedPointsForUnitCopy, validateRoster } from '../rosterValidator';
import { buildCompositeUnits } from '../compositeUnitBuilder';
import { createInitialGameSession, transitionGameSessionStep } from '../gameSessionEngine';
import { lookupKeywordDefinition } from '../keywordGlossary';
import type { Datasheet, Detachment, Enhancement, SavedRoster, Stratagem } from '../../types/rules';

describe('Milestone 1: Wahapedia 11th Ed Multiline Pipe CSV Parser & Normalizers', () => {
  it('parses pipe-delimited CSV rows containing embedded newlines inside HTML descriptions', () => {
    const rawCsv = [
      'id|name|description|phase|',
      '001|THREAT TARGETERS|Line 1 of HTML<br>',
      'Line 2 of HTML|Shooting phase|',
      '002|CLEAN ROW|Single line|Command phase|',
    ].join('\n');

    const res = parseWahapediaPipeCsv(rawCsv);
    expect(res.leftover).toBe('');
    expect(res.rows).toHaveLength(2);
    expect(res.rows[0].id).toBe('001');
    expect(res.rows[0].phase).toBe('Shooting phase');
    expect(res.rows[1].id).toBe('002');
  });

  it('normalizes all 13 unique Wahapedia 11th Ed Stratagem phase strings', () => {
    expect(normalizeStratagemPhase('Command phase')).toEqual(['command']);
    expect(normalizeStratagemPhase('Movement phase')).toEqual(['movement']);
    expect(normalizeStratagemPhase('Shooting phase')).toEqual(['shooting']);
    expect(normalizeStratagemPhase('Charge phase')).toEqual(['charge']);
    expect(normalizeStratagemPhase('Fight phase')).toEqual(['fight']);
    expect(normalizeStratagemPhase('Any phase')).toEqual(['any']);
    expect(normalizeStratagemPhase('Movement or Charge phase')).toEqual(['movement', 'charge']);
    expect(normalizeStratagemPhase('Shooting or Charge phase')).toEqual(['shooting', 'charge']);
    expect(normalizeStratagemPhase('Shooting or Fight phase')).toEqual(['shooting', 'fight']);
    expect(normalizeStratagemPhase('Charge or Fight phase')).toEqual(['charge', 'fight']);
    expect(normalizeStratagemPhase('Ability "Move"')).toEqual(['movement']);
    expect(normalizeStratagemPhase('Ability "Shoot"')).toEqual(['shooting']);
    expect(normalizeStratagemPhase('Ability "Fight"')).toEqual(['fight']);
  });

  it('normalizes Stratagem turn strings and Russian layout ability categories', () => {
    expect(normalizeStratagemTurn('Your turn')).toBe('your_turn');
    expect(normalizeStratagemTurn('Opponent’s turn')).toBe('opponent_turn');
    expect(normalizeStratagemTurn('Either player’s turn')).toBe('either');

    expect(normalizeAbilityCategory('Fortification (левая колонка)')).toBe('Fortification');
    expect(normalizeAbilityCategory('Special (правая колонка)')).toBe('Special');
    expect(normalizeAbilityCategory('Core')).toBe('Core');
  });

  it('parses Enhancements.support_leader HTML links into structured SupportLeaderOverride', () => {
    const slugMap = new Map<string, string>([
      ['necrons/ophydian-destroyers', 'ds_ophydian'],
      ['necrons/skorpekh-destroyers', 'ds_skorpekh'],
    ]);
    const html =
      '<span class="kwb">SUPPORT:</span> <a class="kwbOne" href="/wh40k11ed/factions/necrons/Ophydian-Destroyers">OPHYDIAN DESTROYERS</a>, <a class="kwbOne" href="/wh40k11ed/factions/necrons/Skorpekh-Destroyers">SKORPEKH DESTROYERS</a>';

    const override = parseSupportLeaderOverride(html, slugMap);
    expect(override).toBeDefined();
    expect(override?.roleOverride).toBe('support');
    expect(override?.targetDatasheetIds).toEqual(['ds_ophydian', 'ds_skorpekh']);
  });

  it('parses 11th Edition escalating duplicate-unit cost tiers and wargear options', () => {
    const rows = [
      { line: '1', description: 'YOUR 1ST TO 2ND UNITS COST', cost: '' },
      { line: '2', description: '1 model', cost: '115' },
      { line: '3', description: 'YOUR 3RD+ UNIT COSTS', cost: '' },
      { line: '4', description: '1 model', cost: '130' },
      { line: '5', description: 'WARGEAR OPTIONS', cost: '' },
      { line: '6', description: 'Heavy weapon upgrade', cost: '15' },
    ];

    const { costTiers, wargearCosts } = parseDatasheetCosts(rows);
    expect(costTiers).toHaveLength(2);
    expect(costTiers[0].tierGroup).toBe('1st_to_2nd');
    expect(costTiers[0].cost).toBe(115);
    expect(costTiers[1].tierGroup).toBe('3rd+');
    expect(costTiers[1].cost).toBe(130);
    expect(wargearCosts).toHaveLength(1);
    expect(wargearCosts[0].cost).toBe(15);

    const mockDs = { costTiers, wargearCosts } as Datasheet;
    expect(getExpectedPointsForUnitCopy(mockDs, 1, 1)).toBe(115);
    expect(getExpectedPointsForUnitCopy(mockDs, 1, 2)).toBe(115);
    expect(getExpectedPointsForUnitCopy(mockDs, 1, 3)).toBe(130);
  });

  it('resolves exact and parameterized unit keywords and weapon abilities for hover tooltips', () => {
    const infantry = lookupKeywordDefinition('Infantry');
    expect(infantry?.category).toBe('unit');
    expect(infantry?.summary).toContain('Ruins');

    const lethal = lookupKeywordDefinition('[LETHAL HITS]');
    expect(lethal?.category).toBe('weapon');
    expect(lethal?.summary).toContain('Critical Hits');

    const sustained = lookupKeywordDefinition('SUSTAINED HITS 2');
    expect(sustained?.name).toBe('Sustained Hits 2');
    expect(sustained?.summary).toContain('2 additional hits');

    const antiVeh = lookupKeywordDefinition('ANTI-VEHICLE 4+');
    expect(antiVeh?.name).toBe('Anti-VEHICLE 4+');
    expect(antiVeh?.summary).toContain('4+');

    const heavy = lookupKeywordDefinition('[HEAVY]');
    expect(heavy?.category).toBe('weapon');
    expect(heavy?.summary).toContain('3" or less');

    const blast1 = lookupKeywordDefinition('BLAST 1');
    expect(blast1?.category).toBe('weapon');
    expect(blast1?.name).toBe('Blast 1');

    const cleave2 = lookupKeywordDefinition('CLEAVE 2');
    expect(cleave2?.category).toBe('weapon');
    expect(cleave2?.name).toBe('Cleave 2');

    const condLethal = lookupKeywordDefinition('LETHAL HITS: non-MONSTER/VEHICLE');
    expect(condLethal?.category).toBe('weapon');
    expect(condLethal?.name).toContain('non-MONSTER/VEHICLE');
  });

  it('maps 11th Edition Core Actions to their exact phases and analyzes Faction/Army rules accurately', () => {
    expect(normalizeCoreActionPhases('SCOUT MOVE', 'Ability "Move"', 'Before the first turn begins...')).toEqual([
      'pre_game',
    ]);
    expect(normalizeCoreActionPhases('CHARGE MOVE', 'Ability "Move"', 'In your Charge phase...')).toEqual([
      'charge',
    ]);
    expect(normalizeCoreActionPhases('PILE-IN MOVE', 'Ability "Move"', 'In the Fight phase...')).toEqual([
      'fight',
    ]);
    expect(normalizeCoreActionPhases('CONSOLIDATION MOVE', 'Ability "Move"', 'In the Fight phase...')).toEqual([
      'fight',
    ]);
    expect(normalizeCoreActionPhases('NORMAL FIGHT', 'Ability "Fight"', 'In the Fight phase...')).toEqual([
      'fight',
    ]);
    expect(normalizeCoreActionPhases('SURGE MOVE', 'Ability "Move"', 'Make a Surge move...')).toEqual([
      'movement',
      'shooting',
      'charge',
    ]);

    const combatDoctrines = analyzeAbilityText(
      'Combat Doctrines',
      'At the start of your Command phase, you can select one of the Combat Doctrines listed below. Until the start of your next Command phase, that Combat Doctrine is active.'
    );
    expect(combatDoctrines.phases).toEqual(['command']);
    expect(combatDoctrines.timing).toBe('your_turn');

    const musterRule = analyzeAbilityText(
      'Templar Vows',
      'If your army includes one or more BLACK TEMPLARS units, it cannot include any Adeptus Astartes PSYKER models.'
    );
    expect(musterRule.phases).toEqual(['pre_game']);
  });
});

describe('Milestone 2 & 3: 11th Ed Attachment Validator & Dynamic CompositeUnit Lifecycle', () => {
  const bodyguardDs: Datasheet = {
    id: 'ds_intercessors',
    name: 'Intercessor Squad',
    factionId: 'SM',
    sourceId: 's1',
    legend: '',
    role: 'Battleline',
    loadout: '',
    transport: '',
    virtual: false,
    isSupport: false,
    leaderHead: '',
    leaderFooter: '',
    damagedW: '1-4',
    damagedThreshold: parseDamagedThreshold('1-4'),
    link: '',
    slug: 'space-marines/intercessor-squad',
    models: [{ line: 1, name: 'Intercessor', M: '6"', T: 4, Sv: '3+', W: 2, Ld: '6+', OC: 2 }],
    rangedWeapons: [],
    meleeWeapons: [],
    abilities: [
      {
        id: 'ab_dd',
        line: 1,
        name: 'Deadly Demise D3',
        description: 'Deadly Demise D3',
        type: 'Core',
        parameter: 'D3',
        phases: ['any'],
        timing: 'either',
        isLeaderBuff: false,
        isSupportBuff: false,
      },
    ],
    coreAbilities: ['Deadly Demise D3'],
    factionAbilities: ['Combat Doctrines'],
    keywords: ['Infantry', 'Battleline'],
    factionKeywords: ['Adeptus Astartes'],
    unitComposition: ['10 Intercessors'],
    wargearOptions: [],
    costTiers: [{ tierGroup: 'standard', tierLabel: 'YOUR UNIT COSTS', line: 1, description: '10 models', modelsCount: 10, cost: 160 }],
    wargearCosts: [],
    canLeadDatasheetIds: [],
    validStratagemIds: ['strat_1'],
    validEnhancementIds: [],
    validDetachmentAbilityIds: [],
  };

  const captainDs: Datasheet = {
    ...bodyguardDs,
    id: 'ds_captain',
    name: 'Captain',
    role: 'Infantry Character',
    isSupport: false,
    canLeadDatasheetIds: ['ds_intercessors'],
    keywords: ['Infantry', 'Character', 'Captain'],
    abilities: [
      {
        id: 'ab_cap_lead',
        line: 1,
        name: 'Finest Hour (While leading)',
        description: 'While this model is leading a unit, weapons equipped by models in that unit have [LETHAL HITS].',
        type: 'Datasheet',
        phases: ['shooting', 'fight'],
        timing: 'either',
        isLeaderBuff: true,
        isSupportBuff: false,
      },
      {
        id: 'ab_cap_self',
        line: 2,
        name: 'Rites of Battle',
        description: 'Once per battle round, target this unit with a Stratagem for -1 CP.',
        type: 'Datasheet',
        phases: ['any'],
        timing: 'either',
        isLeaderBuff: false,
        isSupportBuff: false,
      },
    ],
  };

  const apothecaryDs: Datasheet = {
    ...bodyguardDs,
    id: 'ds_apothecary',
    name: 'Apothecary',
    role: 'Infantry Character',
    isSupport: true,
    canLeadDatasheetIds: ['ds_intercessors'],
    keywords: ['Infantry', 'Character', 'Apothecary'],
    abilities: [
      {
        id: 'ab_apo_lead',
        line: 1,
        name: 'Narthecium',
        description: 'While this model is leading a unit, in your Command phase, you can return 1 destroyed Bodyguard model to that unit.',
        type: 'Datasheet',
        phases: ['command'],
        timing: 'your_turn',
        isLeaderBuff: false,
        isSupportBuff: true,
      },
    ],
  };

  const datasheetsMap = new Map<string, Datasheet>([
    [bodyguardDs.id, bodyguardDs],
    [captainDs.id, captainDs],
    [apothecaryDs.id, apothecaryDs],
  ]);

  const detachmentsMap = new Map<string, Detachment>([
    ['det_1', { id: 'det_1', factionId: 'SM', name: 'Gladius Task Force', legend: '', type: '', dp: 2, abilities: [] }],
    ['det_2', { id: 'det_2', factionId: 'SM', name: 'Anvil Siege Force', legend: '', type: '', dp: 2, abilities: [] }],
  ]);

  const enhancementsMap = new Map<string, Enhancement>();

  const roster: SavedRoster = {
    id: 'r1',
    name: 'Crimson Fists',
    factionId: 'SM',
    battleSize: 'strike_force',
    detachmentIds: ['det_1'],
    totalPoints: 300,
    totalDetachmentPoints: 2,
    updatedAt: Date.now(),
    units: [
      {
        instanceId: 'u_intercessors',
        datasheetId: 'ds_intercessors',
        startingModels: 10,
        startingWoundsPerModel: 2,
        points: 160,
        enhancementIds: [],
        attachedLeaderInstanceId: 'u_captain',
        attachedSupportInstanceId: 'u_apothecary',
      },
      {
        instanceId: 'u_captain',
        datasheetId: 'ds_captain',
        startingModels: 1,
        startingWoundsPerModel: 5,
        points: 80,
        enhancementIds: [],
      },
      {
        instanceId: 'u_apothecary',
        datasheetId: 'ds_apothecary',
        startingModels: 1,
        startingWoundsPerModel: 4,
        points: 50,
        enhancementIds: [],
      },
    ],
  };

  it('validates 1 Regular Leader + 1 Support Leader and flags exceeded Detachment Points', () => {
    const validIssues = validateRoster(roster, datasheetsMap, detachmentsMap, enhancementsMap);
    expect(validIssues).toHaveLength(0);

    const overDpRoster: SavedRoster = {
      ...roster,
      detachmentIds: ['det_1', 'det_2'], // 2 + 2 = 4 DP > Strike Force max 3 DP
    };
    const dpIssues = validateRoster(overDpRoster, datasheetsMap, detachmentsMap, enhancementsMap);
    expect(dpIssues.some((i) => i.code === 'DP_EXCEEDED')).toBe(true);
  });

  it('merges Bodyguard + Leader + Support, detects Below Half-Strength & Damaged brackets, deactivates dead Leader buffs, and separates surviving Characters when Bodyguard is wiped out', () => {
    const session = createInitialGameSession(roster, 'user');

    // Initial state: 1 merged CompositeUnit (Intercessors + Captain + Apothecary)
    let composites = buildCompositeUnits(roster, session, datasheetsMap, enhancementsMap, []);
    expect(composites).toHaveLength(1);
    expect(composites[0].displayName).toBe('Intercessor Squad + Captain + Apothecary');
    expect(composites[0].combinedKeywords).toContain('Captain');
    expect(composites[0].combinedKeywords).toContain('Apothecary');
    expect(composites[0].isBelowHalfStrength).toBe(false);

    // 1. Reduce Intercessors from 10 models to 4 models (< 50% -> Below Half-Strength!)
    session.unitStates['u_intercessors'].remainingModels = 4;
    session.unitStates['u_intercessors'].currentModelWounds = 3; // <= damagedThreshold (4)
    composites = buildCompositeUnits(roster, session, datasheetsMap, enhancementsMap, []);
    expect(composites[0].isBelowHalfStrength).toBe(true);
    expect(composites[0].isInDamagedBracket).toBe(true);

    // 2. Kill attached Captain via [PRECISION] (0 wounds) -> Captain's buff is deactivated!
    session.unitStates['u_captain'].currentModelWounds = 0;
    session.unitStates['u_captain'].remainingModels = 0;
    session.unitStates['u_captain'].status = 'destroyed';
    composites = buildCompositeUnits(roster, session, datasheetsMap, enhancementsMap, []);
    const capAbility = composites[0].combinedAbilities.find((a) => a.id === 'ab_cap_lead');
    expect(capAbility?.isDeactivatedByDeath).toBe(true);

    // 3. Wipe out the Bodyguard squad (0 models) -> Surviving Apothecary separates into its own unit card!
    session.unitStates['u_intercessors'].remainingModels = 0;
    session.unitStates['u_intercessors'].status = 'destroyed';
    composites = buildCompositeUnits(roster, session, datasheetsMap, enhancementsMap, []);

    const separatedApothecary = composites.find((c) => c.primaryUnit.instanceId === 'u_apothecary');
    expect(separatedApothecary).toBeDefined();
    expect(separatedApothecary?.primaryLiveState.isDetachedFromBodyguard).toBe(true);
    // Its "While leading a unit" buff is automatically turned off now that the bodyguard is dead
    const narthecium = separatedApothecary?.combinedAbilities.find((a) => a.id === 'ab_apo_lead');
    expect(narthecium?.isDeactivatedByDeath).toBe(true);
  });

  it('clears 1-Stratagem-per-phase unit locks, resets phase activation & checklist state, and awards +1 CP on entering Command Phase', () => {
    let session = createInitialGameSession(roster, 'user');
    session.unitStates['u_intercessors'].lockedByStratagemIdInPhase = 'strat_1';
    session.unitStates['u_intercessors'].activatedInPhase = true;
    session.completedChecklistIds = ['faction_ab_1'];

    session = transitionGameSessionStep(session, {
      battleRound: 1,
      currentTurn: 'your_turn',
      currentPhase: 'command',
      label: 'Command Phase',
    });

    expect(session.userCp).toBe(1);
    expect(session.opponentCp).toBe(1);
    expect(session.unitStates['u_intercessors'].lockedByStratagemIdInPhase).toBeUndefined();
    expect(session.unitStates['u_intercessors'].activatedInPhase).toBe(false);
    expect(session.completedChecklistIds).toEqual([]);
  });

  it('imports plain-text army lists and matches datasheets, model counts, and detachments', async () => {
    const { importFromPlainTextList } = await import('../../importers/rosterImporter');
    const sampleText = [
      'Crimson Fists Strike Force (320 Points)',
      'Gladius Task Force',
      'Captain (80 Points)',
      'Intercessor Squad (x10) (160 Points)',
      'Apothecary (50 Points)',
    ].join('\n');

    const imported = importFromPlainTextList(
      sampleText,
      'SM',
      [bodyguardDs, captainDs, apothecaryDs],
      [...detachmentsMap.values()],
      []
    );

    expect(imported.detachmentIds).toContain('det_1');
    expect(imported.units).toHaveLength(3);
    const intercessorsUnit = imported.units.find((u) => u.datasheetId === 'ds_intercessors');
    expect(intercessorsUnit?.startingModels).toBe(10);
    expect(intercessorsUnit?.points).toBe(160);
  });

  it('suppresses optional Wargear abilities if the unit keeps the weapon that would be replaced', () => {
    const vanguardDs: Datasheet = {
      ...bodyguardDs,
      id: 'ds_vanguard',
      name: 'Vanguard Veteran Squad With Jump Packs',
      wargearOptions: ['All models in this unit can each have their Heavy Bolt Pistol replaced with 1 Combat Shield.'],
      rangedWeapons: [
        {
          id: 'w_hbp',
          line: 1,
          lineInWargear: 1,
          name: 'Heavy Bolt Pistol',
          description: 'CLOSE-QUARTERS',
          keywords: ['CLOSE-QUARTERS'],
          range: '18"',
          type: 'Ranged',
          A: '1',
          BS_WS: '3+',
          S: '5',
          AP: '-1',
          D: '1',
        },
      ],
      meleeWeapons: [
        {
          id: 'w_pw',
          line: 2,
          lineInWargear: 1,
          name: 'Power Weapon',
          description: '',
          keywords: [],
          range: 'Melee',
          type: 'Melee',
          A: '4',
          BS_WS: '3+',
          S: '5',
          AP: '-2',
          D: '1',
        },
      ],
      abilities: [
        {
          id: 'ab_shield',
          line: 4,
          name: 'Combat Shield',
          description: 'This model has 5+ InSv.',
          type: 'Wargear',
          phases: ['any'],
          timing: 'either',
          isLeaderBuff: false,
          isSupportBuff: false,
          isDefensiveOrReactive: true,
        },
      ],
    };

    const dsMap = new Map<string, Datasheet>([[vanguardDs.id, vanguardDs]]);

    // Case 1: Vanguard Veterans with Heavy Bolt Pistol equipped -> Combat Shield should be SUPPRESSED!
    const rosterWithPistol: SavedRoster = {
      ...roster,
      units: [
        {
          instanceId: 'u_vv_pistol',
          datasheetId: 'ds_vanguard',
          startingModels: 5,
          startingWoundsPerModel: 2,
          points: 120,
          equippedWeaponIds: ['w_hbp', 'w_pw'],
          enhancementIds: [],
        },
      ],
    };

    const compositesWithPistol = buildCompositeUnits(rosterWithPistol, undefined, dsMap, new Map(), []);
    const shieldAb1 = compositesWithPistol[0].combinedAbilities.find((a) => a.name === 'Combat Shield');
    expect(shieldAb1).toBeUndefined(); // Suppressed!

    // Case 2: Vanguard Veterans replaced pistol (only Power Weapon equipped) -> Combat Shield is ACTIVE!
    const rosterWithShield: SavedRoster = {
      ...roster,
      units: [
        {
          instanceId: 'u_vv_shield',
          datasheetId: 'ds_vanguard',
          startingModels: 5,
          startingWoundsPerModel: 2,
          points: 120,
          equippedWeaponIds: ['w_pw'], // No pistol!
          enhancementIds: [],
        },
      ],
    };

    const compositesWithShield = buildCompositeUnits(rosterWithShield, undefined, dsMap, new Map(), []);
    const shieldAb2 = compositesWithShield[0].combinedAbilities.find((a) => a.name === 'Combat Shield');
    expect(shieldAb2).toBeDefined(); // Active!
  });

  it('restricts keyword-locked Core Stratagems (e.g. Explosives) to units that actually have validStratagemIds', () => {
    const explosivesStrat: Stratagem = {
      id: '000010810005',
      factionId: '',
      name: 'EXPLOSIVES',
      type: 'Core – Wargear Stratagem',
      category: 'Wargear',
      isCore: true,
      cpCost: 1,
      legend: '',
      rawTurn: 'Your turn',
      timing: 'your_turn',
      rawPhase: 'Shooting phase',
      phases: ['shooting'],
      detachment: '',
      detachmentId: '',
      description: 'One friendly unengaged EXPLOSIVES/GRENADES unit that is eligible to shoot...',
      whenText: 'Your Shooting phase.',
      targetText: 'One friendly unengaged EXPLOSIVES/GRENADES unit...',
      effectText: 'Roll six D6...',
    };

    const commandReRollStrat: Stratagem = {
      id: '000010810002',
      factionId: '',
      name: 'COMMAND RE-ROLL',
      type: 'Core – Epic Deed Stratagem',
      category: 'Epic Deed',
      isCore: true,
      cpCost: 1,
      legend: '',
      rawTurn: "Either player's turn",
      timing: 'either',
      rawPhase: 'Any phase',
      phases: ['any'],
      detachment: '',
      detachmentId: '',
      description: 'Re-roll a roll.',
      whenText: 'Any phase.',
      targetText: 'That unit or model.',
      effectText: 'You re-roll that roll.',
    };

    const landSpeederDs: Datasheet = {
      ...bodyguardDs,
      id: 'ds_land_speeder',
      name: 'Land Speeder',
      role: 'Vehicle',
      keywords: ['Vehicle', 'Fly', 'Land Speeder'],
      // Land Speeder has Command Re-roll, but does NOT have Explosives:
      validStratagemIds: ['000010810002'],
    };

    const intercessorsDs: Datasheet = {
      ...bodyguardDs,
      id: 'ds_intercessors_grenade',
      name: 'Intercessor Squad',
      keywords: ['Infantry', 'Battleline', 'Grenades'],
      // Intercessors have both Command Re-roll and Explosives:
      validStratagemIds: ['000010810002', '000010810005'],
    };

    const stratRoster: SavedRoster = {
      ...roster,
      id: 'r_test_strats',
      units: [
        {
          instanceId: 'u_speeder',
          datasheetId: 'ds_land_speeder',
          startingModels: 1,
          startingWoundsPerModel: 6,
          points: 80,
          enhancementIds: [],
        },
        {
          instanceId: 'u_grenadiers',
          datasheetId: 'ds_intercessors_grenade',
          startingModels: 5,
          startingWoundsPerModel: 2,
          points: 80,
          enhancementIds: [],
        },
      ],
    };

    const dsMap = new Map<string, Datasheet>([
      [landSpeederDs.id, landSpeederDs],
      [intercessorsDs.id, intercessorsDs],
    ]);

    const composites = buildCompositeUnits(
      stratRoster,
      undefined,
      dsMap,
      new Map(),
      [explosivesStrat, commandReRollStrat]
    );

    const speederComposite = composites.find((c) => c.primaryDatasheet.id === 'ds_land_speeder')!;
    const intercessorsComposite = composites.find((c) => c.primaryDatasheet.id === 'ds_intercessors_grenade')!;

    // Land Speeder: Command Re-roll is eligible, but EXPLOSIVES is NOT!
    expect(speederComposite.eligibleStratagemIds).toContain('000010810002');
    expect(speederComposite.eligibleStratagemIds).not.toContain('000010810005');

    // Intercessors: Both are eligible!
    expect(intercessorsComposite.eligibleStratagemIds).toContain('000010810002');
    expect(intercessorsComposite.eligibleStratagemIds).toContain('000010810005');

    // Also verify keyword fallback when validStratagemIds is empty (e.g. externally imported roster unit):
    const unindexedIntercessorsDs: Datasheet = {
      ...intercessorsDs,
      validStratagemIds: [], // Empty junction
    };
    const unindexedMap = new Map<string, Datasheet>([
      [landSpeederDs.id, landSpeederDs],
      [unindexedIntercessorsDs.id, unindexedIntercessorsDs],
    ]);
    const unindexedComposites = buildCompositeUnits(
      stratRoster,
      undefined,
      unindexedMap,
      new Map(),
      [explosivesStrat, commandReRollStrat]
    );
    const unindexedInt = unindexedComposites.find((c) => c.primaryDatasheet.id === 'ds_intercessors_grenade')!;
    // Still eligible because unit has keyword 'Grenades'!
    expect(unindexedInt.eligibleStratagemIds).toContain('000010810005');
  });

  it('dynamically resolves Deathwing and Ravenwing keywords only when running a Dark Angels army (Option B)', () => {
    const genericTerminatorDs: Datasheet = {
      id: '000001183',
      name: 'Terminator Squad',
      factionId: 'SM',
      sourceId: '000000139', // Generic Codex Space Marines
      legend: '',
      role: 'Infantry',
      loadout: '',
      transport: '',
      virtual: false,
      isSupport: false,
      leaderHead: '',
      leaderFooter: '',
      link: '',
      slug: 'terminator-squad',
      models: [],
      rangedWeapons: [],
      meleeWeapons: [],
      abilities: [],
      coreAbilities: [],
      factionAbilities: [],
      keywords: ['Infantry', 'Imperium', 'Terminator', 'Deathwing'], // pre-baked in CSV
      factionKeywords: ['Adeptus Astartes'],
      unitComposition: [],
      wargearOptions: [],
      costTiers: [],
      wargearCosts: [],
      canLeadDatasheetIds: [],
      validStratagemIds: ['000008775004'], // Wrath of the Lion (requires DEATHWING)
      validEnhancementIds: [],
      validDetachmentAbilityIds: [],
    };

    const nativeDaKnightsDs: Datasheet = {
      id: '000000231',
      name: 'Deathwing Knights',
      factionId: 'SM',
      sourceId: '000000023', // Dark Angels
      legend: '',
      role: 'Infantry',
      loadout: '',
      transport: '',
      virtual: false,
      isSupport: false,
      leaderHead: '',
      leaderFooter: '',
      link: '',
      slug: 'deathwing-knights',
      models: [],
      rangedWeapons: [],
      meleeWeapons: [],
      abilities: [],
      coreAbilities: [],
      factionAbilities: [],
      keywords: ['Infantry', 'Terminator', 'Deathwing', 'Imperium'],
      factionKeywords: ['Adeptus Astartes', 'Dark Angels'],
      unitComposition: [],
      wargearOptions: [],
      costTiers: [],
      wargearCosts: [],
      canLeadDatasheetIds: [],
      validStratagemIds: ['000008775004'],
      validEnhancementIds: [],
      validDetachmentAbilityIds: [],
    };

    const wrathOfTheLionStrat: Stratagem = {
      id: '000008775004',
      factionId: 'SM',
      name: 'WRATH OF THE LION',
      type: 'Inner Circle Task Force Stratagem',
      category: 'Battle Tactic',
      isCore: false,
      cpCost: 1,
      legend: '',
      rawTurn: 'Your turn',
      timing: 'your_turn',
      rawPhase: 'Charge phase',
      phases: ['charge'],
      detachment: 'Inner Circle Task Force',
      detachmentId: '000000835',
      description: 'Select one enemy unit engaged with your unit...',
      whenText: 'Your Charge phase',
      targetText: 'That DEATHWING unit.',
      effectText: 'Roll D6 for each model...',
    };

    const dsMap = new Map<string, Datasheet>([
      [genericTerminatorDs.id, genericTerminatorDs],
      [nativeDaKnightsDs.id, nativeDaKnightsDs],
    ]);

    // 1. NON-DARK ANGELS ARMY (e.g. Ultramarines with Gladius Task Force)
    const ultramarinesRoster: SavedRoster = {
      id: 'roster_ultra',
      name: 'Ultramarines 1st Company',
      factionId: 'SM',
      subFactionName: 'Ultramarines',
      battleSize: 'strike_force',
      detachmentIds: ['000000750'], // Gladius Task Force
      totalPoints: 185,
      totalDetachmentPoints: 1,
      updatedAt: Date.now(),
      units: [
        {
          instanceId: 'u_term_ultra',
          datasheetId: genericTerminatorDs.id,
          startingModels: 5,
          startingWoundsPerModel: 3,
          points: 185,
          enhancementIds: [],
        },
      ],
    };

    const ultraComposites = buildCompositeUnits(
      ultramarinesRoster,
      undefined,
      dsMap,
      new Map(),
      [wrathOfTheLionStrat]
    );

    const ultraTermComposite = ultraComposites[0];
    // Must NOT have Deathwing keyword!
    expect(ultraTermComposite.combinedKeywords).not.toContain('Deathwing');
    // Must NOT be eligible for Wrath of the Lion (even though mapped in Wahapedia junction)
    expect(ultraTermComposite.eligibleStratagemIds).not.toContain('000008775004');

    // 2. DARK ANGELS ARMY via explicit Chapter name
    const daChapterRoster: SavedRoster = {
      ...ultramarinesRoster,
      id: 'roster_da_chapter',
      subFactionName: 'Dark Angels',
      detachmentIds: [], // Even without a DA detachment, selecting Dark Angels activates Deathwing!
    };

    const daChapterComposites = buildCompositeUnits(
      daChapterRoster,
      undefined,
      dsMap,
      new Map(),
      [wrathOfTheLionStrat]
    );
    expect(daChapterComposites[0].combinedKeywords).toContain('Deathwing');

    // 3. DARK ANGELS ARMY via Dark Angels Detachment
    const daDetachmentRoster: SavedRoster = {
      ...ultramarinesRoster,
      id: 'roster_da_det',
      subFactionName: undefined, // No subfaction name typed
      detachmentIds: ['000000835'], // Inner Circle Task Force
    };

    const daDetComposites = buildCompositeUnits(
      daDetachmentRoster,
      undefined,
      dsMap,
      new Map(),
      [wrathOfTheLionStrat]
    );
    expect(daDetComposites[0].combinedKeywords).toContain('Deathwing');
    expect(daDetComposites[0].eligibleStratagemIds).toContain('000008775004');

    // 4. Native Dark Angels unit always retains Deathwing regardless
    const mixedRoster: SavedRoster = {
      ...ultramarinesRoster,
      units: [
        {
          instanceId: 'u_knights',
          datasheetId: nativeDaKnightsDs.id,
          startingModels: 5,
          startingWoundsPerModel: 4,
          points: 235,
          enhancementIds: [],
        },
      ],
    };
    const mixedComposites = buildCompositeUnits(
      mixedRoster,
      undefined,
      dsMap,
      new Map(),
      [wrathOfTheLionStrat]
    );
    expect(mixedComposites[0].combinedKeywords).toContain('Deathwing');
  });

  it('validates Chapter consistency and flags cross-Chapter Space Marine roster violations', () => {
    const daHeroDs: Datasheet = {
      id: '000000218',
      name: 'Azrael',
      factionId: 'SM',
      sourceId: '000000023',
      legend: '',
      role: 'Character',
      loadout: '',
      transport: '',
      virtual: false,
      isSupport: false,
      leaderHead: '',
      leaderFooter: '',
      link: '',
      slug: 'azrael',
      models: [],
      rangedWeapons: [],
      meleeWeapons: [],
      abilities: [],
      coreAbilities: [],
      factionAbilities: [],
      keywords: ['Character', 'Epic Hero'],
      factionKeywords: ['Adeptus Astartes', 'Dark Angels'],
      unitComposition: [],
      wargearOptions: [],
      costTiers: [{ tierGroup: 'standard', tierLabel: '1 model', line: 1, description: '1 model', cost: 105 }],
      wargearCosts: [],
      canLeadDatasheetIds: [],
      validStratagemIds: [],
      validEnhancementIds: [],
      validDetachmentAbilityIds: [],
    };

    const ultraHeroDs: Datasheet = {
      id: '000000101',
      name: 'Marneus Calgar',
      factionId: 'SM',
      sourceId: '000000139',
      legend: '',
      role: 'Character',
      loadout: '',
      transport: '',
      virtual: false,
      isSupport: false,
      leaderHead: '',
      leaderFooter: '',
      link: '',
      slug: 'marneus-calgar',
      models: [],
      rangedWeapons: [],
      meleeWeapons: [],
      abilities: [],
      coreAbilities: [],
      factionAbilities: [],
      keywords: ['Character', 'Epic Hero'],
      factionKeywords: ['Adeptus Astartes', 'Ultramarines'],
      unitComposition: [],
      wargearOptions: [],
      costTiers: [{ tierGroup: 'standard', tierLabel: '1 model', line: 1, description: '1 model', cost: 185 }],
      wargearCosts: [],
      canLeadDatasheetIds: [],
      validStratagemIds: [],
      validEnhancementIds: [],
      validDetachmentAbilityIds: [],
    };

    const dsMap = new Map<string, Datasheet>([
      [daHeroDs.id, daHeroDs],
      [ultraHeroDs.id, ultraHeroDs],
    ]);

    const conflictingRoster: SavedRoster = {
      id: 'roster_conflict',
      name: 'Conflicting Chapters Roster',
      factionId: 'SM',
      battleSize: 'strike_force',
      detachmentIds: ['000000750'], // Gladius Task Force
      totalPoints: 290,
      totalDetachmentPoints: 1,
      updatedAt: Date.now(),
      units: [
        {
          instanceId: 'u_azrael',
          datasheetId: daHeroDs.id,
          startingModels: 1,
          startingWoundsPerModel: 6,
          points: 105,
          enhancementIds: [],
        },
        {
          instanceId: 'u_calgar',
          datasheetId: ultraHeroDs.id,
          startingModels: 1,
          startingWoundsPerModel: 6,
          points: 185,
          enhancementIds: [],
        },
      ],
    };

    const issues = validateRoster(conflictingRoster, dsMap, new Map(), new Map());
    const chapterIssue = issues.find((i) => i.code === 'CHAPTER_CONFLICT');
    expect(chapterIssue).toBeDefined();
    expect(chapterIssue?.severity).toBe('error');
    expect(chapterIssue?.message).toContain('Dark Angels');
    expect(chapterIssue?.message).toContain('Ultramarines');
  });
});

