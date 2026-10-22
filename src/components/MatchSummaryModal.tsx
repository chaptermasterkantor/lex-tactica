import React, { useState } from 'react';
import {
  Trophy,
  X,
  CheckCircle2,
  Printer,
  RotateCcw,
  Swords,
  Shield,
  Zap,
  BookmarkCheck,
} from 'lucide-react';
import type {
  CompositeUnit,
  Detachment,
  Faction,
  GameSessionState,
  MatchHistoryRecord,
  SavedRoster,
  Stratagem,
} from '../types/rules';

interface MatchSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: GameSessionState;
  roster: SavedRoster;
  currentFaction?: Faction;
  selectedDetachments: Detachment[];
  compositeUnits: CompositeUnit[];
  stratagems: Stratagem[];
  onSaveMatchHistory: (record: MatchHistoryRecord) => Promise<void>;
  onStartNewMatch: () => void;
}

export const MatchSummaryModal: React.FC<MatchSummaryModalProps> = ({
  isOpen,
  onClose,
  session,
  roster,
  currentFaction,
  selectedDetachments,
  compositeUnits,
  stratagems,
  onSaveMatchHistory,
  onStartNewMatch,
}) => {
  const [savedToHistory, setSavedToHistory] = useState(false);

  if (!isOpen) return null;

  const rounds = [1, 2, 3, 4, 5];
  const battleReadyUserVp = session.matchSetup?.battleReadyUser !== false ? 10 : 0;
  const battleReadyOppVp = session.matchSetup?.battleReadyOpponent !== false ? 10 : 0;

  const totalUserPrimary = rounds.reduce(
    (sum, r) => sum + (session.scoresByRound[r]?.userPrimaryVp ?? 0),
    0
  );
  const totalUserSecondary = rounds.reduce(
    (sum, r) => sum + (session.scoresByRound[r]?.userSecondaryVp ?? 0),
    0
  );
  const userTotalVp = Math.min(100, totalUserPrimary + totalUserSecondary + battleReadyUserVp);

  const totalOppPrimary = rounds.reduce(
    (sum, r) => sum + (session.scoresByRound[r]?.opponentPrimaryVp ?? 0),
    0
  );
  const totalOppSecondary = rounds.reduce(
    (sum, r) => sum + (session.scoresByRound[r]?.opponentSecondaryVp ?? 0),
    0
  );
  const opponentTotalVp = Math.min(100, totalOppPrimary + totalOppSecondary + battleReadyOppVp);

  const result: 'victory' | 'defeat' | 'draw' =
    userTotalVp > opponentTotalVp
      ? 'victory'
      : userTotalVp < opponentTotalVp
      ? 'defeat'
      : 'draw';

  const totalCpSpent = session.stratagemLog.reduce((sum, entry) => sum + entry.cpSpent, 0);
  const survivingUnitsCount = compositeUnits.filter(
    (c) => c.primaryLiveState.status !== 'destroyed' && c.primaryLiveState.remainingModels > 0
  ).length;
  const totalUnitsCount = compositeUnits.length;

  // Most used stratagem
  const stratCounts = new Map<string, number>();
  for (const log of session.stratagemLog) {
    stratCounts.set(log.stratagemId, (stratCounts.get(log.stratagemId) ?? 0) + 1);
  }
  let topStratName = 'None used';
  let topStratCount = 0;
  for (const [id, count] of stratCounts.entries()) {
    if (count > topStratCount) {
      topStratCount = count;
      topStratName = stratagems.find((s) => s.id === id)?.name ?? id;
    }
  }

  const handleSaveRecord = async () => {
    if (savedToHistory) return;
    const record: MatchHistoryRecord = {
      id: `match_${Date.now()}`,
      completedAt: Date.now(),
      rosterId: roster.id,
      rosterName: roster.name,
      userFactionId: roster.factionId,
      userFactionName: currentFaction?.name ?? roster.factionId,
      userDetachments: selectedDetachments.map((d) => d.name),
      userDisposition: session.matchSetup?.yourDisposition ?? roster.forceDisposition,
      opponentName: session.matchSetup?.opponent.name ?? "Opponent's Army",
      opponentFactionId: session.matchSetup?.opponent.factionId ?? 'UNK',
      opponentFactionName: session.matchSetup?.opponent.factionName ?? 'Opponent',
      opponentDetachments: session.matchSetup?.opponent.detachmentNames ?? [],
      opponentDisposition: session.matchSetup?.opponent.forceDisposition,
      mapLayout: session.matchSetup?.mapLayout,
      roundsPlayed: session.battleRound,
      userTotalVp,
      userPrimaryVp: totalUserPrimary,
      userSecondaryVp: totalUserSecondary,
      opponentTotalVp,
      opponentPrimaryVp: totalOppPrimary,
      opponentSecondaryVp: totalOppSecondary,
      result,
      totalCpSpent,
      survivingUnitsCount,
      totalUnitsCount,
      scoresByRound: session.scoresByRound,
    };
    await onSaveMatchHistory(record);
    setSavedToHistory(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto no-print">
      <div className="w-full max-w-3xl bg-[#0e1017] border border-amber-500/50 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Victory / Defeat Header Banner */}
        <div
          className={`px-6 py-5 border-b border-slate-800 flex items-center justify-between ${
            result === 'victory'
              ? 'bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/40'
              : result === 'defeat'
              ? 'bg-gradient-to-r from-rose-950/60 via-slate-900 to-rose-950/40'
              : 'bg-gradient-to-r from-amber-950/50 via-slate-900 to-amber-950/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl border ${
                result === 'victory'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : result === 'defeat'
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                  : 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              }`}
            >
              <Trophy className="w-7 h-7" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                11th Edition After-Action Report · Round {session.battleRound}/5
              </div>
              <h2 className="text-2xl font-serif font-extrabold uppercase tracking-wider text-white">
                {result === 'victory'
                  ? 'Glorious Victory!'
                  : result === 'defeat'
                  ? 'Valiant Defeat'
                  : 'Tactical Draw'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close Match Summary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Score Comparison Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-600/50 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  {roster.name}
                </div>
                <div className="text-[11px] text-slate-400">
                  {currentFaction?.name ?? roster.factionId}
                  {session.matchSetup?.yourDisposition
                    ? ` · ${session.matchSetup.yourDisposition}`
                    : ''}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  Primary: <strong>{totalUserPrimary}</strong> · Secondary:{' '}
                  <strong>{totalUserSecondary}</strong> · Ready: <strong>+{battleReadyUserVp}</strong>
                </div>
              </div>
              <div className="text-4xl font-extrabold text-emerald-300 tabular-nums">
                {userTotalVp}
                <span className="text-xs font-normal text-slate-400 block text-right">VP</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-950/25 border border-rose-600/50 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-rose-300">
                  {session.matchSetup?.opponent.name || "Opponent's Army"}
                </div>
                <div className="text-[11px] text-slate-400">
                  {session.matchSetup?.opponent.factionName || 'Opponent'}
                  {session.matchSetup?.opponent.forceDisposition
                    ? ` · ${session.matchSetup.opponent.forceDisposition}`
                    : ''}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  Primary: <strong>{totalOppPrimary}</strong> · Secondary:{' '}
                  <strong>{totalOppSecondary}</strong> · Ready: <strong>+{battleReadyOppVp}</strong>
                </div>
              </div>
              <div className="text-4xl font-extrabold text-rose-300 tabular-nums">
                {opponentTotalVp}
                <span className="text-xs font-normal text-slate-400 block text-right">VP</span>
              </div>
            </div>
          </div>

          {/* Tactical Telemetry Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5">
              <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400 uppercase font-semibold">
                  Surviving Units
                </div>
                <div className="text-sm font-bold text-white">
                  {survivingUnitsCount} / {totalUnitsCount} Units Intact
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5">
              <Zap className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400 uppercase font-semibold">
                  Total CP Spent
                </div>
                <div className="text-sm font-bold text-white">
                  {totalCpSpent} CP ({session.stratagemLog.length} Stratagems)
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center gap-2.5">
              <Swords className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400 uppercase font-semibold">
                  Top Stratagem
                </div>
                <div className="text-sm font-bold text-white truncate">
                  {topStratName} {topStratCount > 0 ? `(${topStratCount}×)` : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Round-by-Round Breakdown Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/70">
            <table className="w-full text-xs text-left border-collapse tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/80">
                  <th className="py-2 px-3">Round</th>
                  <th className="py-2 px-3 text-emerald-300">Your Primary</th>
                  <th className="py-2 px-3 text-emerald-300">Your Secondary</th>
                  <th className="py-2 px-3 text-rose-300">Opp Primary</th>
                  <th className="py-2 px-3 text-rose-300">Opp Secondary</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((r) => {
                  const sc = session.scoresByRound[r];
                  return (
                    <tr key={r} className="border-b border-slate-800/50">
                      <td className="py-2 px-3 font-semibold text-white">Battle Round {r}</td>
                      <td className="py-2 px-3 text-emerald-200">{sc?.userPrimaryVp ?? 0} VP</td>
                      <td className="py-2 px-3 text-emerald-200">{sc?.userSecondaryVp ?? 0} VP</td>
                      <td className="py-2 px-3 text-rose-200">{sc?.opponentPrimaryVp ?? 0} VP</td>
                      <td className="py-2 px-3 text-rose-200">{sc?.opponentSecondaryVp ?? 0} VP</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Actions Footer */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSaveRecord}
                disabled={savedToHistory}
                className={`min-h-[44px] px-4 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition ${
                  savedToHistory
                    ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg'
                }`}
              >
                {savedToHistory ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Saved to Device Match History</span>
                  </>
                ) : (
                  <>
                    <BookmarkCheck className="w-4 h-4" />
                    <span>Save Match to Device History</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[44px] px-3.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 inline-flex items-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4 text-slate-400" />
                <span>Print Report</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onStartNewMatch();
              }}
              className="min-h-[44px] px-4 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 inline-flex items-center gap-1.5 transition"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Start New Match Setup</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
