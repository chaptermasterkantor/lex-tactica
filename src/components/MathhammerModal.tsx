import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Swords,
  Crosshair,
  Shield,
  ArrowLeftRight,
  RotateCcw,
  Plus,
  Minus,
  Upload,
  Zap,
  Target,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  Info,
} from 'lucide-react';
import type {
  CompositeUnit,
  Datasheet,
  Detachment,
  Enhancement,
  Faction,
  GameSessionState,
  RosterUnit,
  SavedRoster,
  Stratagem,
} from '../types/rules';
import { db, ensureFactionDataSynced } from '../db/lexTacticaDb';
import { buildCompositeUnits } from '../engine/compositeUnitBuilder';
import {
  buildWeaponGroups,
  compileWeaponProfiles,
  scanUnitAbilitiesForMathhammer,
  type DetectedAbilityChip,
  type WeaponGroupUI,
} from '../engine/mathhammerRuleExtractor';
import {
  calculateMathhammer,
  type DefenderCombatProfile,
  type MathhammerResult,
  type ReRollMode,
  type SaveReRollMode,
} from '../engine/mathhammerEngine';
import {
  importFromNewRecruitJson,
  importFromPlainTextList,
  importFromRoszOrRosFile,
} from '../importers/rosterImporter';

export interface MathhammerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRoster: SavedRoster;
  userCompositeUnits: CompositeUnit[];
  allRosters: SavedRoster[];
  factions: Faction[];
  allDatasheets: Datasheet[];
  allDetachments: Detachment[];
  allEnhancements: Enhancement[];
  opponentRosterId?: string;
  initialAttackerInstanceId?: string | null;
  initialDefenderInstanceId?: string | null;
  initialCombatMode?: 'Ranged' | 'Melee';
  onSaveOpponentRoster?: (roster: SavedRoster) => Promise<void>;
  onSelectOpponentRosterId?: (rosterId: string) => void;
}

type UnitSourceMode = 'your_roster' | 'opponent_roster' | 'on_the_fly';

/**
 * Creates a synthetic CompositeUnit for on-the-fly datasheet testing.
 */
function createSyntheticCompositeUnit(ds: Datasheet): CompositeUnit {
  const defaultModels = ds.costTiers[0]?.modelsCount ?? 1;
  const defaultWounds = ds.models[0]?.W ?? 1;
  const mockUnit: RosterUnit = {
    instanceId: `fly_${ds.id}`,
    datasheetId: ds.id,
    startingModels: defaultModels,
    startingWoundsPerModel: defaultWounds,
    points: ds.costTiers[0]?.cost ?? 100,
    equippedWeaponIds: [...ds.rangedWeapons, ...ds.meleeWeapons].map((w) => w.id),
    enhancementIds: [],
    initialStatus: 'on_battlefield',
  };

  const liveState = {
    instanceId: mockUnit.instanceId,
    status: 'on_battlefield' as const,
    remainingModels: defaultModels,
    currentModelWounds: defaultWounds,
    isBattleShocked: false,
    usedOncePerBattleIds: [],
  };

  return {
    primaryUnit: mockUnit,
    primaryDatasheet: ds,
    primaryLiveState: liveState,
    unitUpgrades: [],
    displayName: ds.name,
    combinedKeywords: ds.keywords,
    combinedFactionKeywords: ds.factionKeywords,
    combinedCoreAbilities: ds.coreAbilities,
    combinedAbilities: ds.abilities.map((a) => ({
      ...a,
      sourceName: ds.name,
      sourceInstanceId: mockUnit.instanceId,
      sourceType: 'unit',
      isFromAttachedCharacter: false,
      isDeactivatedByDeath: false,
    })),
    equippedRangedWeapons: ds.rangedWeapons.map((w) => ({
      weapon: w,
      ownerName: ds.name,
      ownerInstanceId: mockUnit.instanceId,
      isOwnerDestroyed: false,
      count: 1,
    })),
    allRangedWeapons: ds.rangedWeapons.map((w) => ({
      weapon: w,
      ownerName: ds.name,
      ownerInstanceId: mockUnit.instanceId,
      isOwnerDestroyed: false,
      count: 1,
    })),
    equippedMeleeWeapons: ds.meleeWeapons.map((w) => ({
      weapon: w,
      ownerName: ds.name,
      ownerInstanceId: mockUnit.instanceId,
      isOwnerDestroyed: false,
      count: 1,
    })),
    allMeleeWeapons: ds.meleeWeapons.map((w) => ({
      weapon: w,
      ownerName: ds.name,
      ownerInstanceId: mockUnit.instanceId,
      isOwnerDestroyed: false,
      count: 1,
    })),
    eligibleStratagemIds: [],
    isBelowHalfStrength: false,
    isInDamagedBracket: false,
    hasDeadlyDemise: ds.abilities.some((a) => /deadly demise/i.test(a.name)),
    totalPoints: mockUnit.points,
  };
}

export const MathhammerModal: React.FC<MathhammerModalProps> = ({
  isOpen,
  onClose,
  userRoster,
  userCompositeUnits,
  allRosters,
  factions,
  allDatasheets,
  allDetachments,
  allEnhancements,
  opponentRosterId,
  initialAttackerInstanceId,
  initialDefenderInstanceId,
  initialCombatMode = 'Ranged',
  onSaveOpponentRoster,
  onSelectOpponentRosterId,
}) => {
  // 1. COMBAT CONFIGURATION
  const [combatMode, setCombatMode] = useState<'Ranged' | 'Melee'>(initialCombatMode);

  // 2. OPPONENT ROSTER STATE
  const [selectedOppRosterId, setSelectedOppRosterId] = useState<string>(
    opponentRosterId || (allRosters.find((r) => r.id !== userRoster.id)?.id ?? '')
  );
  const [oppRosterCompositeUnits, setOppRosterCompositeUnits] = useState<CompositeUnit[]>([]);
  const [isOppImportOpen, setIsOppImportOpen] = useState(false);
  const [oppImportFactionId, setOppImportFactionId] = useState('SM');
  const [oppImportError, setOppImportError] = useState<string | null>(null);

  // Load Opponent Roster Composite Units whenever selectedOppRosterId changes
  useEffect(() => {
    async function loadOppUnits() {
      if (!selectedOppRosterId) {
        setOppRosterCompositeUnits([]);
        return;
      }
      const targetRoster = allRosters.find((r) => r.id === selectedOppRosterId);
      if (!targetRoster) return;
      await ensureFactionDataSynced(targetRoster.factionId);
      const dsList = await db.datasheets.where('factionId').equals(targetRoster.factionId).toArray();
      const enhList = await db.enhancements.where('factionId').equals(targetRoster.factionId).toArray();
      const dsMap = new Map(dsList.map((d) => [d.id, d]));
      const enhMap = new Map(enhList.map((e) => [e.id, e]));
      const compUnits = buildCompositeUnits(targetRoster, undefined, dsMap, enhMap, []);
      setOppRosterCompositeUnits(compUnits);
    }
    loadOppUnits();
  }, [selectedOppRosterId, allRosters]);

  // 3. ON-THE-FLY DATASHEET STATE
  const [onTheFlyFactionId, setOnTheFlyFactionId] = useState<string>('SM');
  const [onTheFlyDatasheets, setOnTheFlyDatasheets] = useState<Datasheet[]>([]);
  const [onTheFlySelectedDsId, setOnTheFlySelectedDsId] = useState<string>('');
  const [onTheFlySearch, setOnTheFlySearch] = useState('');

  useEffect(() => {
    async function loadOnTheFly() {
      if (!onTheFlyFactionId) return;
      await ensureFactionDataSynced(onTheFlyFactionId);
      const dss = await db.datasheets.where('factionId').equals(onTheFlyFactionId).toArray();
      const sorted = dss.sort((a, b) => a.name.localeCompare(b.name));
      setOnTheFlyDatasheets(sorted);
      if (sorted.length > 0 && !sorted.some((d) => d.id === onTheFlySelectedDsId)) {
        setOnTheFlySelectedDsId(sorted[0].id);
      }
    }
    loadOnTheFly();
  }, [onTheFlyFactionId]);

  // 4. ATTACKER & DEFENDER SELECTION
  const [attackerSource, setAttackerSource] = useState<UnitSourceMode>('your_roster');
  const [attackerInstanceId, setAttackerInstanceId] = useState<string>(
    initialAttackerInstanceId || userCompositeUnits[0]?.primaryUnit.instanceId || ''
  );

  const [defenderSource, setDefenderSource] = useState<UnitSourceMode>(
    opponentRosterId || allRosters.length > 1 ? 'opponent_roster' : 'on_the_fly'
  );
  const [defenderInstanceId, setDefenderInstanceId] = useState<string>(initialDefenderInstanceId || '');

  // Reset attacker/defender when opening with new initial IDs
  useEffect(() => {
    if (isOpen) {
      if (initialAttackerInstanceId) {
        setAttackerSource('your_roster');
        setAttackerInstanceId(initialAttackerInstanceId);
      }
      if (initialDefenderInstanceId) {
        setDefenderInstanceId(initialDefenderInstanceId);
      }
      if (initialCombatMode) {
        setCombatMode(initialCombatMode);
      }
    }
  }, [isOpen, initialAttackerInstanceId, initialDefenderInstanceId, initialCombatMode]);

  // Resolve Active Attacker CompositeUnit
  const activeAttackerUnit: CompositeUnit | null = useMemo(() => {
    if (attackerSource === 'your_roster') {
      return userCompositeUnits.find((u) => u.primaryUnit.instanceId === attackerInstanceId) || userCompositeUnits[0] || null;
    }
    if (attackerSource === 'opponent_roster') {
      return oppRosterCompositeUnits.find((u) => u.primaryUnit.instanceId === attackerInstanceId) || oppRosterCompositeUnits[0] || null;
    }
    const ds = onTheFlyDatasheets.find((d) => d.id === onTheFlySelectedDsId) || onTheFlyDatasheets[0];
    return ds ? createSyntheticCompositeUnit(ds) : null;
  }, [attackerSource, attackerInstanceId, userCompositeUnits, oppRosterCompositeUnits, onTheFlyDatasheets, onTheFlySelectedDsId]);

  // Resolve Active Defender CompositeUnit
  const activeDefenderUnit: CompositeUnit | null = useMemo(() => {
    if (defenderSource === 'your_roster') {
      return userCompositeUnits.find((u) => u.primaryUnit.instanceId === defenderInstanceId) || userCompositeUnits[0] || null;
    }
    if (defenderSource === 'opponent_roster') {
      return oppRosterCompositeUnits.find((u) => u.primaryUnit.instanceId === defenderInstanceId) || oppRosterCompositeUnits[0] || null;
    }
    const ds = onTheFlyDatasheets.find((d) => d.id === onTheFlySelectedDsId) || onTheFlyDatasheets[0];
    return ds ? createSyntheticCompositeUnit(ds) : null;
  }, [defenderSource, defenderInstanceId, userCompositeUnits, oppRosterCompositeUnits, onTheFlyDatasheets, onTheFlySelectedDsId]);

  // Target Keywords
  const targetKeywordsSet = useMemo(() => {
    return new Set((activeDefenderUnit?.combinedKeywords || []).map((k) => k.toLowerCase().trim()));
  }, [activeDefenderUnit]);

  // 5. ATTACKER WEAPONS & MODIFIERS STATE
  const [weaponGroups, setWeaponGroups] = useState<WeaponGroupUI[]>([]);

  // Initialize weapon groups whenever activeAttackerUnit, combatMode, or targetKeywords change
  useEffect(() => {
    if (!activeAttackerUnit) {
      setWeaponGroups([]);
      return;
    }
    const isMonsterVehicle =
      activeAttackerUnit.combinedKeywords.some((k) => /monster|vehicle/i.test(k));
    const weaponsList =
      combatMode === 'Ranged'
        ? activeAttackerUnit.equippedRangedWeapons
        : activeAttackerUnit.equippedMeleeWeapons;
    const groups = buildWeaponGroups(
      weaponsList,
      combatMode,
      targetKeywordsSet,
      isMonsterVehicle,
      activeAttackerUnit.primaryLiveState.remainingModels
    );
    setWeaponGroups(groups);
  }, [activeAttackerUnit, combatMode, targetKeywordsSet]);

  // Global Attacker Modifiers
  const [halfRange, setHalfRange] = useState(false);
  const [remainedStationary, setRemainedStationary] = useState(false);
  const [chargedThisTurn, setChargedThisTurn] = useState(false);
  const [isOverwatch, setIsOverwatch] = useState(false);

  const [hitModifier, setHitModifier] = useState<number>(0);
  const [hitReRoll, setHitReRoll] = useState<ReRollMode>('none');
  const [woundModifier, setWoundModifier] = useState<number>(0);
  const [woundReRoll, setWoundReRoll] = useState<ReRollMode>('none');
  const [apImprove, setApImprove] = useState<number>(0);
  const [damageBonus, setDamageBonus] = useState<number>(0);
  const [reRollDamage, setReRollDamage] = useState(false);

  const [grantLethal, setGrantLethal] = useState(false);
  const [grantSustained1, setGrantSustained1] = useState(false);
  const [grantDevastating, setGrantDevastating] = useState(false);
  const [grantIgnoresCover, setGrantIgnoresCover] = useState(false);

  // 6. DEFENDER STATS & BUFFS STATE (What-If, completely local)
  const [defModels, setDefModels] = useState<number>(5);
  const [defWoundsPerModel, setDefWoundsPerModel] = useState<number>(2);
  const [defCurrentModelWounds, setDefCurrentModelWounds] = useState<number>(2);
  const [defToughness, setDefToughness] = useState<number>(4);
  const [defSave, setDefSave] = useState<number>(3);
  const [defInvuln, setDefInvuln] = useState<number | null>(null);
  const [defFnp, setDefFnp] = useState<number | null>(null);
  const [defFnpMortalDev, setDefFnpMortalDev] = useState<number | null>(null);

  const [defCover, setDefCover] = useState(false);
  const [defAoC, setDefAoC] = useState(false); // Armour of Contempt (-1 AP)
  const [defStealth, setDefStealth] = useState(false);
  const [defWoundPenalty, setDefWoundPenalty] = useState(0);
  const [defDamageReduction, setDefDamageReduction] = useState<'none' | 'minus_one' | 'halve_up'>('none');
  const [defSaveReRoll, setDefSaveReRoll] = useState<SaveReRollMode>('none');

  // Sync Defender Stats whenever activeDefenderUnit changes
  useEffect(() => {
    if (!activeDefenderUnit) return;
    const primModel = activeDefenderUnit.primaryDatasheet.models[0];
    const modelsCount = activeDefenderUnit.primaryLiveState.remainingModels || 1;
    const woundsMax = primModel?.W || 1;
    const woundsCurr = activeDefenderUnit.primaryLiveState.currentModelWounds || woundsMax;
    const tVal = primModel?.T || 4;
    const svMatch = (primModel?.Sv || '3+').match(/(\d+)/);
    const svVal = svMatch ? parseInt(svMatch[1], 10) : 3;

    let invVal: number | null = null;
    if (primModel?.invSv) {
      const invMatch = primModel.invSv.match(/(\d+)/);
      if (invMatch) invVal = parseInt(invMatch[1], 10);
    }

    // Auto-detect FNP and Stealth from abilities
    let fnpVal: number | null = null;
    let fnpMortal: number | null = null;
    let hasStealth = false;

    for (const ab of activeDefenderUnit.combinedAbilities) {
      const abName = ab.name.toLowerCase();
      const abDesc = (ab.description || '').toLowerCase();
      const match = abName.match(/feel no pain\s*(\d)\+/i) || abDesc.match(/feel no pain\s*(\d)\+/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (abDesc.includes('mortal') || abDesc.includes('psychic')) {
          fnpMortal = val;
        } else {
          fnpVal = val;
        }
      }
      if (abName === 'stealth' || abDesc.includes('subtract 1 from that attack’s hit roll')) {
        hasStealth = true;
      }
    }

    setDefModels(modelsCount);
    setDefWoundsPerModel(woundsMax);
    setDefCurrentModelWounds(woundsCurr);
    setDefToughness(tVal);
    setDefSave(svVal);
    setDefInvuln(invVal);
    setDefFnp(fnpVal);
    setDefFnpMortalDev(fnpMortal);
    setDefStealth(hasStealth);
    setDefCover(false);
    setDefAoC(false);
    setDefDamageReduction('none');
    setDefWoundPenalty(0);
  }, [activeDefenderUnit]);

  // Auto-detect Attacker rules (e.g. Total Obliteration)
  const detectedAttackerChips = useMemo(() => {
    if (!activeAttackerUnit) return [];
    return scanUnitAbilitiesForMathhammer(activeAttackerUnit.combinedAbilities, 'attacker');
  }, [activeAttackerUnit]);

  useEffect(() => {
    const hasDamageReroll = detectedAttackerChips.some((c) => c.effectType === 'damage_reroll');
    setReRollDamage(hasDamageReroll);
    const hasHitRerollOnes = detectedAttackerChips.some((c) => c.effectType === 'hit_reroll_ones');
    if (hasHitRerollOnes) setHitReRoll('ones');
  }, [detectedAttackerChips]);

  // 7. 1-TAP SWAP SIDES
  const handleSwapSides = () => {
    const prevAttackerSource = attackerSource;
    const prevAttackerId = attackerInstanceId;
    const prevDefenderSource = defenderSource;
    const prevDefenderId = defenderInstanceId;

    setAttackerSource(prevDefenderSource);
    setAttackerInstanceId(prevDefenderId);
    setDefenderSource(prevAttackerSource);
    setDefenderInstanceId(prevAttackerId);
  };

  // 8. COMPILE PROFILES AND EXECUTE ENGINE
  const mathResult: MathhammerResult | null = useMemo(() => {
    if (!activeAttackerUnit || !activeDefenderUnit || weaponGroups.length === 0) {
      return null;
    }

    const compiledWeapons = compileWeaponProfiles(weaponGroups, targetKeywordsSet, {
      halfRange,
      remainedStationary,
      chargedThisTurn,
      hitMod: hitModifier,
      woundMod: woundModifier,
      apImprove,
      damageBonus,
      hitReRoll,
      woundReRoll,
      reRollDamage,
      grantLethalHits: grantLethal,
      grantSustainedHits1: grantSustained1,
      grantDevastatingWounds: grantDevastating,
      grantIgnoresCover,
    });

    const defenderProfile: DefenderCombatProfile = {
      name: activeDefenderUnit.displayName,
      models: defModels,
      woundsPerModel: defWoundsPerModel,
      currentModelWounds: defCurrentModelWounds,
      T: defToughness,
      Sv: defSave,
      invSv: defInvuln,
      fnp: defFnp,
      fnpMortalDev: defFnpMortalDev,
      hasCover: defCover,
      apWorsen: defAoC ? 1 : 0,
      damageReduction: defDamageReduction,
      hitPenalty: defStealth ? 1 : 0,
      woundPenalty: defWoundPenalty,
      saveReRoll: defSaveReRoll,
    };

    return calculateMathhammer(compiledWeapons, defenderProfile, isOverwatch);
  }, [
    activeAttackerUnit,
    activeDefenderUnit,
    weaponGroups,
    targetKeywordsSet,
    halfRange,
    remainedStationary,
    chargedThisTurn,
    hitModifier,
    woundModifier,
    apImprove,
    damageBonus,
    hitReRoll,
    woundReRoll,
    reRollDamage,
    grantLethal,
    grantSustained1,
    grantDevastating,
    grantIgnoresCover,
    defModels,
    defWoundsPerModel,
    defCurrentModelWounds,
    defToughness,
    defSave,
    defInvuln,
    defFnp,
    defFnpMortalDev,
    defCover,
    defAoC,
    defDamageReduction,
    defStealth,
    defWoundPenalty,
    defSaveReRoll,
    isOverwatch,
  ]);

  // 9. INLINE OPPONENT ROSTER IMPORT HANDLER
  const handleOpponentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOppImportError(null);
    try {
      await ensureFactionDataSynced(oppImportFactionId);
      const dsList = await db.datasheets.where('factionId').equals(oppImportFactionId).toArray();
      const detList = await db.detachments.where('factionId').equals(oppImportFactionId).toArray();
      const enhList = await db.enhancements.where('factionId').equals(oppImportFactionId).toArray();

      let imported: SavedRoster;
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        imported = await importFromNewRecruitJson(text, oppImportFactionId, dsList, detList, enhList);
      } else {
        imported = await importFromRoszOrRosFile(file, oppImportFactionId, dsList, detList, enhList);
      }
      imported.id = `roster_opp_${Date.now()}`;
      imported.name = `[Opponent] ${imported.name}`;
      await db.savedRosters.put(imported);
      if (onSaveOpponentRoster) {
        await onSaveOpponentRoster(imported);
      }
      setSelectedOppRosterId(imported.id);
      if (onSelectOpponentRosterId) {
        onSelectOpponentRosterId(imported.id);
      }
      setDefenderSource('opponent_roster');
      setIsOppImportOpen(false);
    } catch (err: any) {
      setOppImportError(err?.message || 'Failed to import opponent list file.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 no-print select-none">
      <div className="bg-[#0e1017] border border-slate-700 w-full max-w-5xl max-h-[94vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden text-slate-100">
        {/* =====================================================================
            1. TOP HEADER & MATCHUP BAR
           ===================================================================== */}
        <div className="border-b border-slate-800 bg-[#0b0c10] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  11th Edition Tabletop Mathhammer
                </span>
                <span className="text-xs text-slate-400">
                  {mathResult ? `(${mathResult.calculationTimeMs}ms exact)` : ''}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Combat & Survival Calculator</span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Combat Mode Toggle: Ranged vs Melee */}
            <div className="inline-flex rounded-lg bg-slate-900 border border-slate-700 p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setCombatMode('Ranged')}
                className={`min-h-[38px] px-3 rounded-md transition flex items-center gap-1.5 ${
                  combatMode === 'Ranged'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Ranged</span>
              </button>
              <button
                type="button"
                onClick={() => setCombatMode('Melee')}
                className={`min-h-[38px] px-3 rounded-md transition flex items-center gap-1.5 ${
                  combatMode === 'Melee'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Melee</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition"
              title="Close Mathhammer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =====================================================================
            2. MATCHUP SELECTOR STRIP WITH 1-TAP SWAP SIDES
           ===================================================================== */}
        <div className="border-b border-slate-800/80 bg-slate-950/70 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Attacker Selector */}
          <div className="flex-1 min-w-[260px] bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                <span>⚔️ Attacker:</span>
                <span className="text-white truncate max-w-[150px]">
                  {activeAttackerUnit?.displayName || 'Select Unit'}
                </span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setAttackerSource('your_roster')}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    attackerSource === 'your_roster' ? 'bg-emerald-500/30 text-emerald-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Your Army
                </button>
                <button
                  type="button"
                  onClick={() => setAttackerSource('opponent_roster')}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    attackerSource === 'opponent_roster' ? 'bg-rose-500/30 text-rose-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Opponent
                </button>
                <button
                  type="button"
                  onClick={() => setAttackerSource('on_the_fly')}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    attackerSource === 'on_the_fly' ? 'bg-cyan-500/30 text-cyan-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Any Datasheet
                </button>
              </div>
            </div>

            {attackerSource === 'your_roster' && (
              <select
                value={attackerInstanceId}
                onChange={(e) => setAttackerInstanceId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              >
                {userCompositeUnits.map((u) => (
                  <option key={u.primaryUnit.instanceId} value={u.primaryUnit.instanceId}>
                    {u.displayName} ({u.primaryLiveState.remainingModels} models)
                  </option>
                ))}
              </select>
            )}

            {attackerSource === 'opponent_roster' && (
              <select
                value={attackerInstanceId}
                onChange={(e) => setAttackerInstanceId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              >
                {oppRosterCompositeUnits.length === 0 ? (
                  <option value="">No units in opponent roster</option>
                ) : (
                  oppRosterCompositeUnits.map((u) => (
                    <option key={u.primaryUnit.instanceId} value={u.primaryUnit.instanceId}>
                      {u.displayName} ({u.primaryLiveState.remainingModels} models)
                    </option>
                  ))
                )}
              </select>
            )}

            {attackerSource === 'on_the_fly' && (
              <div className="flex gap-2">
                <select
                  value={onTheFlyFactionId}
                  onChange={(e) => setOnTheFlyFactionId(e.target.value)}
                  className="w-1/3 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  {factions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <select
                  value={onTheFlySelectedDsId}
                  onChange={(e) => setOnTheFlySelectedDsId(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  {onTheFlyDatasheets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 1-Tap SWAP SIDES BUTTON (44x44px) */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleSwapSides}
              className="min-w-[44px] min-h-[44px] rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/60 text-amber-300 flex items-center justify-center shadow transition active:scale-95"
              title="⇄ Swap Attacker & Defender (Flip from 'Will I kill them?' to 'Will they kill me?')"
            >
              <ArrowLeftRight className="w-5 h-5 text-amber-400" />
            </button>
          </div>

          {/* Defender Selector */}
          <div className="flex-1 min-w-[260px] bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-400 uppercase tracking-wide flex items-center gap-1">
                <span>🛡️ Defender:</span>
                <span className="text-white truncate max-w-[150px]">
                  {activeDefenderUnit?.displayName || 'Select Unit'}
                </span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDefenderSource('your_roster')}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    defenderSource === 'your_roster' ? 'bg-emerald-500/30 text-emerald-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Your Army
                </button>
                <button
                  type="button"
                  onClick={() => setDefenderSource('opponent_roster')}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    defenderSource === 'opponent_roster' ? 'bg-rose-500/30 text-rose-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Opponent
                </button>
                <button
                  type="button"
                  onClick={() => setDefenderSource('on_the_fly')}
                  className={`px-1.5 py-0.5 rounded text-[10px] ${
                    defenderSource === 'on_the_fly' ? 'bg-cyan-500/30 text-cyan-300 font-bold' : 'text-slate-400'
                  }`}
                >
                  Any Datasheet
                </button>
              </div>
            </div>

            {defenderSource === 'your_roster' && (
              <select
                value={defenderInstanceId}
                onChange={(e) => setDefenderInstanceId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
              >
                {userCompositeUnits.map((u) => (
                  <option key={u.primaryUnit.instanceId} value={u.primaryUnit.instanceId}>
                    {u.displayName} ({u.primaryLiveState.remainingModels} models)
                  </option>
                ))}
              </select>
            )}

            {defenderSource === 'opponent_roster' && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <select
                    value={defenderInstanceId}
                    onChange={(e) => setDefenderInstanceId(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                  >
                    {oppRosterCompositeUnits.length === 0 ? (
                      <option value="">No units in opponent roster</option>
                    ) : (
                      oppRosterCompositeUnits.map((u) => (
                        <option key={u.primaryUnit.instanceId} value={u.primaryUnit.instanceId}>
                          {u.displayName} ({u.primaryLiveState.remainingModels} models)
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIsOppImportOpen(true)}
                    className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 flex items-center gap-1 shrink-0 text-[11px]"
                    title="Import new opponent list file"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import</span>
                  </button>
                </div>
              </div>
            )}

            {defenderSource === 'on_the_fly' && (
              <div className="flex gap-2">
                <select
                  value={onTheFlyFactionId}
                  onChange={(e) => setOnTheFlyFactionId(e.target.value)}
                  className="w-1/3 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  {factions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <select
                  value={onTheFlySelectedDsId}
                  onChange={(e) => setOnTheFlySelectedDsId(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  {onTheFlyDatasheets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Opponent List File Import Sub-Panel (Collapsible) */}
        {isOppImportOpen && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-300">Import Opponent List:</span>
              <select
                value={oppImportFactionId}
                onChange={(e) => setOppImportFactionId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
              >
                {factions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <label className="cursor-pointer px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded hover:bg-amber-400 transition flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload .rosz / JSON / Text</span>
                <input
                  type="file"
                  accept=".rosz,.ros,.json,.txt"
                  className="hidden"
                  onChange={handleOpponentFileUpload}
                />
              </label>
              {oppImportError && <span className="text-rose-400 font-semibold">{oppImportError}</span>}
            </div>
            <button
              type="button"
              onClick={() => setIsOppImportOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        )}

        {/* =====================================================================
            3. MAIN SCROLLABLE CONTENT AREA
           ===================================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* PRIMARY RESULTS HERO: HEADLINE KILL GAUGE + THE 3 OUTCOME CARDS */}
          {mathResult && (
            <div className="bg-[#14161f] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
              {/* Row 1: Kill Gauge + Quick Summary */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`px-3.5 py-1.5 rounded-xl border text-sm sm:text-base font-black uppercase tracking-wider flex items-center gap-2 ${
                      mathResult.killProbabilityPercent >= 75
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : mathResult.killProbabilityPercent >= 35
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    }`}
                  >
                    <Target className="w-4 h-4" />
                    <span>Unit Wipe Probability: {mathResult.killProbabilityPercent}%</span>
                  </div>

                  <span className="text-xs text-slate-400">
                    Expected Dead: <strong className="text-white">{mathResult.modelsKilled.expectedMean}</strong> / {defModels} models
                    {' · '}
                    Expected Damage: <strong className="text-white">{mathResult.effectiveWoundsInflicted.expectedMean}</strong> W
                  </span>
                </div>

                <div className="text-xs text-slate-400">
                  Target: <span className="text-slate-200 font-medium">{defModels} models × {defWoundsPerModel}W</span> (T{defToughness} · Sv{defSave}+
                  {defInvuln ? ` · Inv${defInvuln}+` : ''}
                  {defFnp ? ` · FNP${defFnp}+` : ''})
                </div>
              </div>

              {/* Row 2: THE 3 OUTCOME CARDS (Bottom 25% | Middle 50% | Top 25%) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                {/* 1. Bottom 25% (Unlucky / Great Defender Saves) */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="font-extrabold uppercase tracking-wide text-rose-400 flex items-center gap-1.5">
                      <span>Bottom 25%</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Unlucky / Hot Saves</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Dead Models:</span>
                      <span className="font-bold text-white text-sm">
                        {mathResult.modelsKilled.bottom25.min === mathResult.modelsKilled.bottom25.max
                          ? `${mathResult.modelsKilled.bottom25.max} models`
                          : `${mathResult.modelsKilled.bottom25.min}–${mathResult.modelsKilled.bottom25.max} models`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Damage Dealt:</span>
                      <span className="font-semibold text-slate-200">
                        {mathResult.effectiveWoundsInflicted.bottom25.min}–{mathResult.effectiveWoundsInflicted.bottom25.max} W
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      <span className="text-slate-400">Defender Left:</span>
                      <span className="font-bold text-amber-300">
                        {mathResult.remainingModels.bottom25} models alive
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Middle 50% (Typical / Expected Outcome) */}
                <div className="bg-gradient-to-b from-amber-500/10 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-xl p-3.5 space-y-2 shadow-lg shadow-amber-500/5">
                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-1.5">
                    <span className="font-extrabold uppercase tracking-wide text-amber-300 flex items-center gap-1.5">
                      <span>Middle 50%</span>
                      <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded">
                        Typical Range
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-300">25th–75th Percentile</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Dead Models:</span>
                      <span className="font-bold text-amber-300 text-base">
                        {mathResult.modelsKilled.middle50.min === mathResult.modelsKilled.middle50.max
                          ? `${mathResult.modelsKilled.middle50.max} models`
                          : `${mathResult.modelsKilled.middle50.min}–${mathResult.modelsKilled.middle50.max} models`}
                        <span className="text-xs text-slate-400 font-normal ml-1">
                          (median {mathResult.modelsKilled.middle50.median})
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Damage Dealt:</span>
                      <span className="font-semibold text-white">
                        {mathResult.effectiveWoundsInflicted.middle50.min}–{mathResult.effectiveWoundsInflicted.middle50.max} W
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <span className="text-slate-300">Defender Left:</span>
                      <span className="font-bold text-emerald-400">
                        {mathResult.remainingModels.middle50Min === mathResult.remainingModels.middle50Max
                          ? `${mathResult.remainingModels.middle50Min} models`
                          : `${mathResult.remainingModels.middle50Min}–${mathResult.remainingModels.middle50Max} models`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Top 25% (Hot Rolls / Failed Saves) */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="font-extrabold uppercase tracking-wide text-emerald-400 flex items-center gap-1.5">
                      <span>Top 25%</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Hot Rolls / Spike</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Dead Models:</span>
                      <span className="font-bold text-white text-sm">
                        {mathResult.modelsKilled.top25.min === mathResult.modelsKilled.top25.max
                          ? `${mathResult.modelsKilled.top25.max} models`
                          : `${mathResult.modelsKilled.top25.min}–${mathResult.modelsKilled.top25.max} models`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Damage Dealt:</span>
                      <span className="font-semibold text-slate-200">
                        {mathResult.effectiveWoundsInflicted.top25.min}–{mathResult.effectiveWoundsInflicted.top25.max} W
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                      <span className="text-slate-400">Defender Left:</span>
                      <span className="font-bold text-rose-400">
                        {mathResult.remainingModels.top25} models alive
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 3: Visual Probability Distribution Histogram */}
              <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold uppercase tracking-wider text-slate-300">
                    Models Killed Probability Distribution:
                  </span>
                  <span>Hover / tap bar for cumulative probability</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-1.5">
                  {mathResult.modelsKilled.distribution.map((d) => (
                    <div
                      key={d.value}
                      className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-center flex flex-col justify-between"
                      title={`Chance of killing at least ${d.value} models: ${d.cumulativeAbove}%`}
                    >
                      <div className="text-[10px] text-slate-400 font-bold">
                        {d.value === defModels ? `${d.value} (Wipe)` : `${d.value} dead`}
                      </div>
                      <div className="my-1">
                        <div
                          className="h-1.5 rounded-full bg-amber-400"
                          style={{ width: `${Math.min(100, Math.max(8, d.probability * 2.5))}%`, margin: '0 auto' }}
                        />
                      </div>
                      <div className="text-xs font-bold text-amber-300">
                        {d.probability}%
                      </div>
                      <div className="text-[9px] text-slate-400">
                        &ge;{d.value}: {d.cumulativeAbove}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* =====================================================================
              4. ATTACKER WEAPONS & MODIFIERS PANEL
             ===================================================================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Attacker Weapons List */}
            <div className="bg-[#14161f] border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Crosshair className="w-4 h-4" />
                  <span>Attacker Weapons ({weaponGroups.filter((g) => g.enabled).length} active)</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  Select variants & adjust gun counts
                </span>
              </div>

              {weaponGroups.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-950/50 rounded-xl">
                  No {combatMode} weapons equipped for this unit.
                </div>
              ) : (
                <div className="space-y-2">
                  {weaponGroups.map((g, idx) => (
                    <div
                      key={g.groupKey}
                      className={`rounded-xl border p-2.5 space-y-2 transition ${
                        g.enabled
                          ? 'bg-slate-950/80 border-slate-700'
                          : 'bg-slate-950/30 border-slate-800/50 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-white truncate">
                          <input
                            type="checkbox"
                            checked={g.enabled}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setWeaponGroups((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, enabled: checked } : item))
                              );
                            }}
                            className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0"
                          />
                          <span className="truncate">{g.baseName}</span>
                          {g.isPistol && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px]">
                              Pistol
                            </span>
                          )}
                          {g.isExtraAttacks && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[10px]">
                              Extra Attacks
                            </span>
                          )}
                          {g.autoHunterTriggered && (
                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                              🎯 Auto Hunter
                            </span>
                          )}
                        </label>

                        {/* Gun count stepper (- / +) 44x44px target */}
                        <div className="flex items-center gap-1 shrink-0 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() =>
                              setWeaponGroups((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, count: Math.max(0, item.count - 1) } : item
                                )
                              )
                            }
                            className="min-w-[36px] min-h-[36px] rounded hover:bg-slate-800 text-slate-300 flex items-center justify-center"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 font-bold text-xs text-amber-400 tabular-nums">
                            {g.count}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setWeaponGroups((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, count: item.count + 1 } : item
                                )
                              )
                            }
                            className="min-w-[36px] min-h-[36px] rounded hover:bg-slate-800 text-slate-300 flex items-center justify-center"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Multi-profile Variant Radio Pills */}
                      {g.variants.length > 1 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/60">
                          <span className="text-[10px] text-slate-400">Profile:</span>
                          {g.variants.map((v) => (
                            <button
                              key={v.variantKey}
                              type="button"
                              onClick={() => {
                                setWeaponGroups((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, selectedVariantKey: v.variantKey } : item
                                  )
                                );
                              }}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                                g.selectedVariantKey === v.variantKey
                                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                              }`}
                            >
                              {v.variantLabel}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Active profile statline preview */}
                      {(() => {
                        const activeVariant =
                          g.variants.find((v) => v.variantKey === g.selectedVariantKey) ||
                          g.variants[0];
                        const w = activeVariant?.weapon;
                        if (!w) return null;
                        return (
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                            <span>Range: <strong className="text-slate-200">{w.range}</strong></span>
                            <span>A: <strong className="text-slate-200">{w.A}</strong></span>
                            <span>BS/WS: <strong className="text-slate-200">{w.BS_WS}</strong></span>
                            <span>S: <strong className="text-slate-200">{w.S}</strong></span>
                            <span>AP: <strong className="text-slate-200">{w.AP}</strong></span>
                            <span>D: <strong className="text-slate-200">{w.D}</strong></span>
                            {w.keywords.length > 0 && (
                              <span className="text-amber-400/80 truncate">
                                [{w.keywords.join(', ')}]
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}

              {/* Detected Attacker Wahapedia Ability Chips */}
              {detectedAttackerChips.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Detected Unit Abilities:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {detectedAttackerChips.map((c) => (
                      <span
                        key={c.id}
                        className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1"
                        title={c.description}
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>{c.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Attacker Context & Modifier Pills */}
            <div className="bg-[#14161f] border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-xs uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Attacker Situational Buffs & Modifiers</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setHalfRange(false);
                    setRemainedStationary(false);
                    setChargedThisTurn(false);
                    setIsOverwatch(false);
                    setHitModifier(0);
                    setHitReRoll('none');
                    setWoundModifier(0);
                    setWoundReRoll('none');
                    setApImprove(0);
                    setDamageBonus(0);
                    setGrantLethal(false);
                    setGrantSustained1(false);
                    setGrantDevastating(false);
                    setGrantIgnoresCover(false);
                  }}
                  className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Buffs</span>
                </button>
              </div>

              {/* 1. Context Toggles */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Range & Engagement Context:
                </span>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setHalfRange((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-lg border font-semibold transition ${
                      halfRange
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🎯 Half Range (Melta / Rapid Fire)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemainedStationary((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-lg border font-semibold transition ${
                      remainedStationary
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    🛡️ Stationary (+1 Heavy)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChargedThisTurn((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-lg border font-semibold transition ${
                      chargedThisTurn
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    ⚡ Charged (+1 Lance)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOverwatch((v) => !v)}
                    className={`px-2.5 py-1.5 rounded-lg border font-semibold transition ${
                      isOverwatch
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    👁️ Fire Overwatch (6s only)
                  </button>
                </div>
              </div>

              {/* 2. Hit & Wound Modifiers & Re-rolls */}
              <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-slate-800/60">
                {/* Hit Roll */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    To Hit Modifiers:
                  </span>
                  <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => setHitModifier(-1)}
                      className={`flex-1 py-1 rounded text-center font-bold ${
                        hitModifier === -1 ? 'bg-rose-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => setHitModifier(0)}
                      className={`flex-1 py-1 rounded text-center font-bold ${
                        hitModifier === 0 ? 'bg-slate-700 text-white' : 'text-slate-400'
                      }`}
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => setHitModifier(1)}
                      className={`flex-1 py-1 rounded text-center font-bold ${
                        hitModifier === 1 ? 'bg-emerald-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      +1
                    </button>
                  </div>

                  <select
                    value={hitReRoll}
                    onChange={(e) => setHitReRoll(e.target.value as ReRollMode)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                  >
                    <option value="none">No Hit Re-rolls</option>
                    <option value="ones">Re-roll 1s to Hit</option>
                    <option value="failed">Re-roll All Failed Hits</option>
                    <option value="non_crit">Fish for Crits (Re-roll non-6s)</option>
                  </select>
                </div>

                {/* Wound Roll */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    To Wound Modifiers:
                  </span>
                  <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => setWoundModifier(-1)}
                      className={`flex-1 py-1 rounded text-center font-bold ${
                        woundModifier === -1 ? 'bg-rose-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => setWoundModifier(0)}
                      className={`flex-1 py-1 rounded text-center font-bold ${
                        woundModifier === 0 ? 'bg-slate-700 text-white' : 'text-slate-400'
                      }`}
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => setWoundModifier(1)}
                      className={`flex-1 py-1 rounded text-center font-bold ${
                        woundModifier === 1 ? 'bg-emerald-600 text-white' : 'text-slate-400'
                      }`}
                    >
                      +1
                    </button>
                  </div>

                  <select
                    value={woundReRoll}
                    onChange={(e) => setWoundReRoll(e.target.value as ReRollMode)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                  >
                    <option value="none">No Wound Re-rolls</option>
                    <option value="ones">Re-roll 1s to Wound</option>
                    <option value="failed">Re-roll Failed Wounds (Twin-Linked)</option>
                  </select>
                </div>
              </div>

              {/* 3. Stat & Keyword Grants */}
              <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Stratagem / Enhancement Buffs:
                </span>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setApImprove((v) => (v === 1 ? 0 : 1))}
                    className={`px-2.5 py-1 rounded-lg border font-semibold transition ${
                      apImprove === 1
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    +1 AP
                  </button>
                  <button
                    type="button"
                    onClick={() => setDamageBonus((v) => (v === 1 ? 0 : 1))}
                    className={`px-2.5 py-1 rounded-lg border font-semibold transition ${
                      damageBonus === 1
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    +1 Damage
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrantLethal((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg border font-semibold transition ${
                      grantLethal
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    [LETHAL HITS]
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrantSustained1((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg border font-semibold transition ${
                      grantSustained1
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    [SUSTAINED HITS 1]
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrantDevastating((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg border font-semibold transition ${
                      grantDevastating
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    [DEVASTATING WOUNDS]
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrantIgnoresCover((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg border font-semibold transition ${
                      grantIgnoresCover
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    [IGNORES COVER]
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              5. DEFENDER STATS & DEFENSIVE BUFFS PANEL (Pure What-If Local State)
             ===================================================================== */}
          <div className="bg-[#14161f] border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <Shield className="w-4 h-4" />
                <span>Defender Health & Defensive Reactions (What-If State)</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Adjust wounds or test reactions (does not alter live game state)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs">
              {/* Models Count Stepper */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Models</span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setDefModels((v) => Math.max(1, v - 1))}
                    className="w-8 h-8 rounded bg-slate-900 hover:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="text-sm font-black text-white">{defModels}</span>
                  <button
                    type="button"
                    onClick={() => setDefModels((v) => v + 1)}
                    className="w-8 h-8 rounded bg-slate-900 hover:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Wounds per Model Stepper */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Wounds/Model</span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setDefWoundsPerModel((v) => Math.max(1, v - 1))}
                    className="w-8 h-8 rounded bg-slate-900 hover:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="text-sm font-black text-white">{defWoundsPerModel}</span>
                  <button
                    type="button"
                    onClick={() => setDefWoundsPerModel((v) => v + 1)}
                    className="w-8 h-8 rounded bg-slate-900 hover:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Current Model Wounds Stepper */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Active Wounds</span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setDefCurrentModelWounds((v) => Math.max(1, v - 1))}
                    className="w-8 h-8 rounded bg-slate-900 hover:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="text-sm font-black text-amber-300">{defCurrentModelWounds}</span>
                  <button
                    type="button"
                    onClick={() => setDefCurrentModelWounds((v) => Math.min(defWoundsPerModel, v + 1))}
                    className="w-8 h-8 rounded bg-slate-900 hover:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Toughness */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Toughness</span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setDefToughness((v) => Math.max(1, v - 1))}
                    className="w-8 h-8 rounded bg-slate-900 hover:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="text-sm font-black text-white">T{defToughness}</span>
                  <button
                    type="button"
                    onClick={() => setDefToughness((v) => v + 1)}
                    className="w-8 h-8 rounded bg-slate-900 hover:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Armor Save */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Armor Save</span>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setDefSave((v) => Math.min(6, v + 1))}
                    className="w-8 h-8 rounded bg-slate-900 hover:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="text-sm font-black text-white">{defSave}+</span>
                  <button
                    type="button"
                    onClick={() => setDefSave((v) => Math.max(2, v - 1))}
                    className="w-8 h-8 rounded bg-slate-900 hover:bg-slate-800 flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Invulnerable Save Override */}
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Invulnerable</span>
                <select
                  value={defInvuln ?? ''}
                  onChange={(e) => setDefInvuln(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full bg-slate-900 border border-slate-700 rounded h-8 px-1 text-xs text-white"
                >
                  <option value="">None</option>
                  <option value="6">6+ InSv</option>
                  <option value="5">5+ InSv</option>
                  <option value="4">4+ InSv</option>
                  <option value="3">3+ InSv</option>
                </select>
              </div>
            </div>

            {/* Defensive Reaction Pills */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Defensive Buffs & Reactions:
              </span>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDefCover((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-lg border font-semibold transition ${
                    defCover
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🛡️ Benefit of Cover (+1 Save)
                </button>
                <button
                  type="button"
                  onClick={() => setDefAoC((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-lg border font-semibold transition ${
                    defAoC
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🛡️ Armour of Contempt (-1 AP)
                </button>
                <button
                  type="button"
                  onClick={() => setDefStealth((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-lg border font-semibold transition ${
                    defStealth
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🌫️ Stealth (-1 to Hit)
                </button>
                <button
                  type="button"
                  onClick={() => setDefWoundPenalty((v) => (v === 1 ? 0 : 1))}
                  className={`px-2.5 py-1.5 rounded-lg border font-semibold transition ${
                    defWoundPenalty === 1
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🛡️ -1 to Wound
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDefDamageReduction((v) => (v === 'minus_one' ? 'none' : 'minus_one'))
                  }
                  className={`px-2.5 py-1.5 rounded-lg border font-semibold transition ${
                    defDamageReduction === 'minus_one'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🛡️ -1 Damage (min 1)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDefDamageReduction((v) => (v === 'halve_up' ? 'none' : 'halve_up'))
                  }
                  className={`px-2.5 py-1.5 rounded-lg border font-semibold transition ${
                    defDamageReduction === 'halve_up'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  🛡️ Halve Damage (round up)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info bar */}
        <div className="border-t border-slate-800 bg-[#08090d] px-4 py-2.5 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-400" />
            <span>
              100% exact discrete Markov chain convolution. Models multi-wound waste, random damage, FNP, and critical branching without Monte Carlo noise.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
