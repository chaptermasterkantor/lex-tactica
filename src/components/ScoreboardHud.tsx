import React, { useEffect, useState } from 'react';
import {
  Trophy,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  CheckSquare,
  Square,
  Dices,
  SlidersHorizontal,
  Flag,
  Eye,
} from 'lucide-react';
import type { GameSessionState, MapLayoutDescriptor, RoundScore } from '../types/rules';
import {
  DISPOSITION_COLORS,
  getAllSecondaryCards,
  isMissionItemActiveInRound,
} from '../engine/missionEngine';
import { MapLightboxModal } from './MapLightboxModal';

interface ScoreboardHudProps {
  session: GameSessionState;
  onUpdateSession: (updater: (prev: GameSessionState) => GameSessionState) => void;
  onOpenSetupWizard: () => void;
  onOpenMatchSummary?: () => void;
}

export const ScoreboardHud: React.FC<ScoreboardHudProps> = ({
  session,
  onUpdateSession,
  onOpenSetupWizard,
  onOpenMatchSummary,
}) => {
  const [expandedVp, setExpandedVp] = useState(false);
  const [expandedMissions, setExpandedMissions] = useState(true);
  const [expandedCardNames, setExpandedCardNames] = useState<Record<string, boolean>>({});
  const [discardPromptCard, setDiscardPromptCard] = useState<string | null>(null);
  const [lightboxLayout, setLightboxLayout] = useState<MapLayoutDescriptor | null>(null);

  // Temporal Progressive Disclosure:
  // Auto-expand mission/secondary scoring during Start of Round, Command, End of Turn, and End of Round.
  // Auto-collapse during Movement, Shooting, Charge, and Fight so unit cards stay above the fold.
  useEffect(() => {
    const scoringPhases = new Set(['start_of_round', 'command', 'end_of_turn', 'end_of_round']);
    setExpandedMissions(scoringPhases.has(session.currentPhase));
  }, [session.currentPhase, session.currentTurn]);

  const allSecondaryCards = getAllSecondaryCards();
  const secondaryCardsByName = new Map(allSecondaryCards.map((c) => [c.name, c]));

  const rounds = [1, 2, 3, 4, 5];
  const currentRound = session.battleRound;

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
  const totalUserVp = Math.min(100, totalUserPrimary + totalUserSecondary + battleReadyUserVp);

  const totalOppPrimary = rounds.reduce(
    (sum, r) => sum + (session.scoresByRound[r]?.opponentPrimaryVp ?? 0),
    0
  );
  const totalOppSecondary = rounds.reduce(
    (sum, r) => sum + (session.scoresByRound[r]?.opponentSecondaryVp ?? 0),
    0
  );
  const totalOppVp = Math.min(100, totalOppPrimary + totalOppSecondary + battleReadyOppVp);

  const adjustCp = (player: 'user' | 'opponent', delta: number) => {
    onUpdateSession((prev) => ({
      ...prev,
      userCp: player === 'user' ? Math.max(0, prev.userCp + delta) : prev.userCp,
      opponentCp: player === 'opponent' ? Math.max(0, prev.opponentCp + delta) : prev.opponentCp,
      updatedAt: Date.now(),
    }));
  };

  const updateRoundVp = (
    round: number,
    field: keyof Omit<RoundScore, 'round'>,
    delta: number
  ) => {
    onUpdateSession((prev) => {
      const current = prev.scoresByRound[round] ?? {
        round,
        userPrimaryVp: 0,
        userSecondaryVp: 0,
        opponentPrimaryVp: 0,
        opponentSecondaryVp: 0,
      };
      return {
        ...prev,
        scoresByRound: {
          ...prev.scoresByRound,
          [round]: {
            ...current,
            [field]: Math.max(0, (current[field] ?? 0) + delta),
          },
        },
        updatedAt: Date.now(),
      };
    });
  };

  // Toggle mission scoring item checkbox
  const toggleMissionItemScore = (
    key: string,
    vpValue: number,
    player: 'user' | 'opponent'
  ) => {
    onUpdateSession((prev) => {
      const activeScores = prev.activeMissionScores || {};
      const isCurrentlyScored = !!activeScores[key];
      const delta = isCurrentlyScored ? -vpValue : vpValue;
      const field = player === 'user' ? 'userPrimaryVp' : 'opponentPrimaryVp';

      const roundSc = prev.scoresByRound[currentRound] ?? {
        round: currentRound,
        userPrimaryVp: 0,
        userSecondaryVp: 0,
        opponentPrimaryVp: 0,
        opponentSecondaryVp: 0,
      };

      return {
        ...prev,
        activeMissionScores: {
          ...activeScores,
          [key]: !isCurrentlyScored,
        },
        scoresByRound: {
          ...prev.scoresByRound,
          [currentRound]: {
            ...roundSc,
            [field]: Math.max(0, (roundSc[field] ?? 0) + delta),
          },
        },
        updatedAt: Date.now(),
      };
    });
  };

  // Draw 2 tactical secondaries
  const handleDrawTacticalSecondaries = () => {
    const all = getAllSecondaryCards();
    const used = new Set([
      ...(session.matchSetup?.userSecondaries.activeCards || []),
      ...(session.matchSetup?.userSecondaries.discardedCards || []),
    ]);
    const available = all.filter((c) => !used.has(c.name));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const drawn = shuffled.slice(0, 2).map((c) => c.name);

    onUpdateSession((prev) => {
      if (!prev.matchSetup) return prev;
      const currentActive = prev.matchSetup.userSecondaries.activeCards || [];
      return {
        ...prev,
        matchSetup: {
          ...prev.matchSetup,
          userSecondaries: {
            ...prev.matchSetup.userSecondaries,
            activeCards: [...currentActive, ...drawn].slice(0, 2),
          },
        },
        updatedAt: Date.now(),
      };
    });
  };

  const handleDiscardSecondary = (cardName: string, gainCp: boolean = false) => {
    setDiscardPromptCard(null);
    onUpdateSession((prev) => {
      if (!prev.matchSetup) return prev;
      const sec = prev.matchSetup.userSecondaries;
      return {
        ...prev,
        userCp: gainCp ? prev.userCp + 1 : prev.userCp,
        matchSetup: {
          ...prev.matchSetup,
          userSecondaries: {
            ...sec,
            activeCards: sec.activeCards.filter((c) => c !== cardName),
            discardedCards: [...(sec.discardedCards || []), cardName],
          },
        },
        updatedAt: Date.now(),
      };
    });
  };

  const toggleExpandCard = (cardName: string) => {
    setExpandedCardNames((prev) => ({ ...prev, [cardName]: !prev[cardName] }));
  };

  const getSecondaryVpButtons = (cardName: string): number[] => {
    const def = secondaryCardsByName.get(cardName);
    if (!def) return [3, 5];
    const vpSet = new Set<number>();
    for (const grp of def.score) {
      for (const item of grp.items) {
        const parsed = parseInt(String(item.vp).replace(/\D/g, ''), 10);
        if (parsed > 0) vpSet.add(parsed);
      }
    }
    const sorted = Array.from(vpSet).sort((a, b) => a - b);
    return sorted.length > 0 ? sorted : [3, 5];
  };

  const match = session.matchSetup;

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-3 mb-4 shadow-xl no-print">
      {/* Top Banner: Matchup Metadata & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {match ? (
            <>
              <span className={`px-2 py-0.5 rounded font-bold border ${DISPOSITION_COLORS[match.yourDisposition].badge}`}>
                {match.yourDisposition}
              </span>
              <span className="text-slate-500 font-bold">vs</span>
              <span className={`px-2 py-0.5 rounded font-bold border ${DISPOSITION_COLORS[match.opponent.forceDisposition].badge}`}>
                {match.opponent.forceDisposition}
              </span>
              <span className="text-slate-400 font-medium hidden sm:inline">
                ({match.yourMission.mission} vs {match.opponentMission.mission})
              </span>
              {match.mapDescriptor && (
                <button
                  type="button"
                  onClick={() => setLightboxLayout(match.mapDescriptor || null)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold border border-amber-500/30 transition ml-1"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  Layout {match.mapLayout} (p. {match.mapDescriptor.page})
                </button>
              )}
            </>
          ) : (
            <span className="text-slate-400 italic">
              Playing without Mission Setup (Default +10 Battle Ready)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSetupWizard}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 font-bold tracking-wide uppercase text-[11px] transition"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{match ? 'Change Match Setup' : 'Configure Mission & Map'}</span>
          </button>

          {onOpenMatchSummary && (
            <button
              type="button"
              onClick={onOpenMatchSummary}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 font-bold tracking-wide uppercase text-[11px] transition"
              title="Complete Match & View Final Victory Summary"
            >
              <Flag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Finish Match</span>
            </button>
          )}
        </div>
      </div>

      {/* Main HUD Row: CP & VP (44x44px Touch Targets) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* User CP & VP */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 bg-emerald-950/60 border border-emerald-700/50 rounded-lg px-2 py-0.5 tabular-nums">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300 mr-0.5">
              Your CP
            </span>
            <button
              type="button"
              onClick={() => adjustCp('user', -1)}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md hover:bg-emerald-800/60 text-emerald-200 active:scale-95 transition"
              title="Decrease Your CP"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-lg font-bold text-white min-w-[1.5rem] text-center">
              {session.userCp}
            </span>
            <button
              type="button"
              onClick={() => adjustCp('user', 1)}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md hover:bg-emerald-800/60 text-emerald-200 active:scale-95 transition"
              title="Increase Your CP"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setExpandedVp((v) => !v)}
            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg px-3 min-h-[44px] transition tabular-nums"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <div className="text-left">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Your VP</div>
              <div className="text-sm font-bold text-amber-300">
                {totalUserVp}{' '}
                <span className="text-xs font-normal text-slate-400">
                  (P:{totalUserPrimary} / S:{totalUserSecondary})
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Center Round & Mission Toggles */}
        <div className="flex items-center gap-2">
          {match && (
            <button
              type="button"
              onClick={() => setExpandedMissions((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 min-h-[44px] rounded-lg border transition ${
                expandedMissions
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <span>Round {currentRound} Mission Rules</span>
              {expandedMissions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpandedVp((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white px-3 min-h-[44px] rounded-lg bg-slate-800/60 border border-slate-700"
          >
            <span>Scoreboard</span>
            {expandedVp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Opponent VP & CP */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setExpandedVp((v) => !v)}
            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg px-3 min-h-[44px] transition tabular-nums"
          >
            <Trophy className="w-4 h-4 text-rose-400" />
            <div className="text-left">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Opponent VP</div>
              <div className="text-sm font-bold text-rose-300">
                {totalOppVp}{' '}
                <span className="text-xs font-normal text-slate-400">
                  (P:{totalOppPrimary} / S:{totalOppSecondary})
                </span>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1 bg-rose-950/60 border border-rose-700/50 rounded-lg px-2 py-0.5 tabular-nums">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-300 mr-0.5">
              Opp CP
            </span>
            <button
              type="button"
              onClick={() => adjustCp('opponent', -1)}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md hover:bg-rose-800/60 text-rose-200 active:scale-95 transition"
              title="Decrease Opponent CP"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-lg font-bold text-white min-w-[1.5rem] text-center">
              {session.opponentCp}
            </span>
            <button
              type="button"
              onClick={() => adjustCp('opponent', 1)}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-md hover:bg-rose-800/60 text-rose-200 active:scale-95 transition"
              title="Increase Opponent CP"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Compact 1-Line Secondary Summary When Collapsed During Combat Phases */}
      {match && !expandedMissions && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              🎯 Active Secondaries:
            </span>
            {match.userSecondaries.mode === 'fixed' ? (
              match.userSecondaries.fixedCards.map((cName) => (
                <span
                  key={cName}
                  className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 font-semibold"
                >
                  {cName}
                </span>
              ))
            ) : (match.userSecondaries.activeCards || []).length > 0 ? (
              match.userSecondaries.activeCards.map((cName) => (
                <span
                  key={cName}
                  className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/40 font-semibold"
                >
                  {cName}
                </span>
              ))
            ) : (
              <span className="text-slate-500 italic">None drawn yet</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setExpandedMissions(true)}
            className="text-[11px] font-semibold text-amber-400 hover:text-amber-300"
          >
            Tap to Score / View Mission Rules ↓
          </button>
        </div>
      )}

      {/* ACTIVE ROUND PRIMARY MISSION SCORING (IRONBUILT STYLE) */}
      {match && expandedMissions && (
        <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* YOUR PRIMARY SCORING */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                {match.yourMission.mission} · Round {currentRound}
              </span>
              <span className="text-[11px] text-slate-400">
                R{currentRound} VP:{' '}
                <span className="text-emerald-300 font-bold">
                  {session.scoresByRound[currentRound]?.userPrimaryVp ?? 0}
                </span>
              </span>
            </div>

            {match.yourMission.setup && (
              <div className="text-[11px] bg-slate-900 border border-slate-800 rounded p-2 text-sky-300">
                <span className="font-bold">⚙️ Setup:</span> {match.yourMission.setup}
              </div>
            )}

            <div className="space-y-2">
              {match.yourMission.score
                .filter((g) => isMissionItemActiveInRound(g.when, currentRound))
                .map((g, gIdx) => (
                  <div key={gIdx} className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      {g.when}
                    </div>
                    {g.items.map((item, iIdx) => {
                      const scoreKey = `R${currentRound}_user_p${gIdx}_i${iIdx}`;
                      const isScored = !!session.activeMissionScores?.[scoreKey];
                      const vpNum = parseInt(String(item.vp).replace(/\D/g, ''), 10) || 0;

                      return (
                        <div
                          key={iIdx}
                          onClick={() => toggleMissionItemScore(scoreKey, vpNum, 'user')}
                          className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition min-h-[44px] ${
                            isScored
                              ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="mt-0.5 text-emerald-400">
                            {isScored ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <span className="font-bold text-amber-300 mr-1.5">+{item.vp} VP:</span>
                            <span>{item.text}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>

            {/* Tactical Secondary Draw/Manage */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase">
                  Secondaries ({match.userSecondaries.mode.toUpperCase()})
                </span>
                {match.userSecondaries.mode === 'tactical' && (
                  <button
                    type="button"
                    onClick={handleDrawTacticalSecondaries}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-[11px] font-bold text-amber-300 hover:bg-amber-500/25 transition"
                  >
                    <Dices className="w-3.5 h-3.5" /> Draw 2 Cards
                  </button>
                )}
              </div>

              {match.userSecondaries.mode === 'fixed' ? (
                <div className="space-y-1.5">
                  {match.userSecondaries.fixedCards.map((cName) => {
                    const cardDef = secondaryCardsByName.get(cName);
                    const isCardOpen = Boolean(expandedCardNames[cName]);
                    const vpOptions = getSecondaryVpButtons(cName);
                    return (
                      <div key={cName} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => toggleExpandCard(cName)}
                            className="font-semibold text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 text-left"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                            <span>{cName}</span>
                          </button>
                          <div className="flex items-center gap-1">
                            {vpOptions.map((vp) => (
                              <button
                                key={vp}
                                type="button"
                                onClick={() => updateRoundVp(currentRound, 'userSecondaryVp', vp)}
                                className="px-2 py-1 rounded bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 text-[11px] font-bold hover:bg-emerald-600/50"
                              >
                                +{vp} VP
                              </button>
                            ))}
                          </div>
                        </div>
                        {isCardOpen && cardDef && (
                          <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-300 space-y-1">
                            {cardDef.score
                              .filter((s) => s.mode === 'Fixed')
                              .map((grp, idx) => (
                                <div key={idx}>
                                  <div className="text-[10px] font-bold uppercase text-amber-400">{grp.when}</div>
                                  {grp.items.map((it, i) => (
                                    <div key={i}>
                                      <strong className="text-emerald-300">+{it.vp} VP:</strong> {it.text}
                                    </div>
                                  ))}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(match.userSecondaries.activeCards || []).length > 0 ? (
                    match.userSecondaries.activeCards.map((cName) => {
                      const cardDef = secondaryCardsByName.get(cName);
                      const isCardOpen = Boolean(expandedCardNames[cName]);
                      const vpOptions = getSecondaryVpButtons(cName);
                      const isConfirmingDiscard = discardPromptCard === cName;
                      return (
                        <div key={cName} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => toggleExpandCard(cName)}
                              className="font-semibold text-amber-300 hover:text-amber-200 inline-flex items-center gap-1 text-left"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-400" />
                              <span>{cName}</span>
                            </button>
                            <div className="flex flex-wrap items-center gap-1">
                              {vpOptions.map((vp) => (
                                <button
                                  key={vp}
                                  type="button"
                                  onClick={() => updateRoundVp(currentRound, 'userSecondaryVp', vp)}
                                  className="px-2 py-1 rounded bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 text-[11px] font-bold hover:bg-emerald-600/50"
                                >
                                  +{vp} VP
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() =>
                                  setDiscardPromptCard(isConfirmingDiscard ? null : cName)
                                }
                                className="px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-[11px] border border-slate-700"
                              >
                                Discard
                              </button>
                            </div>
                          </div>

                          {/* +1 CP Discard Confirmation Prompt */}
                          {isConfirmingDiscard && (
                            <div className="p-2 rounded bg-slate-950 border border-amber-500/50 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                              <span className="text-slate-300">
                                Discard <strong>{cName}</strong>?
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDiscardSecondary(cName, true)}
                                  className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                                >
                                  Discard & Gain +1 CP
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDiscardSecondary(cName, false)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                                >
                                  Free Discard (0 CP)
                                </button>
                              </div>
                            </div>
                          )}

                          {isCardOpen && cardDef && (
                            <div className="pt-1.5 border-t border-slate-800 text-[11px] text-slate-300 space-y-1">
                              {cardDef.whenDrawn && (
                                <div className="text-sky-300 italic">{cardDef.whenDrawn}</div>
                              )}
                              {cardDef.score
                                .filter((s) => s.mode === 'Tactical')
                                .map((grp, idx) => (
                                  <div key={idx}>
                                    <div className="text-[10px] font-bold uppercase text-amber-400">{grp.when}</div>
                                    {grp.items.map((it, i) => (
                                      <div key={i}>
                                        <strong className="text-emerald-300">+{it.vp} VP:</strong> {it.text}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[11px] text-slate-500 italic p-1">
                      No active secondaries in hand. Tap &quot;Draw 2 Cards&quot; above.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* OPPONENT PRIMARY SCORING */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
              <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">
                {match.opponentMission.mission} · Round {currentRound}
              </span>
              <span className="text-[11px] text-slate-400">
                R{currentRound} VP:{' '}
                <span className="text-rose-300 font-bold">
                  {session.scoresByRound[currentRound]?.opponentPrimaryVp ?? 0}
                </span>
              </span>
            </div>

            {match.opponentMission.setup && (
              <div className="text-[11px] bg-slate-900 border border-slate-800 rounded p-2 text-sky-300">
                <span className="font-bold">⚙️ Setup:</span> {match.opponentMission.setup}
              </div>
            )}

            <div className="space-y-2">
              {match.opponentMission.score
                .filter((g) => isMissionItemActiveInRound(g.when, currentRound))
                .map((g, gIdx) => (
                  <div key={gIdx} className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      {g.when}
                    </div>
                    {g.items.map((item, iIdx) => {
                      const scoreKey = `R${currentRound}_opp_p${gIdx}_i${iIdx}`;
                      const isScored = !!session.activeMissionScores?.[scoreKey];
                      const vpNum = parseInt(String(item.vp).replace(/\D/g, ''), 10) || 0;

                      return (
                        <div
                          key={iIdx}
                          onClick={() => toggleMissionItemScore(scoreKey, vpNum, 'opponent')}
                          className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition min-h-[44px] ${
                            isScored
                              ? 'bg-rose-950/40 border-rose-500/60 text-white'
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="mt-0.5 text-rose-400">
                            {isScored ? (
                              <CheckSquare className="w-4 h-4 text-rose-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                          <div className="flex-1">
                            <span className="font-bold text-amber-300 mr-1.5">+{item.vp} VP:</span>
                            <span>{item.text}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>

            {/* Quick Opponent Round Adjustment */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400 font-bold uppercase">Manual Adjust Opp VP</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => updateRoundVp(currentRound, 'opponentPrimaryVp', -1)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  -1
                </button>
                <button
                  type="button"
                  onClick={() => updateRoundVp(currentRound, 'opponentPrimaryVp', 1)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => updateRoundVp(currentRound, 'opponentSecondaryVp', 5)}
                  className="px-2.5 py-1 rounded bg-rose-900/40 border border-rose-700/60 text-rose-300 text-xs font-bold"
                >
                  +5 Sec
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expandable Round-by-Round Primary & Secondary VP Table */}
      {expandedVp && (
        <div className="mt-3 pt-3 border-t border-slate-800 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="py-1.5 px-2">Battle Round</th>
                <th className="py-1.5 px-2 text-emerald-300">Your Primary VP</th>
                <th className="py-1.5 px-2 text-emerald-300">Your Secondary VP</th>
                <th className="py-1.5 px-2 text-rose-300">Opp Primary VP</th>
                <th className="py-1.5 px-2 text-rose-300">Opp Secondary VP</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => {
                const sc = session.scoresByRound[r] ?? {
                  round: r,
                  userPrimaryVp: 0,
                  userSecondaryVp: 0,
                  opponentPrimaryVp: 0,
                  opponentSecondaryVp: 0,
                };
                const isCurrent = r === session.battleRound;
                return (
                  <tr
                    key={r}
                    className={`border-b border-slate-800/60 ${
                      isCurrent ? 'bg-amber-500/10 font-semibold' : ''
                    }`}
                  >
                    <td className="py-1.5 px-2 text-slate-200">
                      Round {r} {isCurrent && <span className="text-amber-400 font-bold">(Active)</span>}
                    </td>
                    {(
                      [
                        'userPrimaryVp',
                        'userSecondaryVp',
                        'opponentPrimaryVp',
                        'opponentSecondaryVp',
                      ] as const
                    ).map((field) => (
                      <td key={field} className="py-1.5 px-2">
                        <div className="inline-flex items-center gap-1.5 bg-slate-950/80 border border-slate-700 rounded px-1.5 py-0.5">
                          <button
                            type="button"
                            onClick={() => updateRoundVp(r, field, -1)}
                            className="text-slate-400 hover:text-white px-1.5 py-1"
                          >
                            -1
                          </button>
                          <span className="min-w-[1.5rem] text-center text-white font-bold">
                            {sc[field]}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateRoundVp(r, field, 1)}
                            className="text-slate-400 hover:text-white px-1.5 py-1"
                          >
                            +1
                          </button>
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[11px] text-slate-400 mt-2">
            Includes +10 VP Battle Ready bonus (User: +{battleReadyUserVp} VP / Opponent: +{battleReadyOppVp} VP, capped at 100 VP).
          </p>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxLayout && (
        <MapLightboxModal
          layout={lightboxLayout}
          onClose={() => setLightboxLayout(null)}
        />
      )}
    </div>
  );
};
