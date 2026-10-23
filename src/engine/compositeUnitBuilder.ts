import type {
  CompositeUnit,
  CompositeWeaponEntry,
  Datasheet,
  Enhancement,
  GameSessionState,
  LiveUnitState,
  Phase,
  ResolvedAbility,
  RosterUnit,
  SavedRoster,
  Stratagem,
  TurnTiming,
  WeaponProfile,
} from '../types/rules';
import { isDarkAngelsRoster, resolveActiveKeywords } from './chapterKeywordRules';

function defaultLiveState(unit: RosterUnit): LiveUnitState {
  return {
    instanceId: unit.instanceId,
    status: unit.initialStatus ?? 'on_battlefield',
    remainingModels: unit.startingModels || 1,
    currentModelWounds: unit.startingWoundsPerModel || 1,
    isBattleShocked: false,
    usedOncePerBattleIds: [],
  };
}

function selectEquippedWeapons(
  allWeapons: WeaponProfile[],
  equippedWeaponIds?: string[]
): WeaponProfile[] {
  if (!equippedWeaponIds) {
    return allWeapons;
  }
  return allWeapons.filter((w) => equippedWeaponIds.includes(w.id));
}

/**
 * Resolves the number of a particular weapon equipped across models in a unit.
 * Priority:
 * 1. Explicit `equippedWeaponCounts[weapon.id]` in RosterUnit.
 * 2. Single-model units (Characters, Vehicles, Monsters): default 1.
 * 3. Squads: if weapon is part of base loadout, default to `startingModels` minus any
 *    special replacement weapons of the same type (ranged/melee). If heavy/special weapon, default 1.
 */
function resolveWeaponCount(
  weapon: WeaponProfile,
  rosterUnit: RosterUnit,
  datasheet: Datasheet
): number {
  if (rosterUnit.equippedWeaponCounts && rosterUnit.equippedWeaponCounts[weapon.id] !== undefined) {
    return Math.max(0, rosterUnit.equippedWeaponCounts[weapon.id]);
  }
  const startingModels = rosterUnit.startingModels || 1;
  if (startingModels <= 1) {
    return 1;
  }
  const baseLoadout = (datasheet.loadout || '').toLowerCase();
  const wBaseName = weapon.name.split(' - ')[0].trim().toLowerCase();
  const isBaseLoadout = baseLoadout.includes(wBaseName);

  if (isBaseLoadout) {
    const sameTypeWeapons = weapon.type === 'Melee' ? datasheet.meleeWeapons : datasheet.rangedWeapons;
    const equippedIds = rosterUnit.equippedWeaponIds ?? sameTypeWeapons.map((x) => x.id);
    const nonBaseEquipped = sameTypeWeapons.filter(
      (sw) =>
        sw.id !== weapon.id &&
        equippedIds.includes(sw.id) &&
        !baseLoadout.includes(sw.name.split(' - ')[0].trim().toLowerCase())
    );
    const distinctReplacements = new Set(
      nonBaseEquipped.map((sw) => sw.name.split(' - ')[0].trim().toLowerCase())
    );
    return Math.max(1, startingModels - distinctReplacements.size);
  }

  // Heavy / Special weapon default in a squad
  return 1;
}

/**
 * Checks whether an optional Wargear ability should be active based on the unit's equipped weapons
 * and wargear options.
 *
 * Example: Vanguard Veterans option:
 * "All models in this unit can each have their Heavy Bolt Pistol replaced with 1 Combat Shield."
 * If the unit has Heavy Bolt Pistol equipped, Combat Shield is NOT equipped (they kept the pistol).
 */
function isWargearAbilityActive(
  abilityName: string,
  abilityType: string,
  equippedWeapons: WeaponProfile[],
  wargearOptions: string[]
): boolean {
  if (abilityType !== 'Wargear') return true;

  const abLower = abilityName.toLowerCase().trim();
  const equippedNames = equippedWeapons.map((w) => w.name.toLowerCase().trim());

  for (const opt of wargearOptions) {
    const optLower = opt.toLowerCase();
    const repIdx = optLower.indexOf('replaced with');
    if (repIdx !== -1) {
      const afterReplaced = optLower.slice(repIdx);
      const beforeReplaced = optLower.slice(0, repIdx);

      // If this option mentions replacing something with this ability/shield
      if (afterReplaced.includes(abLower)) {
        // If the unit STILL has the replaced weapon equipped, then this wargear ability is NOT equipped!
        const conflictsWithEquipped = equippedNames.some((wName) =>
          beforeReplaced.includes(wName)
        );
        if (conflictsWithEquipped) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Evaluates whether a composite unit satisfies the targeting requirements for a stratagem.
 * Uses Wahapedia's pre-indexed `Datasheets_stratagems.csv` (`validStratIdSet`) AND validates
 * keyword prerequisites for 11th Edition Core Stratagems (e.g. EXPLOSIVES requires EXPLOSIVES or GRENADES,
 * SMOKESCREEN requires SMOKE, CRUSHING IMPACT requires VEHICLE or MONSTER, EPIC CHALLENGE requires CHARACTER).
 */
export function isStratagemEligibleForUnit(
  strat: Stratagem,
  validStratIdSet: Set<string>,
  unitKeywords: Set<string>
): boolean {
  const kwLower = new Set(Array.from(unitKeywords).map((k) => k.toLowerCase().trim()));

  // If the stratagem explicitly targets DEATHWING or RAVENWING, require that keyword
  const targetUpper = (strat.targetText || strat.description || '').toUpperCase();
  if (targetUpper.includes('DEATHWING') && !kwLower.has('deathwing')) {
    return false;
  }
  if (targetUpper.includes('RAVENWING') && !kwLower.has('ravenwing')) {
    return false;
  }

  // If explicitly mapped in Wahapedia junction
  if (validStratIdSet.has(strat.id)) {
    return true;
  }

  // If this is a Core Stratagem, verify targeting requirements against the unit's active keywords:
  if (strat.isCore) {
    const sName = strat.name.toUpperCase();

    if (sName === 'EXPLOSIVES') {
      return kwLower.has('explosives') || kwLower.has('grenades');
    }
    if (sName === 'SMOKESCREEN') {
      return kwLower.has('smoke');
    }
    if (sName === 'CRUSHING IMPACT' || sName === 'TANK SHOCK') {
      return kwLower.has('monster') || kwLower.has('vehicle');
    }
    if (sName === 'EPIC CHALLENGE') {
      return kwLower.has('character');
    }
    if (sName === 'HEROIC INTERVENTION') {
      if (kwLower.has('vehicle')) {
        return kwLower.has('walker') || kwLower.has('character');
      }
      return true;
    }
    if (sName === 'FIRE OVERWATCH') {
      return !kwLower.has('titanic');
    }
    if (sName === 'RAPID INGRESS') {
      return !kwLower.has('aircraft');
    }
    if (
      sName === 'COMMAND RE-ROLL' ||
      sName === 'INSANE BRAVERY' ||
      sName === 'COUNTEROFFENSIVE' ||
      sName === 'COUNTER-OFFENSIVE'
    ) {
      return !kwLower.has('fortification');
    }
  }

  return false;
}

function checkIsBelowHalfStrength(
  startingModels: number,
  remainingModels: number,
  startingWoundsPerModel: number,
  currentModelWounds: number
): boolean {
  if (remainingModels <= 0) return false;
  if (startingModels === 1) {
    return currentModelWounds < startingWoundsPerModel / 2;
  }
  return remainingModels < startingModels / 2;
}

/**
 * Builds the live `CompositeUnit[]` list for a roster and active game session.
 * Implements all finalized /grill-me rules:
 * - Merges Bodyguard + 1 Regular Leader + 1 Support Leader + Unit Upgrades.
 * - Separate wound/model pools for Bodyguard vs Leader vs Support.
 * - If an attached Leader/Support is destroyed (0 wounds/models), their `While leading a unit`
 *   buffs and weapons are marked `isDeactivatedByDeath: true` / `isOwnerDestroyed: true`.
 * - If a Bodyguard squad hits 0 models (`status === 'destroyed'`), any surviving attached
 *   Leader or Support Character automatically separates into its own standalone `CompositeUnit`
 *   on the battlefield (turning off `While leading a unit` buffs while keeping personal rules).
 */
export function buildCompositeUnits(
  roster: SavedRoster,
  session: GameSessionState | undefined,
  datasheetsById: Map<string, Datasheet>,
  enhancementsById: Map<string, Enhancement>,
  allStratagems: Stratagem[]
): CompositeUnit[] {
  const unitsByInstanceId = new Map<string, RosterUnit>(
    roster.units.map((u) => [u.instanceId, u])
  );

  const isDarkAngelsArmy = isDarkAngelsRoster(roster, datasheetsById);

  const getLiveState = (u: RosterUnit): LiveUnitState =>
    session?.unitStates[u.instanceId] ?? defaultLiveState(u);

  // Identify characters currently attached to a LIVING bodyguard unit
  const attachedToLivingBodyguard = new Set<string>();
  const detachedCharacters = new Set<string>();

  for (const unit of roster.units) {
    const bgState = getLiveState(unit);
    const isBodyguardAlive = bgState.status !== 'destroyed' && bgState.remainingModels > 0;

    for (const charId of [unit.attachedLeaderInstanceId, unit.attachedSupportInstanceId]) {
      if (!charId) continue;
      if (isBodyguardAlive) {
        attachedToLivingBodyguard.add(charId);
      } else {
        detachedCharacters.add(charId);
      }
    }
  }

  // Filter stratagems available to this roster (Core + any selected Detachment in roster.detachmentIds)
  const rosterDetachmentSet = new Set(roster.detachmentIds);
  const availableStratagems = allStratagems.filter(
    (s) =>
      s.isCore ||
      (s.factionId === roster.factionId &&
        (!s.detachmentId || rosterDetachmentSet.size === 0 || rosterDetachmentSet.has(s.detachmentId)))
  );

  const compositeUnits: CompositeUnit[] = [];

  for (const unit of roster.units) {
    // Skip characters that are currently attached to a living bodyguard unit
    // (they are rendered inside that bodyguard's CompositeUnit)
    if (attachedToLivingBodyguard.has(unit.instanceId)) {
      continue;
    }

    const primaryDatasheet = datasheetsById.get(unit.datasheetId);
    if (!primaryDatasheet) continue;

    const primaryLiveState = {
      ...getLiveState(unit),
      isDetachedFromBodyguard: detachedCharacters.has(unit.instanceId),
    };
    const isBodyguardAlive =
      primaryLiveState.status !== 'destroyed' && primaryLiveState.remainingModels > 0;

    // Resolve attached Regular Leader (only if bodyguard is still alive)
    let attachedLeader: CompositeUnit['attachedLeader'];
    if (isBodyguardAlive && unit.attachedLeaderInstanceId) {
      const leaderUnit = unitsByInstanceId.get(unit.attachedLeaderInstanceId);
      const leaderDs = leaderUnit ? datasheetsById.get(leaderUnit.datasheetId) : undefined;
      if (leaderUnit && leaderDs) {
        attachedLeader = {
          rosterUnit: leaderUnit,
          datasheet: leaderDs,
          liveState: getLiveState(leaderUnit),
          enhancements: leaderUnit.enhancementIds
            .map((id) => enhancementsById.get(id))
            .filter((e): e is Enhancement => Boolean(e)),
        };
      }
    }

    // Resolve attached Support Leader (only if bodyguard is still alive)
    let attachedSupport: CompositeUnit['attachedSupport'];
    if (isBodyguardAlive && unit.attachedSupportInstanceId) {
      const supportUnit = unitsByInstanceId.get(unit.attachedSupportInstanceId);
      const supportDs = supportUnit ? datasheetsById.get(supportUnit.datasheetId) : undefined;
      if (supportUnit && supportDs) {
        attachedSupport = {
          rosterUnit: supportUnit,
          datasheet: supportDs,
          liveState: getLiveState(supportUnit),
          enhancements: supportUnit.enhancementIds
            .map((id) => enhancementsById.get(id))
            .filter((e): e is Enhancement => Boolean(e)),
        };
      }
    }

    const unitUpgrades = unit.enhancementIds
      .map((id) => enhancementsById.get(id))
      .filter((e): e is Enhancement => Boolean(e));

    // Display name
    const baseName = unit.customName || primaryDatasheet.name;
    const attachedNames: string[] = [];
    if (attachedLeader) {
      const isDead =
        attachedLeader.liveState.status === 'destroyed' ||
        attachedLeader.liveState.remainingModels <= 0 ||
        attachedLeader.liveState.currentModelWounds <= 0;
      attachedNames.push(
        isDead ? `${attachedLeader.datasheet.name} (Destroyed)` : attachedLeader.datasheet.name
      );
    }
    if (attachedSupport) {
      const isDead =
        attachedSupport.liveState.status === 'destroyed' ||
        attachedSupport.liveState.remainingModels <= 0 ||
        attachedSupport.liveState.currentModelWounds <= 0;
      attachedNames.push(
        isDead ? `${attachedSupport.datasheet.name} (Destroyed)` : attachedSupport.datasheet.name
      );
    }
    const displayName =
      attachedNames.length > 0 ? `${baseName} + ${attachedNames.join(' + ')}` : baseName;

    // Combined Keywords & Core Abilities (from living members)
    const activePrimaryKeywords = resolveActiveKeywords(primaryDatasheet, isDarkAngelsArmy);
    const combinedKeywords = new Set<string>(activePrimaryKeywords);
    const combinedFactionKeywords = new Set<string>(primaryDatasheet.factionKeywords);
    const combinedCoreAbilities = new Set<string>(primaryDatasheet.coreAbilities);

    const isLeaderDead =
      !attachedLeader ||
      attachedLeader.liveState.status === 'destroyed' ||
      attachedLeader.liveState.remainingModels <= 0 ||
      attachedLeader.liveState.currentModelWounds <= 0;

    const isSupportDead =
      !attachedSupport ||
      attachedSupport.liveState.status === 'destroyed' ||
      attachedSupport.liveState.remainingModels <= 0 ||
      attachedSupport.liveState.currentModelWounds <= 0;

    if (attachedLeader && !isLeaderDead) {
      resolveActiveKeywords(attachedLeader.datasheet, isDarkAngelsArmy).forEach((k) =>
        combinedKeywords.add(k)
      );
      attachedLeader.datasheet.factionKeywords.forEach((k) => combinedFactionKeywords.add(k));
      attachedLeader.datasheet.coreAbilities.forEach((c) => combinedCoreAbilities.add(c));
    }
    if (attachedSupport && !isSupportDead) {
      resolveActiveKeywords(attachedSupport.datasheet, isDarkAngelsArmy).forEach((k) =>
        combinedKeywords.add(k)
      );
      attachedSupport.datasheet.factionKeywords.forEach((k) => combinedFactionKeywords.add(k));
      attachedSupport.datasheet.coreAbilities.forEach((c) => combinedCoreAbilities.add(c));
    }

    // Primary equipped weapons
    const primaryEquippedWeapons = [
      ...selectEquippedWeapons(primaryDatasheet.rangedWeapons, unit.equippedWeaponIds),
      ...selectEquippedWeapons(primaryDatasheet.meleeWeapons, unit.equippedWeaponIds),
    ];

    // Combined Abilities
    const combinedAbilities: ResolvedAbility[] = [];
    for (const ab of primaryDatasheet.abilities) {
      // Check if this Wargear ability was replaced by an equipped weapon (e.g. Combat Shield vs Heavy Bolt Pistol)
      if (
        !isWargearAbilityActive(
          ab.name,
          ab.type,
          primaryEquippedWeapons,
          primaryDatasheet.wargearOptions
        )
      ) {
        continue;
      }

      // If this character was detached because its bodyguard died, deactivate its "While leading a unit" buff
      const isDeactivatedWhileLeading =
        Boolean(primaryLiveState.isDetachedFromBodyguard) && (ab.isLeaderBuff || ab.isSupportBuff);

      combinedAbilities.push({
        ...ab,
        sourceName: primaryDatasheet.name,
        sourceInstanceId: unit.instanceId,
        sourceType: ab.type === 'Core' ? 'core' : ab.type === 'Faction' ? 'faction' : 'unit',
        isFromAttachedCharacter: false,
        isDeactivatedByDeath: isDeactivatedWhileLeading,
      });
    }

    for (const upg of unitUpgrades) {
      combinedAbilities.push({
        id: `enh_${upg.id}_${unit.instanceId}`,
        line: 99,
        name: upg.name,
        description: upg.description,
        type: 'Special',
        phases: upg.phases,
        timing: upg.timing,
        isLeaderBuff: false,
        isSupportBuff: false,
        sourceName: `${upg.name} (${upg.isUnitUpgrade ? 'Unit Upgrade' : 'Enhancement'})`,
        sourceInstanceId: unit.instanceId,
        sourceType: upg.isUnitUpgrade ? 'unit_upgrade' : 'enhancement',
        isFromAttachedCharacter: false,
        isDeactivatedByDeath: false,
      });
    }

    if (attachedLeader) {
      const leaderEquippedWeapons = [
        ...selectEquippedWeapons(attachedLeader.datasheet.rangedWeapons, attachedLeader.rosterUnit.equippedWeaponIds),
        ...selectEquippedWeapons(attachedLeader.datasheet.meleeWeapons, attachedLeader.rosterUnit.equippedWeaponIds),
      ];
      for (const ab of attachedLeader.datasheet.abilities) {
        if (
          !isWargearAbilityActive(
            ab.name,
            ab.type,
            leaderEquippedWeapons,
            attachedLeader.datasheet.wargearOptions
          )
        ) {
          continue;
        }

        combinedAbilities.push({
          ...ab,
          sourceName: attachedLeader.datasheet.name,
          sourceInstanceId: attachedLeader.rosterUnit.instanceId,
          sourceType: 'leader',
          isFromAttachedCharacter: true,
          isDeactivatedByDeath: isLeaderDead,
        });
      }
      for (const enh of attachedLeader.enhancements) {
        combinedAbilities.push({
          id: `enh_${enh.id}_${attachedLeader.rosterUnit.instanceId}`,
          line: 100,
          name: enh.name,
          description: enh.description,
          type: 'Special',
          phases: enh.phases,
          timing: enh.timing,
          isLeaderBuff: true,
          isSupportBuff: false,
          sourceName: `${enh.name} (${attachedLeader.datasheet.name})`,
          sourceInstanceId: attachedLeader.rosterUnit.instanceId,
          sourceType: 'enhancement',
          isFromAttachedCharacter: true,
          isDeactivatedByDeath: isLeaderDead,
        });
      }
    }

    if (attachedSupport) {
      const supportEquippedWeapons = [
        ...selectEquippedWeapons(attachedSupport.datasheet.rangedWeapons, attachedSupport.rosterUnit.equippedWeaponIds),
        ...selectEquippedWeapons(attachedSupport.datasheet.meleeWeapons, attachedSupport.rosterUnit.equippedWeaponIds),
      ];
      for (const ab of attachedSupport.datasheet.abilities) {
        if (
          !isWargearAbilityActive(
            ab.name,
            ab.type,
            supportEquippedWeapons,
            attachedSupport.datasheet.wargearOptions
          )
        ) {
          continue;
        }

        combinedAbilities.push({
          ...ab,
          sourceName: attachedSupport.datasheet.name,
          sourceInstanceId: attachedSupport.rosterUnit.instanceId,
          sourceType: 'support',
          isFromAttachedCharacter: true,
          isDeactivatedByDeath: isSupportDead,
        });
      }
      for (const enh of attachedSupport.enhancements) {
        combinedAbilities.push({
          id: `enh_${enh.id}_${attachedSupport.rosterUnit.instanceId}`,
          line: 101,
          name: enh.name,
          description: enh.description,
          type: 'Special',
          phases: enh.phases,
          timing: enh.timing,
          isLeaderBuff: false,
          isSupportBuff: true,
          sourceName: `${enh.name} (${attachedSupport.datasheet.name})`,
          sourceInstanceId: attachedSupport.rosterUnit.instanceId,
          sourceType: 'enhancement',
          isFromAttachedCharacter: true,
          isDeactivatedByDeath: isSupportDead,
        });
      }
    }

    // Weapons (Equipped vs All)
    const buildWeaponEntries = (
      weapons: WeaponProfile[],
      ownerRosterUnit: RosterUnit,
      ownerDatasheet: Datasheet,
      isOwnerDestroyed: boolean
    ): CompositeWeaponEntry[] =>
      weapons.map((weapon) => ({
        weapon,
        ownerName: ownerDatasheet.name,
        ownerInstanceId: ownerRosterUnit.instanceId,
        isOwnerDestroyed,
        count: resolveWeaponCount(weapon, ownerRosterUnit, ownerDatasheet),
      }));

    const allRangedWeapons: CompositeWeaponEntry[] = [
      ...buildWeaponEntries(primaryDatasheet.rangedWeapons, unit, primaryDatasheet, !isBodyguardAlive),
      ...(attachedLeader
        ? buildWeaponEntries(
            attachedLeader.datasheet.rangedWeapons,
            attachedLeader.rosterUnit,
            attachedLeader.datasheet,
            isLeaderDead
          )
        : []),
      ...(attachedSupport
        ? buildWeaponEntries(
            attachedSupport.datasheet.rangedWeapons,
            attachedSupport.rosterUnit,
            attachedSupport.datasheet,
            isSupportDead
          )
        : []),
    ];

    const equippedRangedWeapons: CompositeWeaponEntry[] = [
      ...buildWeaponEntries(
        selectEquippedWeapons(primaryDatasheet.rangedWeapons, unit.equippedWeaponIds),
        unit,
        primaryDatasheet,
        !isBodyguardAlive
      ),
      ...(attachedLeader
        ? buildWeaponEntries(
            selectEquippedWeapons(
              attachedLeader.datasheet.rangedWeapons,
              attachedLeader.rosterUnit.equippedWeaponIds
            ),
            attachedLeader.rosterUnit,
            attachedLeader.datasheet,
            isLeaderDead
          )
        : []),
      ...(attachedSupport
        ? buildWeaponEntries(
            selectEquippedWeapons(
              attachedSupport.datasheet.rangedWeapons,
              attachedSupport.rosterUnit.equippedWeaponIds
            ),
            attachedSupport.rosterUnit,
            attachedSupport.datasheet,
            isSupportDead
          )
        : []),
    ];

    const allMeleeWeapons: CompositeWeaponEntry[] = [
      ...buildWeaponEntries(primaryDatasheet.meleeWeapons, unit, primaryDatasheet, !isBodyguardAlive),
      ...(attachedLeader
        ? buildWeaponEntries(
            attachedLeader.datasheet.meleeWeapons,
            attachedLeader.rosterUnit,
            attachedLeader.datasheet,
            isLeaderDead
          )
        : []),
      ...(attachedSupport
        ? buildWeaponEntries(
            attachedSupport.datasheet.meleeWeapons,
            attachedSupport.rosterUnit,
            attachedSupport.datasheet,
            isSupportDead
          )
        : []),
    ];

    const equippedMeleeWeapons: CompositeWeaponEntry[] = [
      ...buildWeaponEntries(
        selectEquippedWeapons(primaryDatasheet.meleeWeapons, unit.equippedWeaponIds),
        unit,
        primaryDatasheet,
        !isBodyguardAlive
      ),
      ...(attachedLeader
        ? buildWeaponEntries(
            selectEquippedWeapons(
              attachedLeader.datasheet.meleeWeapons,
              attachedLeader.rosterUnit.equippedWeaponIds
            ),
            attachedLeader.rosterUnit,
            attachedLeader.datasheet,
            isLeaderDead
          )
        : []),
      ...(attachedSupport
        ? buildWeaponEntries(
            selectEquippedWeapons(
              attachedSupport.datasheet.meleeWeapons,
              attachedSupport.rosterUnit.equippedWeaponIds
            ),
            attachedSupport.rosterUnit,
            attachedSupport.datasheet,
            isSupportDead
          )
        : []),
    ];

    // Eligible Stratagems for this CompositeUnit
    const validStratIdSet = new Set<string>(primaryDatasheet.validStratagemIds || []);
    if (attachedLeader && !isLeaderDead) {
      (attachedLeader.datasheet.validStratagemIds || []).forEach((id) => validStratIdSet.add(id));
    }
    if (attachedSupport && !isSupportDead) {
      (attachedSupport.datasheet.validStratagemIds || []).forEach((id) => validStratIdSet.add(id));
    }

    const eligibleStratagemIds = availableStratagems
      .filter((s) => isStratagemEligibleForUnit(s, validStratIdSet, combinedKeywords))
      .map((s) => s.id);

    // Smart Auto-Detection: Below Half-Strength, Damaged Bracket, Deadly Demise
    const isBelowHalfStrength = checkIsBelowHalfStrength(
      unit.startingModels,
      primaryLiveState.remainingModels,
      unit.startingWoundsPerModel,
      primaryLiveState.currentModelWounds
    );

    const isInDamagedBracket =
      primaryDatasheet.damagedThreshold !== undefined &&
      primaryLiveState.remainingModels > 0 &&
      primaryLiveState.currentModelWounds > 0 &&
      primaryLiveState.currentModelWounds <= primaryDatasheet.damagedThreshold;

    const deadlyDemiseAb = combinedAbilities.find(
      (a) => !a.isDeactivatedByDeath && /deadly demise/i.test(a.name)
    );

    const totalPoints =
      unit.points +
      (attachedLeader?.rosterUnit.points ?? 0) +
      (attachedSupport?.rosterUnit.points ?? 0);

    compositeUnits.push({
      primaryUnit: unit,
      primaryDatasheet,
      primaryLiveState,
      attachedLeader,
      attachedSupport,
      unitUpgrades,
      displayName,
      combinedKeywords: [...combinedKeywords],
      combinedFactionKeywords: [...combinedFactionKeywords],
      combinedCoreAbilities: [...combinedCoreAbilities],
      combinedAbilities,
      equippedRangedWeapons,
      allRangedWeapons,
      equippedMeleeWeapons,
      allMeleeWeapons,
      eligibleStratagemIds,
      isBelowHalfStrength,
      isInDamagedBracket,
      hasDeadlyDemise: Boolean(deadlyDemiseAb),
      deadlyDemiseParameter: deadlyDemiseAb?.parameter,
      totalPoints,
    });
  }

  return compositeUnits;
}

/**
 * Checks whether an ability or stratagem is active in the given Phase and TurnTiming.
 */
export function isActiveInPhaseAndTurn(
  itemPhases: Phase[],
  itemTiming: TurnTiming,
  currentPhase: Phase,
  currentTurn: 'your_turn' | 'opponent_turn'
): boolean {
  const phaseMatch =
    itemPhases.includes('any') ||
    itemPhases.includes(currentPhase) ||
    (currentPhase === 'pre_game' && itemPhases.includes('pre_game'));

  if (!phaseMatch) return false;

  if (currentPhase === 'pre_game' || currentPhase === 'start_of_round' || currentPhase === 'end_of_round') {
    return true;
  }

  return itemTiming === 'either' || itemTiming === currentTurn;
}

/**
 * Turn-accurate stratagem filter that inspects `whenText` / `description` to prevent
 * multi-phase stratagems tagged `timing: 'either'` (e.g., Armour of Contempt:
 * "Your opponent's Shooting phase or the Fight phase") from leaking into Your Turn's
 * Shooting or Movement phase.
 */
export function isStratagemActiveInPhaseAndTurn(
  strat: Pick<Stratagem, 'phases' | 'timing' | 'whenText' | 'description' | 'name'>,
  currentPhase: Phase,
  currentTurn: 'your_turn' | 'opponent_turn'
): boolean {
  if (!isActiveInPhaseAndTurn(strat.phases, strat.timing, currentPhase, currentTurn)) {
    return false;
  }

  const whenRaw = (strat.whenText || strat.description || '')
    .replace(/’/g, "'")
    .toLowerCase();

  if (currentPhase === 'shooting') {
    const mentionsOppShooting = /opponent's shooting phase/.test(whenRaw);
    const mentionsYourOrEitherShooting =
      /your shooting phase|either player's shooting phase|any phase/.test(whenRaw);
    if (currentTurn === 'your_turn' && mentionsOppShooting && !mentionsYourOrEitherShooting) {
      return false;
    }
    if (currentTurn === 'opponent_turn' && /your shooting phase/.test(whenRaw) && !mentionsOppShooting && !/any phase/.test(whenRaw)) {
      return false;
    }
  }

  if (currentPhase === 'movement') {
    const mentionsOppMovement = /opponent's movement phase/.test(whenRaw);
    const mentionsYourOrEitherMovement =
      /your movement phase|either player's movement phase|any phase/.test(whenRaw);
    if (currentTurn === 'your_turn' && mentionsOppMovement && !mentionsYourOrEitherMovement) {
      return false;
    }
    if (currentTurn === 'opponent_turn' && /your movement phase/.test(whenRaw) && !mentionsOppMovement && !/any phase/.test(whenRaw)) {
      return false;
    }
  }

  if (currentPhase === 'charge') {
    const mentionsOppCharge = /opponent's charge phase/.test(whenRaw);
    const mentionsYourOrEitherCharge =
      /your charge phase|either player's charge phase|any phase/.test(whenRaw);
    if (currentTurn === 'your_turn' && mentionsOppCharge && !mentionsYourOrEitherCharge) {
      return false;
    }
    if (currentTurn === 'opponent_turn' && /your charge phase/.test(whenRaw) && !mentionsOppCharge && !/any phase/.test(whenRaw)) {
      return false;
    }
  }

  return true;
}

/**
 * Classifies an Army Rule or Detachment Ability for `PhaseActionChecklist.tsx` so that:
 * - `'action_trigger'`: Rules with an explicit actionable trigger in `currentPhase` get a `[ ]` checkbox.
 * - `'passive_buff'`: Rules that provide passive buffs relevant to `currentPhase` (or round-wide) render as compact reference pills without checkboxes.
 * - `'hidden'`: Rules whose mechanics belong strictly to another phase (e.g., "re-roll advance rolls" during Shooting, or "At the start of your Command phase, select..." during Movement) are hidden.
 */
export function classifyRuleForPhase(
  name: string,
  description: string,
  phases: Phase[],
  timing: TurnTiming,
  currentPhase: Phase,
  currentTurn: 'your_turn' | 'opponent_turn'
): 'action_trigger' | 'passive_buff' | 'hidden' {
  if (!isActiveInPhaseAndTurn(phases, timing, currentPhase, currentTurn)) {
    return 'hidden';
  }

  const text = `${name} ${description}`.replace(/’/g, "'").toLowerCase();

  // Detect explicit Command-phase selection rules (e.g., Combat Doctrines, Oath of Moment, Assault Mastery)
  const isCommandSelectionRule =
    /at the start of your command phase|in your command phase|select one .* doctrine|additional time per battle/.test(
      text
    );
  const isStartOfRoundSelectionRule = /at the start of the battle round/.test(text);

  // Detect strictly movement-only passive rules (e.g., "re-roll advance rolls" without shooting/charge effects)
  const isAdvanceOrMoveOnly =
    /re-roll advance rolls|add \d+" to the move characteristic/.test(text) &&
    !/shoot|ranged|charge|melee|fight|wound|hit roll/.test(text);

  // Detect Advance + Charge only rules (no shooting or melee combat effects)
  const isAdvanceOrChargeOnly =
    /re-roll advance|advance and charge|charge rolls/.test(text) &&
    !/shoot|ranged|melee|fight|wound|hit roll/.test(text);

  // Detect whether the rule requires an active decision/trigger vs. being a passive stat/weapon buff
  const hasExplicitActionTrigger =
    /at the start of|in your .* phase|in the .* phase|at the end of|select one|once per|roll one d6|after this unit has shot|after this unit has fought/.test(
      text
    );

  if (currentPhase === 'command') {
    if (currentTurn === 'your_turn' && (isCommandSelectionRule || phases.includes('command'))) {
      return 'action_trigger';
    }
    return isAdvanceOrMoveOnly || isAdvanceOrChargeOnly ? 'hidden' : 'passive_buff';
  }

  if (currentPhase === 'start_of_round') {
    if (isStartOfRoundSelectionRule || phases.includes('start_of_round')) {
      return 'action_trigger';
    }
    return 'hidden';
  }

  if (currentPhase === 'movement') {
    if (isCommandSelectionRule && !/advance|fall back|move/.test(text)) {
      return 'hidden';
    }
    if (phases.includes('movement') && !phases.includes('any') && hasExplicitActionTrigger) {
      return 'action_trigger';
    }
    return 'passive_buff';
  }

  if (currentPhase === 'shooting') {
    if (isAdvanceOrMoveOnly || isAdvanceOrChargeOnly) {
      return 'hidden';
    }
    if (
      isCommandSelectionRule &&
      !/ranged|shoot|assault doctrine|devastator doctrine|tactical doctrine|hit roll|wound roll/.test(
        text
      )
    ) {
      return 'hidden';
    }
    if (isCommandSelectionRule) {
      // e.g., Combat Doctrines is selected in Command Phase; in Shooting Phase it is a passive reference, NOT a checkbox action
      return 'passive_buff';
    }
    if (phases.includes('shooting') && !phases.includes('any') && hasExplicitActionTrigger) {
      return 'action_trigger';
    }
    return 'passive_buff';
  }

  if (currentPhase === 'charge') {
    if (isAdvanceOrMoveOnly) {
      return 'hidden';
    }
    if (isCommandSelectionRule) {
      return /charge/.test(text) ? 'passive_buff' : 'hidden';
    }
    if (phases.includes('charge') && !phases.includes('any') && hasExplicitActionTrigger) {
      return 'action_trigger';
    }
    return 'passive_buff';
  }

  if (currentPhase === 'fight') {
    if (isAdvanceOrMoveOnly || isAdvanceOrChargeOnly) {
      return 'hidden';
    }
    if (isCommandSelectionRule) {
      return /melee|fight|hit roll|wound roll/.test(text) ? 'passive_buff' : 'hidden';
    }
    if (phases.includes('fight') && !phases.includes('any') && hasExplicitActionTrigger) {
      return 'action_trigger';
    }
    return 'passive_buff';
  }

  return 'passive_buff';
}
