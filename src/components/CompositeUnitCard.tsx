import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Flame,
  Skull,
  Lock,
  Zap,
  Eye,
  Crosshair,
  Swords,
  Shield,
  CheckSquare,
  Square,
  Plus,
  Minus,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  CompositeUnit,
  CompositeWeaponEntry,
  LiveUnitState,
  Phase,
  Stratagem,
  UnitBattlefieldStatus,
} from '../types/rules';
import { isActiveInPhaseAndTurn } from '../engine/compositeUnitBuilder';
import { KeywordBadge } from './KeywordTooltip';

interface CompositeUnitCardProps {
  composite: CompositeUnit;
  currentPhase: Phase;
  currentTurn: 'your_turn' | 'opponent_turn';
  phaseStratagems: Stratagem[];
  userCp: number;
  forceCompact?: boolean;
  onUpdateUnitState: (instanceId: string, updater: (prev: LiveUnitState) => LiveUnitState) => void;
  onUseStratagemOnUnit: (stratagem: Stratagem, unitInstanceId: string) => void;
  onOpenUnitStratagems?: (unitInstanceId: string) => void;
}

export const CompositeUnitCard: React.FC<CompositeUnitCardProps> = ({
  composite,
  currentPhase,
  currentTurn,
  phaseStratagems,
  userCp,
  forceCompact = false,
  onUpdateUnitState,
  onUseStratagemOnUnit,
  onOpenUnitStratagems,
}) => {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
  const [showWeaponsOverride, setShowWeaponsOverride] = useState(false);
  const [showAllDatasheetDetails, setShowAllDatasheetDetails] = useState(false);
  const [showOverwatchRanged, setShowOverwatchRanged] = useState(false);
  const [showInlineEligibleStrats, setShowInlineEligibleStrats] = useState(false);
  const [deadlyDemisePrompt, setDeadlyDemisePrompt] = useState<string | null>(null);

  // When forceCompact prop toggles globally (e.g. Expand Ready Units / Compact All Units), clear manual override
  useEffect(() => {
    setManualExpanded(null);
  }, [forceCompact]);

  const {
    primaryUnit,
    primaryDatasheet,
    primaryLiveState,
    attachedLeader,
    attachedSupport,
  } = composite;

  const isActivated = Boolean(primaryLiveState.activatedInPhase);
  const isDestroyed = primaryLiveState.status === 'destroyed';

  // Determine whether the card is currently rendered in Compact 1-Line mode
  const isCompactMode =
    manualExpanded !== null
      ? !manualExpanded
      : forceCompact || isActivated || isDestroyed;

  const isOpponentNonMeleeTurn =
    currentTurn === 'opponent_turn' && currentPhase !== 'fight';

  // Filter eligible stratagems in this phase for this unit
  const unitEligiblePhaseStrats = phaseStratagems.filter((s) =>
    composite.eligibleStratagemIds.includes(s.id)
  );

  const lockedStratId = primaryLiveState.lockedByStratagemIdInPhase;
  const lockedStratName = phaseStratagems.find((s) => s.id === lockedStratId)?.name;

  // Phase-specific Action Button Label
  const getActionToggleLabel = (done: boolean) => {
    switch (currentPhase) {
      case 'movement':
        return done ? 'Moved' : 'Mark Moved';
      case 'shooting':
        return done ? 'Shot' : 'Mark Shot';
      case 'charge':
        return done ? 'Charged' : 'Mark Charged';
      case 'fight':
        return done ? 'Fought' : 'Mark Fought';
      default:
        return done ? 'Done' : 'Mark Done';
    }
  };

  const handleToggleActivated = () => {
    onUpdateUnitState(primaryUnit.instanceId, (prev) => {
      const nextVal = !prev.activatedInPhase;
      // Reset manual expansion override when toggling activation so Done units auto-collapse
      setManualExpanded(null);
      return {
        ...prev,
        activatedInPhase: nextVal,
      };
    });
  };

  // Adjust models or wounds for any member (bodyguard, leader, or support)
  const adjustMemberHealth = (
    instanceId: string,
    startingModels: number,
    startingWounds: number,
    deltaModels: number,
    deltaWounds: number
  ) => {
    onUpdateUnitState(instanceId, (prev) => {
      let nextModels = Math.max(0, Math.min(startingModels, prev.remainingModels + deltaModels));
      let nextWounds = prev.currentModelWounds + deltaWounds;

      if (deltaWounds < 0 && nextWounds <= 0) {
        nextModels = Math.max(0, nextModels - 1);
        nextWounds = nextModels > 0 ? startingWounds : 0;
      } else if (deltaWounds > 0 && nextWounds > startingWounds) {
        if (nextModels < startingModels) {
          nextModels += 1;
          nextWounds = 1;
        } else {
          nextWounds = startingWounds;
        }
      } else {
        nextWounds = nextModels > 0 ? Math.max(1, Math.min(startingWounds, nextWounds)) : 0;
      }

      if (deltaModels < 0 && nextModels === 0) {
        nextWounds = 0;
      } else if (deltaModels > 0 && prev.remainingModels === 0 && nextModels > 0) {
        nextWounds = startingWounds;
      }

      const nextStatus: UnitBattlefieldStatus =
        nextModels <= 0 ? 'destroyed' : prev.status === 'destroyed' ? 'on_battlefield' : prev.status;

      if (nextModels === 0 && prev.remainingModels > 0 && composite.hasDeadlyDemise) {
        setDeadlyDemisePrompt(
          `Roll D6 for Deadly Demise ${composite.deadlyDemiseParameter || '1'}! On a 6, each unit within 6" suffers ${
            composite.deadlyDemiseParameter || '1'
          } mortal wounds.`
        );
      }

      return {
        ...prev,
        remainingModels: nextModels,
        currentModelWounds: nextWounds,
        status: nextStatus,
      };
    });
  };

  const toggleOncePerBattle = (itemId: string) => {
    onUpdateUnitState(primaryUnit.instanceId, (prev) => {
      const exists = prev.usedOncePerBattleIds.includes(itemId);
      return {
        ...prev,
        usedOncePerBattleIds: exists
          ? prev.usedOncePerBattleIds.filter((id) => id !== itemId)
          : [...prev.usedOncePerBattleIds, itemId],
      };
    });
  };

  const handleOpenStratagems = () => {
    if (onOpenUnitStratagems) {
      onOpenUnitStratagems(primaryUnit.instanceId);
    } else {
      setShowInlineEligibleStrats((v) => !v);
    }
  };

  // Determine which abilities to display
  const activeAbilities = composite.combinedAbilities.filter((ab) => {
    if (ab.type === 'Core' || ab.type === 'Faction') return false;
    if (showAllDatasheetDetails) return true;
    if (isOpponentNonMeleeTurn && ab.isDefensiveOrReactive) return true;
    return isActiveInPhaseAndTurn(ab.phases, ab.timing, currentPhase, currentTurn);
  });

  const sortedAbilities = [...activeAbilities].sort((a, b) => {
    if (isOpponentNonMeleeTurn) {
      return Number(Boolean(b.isDefensiveOrReactive)) - Number(Boolean(a.isDefensiveOrReactive));
    }
    return 0;
  });

  const rangedList = showAllDatasheetDetails
    ? composite.allRangedWeapons
    : composite.equippedRangedWeapons;
  const meleeList = showAllDatasheetDetails
    ? composite.allMeleeWeapons
    : composite.equippedMeleeWeapons;

  const showRangedSection =
    rangedList.length > 0 &&
    (currentPhase === 'shooting' ||
      currentPhase === 'pre_game' ||
      showOverwatchRanged ||
      showWeaponsOverride ||
      showAllDatasheetDetails);

  const showMeleeSection =
    meleeList.length > 0 &&
    (currentPhase === 'fight' ||
      currentPhase === 'charge' ||
      currentPhase === 'pre_game' ||
      showWeaponsOverride ||
      showAllDatasheetDetails);

  const primaryModel = primaryDatasheet.models[0];

  // ============================================================================
  // COMPACT 1-LINE SUMMARY ROW (Used when unit is Marked Done or Compact View)
  // ============================================================================
  if (isCompactMode) {
    return (
      <div
        id={`unit-card-${primaryUnit.instanceId}`}
        className={`rounded-xl border px-3.5 py-2.5 transition-all flex flex-wrap items-center justify-between gap-2 ${
          isDestroyed
            ? 'bg-slate-950/40 border-rose-900/40 opacity-55'
            : isActivated
            ? 'bg-slate-900/50 border-emerald-800/50 opacity-85'
            : primaryLiveState.isBattleShocked
            ? 'bg-slate-900/90 border-amber-500/70'
            : 'bg-slate-900/85 border-slate-800 hover:border-slate-700'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          {!isDestroyed && (
            <button
              type="button"
              onClick={handleToggleActivated}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition shrink-0 ${
                isActivated
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-amber-400 hover:text-amber-300'
              }`}
              title="Toggle phase activation status"
            >
              {isActivated ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{getActionToggleLabel(isActivated)}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setManualExpanded(true)}
            className="text-left font-bold text-sm text-white hover:text-amber-300 truncate transition"
          >
            {composite.displayName}
          </button>

          {/* Quick Inline Stats Pill */}
          {primaryModel && (
            <div className="hidden sm:inline-flex items-center gap-2 px-2 py-0.5 rounded bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300">
              <span>
                M <strong className="text-white">{primaryModel.M}</strong>
              </span>
              <span>·</span>
              <span>
                T <strong className="text-emerald-300">{primaryModel.T}</strong>
              </span>
              <span>·</span>
              <span>
                Sv <strong className="text-white">{primaryModel.Sv}</strong>
              </span>
              {primaryModel.invSv && (
                <>
                  <span>·</span>
                  <span>
                    Inv <strong className="text-cyan-300">{primaryModel.invSv}</strong>
                  </span>
                </>
              )}
              <span>·</span>
              <span>
                OC{' '}
                <strong className={primaryLiveState.isBattleShocked ? 'text-rose-400' : 'text-amber-300'}>
                  {primaryLiveState.isBattleShocked ? 0 : primaryModel.OC}
                </strong>
              </span>
            </div>
          )}

          {/* Status & Alerts */}
          {primaryLiveState.isBattleShocked && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/50">
              ⚡ Battle-Shocked
            </span>
          )}
          {composite.isInDamagedBracket && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700">
              ⚠️ Damaged
            </span>
          )}
          {lockedStratId && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/80 text-rose-200 border border-rose-700">
              🔒 {lockedStratName || 'Stratagem Used'}
            </span>
          )}
        </div>

        {/* Right Side: Quick Health Counter + Stratagems + Expand Button */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          {/* Quick Wound / Model Counter */}
          <div className="inline-flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs">
            <span className="text-amber-300 font-semibold">
              {primaryLiveState.remainingModels}/{primaryUnit.startingModels} Mdl
            </span>
            <span className="text-slate-600">·</span>
            <button
              type="button"
              onClick={() =>
                adjustMemberHealth(
                  primaryUnit.instanceId,
                  primaryUnit.startingModels,
                  primaryUnit.startingWoundsPerModel,
                  0,
                  -1
                )
              }
              className="p-0.5 text-emerald-300 hover:text-white"
              title="-1 Wound"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-emerald-300 font-bold">
              {primaryLiveState.currentModelWounds}W
            </span>
            <button
              type="button"
              onClick={() =>
                adjustMemberHealth(
                  primaryUnit.instanceId,
                  primaryUnit.startingModels,
                  primaryUnit.startingWoundsPerModel,
                  0,
                  1
                )
              }
              className="p-0.5 text-emerald-300 hover:text-white"
              title="+1 Wound"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          {!lockedStratId && !isDestroyed && unitEligiblePhaseStrats.length > 0 && (
            <button
              type="button"
              onClick={handleOpenStratagems}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 transition"
              title="Open eligible Stratagems for this unit"
            >
              <Zap className="w-3 h-3" />
              <span>{unitEligiblePhaseStrats.length}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setManualExpanded(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <span>Expand</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // EXPANDED PHASE-FOCUSED CARD (Default for Ready Units on the Battlefield)
  // ============================================================================
  const renderWeaponsTable = (
    title: string,
    icon: React.ReactNode,
    entries: CompositeWeaponEntry[]
  ) => (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
          {icon}
          <span>{title}</span>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/70">
              <th className="py-1.5 px-2.5">Weapon</th>
              <th className="py-1.5 px-2 text-center">Range</th>
              <th className="py-1.5 px-2 text-center">A</th>
              <th className="py-1.5 px-2 text-center">BS/WS</th>
              <th className="py-1.5 px-2 text-center">S</th>
              <th className="py-1.5 px-2 text-center">AP</th>
              <th className="py-1.5 px-2 text-center">D</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const { weapon, ownerName, isOwnerDestroyed } = entry;
              const isOneShotUsed = primaryLiveState.usedOncePerBattleIds.includes(weapon.id);
              return (
                <tr
                  key={`${entry.ownerInstanceId}_${weapon.id}`}
                  className={`border-b border-slate-800/50 ${
                    isOwnerDestroyed || isOneShotUsed ? 'opacity-40 line-through' : ''
                  }`}
                >
                  <td className="py-1.5 px-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-100">{weapon.name}</span>
                      {ownerName !== primaryDatasheet.name && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          {ownerName}
                        </span>
                      )}
                      {isOwnerDestroyed && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700">
                          Bearer Destroyed
                        </span>
                      )}
                      {weapon.isOneShot && (
                        <button
                          type="button"
                          onClick={() => toggleOncePerBattle(weapon.id)}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-200 border border-purple-700/60 no-underline"
                        >
                          {isOneShotUsed ? (
                            <CheckSquare className="w-3 h-3 text-purple-300" />
                          ) : (
                            <Square className="w-3 h-3" />
                          )}
                          <span>{isOneShotUsed ? 'One Shot Fired' : 'One Shot'}</span>
                        </button>
                      )}
                    </div>
                    {weapon.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {weapon.keywords.map((kw, i) => (
                          <KeywordBadge key={i} keyword={kw} variant="weapon_ability" />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-center text-slate-300">{weapon.range}</td>
                  <td className="py-1.5 px-2 text-center font-semibold text-white">{weapon.A}</td>
                  <td className="py-1.5 px-2 text-center text-slate-200">
                    {composite.isInDamagedBracket ? (
                      <span className="text-rose-400 font-bold" title="Damaged penalty applies">
                        {weapon.BS_WS} ⚠️
                      </span>
                    ) : (
                      weapon.BS_WS
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-center font-semibold text-white">{weapon.S}</td>
                  <td className="py-1.5 px-2 text-center text-slate-200">{weapon.AP}</td>
                  <td className="py-1.5 px-2 text-center font-bold text-amber-300">{weapon.D}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const totalWeaponsCount =
    composite.equippedRangedWeapons.length + composite.equippedMeleeWeapons.length;

  return (
    <div
      id={`unit-card-${primaryUnit.instanceId}`}
      className={`print-card rounded-xl border transition-all p-4 ${
        isDestroyed
          ? 'bg-slate-950/50 border-rose-900/40 opacity-60'
          : primaryLiveState.isBattleShocked
          ? 'bg-slate-900/95 border-amber-500/70 shadow-lg shadow-amber-950/20'
          : 'bg-slate-900/90 border-slate-800 shadow-md'
      }`}
    >
      {/* Top Unit Title & Action Controls */}
      <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-white tracking-tight">
              {composite.displayName}
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
              {composite.totalPoints} pts
            </span>
            {primaryLiveState.isDetachedFromBodyguard && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                Separated Character (Bodyguard Wiped Out)
              </span>
            )}
          </div>

          {/* Core & Faction Abilities Pills */}
          {(composite.combinedCoreAbilities.length > 0 ||
            primaryDatasheet.factionAbilities.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {composite.combinedCoreAbilities.map((core) => {
                const matchingAb = composite.combinedAbilities.find(
                  (a) => a.type === 'Core' && a.name === core
                );
                return (
                  <KeywordBadge
                    key={core}
                    keyword={core}
                    variant="core_ability"
                    customDescription={matchingAb?.description}
                  />
                );
              })}
              {primaryDatasheet.factionAbilities.map((fa) => {
                const matchingFa = composite.combinedAbilities.find(
                  (a) => a.type === 'Faction' && a.name === fa
                );
                return (
                  <KeywordBadge
                    key={fa}
                    keyword={fa}
                    variant="faction_ability"
                    customDescription={matchingFa?.description}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Action-First Controls: Ready/Done Button + Pop-Out Stratagems + Battle-Shock + Status + Collapse */}
        <div className="flex flex-wrap items-center gap-1.5 no-print">
          {!isDestroyed && (
            <button
              type="button"
              onClick={handleToggleActivated}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition ${
                isActivated
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow'
                  : 'bg-emerald-950/60 hover:bg-emerald-900/70 border-emerald-600/60 text-emerald-200'
              }`}
              title="Mark unit as having completed its action in this phase (collapses card)"
            >
              {isActivated ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <Circle className="w-3.5 h-3.5" />
              )}
              <span>{getActionToggleLabel(isActivated)}</span>
            </button>
          )}

          {/* 1-Stratagem-Per-Phase Lock Badge or Pop-Out Stratagems Launcher */}
          {lockedStratId ? (
            <button
              type="button"
              onClick={() =>
                onUpdateUnitState(primaryUnit.instanceId, (prev) => ({
                  ...prev,
                  lockedByStratagemIdInPhase: undefined,
                }))
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-950/80 border border-rose-600 text-rose-200"
              title="Click to unlock unit for this phase"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Locked: {lockedStratName || 'Stratagem Used'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenStratagems}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 transition"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{unitEligiblePhaseStrats.length} Stratagems</span>
            </button>
          )}

          {/* Battle-Shock Toggle */}
          <button
            type="button"
            onClick={() =>
              onUpdateUnitState(primaryUnit.instanceId, (prev) => ({
                ...prev,
                isBattleShocked: !prev.isBattleShocked,
              }))
            }
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
              primaryLiveState.isBattleShocked
                ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>
              {primaryLiveState.isBattleShocked ? 'Battle-shocked (OC 0)' : 'Battle-shock'}
            </span>
          </button>

          {/* Status Selector */}
          <select
            value={primaryLiveState.status}
            onChange={(e) =>
              onUpdateUnitState(primaryUnit.instanceId, (prev) => ({
                ...prev,
                status: e.target.value as UnitBattlefieldStatus,
              }))
            }
            className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="on_battlefield">🟢 Battlefield</option>
            <option value="reserves">📦 Reserves</option>
            <option value="embarked">🚐 Embarked</option>
            <option value="destroyed">💀 Destroyed</option>
          </select>

          {/* Manual Collapse Button */}
          <button
            type="button"
            onClick={() => setManualExpanded(false)}
            className="p-1 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
            title="Collapse unit card"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Smart Auto-Detection Alert Banners */}
      <div className="space-y-2 mt-2">
        {deadlyDemisePrompt && (
          <div className="flex items-center justify-between gap-2 bg-rose-950/90 border border-rose-500 rounded-lg px-3 py-2 text-xs text-rose-100">
            <div className="flex items-center gap-2 font-semibold">
              <Skull className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{deadlyDemisePrompt}</span>
            </div>
            <button
              type="button"
              onClick={() => setDeadlyDemisePrompt(null)}
              className="px-2 py-0.5 rounded bg-rose-800 text-white text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {composite.isBelowHalfStrength && !primaryLiveState.isBattleShocked && (
          <div className="flex items-center justify-between gap-2 bg-amber-950/70 border border-amber-600/60 rounded-lg px-3 py-1.5 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Below Half-Strength:</strong> Must take a Battle-shock test (2D6 vs Ld{' '}
                {primaryDatasheet.models[0]?.Ld || '6+'}) in your Command phase.
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateUnitState(primaryUnit.instanceId, (prev) => ({
                  ...prev,
                  isBattleShocked: true,
                }))
              }
              className="px-2 py-0.5 rounded bg-amber-600/40 hover:bg-amber-600/60 border border-amber-500 text-amber-100 text-[11px] font-semibold shrink-0 no-print"
            >
              Mark Failed
            </button>
          </div>
        )}

        {composite.isInDamagedBracket && (
          <div className="flex items-center gap-2 bg-rose-950/70 border border-rose-600/60 rounded-lg px-3 py-1.5 text-xs text-rose-200">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>DAMAGED ({primaryDatasheet.damagedW} Wounds Remaining):</strong>{' '}
              {primaryDatasheet.damagedDescription ||
                'While this model has 1-4 wounds remaining, each time this model makes an attack, subtract 1 from the Hit roll.'}
            </span>
          </div>
        )}
      </div>

      {/* Fallback Inline Stratagems Drawer (if onOpenUnitStratagems not provided) */}
      {showInlineEligibleStrats && (
        <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-amber-500/40 space-y-2 no-print">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Eligible Stratagems for {composite.displayName} in this Phase
            </span>
            <button
              type="button"
              onClick={() => setShowInlineEligibleStrats(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>
          {unitEligiblePhaseStrats.length === 0 ? (
            <p className="text-xs text-slate-400">No eligible Stratagems in this phase/turn.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {unitEligiblePhaseStrats.map((strat) => {
                const canAfford = userCp >= strat.cpCost;
                const isDisabled =
                  Boolean(lockedStratId) || primaryLiveState.isBattleShocked || !canAfford;
                return (
                  <div
                    key={strat.id}
                    className="p-2.5 rounded border border-slate-800 bg-slate-900/90 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">{strat.name}</span>
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          {strat.cpCost} CP
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1 line-clamp-3">
                        {strat.effectText || strat.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        onUseStratagemOnUnit(strat, primaryUnit.instanceId);
                        setShowInlineEligibleStrats(false);
                      }}
                      className={`w-full py-1 rounded text-xs font-bold transition ${
                        isDisabled
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      {lockedStratId
                        ? 'Unit Locked This Phase'
                        : !canAfford
                        ? `Need ${strat.cpCost} CP`
                        : `Use on Unit (-${strat.cpCost} CP & Lock Phase)`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Separate Casualty & Wound Pools (Bodyguard vs Attached Regular Leader vs Attached Support) */}
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 no-print">
        {/* Bodyguard Pool */}
        <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              {attachedLeader || attachedSupport ? 'Bodyguard Pool' : 'Unit Health Pool'}
            </div>
            <div className="text-xs font-bold text-white">
              {primaryDatasheet.name}:{' '}
              <span className="text-amber-300">
                {primaryLiveState.remainingModels}/{primaryUnit.startingModels} models
              </span>{' '}
              ·{' '}
              <span className="text-emerald-300">
                {primaryLiveState.currentModelWounds}/{primaryUnit.startingWoundsPerModel} W
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {primaryUnit.startingModels > 1 && (
              <div className="flex items-center border border-slate-700 rounded bg-slate-900 px-1 py-0.5 mr-1">
                <button
                  type="button"
                  onClick={() =>
                    adjustMemberHealth(
                      primaryUnit.instanceId,
                      primaryUnit.startingModels,
                      primaryUnit.startingWoundsPerModel,
                      -1,
                      0
                    )
                  }
                  className="p-0.5 text-slate-300 hover:text-white"
                  title="Remove 1 Model"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-[10px] px-1 text-slate-400">Mdl</span>
                <button
                  type="button"
                  onClick={() =>
                    adjustMemberHealth(
                      primaryUnit.instanceId,
                      primaryUnit.startingModels,
                      primaryUnit.startingWoundsPerModel,
                      1,
                      0
                    )
                  }
                  className="p-0.5 text-slate-300 hover:text-white"
                  title="Restore 1 Model"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-center border border-emerald-800/60 rounded bg-emerald-950/40 px-1 py-0.5">
              <button
                type="button"
                onClick={() =>
                  adjustMemberHealth(
                    primaryUnit.instanceId,
                    primaryUnit.startingModels,
                    primaryUnit.startingWoundsPerModel,
                    0,
                    -1
                  )
                }
                className="p-0.5 text-emerald-300 hover:text-white"
                title="-1 Wound"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-[10px] px-1 text-emerald-300 font-semibold">W</span>
              <button
                type="button"
                onClick={() =>
                  adjustMemberHealth(
                    primaryUnit.instanceId,
                    primaryUnit.startingModels,
                    primaryUnit.startingWoundsPerModel,
                    0,
                    1
                  )
                }
                className="p-0.5 text-emerald-300 hover:text-white"
                title="+1 Wound"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Attached Regular Leader Pool */}
        {attachedLeader && (
          <div className="flex items-center justify-between bg-amber-950/20 border border-amber-700/40 rounded-lg px-3 py-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
                Attached Leader
              </div>
              <div className="text-xs font-bold text-white">
                {attachedLeader.datasheet.name}:{' '}
                <span
                  className={
                    attachedLeader.liveState.currentModelWounds <= 0
                      ? 'text-rose-400'
                      : 'text-amber-300'
                  }
                >
                  {attachedLeader.liveState.currentModelWounds}/
                  {attachedLeader.rosterUnit.startingWoundsPerModel} W
                </span>
              </div>
            </div>
            <div className="flex items-center border border-amber-700/60 rounded bg-slate-900 px-1 py-0.5">
              <button
                type="button"
                onClick={() =>
                  adjustMemberHealth(
                    attachedLeader.rosterUnit.instanceId,
                    attachedLeader.rosterUnit.startingModels,
                    attachedLeader.rosterUnit.startingWoundsPerModel,
                    0,
                    -1
                  )
                }
                className="p-0.5 text-amber-300 hover:text-white"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-[10px] px-1 text-amber-300 font-semibold">W</span>
              <button
                type="button"
                onClick={() =>
                  adjustMemberHealth(
                    attachedLeader.rosterUnit.instanceId,
                    attachedLeader.rosterUnit.startingModels,
                    attachedLeader.rosterUnit.startingWoundsPerModel,
                    0,
                    1
                  )
                }
                className="p-0.5 text-amber-300 hover:text-white"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Attached Support Leader Pool */}
        {attachedSupport && (
          <div className="flex items-center justify-between bg-cyan-950/20 border border-cyan-700/40 rounded-lg px-3 py-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-cyan-400 font-semibold">
                Attached Support
              </div>
              <div className="text-xs font-bold text-white">
                {attachedSupport.datasheet.name}:{' '}
                <span
                  className={
                    attachedSupport.liveState.currentModelWounds <= 0
                      ? 'text-rose-400'
                      : 'text-cyan-300'
                  }
                >
                  {attachedSupport.liveState.currentModelWounds}/
                  {attachedSupport.rosterUnit.startingWoundsPerModel} W
                </span>
              </div>
            </div>
            <div className="flex items-center border border-cyan-700/60 rounded bg-slate-900 px-1 py-0.5">
              <button
                type="button"
                onClick={() =>
                  adjustMemberHealth(
                    attachedSupport.rosterUnit.instanceId,
                    attachedSupport.rosterUnit.startingModels,
                    attachedSupport.rosterUnit.startingWoundsPerModel,
                    0,
                    -1
                  )
                }
                className="p-0.5 text-cyan-300 hover:text-white"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-[10px] px-1 text-cyan-300 font-semibold">W</span>
              <button
                type="button"
                onClick={() =>
                  adjustMemberHealth(
                    attachedSupport.rosterUnit.instanceId,
                    attachedSupport.rosterUnit.startingModels,
                    attachedSupport.rosterUnit.startingWoundsPerModel,
                    0,
                    1
                  )
                }
                className="p-0.5 text-cyan-300 hover:text-white"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Model Stat Profiles Table (M | T | Sv | Inv | W | Ld | OC) */}
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/70">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/80">
              <th className="py-1 px-2.5">Model Profile</th>
              <th className="py-1 px-2 text-center">M</th>
              <th className="py-1 px-2 text-center">T</th>
              <th className="py-1 px-2 text-center">Sv</th>
              <th className="py-1 px-2 text-center">Inv</th>
              <th className="py-1 px-2 text-center">W</th>
              <th className="py-1 px-2 text-center">Ld</th>
              <th className="py-1 px-2 text-center">OC</th>
            </tr>
          </thead>
          <tbody>
            {[
              ...primaryDatasheet.models.map((m) => ({ m, roleTag: undefined })),
              ...(attachedLeader
                ? attachedLeader.datasheet.models.map((m) => ({ m, roleTag: 'Leader' }))
                : []),
              ...(attachedSupport
                ? attachedSupport.datasheet.models.map((m) => ({ m, roleTag: 'Support' }))
                : []),
            ].map(({ m, roleTag }, idx) => (
              <tr key={idx} className="border-b border-slate-800/50">
                <td className="py-1 px-2.5 font-semibold text-slate-200">
                  {m.name}{' '}
                  {roleTag && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 ml-1">
                      {roleTag}
                    </span>
                  )}
                </td>
                <td className="py-1 px-2 text-center text-slate-200">{m.M}</td>
                <td className="py-1 px-2 text-center font-bold text-emerald-300">{m.T}</td>
                <td className="py-1 px-2 text-center font-semibold text-white">{m.Sv}</td>
                <td className="py-1 px-2 text-center font-bold text-cyan-300">{m.invSv || '-'}</td>
                <td className="py-1 px-2 text-center font-semibold text-white">{m.W}</td>
                <td className="py-1 px-2 text-center text-slate-200">{m.Ld}</td>
                <td className="py-1 px-2 text-center font-bold text-amber-300">
                  {primaryLiveState.isBattleShocked ? (
                    <span className="text-rose-400">0 (Shocked)</span>
                  ) : (
                    m.OC
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Weapons Tables (Phase-Smart Visibility) */}
      {showRangedSection &&
        renderWeaponsTable(
          'Ranged Weapons',
          <Crosshair className="w-3.5 h-3.5 text-rose-400" />,
          rangedList
        )}
      {showMeleeSection &&
        renderWeaponsTable(
          'Melee Weapons',
          <Swords className="w-3.5 h-3.5 text-amber-400" />,
          meleeList
        )}

      {/* Phase-Filtered Abilities & Enhancements */}
      {sortedAbilities.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {isOpponentNonMeleeTurn
              ? 'Defensive, Reactive & Phase Abilities'
              : 'Active Phase Abilities & Attached Buffs'}
          </div>
          {sortedAbilities.map((ab) => {
            const isUsedOnce = primaryLiveState.usedOncePerBattleIds.includes(ab.id);
            const badgeStyle =
              ab.sourceType === 'leader'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : ab.sourceType === 'support'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : ab.sourceType === 'enhancement' || ab.sourceType === 'unit_upgrade'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700';

            return (
              <div
                key={`${ab.sourceInstanceId}_${ab.id}`}
                className={`p-2.5 rounded-lg border ${
                  ab.isDeactivatedByDeath
                    ? 'bg-rose-950/20 border-rose-900/50 opacity-50 line-through'
                    : isOpponentNonMeleeTurn && ab.isDefensiveOrReactive
                    ? 'bg-emerald-950/30 border-emerald-700/60'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isOpponentNonMeleeTurn && ab.isDefensiveOrReactive && (
                      <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span className="text-xs font-bold text-amber-200">{ab.name}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeStyle}`}>
                      {ab.sourceType === 'leader'
                        ? `LEADER: ${ab.sourceName}`
                        : ab.sourceType === 'support'
                        ? `SUPPORT: ${ab.sourceName}`
                        : ab.sourceName}
                    </span>
                    {ab.isDeactivatedByDeath && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-900 text-rose-200 no-underline">
                        💀 Character Destroyed / Detached — Buff Inactive
                      </span>
                    )}
                  </div>

                  {ab.isOncePerBattle && !ab.isDeactivatedByDeath && (
                    <button
                      type="button"
                      onClick={() => toggleOncePerBattle(ab.id)}
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border no-print ${
                        isUsedOnce
                          ? 'bg-rose-950/80 border-rose-700 text-rose-300'
                          : 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                      }`}
                    >
                      {isUsedOnce ? (
                        <CheckSquare className="w-3 h-3" />
                      ) : (
                        <Square className="w-3 h-3" />
                      )}
                      <span>{isUsedOnce ? 'Used This Battle' : 'Once Per Battle'}</span>
                    </button>
                  )}
                </div>
                <p
                  className={`text-xs text-slate-300 mt-1 whitespace-pre-line leading-relaxed ${
                    isUsedOnce ? 'line-through opacity-50' : ''
                  }`}
                >
                  {ab.description}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Progressive Disclosure Footer: Overwatch / Show Weapons / Full Datasheet & Keywords */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 no-print">
        <div className="flex flex-wrap items-center gap-2">
          {isOpponentNonMeleeTurn && composite.equippedRangedWeapons.length > 0 && (
            <button
              type="button"
              onClick={() => setShowOverwatchRanged((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                showOverwatchRanged
                  ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                  : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-amber-500/50'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {showOverwatchRanged
                  ? 'Hide Ranged Weapons (Overwatch)'
                  : '🎯 Fire Overwatch (Show Ranged)'}
              </span>
            </button>
          )}

          {!showRangedSection && !showMeleeSection && totalWeaponsCount > 0 && (
            <button
              type="button"
              onClick={() => setShowWeaponsOverride((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-950 border border-slate-800 text-slate-300 hover:text-white transition"
            >
              <Swords className="w-3.5 h-3.5 text-amber-400" />
              <span>Show Equipped Weapons ({totalWeaponsCount})</span>
            </button>
          )}

          {showWeaponsOverride && (
            <button
              type="button"
              onClick={() => setShowWeaponsOverride(false)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/15 border border-amber-500/40 text-amber-300 transition"
            >
              <span>Hide Out-of-Phase Weapons</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowAllDatasheetDetails((v) => !v)}
          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition ${
            showAllDatasheetDetails
              ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>
            {showAllDatasheetDetails
              ? 'Hide Full Datasheet & Keywords'
              : `Full Datasheet & Keywords (${composite.combinedKeywords.length})`}
          </span>
        </button>
      </div>

      {/* Combined Keywords (Only shown when Full Datasheet is toggled or when printing) */}
      {showAllDatasheetDetails && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-1 text-[10px] text-slate-400">
          <span className="font-bold text-slate-300 mr-1">KEYWORDS:</span>
          {composite.combinedKeywords.map((kw) => (
            <KeywordBadge key={kw} keyword={kw} variant="unit_keyword" />
          ))}
        </div>
      )}
    </div>
  );
};
