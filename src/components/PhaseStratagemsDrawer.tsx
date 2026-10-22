import React, { useEffect, useState } from 'react';
import { Zap, X, Lock, Filter, CheckCircle2, AlertCircle } from 'lucide-react';
import type { CompositeUnit, Phase, Stratagem } from '../types/rules';
import { PHASE_LABELS } from '../engine/gameSessionEngine';

interface PhaseStratagemsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhase: Phase;
  currentTurn: 'your_turn' | 'opponent_turn';
  userCp: number;
  phaseStratagems: Stratagem[];
  compositeUnits: CompositeUnit[];
  filterUnitInstanceId: string | null;
  onSelectUnitFilter: (unitInstanceId: string | null) => void;
  onUseStratagemOnUnit: (strat: Stratagem, unitInstanceId: string) => void;
}

export const PhaseStratagemsDrawer: React.FC<PhaseStratagemsDrawerProps> = ({
  isOpen,
  onClose,
  currentPhase,
  currentTurn,
  userCp,
  phaseStratagems,
  compositeUnits,
  filterUnitInstanceId,
  onSelectUnitFilter,
  onUseStratagemOnUnit,
}) => {
  const [selectedTargetByStrat, setSelectedTargetByStrat] = useState<Record<string, string>>({});
  const [sourceFilter, setSourceFilter] = useState<'all' | 'detachment' | 'core'>('all');

  useEffect(() => {
    if (filterUnitInstanceId) {
      const nextMap: Record<string, string> = {};
      for (const s of phaseStratagems) {
        nextMap[s.id] = filterUnitInstanceId;
      }
      setSelectedTargetByStrat((prev) => ({ ...prev, ...nextMap }));
    }
  }, [filterUnitInstanceId, phaseStratagems]);

  if (!isOpen) return null;

  const focusedComposite = filterUnitInstanceId
    ? compositeUnits.find((c) => c.primaryUnit.instanceId === filterUnitInstanceId)
    : undefined;

  // Filter stratagems by unit (if focused) and source filter
  const visibleStratagems = phaseStratagems.filter((strat) => {
    if (sourceFilter === 'core' && !strat.isCore) return false;
    if (sourceFilter === 'detachment' && strat.isCore) return false;
    if (focusedComposite) {
      return focusedComposite.eligibleStratagemIds.includes(strat.id);
    }
    return true;
  });

  // Evaluate eligibility and group into Ready vs Unavailable
  const evaluatedStratagems = visibleStratagems.map((strat) => {
    const eligibleUnits = compositeUnits.filter(
      (c) =>
        (c.primaryLiveState.status === 'on_battlefield' ||
          (strat.name.toUpperCase() === 'RAPID INGRESS' && c.primaryLiveState.status === 'reserves')) &&
        !c.primaryLiveState.isBattleShocked &&
        c.eligibleStratagemIds.includes(strat.id)
    );

    const unlockedEligibleUnits = eligibleUnits.filter(
      (c) => !c.primaryLiveState.lockedByStratagemIdInPhase
    );

    const defaultUnitId =
      (filterUnitInstanceId &&
      eligibleUnits.some((u) => u.primaryUnit.instanceId === filterUnitInstanceId)
        ? filterUnitInstanceId
        : undefined) ??
      unlockedEligibleUnits[0]?.primaryUnit.instanceId ??
      eligibleUnits[0]?.primaryUnit.instanceId ??
      '';

    const selectedUnitId = selectedTargetByStrat[strat.id] ?? defaultUnitId;
    const targetComposite =
      eligibleUnits.find((c) => c.primaryUnit.instanceId === selectedUnitId) ?? focusedComposite;
    const isTargetLocked = Boolean(targetComposite?.primaryLiveState.lockedByStratagemIdInPhase);
    const isTargetShocked = Boolean(targetComposite?.primaryLiveState.isBattleShocked);
    const canAfford = userCp >= strat.cpCost;

    const isReadyNow =
      canAfford &&
      eligibleUnits.length > 0 &&
      unlockedEligibleUnits.length > 0 &&
      !isTargetLocked &&
      !isTargetShocked;

    return {
      strat,
      eligibleUnits,
      unlockedEligibleUnits,
      selectedUnitId,
      targetComposite,
      isTargetLocked,
      isTargetShocked,
      canAfford,
      isReadyNow,
    };
  });

  const readyList = evaluatedStratagems.filter((item) => item.isReadyNow);
  const unavailableList = evaluatedStratagems.filter((item) => !item.isReadyNow);

  const renderStratCard = (item: (typeof evaluatedStratagems)[number]) => {
    const {
      strat,
      eligibleUnits,
      selectedUnitId,
      isTargetLocked,
      isTargetShocked,
      canAfford,
      isReadyNow,
    } = item;

    const canExecute =
      Boolean(selectedUnitId) &&
      !isTargetLocked &&
      !isTargetShocked &&
      canAfford &&
      eligibleUnits.some((u) => u.primaryUnit.instanceId === selectedUnitId);

    return (
      <div
        key={strat.id}
        className={`p-4 rounded-xl border transition flex flex-col justify-between gap-3 ${
          isReadyNow
            ? 'bg-slate-900/95 border-amber-500/40 shadow-md'
            : 'bg-slate-950/70 border-slate-800/80 opacity-75'
        }`}
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-bold text-white tracking-wide">{strat.name}</span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                    strat.isCore
                      ? 'bg-slate-800 text-slate-300 border-slate-700'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {strat.isCore ? 'Core' : strat.detachment || strat.category}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">{strat.type}</div>
            </div>

            <span
              className={`px-2.5 py-0.5 rounded-md text-xs font-bold border shrink-0 ${
                canAfford
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-rose-950/60 text-rose-300 border-rose-700/60'
              }`}
            >
              {strat.cpCost} CP
            </span>
          </div>

          {strat.whenText && (
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-amber-300">WHEN:</strong> {strat.whenText}
            </p>
          )}
          {strat.targetText && (
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-amber-300">TARGET:</strong> {strat.targetText}
            </p>
          )}
          <p className="text-xs text-slate-100 whitespace-pre-line leading-relaxed">
            <strong className="text-amber-300">EFFECT:</strong>{' '}
            {strat.effectText || strat.description}
          </p>
        </div>

        <div className="pt-2.5 border-t border-slate-800/90 flex flex-wrap items-center gap-2">
          <select
            value={selectedUnitId}
            onChange={(e) =>
              setSelectedTargetByStrat((prev) => ({
                ...prev,
                [strat.id]: e.target.value,
              }))
            }
            className="flex-1 min-w-[180px] bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            {eligibleUnits.length === 0 ? (
              <option value="">No eligible un-shocked unit available</option>
            ) : (
              eligibleUnits.map((u) => (
                <option key={u.primaryUnit.instanceId} value={u.primaryUnit.instanceId}>
                  {u.displayName}
                  {u.primaryLiveState.lockedByStratagemIdInPhase ? ' (🔒 Locked this phase)' : ''}
                </option>
              ))
            )}
          </select>

          <button
            type="button"
            disabled={!canExecute}
            onClick={() => {
              if (canExecute) {
                onUseStratagemOnUnit(strat, selectedUnitId);
              }
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold shrink-0 transition ${
              !canExecute
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow'
            }`}
          >
            {isTargetLocked ? (
              <span className="inline-flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Unit Locked
              </span>
            ) : !canAfford ? (
              `Need ${strat.cpCost} CP`
            ) : eligibleUnits.length === 0 ? (
              'No Target'
            ) : (
              `Use (-${strat.cpCost} CP)`
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm no-print">
      <div className="w-full max-w-2xl bg-[#0e1017] border-l border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-serif font-bold uppercase tracking-wider text-white">
                  {PHASE_LABELS[currentPhase]} Stratagems
                </h2>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                    currentTurn === 'your_turn'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                      : 'bg-rose-950/80 text-rose-300 border-rose-700'
                  }`}
                >
                  {currentTurn === 'your_turn' ? 'Your Turn' : "Opponent's Turn"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                11th Ed Rule: Max 1 Stratagem per unit per phase · Battle-shocked units cannot be
                targeted
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-600/50 text-center">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
                Your CP
              </div>
              <div className="text-sm font-bold text-white">{userCp} CP</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close Stratagems Drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unit Filter & Source Filter Bar */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={filterUnitInstanceId ?? ''}
              onChange={(e) => onSelectUnitFilter(e.target.value || null)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Army Units in Phase ({phaseStratagems.length})</option>
              {compositeUnits
                .filter((c) => c.primaryLiveState.status !== 'destroyed')
                .map((c) => (
                  <option key={c.primaryUnit.instanceId} value={c.primaryUnit.instanceId}>
                    Unit: {c.displayName}
                    {c.primaryLiveState.lockedByStratagemIdInPhase ? ' (Locked)' : ''}
                  </option>
                ))}
            </select>
            {filterUnitInstanceId && (
              <button
                type="button"
                onClick={() => onSelectUnitFilter(null)}
                className="text-xs text-amber-300 hover:text-amber-200 underline"
              >
                Show All
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 text-xs">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'detachment', label: 'Detachment' },
                { id: 'core', label: 'Core' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSourceFilter(tab.id)}
                className={`px-2.5 py-1 rounded-lg border font-medium transition ${
                  sourceFilter === tab.id
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Focused Unit Locked/Battle-Shocked Banner */}
        {focusedComposite && focusedComposite.primaryLiveState.lockedByStratagemIdInPhase && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-600/60 flex items-center justify-between gap-2 text-xs text-rose-200">
            <div className="flex items-center gap-2 font-semibold">
              <Lock className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                {focusedComposite.displayName} has already used a Stratagem in this phase (Max 1 per
                unit per phase).
              </span>
            </div>
          </div>
        )}

        {/* Stratagems Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Ready to Use Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Ready to Use Right Now ({readyList.length})</span>
            </div>
            {readyList.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-400">
                No Stratagems can be immediately activated right now (check your available CP or unit
                locks below).
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">{readyList.map(renderStratCard)}</div>
            )}
          </div>

          {/* Unavailable / Insufficient CP / Locked Section */}
          {unavailableList.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <AlertCircle className="w-4 h-4 text-slate-500" />
                <span>
                  Insufficient CP or No Eligible Target ({unavailableList.length})
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3">{unavailableList.map(renderStratCard)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
