import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  ShieldAlert,
  Sparkles,
  BookOpen,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  MapPin,
  Crown,
} from 'lucide-react';
import editionRules from '../config/editionRules.json';
import { isActiveInPhaseAndTurn } from '../engine/compositeUnitBuilder';
import type {
  Ability,
  CompositeUnit,
  CoreAction,
  Detachment,
  LiveUnitState,
  Phase,
} from '../types/rules';

interface PhaseActionChecklistProps {
  currentPhase: Phase;
  currentTurn: 'your_turn' | 'opponent_turn';
  compositeUnits: CompositeUnit[];
  selectedDetachments: Detachment[];
  coreActions: CoreAction[];
  completedChecklistIds: string[];
  onToggleChecklistItem: (itemId: string) => void;
  onUpdateUnitState: (instanceId: string, updater: (prev: LiveUnitState) => LiveUnitState) => void;
  onOpenCoreAction: (actionName: string) => void;
}

const MUSTER_ONLY_ABILITY_NAMES = new Set([
  'space marine chapters',
  'assigned agents',
  'sons of russ',
  'heirs of sigismund',
  'veteran recruits',
  'cult of the dark gods',
  'daemonic pact',
  'freeblades',
  'dreadblades',
  'disparate paths',
  'corsairs and travelling players',
  'pact of excess',
  'pact of blood',
  'pact of decay',
  'pact of sorcery',
  'anathema psykana',
  'towering example',
  'titanic support',
  'titanicus traitoris',
  'designer’s note',
  "designer's note",
  'special move types',
  'the ravenwing',
  'the deathwing',
]);

// Sub-abilities that are already embedded inside a parent Faction rule description in Abilities.csv
const EMBEDDED_SUB_ABILITY_NAMES = new Set([
  'assault doctrine',
  'devastator doctrine',
  'tactical doctrine',
  'agile manoeuvres',
]);

export const PhaseActionChecklist: React.FC<PhaseActionChecklistProps> = ({
  currentPhase,
  currentTurn,
  compositeUnits,
  selectedDetachments,
  coreActions,
  completedChecklistIds,
  onToggleChecklistItem,
  onUpdateUnitState,
  onOpenCoreAction,
}) => {
  const [expandedRuleIds, setExpandedRuleIds] = useState<Record<string, boolean>>({});
  const [showSequenceGuide, setShowSequenceGuide] = useState(false);

  const toggleExpandRule = (id: string) => {
    setExpandedRuleIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // 1. Dynamically extract active Faction / Army Rules from Wahapedia datasheets on the roster
  const activeFactionRules: Ability[] = [];
  const seenFactionRuleNames = new Set<string>();

  for (const comp of compositeUnits) {
    if (comp.primaryLiveState.status === 'destroyed') continue;
    for (const ab of comp.combinedAbilities) {
      if (ab.type !== 'Faction' || ab.isDeactivatedByDeath) continue;
      const lowerName = ab.name.toLowerCase().trim();
      if (EMBEDDED_SUB_ABILITY_NAMES.has(lowerName)) continue;
      if (currentPhase !== 'pre_game' && MUSTER_ONLY_ABILITY_NAMES.has(lowerName)) continue;
      if (seenFactionRuleNames.has(lowerName)) continue;

      if (isActiveInPhaseAndTurn(ab.phases, ab.timing, currentPhase, currentTurn)) {
        seenFactionRuleNames.add(lowerName);
        activeFactionRules.push(ab);
      }
    }
  }

  // 2. Dynamically extract active Detachment Rules from Wahapedia Detachment_abilities.csv
  const activeDetachmentAbilities = selectedDetachments.flatMap((d) =>
    d.abilities.filter((ab) =>
      isActiveInPhaseAndTurn(ab.phases, ab.timing, currentPhase, currentTurn)
    )
  );

  // 3. Dynamically detect Start-of-Round / Command Phase unit triggers across living units
  const startOfRoundUnitTriggers =
    currentPhase === 'start_of_round'
      ? compositeUnits.flatMap((comp) =>
          comp.primaryLiveState.status !== 'destroyed'
            ? comp.combinedAbilities
                .filter(
                  (ab) =>
                    ab.type !== 'Faction' &&
                    ab.type !== 'Core' &&
                    !ab.isDeactivatedByDeath &&
                    ab.phases.includes('start_of_round')
                )
                .map((ab) => ({ comp, ab }))
            : []
        )
      : [];

  // 4. Pre-Game Scouts / Infiltrators / Deep Strike / Attached Units detection from Wahapedia Core Abilities
  const preGameScoutOrInfiltratorUnits =
    currentPhase === 'pre_game'
      ? compositeUnits.filter((c) =>
          c.combinedCoreAbilities.some((kw) => /scouts|infiltrators/i.test(kw))
        )
      : [];

  // 5. Command Phase Below Half-Strength Battle-shock Checklist
  const belowHalfStrengthUnits =
    currentPhase === 'command' && currentTurn === 'your_turn'
      ? compositeUnits.filter(
          (c) => c.primaryLiveState.status === 'on_battlefield' && c.isBelowHalfStrength
        )
      : [];

  // 6. Movement Phase Reserves / Embarked Units Ready to Deploy/Disembark
  const reservesUnitsInMovement =
    currentPhase === 'movement' && currentTurn === 'your_turn'
      ? compositeUnits.filter((c) => c.primaryLiveState.status === 'reserves')
      : [];

  const embarkedUnitsInMovement =
    currentPhase === 'movement' && currentTurn === 'your_turn'
      ? compositeUnits.filter((c) => c.primaryLiveState.status === 'embarked')
      : [];

  // 7. Wahapedia Universal Core Actions for this Phase
  const seenCoreActionNames = new Set<string>();
  const phaseCoreActions = coreActions.filter((action) => {
    const normName = action.name.replace(/‑/g, '-').toUpperCase().trim();
    if (seenCoreActionNames.has(normName)) return false;
    const matches =
      action.phases.includes(currentPhase) ||
      (currentPhase === 'charge' && /charge|surge/i.test(action.name)) ||
      (currentPhase === 'pre_game' && /scout/i.test(action.name));
    if (matches) {
      seenCoreActionNames.add(normName);
      return true;
    }
    return false;
  });

  const currentPhaseConfig = editionRules.phaseSequence.find((p) => p.id === currentPhase);

  const getFirstSentence = (text: string) => {
    const clean = text.replace(/\s+/g, ' ').trim();
    const match = clean.match(/^[^.!?]+[.!?]/);
    if (match && match[0].length <= 160) return match[0];
    return clean.length > 140 ? `${clean.slice(0, 140)}...` : clean;
  };

  return (
    <section className="rounded-xl bg-[#131620] border border-slate-800/90 p-3.5 space-y-3 shadow-lg no-print">
      {/* Top Bar: Title + Wahapedia Core Action Chips + Phase Steps Help Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Phase Actions & Active Army Rules
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {phaseCoreActions.map((ca) => (
            <button
              key={ca.id}
              type="button"
              onClick={() => onOpenCoreAction(ca.name)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-amber-500/50 transition"
              title="Click to view 11th Ed Core Action rule"
            >
              <BookOpen className="w-3 h-3 text-amber-400" />
              <span>{ca.name}</span>
            </button>
          ))}

          {currentPhaseConfig && (
            <button
              type="button"
              onClick={() => setShowSequenceGuide((v) => !v)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition ${
                showSequenceGuide
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <HelpCircle className="w-3 h-3" />
              <span>Phase Sequence</span>
            </button>
          )}
        </div>
      </div>

      {/* Collapsible 11th Edition Sequence Guide */}
      {showSequenceGuide && currentPhaseConfig && (
        <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 text-xs text-slate-300 space-y-1">
          <div className="font-bold text-amber-300 uppercase tracking-wider text-[11px] mb-1">
            11th Edition {currentPhaseConfig.label} Step Sequence
          </div>
          {currentPhaseConfig.subSteps.map((step, idx) => (
            <div key={idx} className="leading-relaxed">
              {step}
            </div>
          ))}
        </div>
      )}

      {/* Command Phase Auto-Detected Battle-Shock Checklist */}
      {belowHalfStrengthUnits.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/60 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Action Required: Battle-Shock Tests ({belowHalfStrengthUnits.length} Unit
              {belowHalfStrengthUnits.length > 1 ? 's' : ''} Below Half-Strength)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {belowHalfStrengthUnits.map((c) => (
              <div
                key={c.primaryUnit.instanceId}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-amber-700/50 text-xs"
              >
                <div>
                  <div className="font-bold text-white">{c.displayName}</div>
                  <div className="text-[11px] text-slate-400">
                    Roll 2D6 vs Ld {c.primaryDatasheet.models[0]?.Ld || '6+'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateUnitState(c.primaryUnit.instanceId, (prev) => ({
                      ...prev,
                      isBattleShocked: !prev.isBattleShocked,
                    }))
                  }
                  className={`px-2.5 py-1 rounded font-bold transition ${
                    c.primaryLiveState.isBattleShocked
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600/30 border border-emerald-500 text-emerald-200'
                  }`}
                >
                  {c.primaryLiveState.isBattleShocked ? '⚡ Battle-Shocked (OC 0)' : '✓ Passed Test'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pre-Game Scouts / Infiltrators Triggers */}
      {preGameScoutOrInfiltratorUnits.length > 0 && (
        <div className="p-2.5 rounded-lg bg-teal-950/30 border border-teal-700/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-teal-200">
            <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
            <span>
              <strong>Pre-Battle Deployment & Scout Moves:</strong>{' '}
              {preGameScoutOrInfiltratorUnits
                .map((u) => {
                  const badges = u.combinedCoreAbilities
                    .filter((k) => /scouts|infiltrators/i.test(k))
                    .join(', ');
                  return `${u.displayName} (${badges})`;
                })
                .join(' · ')}
            </span>
          </div>
        </div>
      )}

      {/* Movement Phase Reserves / Embarked Deployment Triggers */}
      {(reservesUnitsInMovement.length > 0 || embarkedUnitsInMovement.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {reservesUnitsInMovement.map((u) => (
            <div
              key={u.primaryUnit.instanceId}
              className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-sky-950/30 border border-sky-700/50 text-xs"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">
                  📦 In Reserves — Reinforcements Step
                </span>
                <span className="font-bold text-white">{u.displayName}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateUnitState(u.primaryUnit.instanceId, (prev) => ({
                    ...prev,
                    status: 'on_battlefield',
                  }))
                }
                className="px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold shrink-0 transition"
              >
                Deploy (&gt;8&quot;)
              </button>
            </div>
          ))}
          {embarkedUnitsInMovement.map((u) => (
            <div
              key={u.primaryUnit.instanceId}
              className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-700/50 text-xs"
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 block">
                  🚐 Embarked in Transport
                </span>
                <span className="font-bold text-white">{u.displayName}</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  onUpdateUnitState(u.primaryUnit.instanceId, (prev) => ({
                    ...prev,
                    status: 'on_battlefield',
                  }))
                }
                className="px-2.5 py-1 rounded bg-indigo-500 hover:bg-indigo-400 text-white font-bold shrink-0 transition"
              >
                Disembark (3&quot;)
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Start of Round Unit Triggers (e.g. Warlord +1 CP abilities from Wahapedia) */}
      {startOfRoundUnitTriggers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {startOfRoundUnitTriggers.map(({ comp, ab }) => {
            const checkId = `sor_${comp.primaryUnit.instanceId}_${ab.id}`;
            const isChecked = completedChecklistIds.includes(checkId);
            return (
              <div
                key={checkId}
                className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-2 transition ${
                  isChecked
                    ? 'bg-slate-950/50 border-slate-800 opacity-60'
                    : 'bg-emerald-950/25 border-emerald-600/50'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggleChecklistItem(checkId)}
                  className="flex items-start gap-2 text-left flex-1"
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <Square className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-bold text-white">{ab.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-700">
                        {ab.sourceName}
                      </span>
                    </div>
                    <p className="text-slate-300 mt-0.5">{ab.description}</p>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Army / Faction Rules & Detachment Rules from Wahapedia */}
      {(activeFactionRules.length > 0 || activeDetachmentAbilities.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {activeFactionRules.map((ab) => {
            const checkId = `faction_${ab.name}`;
            const isChecked = completedChecklistIds.includes(checkId);
            const isExpanded = Boolean(expandedRuleIds[checkId]);
            return (
              <div
                key={checkId}
                className={`p-2.5 rounded-lg border text-xs transition ${
                  isChecked
                    ? 'bg-slate-950/50 border-slate-800 opacity-60'
                    : 'bg-amber-950/20 border-amber-500/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleChecklistItem(checkId)}
                    className="flex items-start gap-2 text-left flex-1"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-amber-200">{ab.name}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Army Rule
                        </span>
                      </div>
                      {!isExpanded && (
                        <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">
                          {getFirstSentence(ab.description)}
                        </p>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleExpandRule(checkId)}
                    className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-700 shrink-0"
                  >
                    <span>{isExpanded ? 'Hide' : 'Rule'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <p className="mt-2 pt-2 border-t border-slate-800/80 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                    {ab.description}
                  </p>
                )}
              </div>
            );
          })}

          {activeDetachmentAbilities.map((ab) => {
            const checkId = `det_${ab.id}`;
            const isChecked = completedChecklistIds.includes(checkId);
            const isExpanded = Boolean(expandedRuleIds[checkId]);
            return (
              <div
                key={checkId}
                className={`p-2.5 rounded-lg border text-xs transition ${
                  isChecked
                    ? 'bg-slate-950/50 border-slate-800 opacity-60'
                    : 'bg-slate-900/90 border-slate-700/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleChecklistItem(checkId)}
                    className="flex items-start gap-2 text-left flex-1"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-white">{ab.name}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                          {ab.detachmentName}
                        </span>
                      </div>
                      {!isExpanded && (
                        <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">
                          {getFirstSentence(ab.description)}
                        </p>
                      )}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleExpandRule(checkId)}
                    className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-slate-950 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-700 shrink-0"
                  >
                    <span>{isExpanded ? 'Hide' : 'Rule'}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <p className="mt-2 pt-2 border-t border-slate-800/80 text-xs text-slate-200 whitespace-pre-line leading-relaxed">
                    {ab.description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
