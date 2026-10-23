import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  Swords,
  MapPin,
  Trophy,
  Sliders,
  Check,
  Star,
  Maximize2,
  Key,
  Flame,
  Target,
  Crown,
  Compass,
} from 'lucide-react';
import type {
  Detachment,
  Faction,
  ForceDisposition,
  GameSessionState,
  MapLayoutDescriptor,
  MatchOpponentConfig,
  MatchSetupConfig,
  PrimaryMissionDefinition,
  SavedRoster,
  SecondaryDeckState,
} from '../types/rules';
import {
  ALL_FORCE_DISPOSITIONS,
  DISPOSITION_COLORS,
  getFixedEligibleSecondaryCards,
  getLayoutImageUrl,
  getLayoutsForMatchup,
  getMissionMetadata,
  getRecommendedDispositions,
  getTerrainKeyImageUrl,
  resolvePrimaryMissions,
} from '../engine/missionEngine';
import { FixedSecondariesModal } from './FixedSecondariesModal';
import { MapLightboxModal } from './MapLightboxModal';
import { db } from '../db/lexTacticaDb';

interface GameSetupWizardModalProps {
  currentRoster: SavedRoster | null;
  allRosters: SavedRoster[];
  factions: Faction[];
  allDetachments: Detachment[];
  onStartGame: (session: GameSessionState) => void;
  onClose: () => void;
}

type WizardStep = 'rosters' | 'preview' | 'missions' | 'map' | 'pregame';

export const GameSetupWizardModal: React.FC<GameSetupWizardModalProps> = ({
  currentRoster,
  allRosters,
  factions,
  allDetachments,
  onStartGame,
  onClose,
}) => {
  const [step, setStep] = useState<WizardStep>('rosters');

  // STEP 1: Rosters State
  const [userRosterMode, setUserRosterMode] = useState<'saved' | 'manual'>('saved');
  const [selectedUserRosterId, setSelectedUserRosterId] = useState<string>(
    currentRoster?.id || (allRosters[0]?.id ?? '')
  );
  const [manualUserFaction, setManualUserFaction] = useState<string>(factions[0]?.id || 'SM');
  const [manualUserDets, setManualUserDets] = useState<string[]>([]);
  const [manualUserName, setManualUserName] = useState<string>('My Strike Force');

  const [oppRosterMode, setOppRosterMode] = useState<'saved' | 'manual'>('manual');
  const [selectedOppRosterId, setSelectedOppRosterId] = useState<string>('');
  const [manualOppFaction, setManualOppFaction] = useState<string>(
    factions.find((f) => f.id !== 'SM')?.id || factions[1]?.id || 'AC'
  );
  const [manualOppDets, setManualOppDets] = useState<string[]>([]);
  const [manualOppName, setManualOppName] = useState<string>("Opponent's Army");

  // Load detachments for manual opponent faction if needed
  const [factionDetachmentsCache, setFactionDetachmentsCache] = useState<Record<string, Detachment[]>>({});

  useEffect(() => {
    async function loadDets(factionId: string) {
      if (factionDetachmentsCache[factionId]) return;
      const dets = await db.detachments.where('factionId').equals(factionId).toArray();
      if (dets.length > 0) {
        setFactionDetachmentsCache((prev) => ({ ...prev, [factionId]: dets }));
      }
    }
    if (manualUserFaction) loadDets(manualUserFaction);
    if (manualOppFaction) loadDets(manualOppFaction);
  }, [manualUserFaction, manualOppFaction, factionDetachmentsCache]);

  // Active User Army & Detachments
  const effectiveUserRoster = useMemo(() => {
    if (userRosterMode === 'saved') {
      return allRosters.find((r) => r.id === selectedUserRosterId) || currentRoster;
    }
    return null;
  }, [userRosterMode, selectedUserRosterId, allRosters, currentRoster]);

  const effectiveUserFactionId = userRosterMode === 'saved'
    ? effectiveUserRoster?.factionId || 'SM'
    : manualUserFaction;

  const effectiveUserDetachments = useMemo(() => {
    if (userRosterMode === 'saved' && effectiveUserRoster) {
      return allDetachments.filter((d) => effectiveUserRoster.detachmentIds.includes(d.id));
    }
    const pool = factionDetachmentsCache[manualUserFaction] || allDetachments.filter((d) => d.factionId === manualUserFaction);
    return pool.filter((d) => manualUserDets.includes(d.id));
  }, [userRosterMode, effectiveUserRoster, allDetachments, factionDetachmentsCache, manualUserFaction, manualUserDets]);

  // Active Opponent Army & Detachments
  const effectiveOppRoster = useMemo(() => {
    if (oppRosterMode === 'saved' && selectedOppRosterId) {
      return allRosters.find((r) => r.id === selectedOppRosterId) || null;
    }
    return null;
  }, [oppRosterMode, selectedOppRosterId, allRosters]);

  const effectiveOppFactionId = oppRosterMode === 'saved' && effectiveOppRoster
    ? effectiveOppRoster.factionId
    : manualOppFaction;

  const effectiveOppDetachments = useMemo(() => {
    if (oppRosterMode === 'saved' && effectiveOppRoster) {
      return allDetachments.filter((d) => effectiveOppRoster.detachmentIds.includes(d.id));
    }
    const pool = factionDetachmentsCache[manualOppFaction] || allDetachments.filter((d) => d.factionId === manualOppFaction);
    return pool.filter((d) => manualOppDets.includes(d.id));
  }, [oppRosterMode, effectiveOppRoster, allDetachments, factionDetachmentsCache, manualOppFaction, manualOppDets]);

  // STEP 2: Force Dispositions State
  const userRecDisps = useMemo(() => {
    const ids = effectiveUserDetachments.map((d) => d.id);
    return getRecommendedDispositions(ids, effectiveUserDetachments);
  }, [effectiveUserDetachments]);

  const oppRecDisps = useMemo(() => {
    const ids = effectiveOppDetachments.map((d) => d.id);
    return getRecommendedDispositions(ids, effectiveOppDetachments);
  }, [effectiveOppDetachments]);

  const [yourDisposition, setYourDisposition] = useState<ForceDisposition>('Purge the Foe');
  const [oppDisposition, setOppDisposition] = useState<ForceDisposition>('Disruption');

  // Auto-set recommended disposition on step change or det update
  useEffect(() => {
    if (userRecDisps.length > 0 && !userRecDisps.includes(yourDisposition)) {
      setYourDisposition(userRecDisps[0]);
    }
  }, [userRecDisps]);

  useEffect(() => {
    if (oppRecDisps.length > 0 && !oppRecDisps.includes(oppDisposition)) {
      setOppDisposition(oppRecDisps[0]);
    }
  }, [oppRecDisps]);

  // STEP 3: Missions
  const { yourMission, opponentMission } = useMemo(() => {
    try {
      return resolvePrimaryMissions(yourDisposition, oppDisposition);
    } catch {
      return { yourMission: null, opponentMission: null };
    }
  }, [yourDisposition, oppDisposition]);

  // STEP 4: Map Layouts
  const availableLayouts = useMemo(() => {
    return getLayoutsForMatchup(yourDisposition, oppDisposition);
  }, [yourDisposition, oppDisposition]);

  const [selectedLayoutKey, setSelectedLayoutKey] = useState<'A' | 'B' | 'C'>('A');
  const activeLayout = useMemo(() => {
    return availableLayouts.find((l) => l.layout === selectedLayoutKey) || availableLayouts[0];
  }, [availableLayouts, selectedLayoutKey]);

  const [lightboxLayout, setLightboxLayout] = useState<MapLayoutDescriptor | null>(null);

  // STEP 5: Pre-Game Parameters
  const [battleReadyUser, setBattleReadyUser] = useState(true);
  const [battleReadyOpponent, setBattleReadyOpponent] = useState(true);

  const [userSecMode, setUserSecMode] = useState<'tactical' | 'fixed'>('tactical');
  const [userFixedCards, setUserFixedCards] = useState<string[]>(['Assassination', 'Bring it Down']);
  const [isUserFixedModalOpen, setIsUserFixedModalOpen] = useState(false);

  const [oppSecMode, setOppSecMode] = useState<'tactical' | 'fixed'>('tactical');
  const [oppFixedCards, setOppFixedCards] = useState<string[]>(['Assassination', 'Bring it Down']);
  const [isOppFixedModalOpen, setIsOppFixedModalOpen] = useState(false);

  const [userRole, setUserRole] = useState<'attacker' | 'defender'>('attacker');
  const [firstTurn, setFirstTurn] = useState<'user' | 'opponent'>('user');

  // Auto-align default role with layout recommendation if available
  useEffect(() => {
    if (activeLayout) {
      if (activeLayout.attacker.disposition === yourDisposition) {
        setUserRole('attacker');
      } else {
        setUserRole('defender');
      }
    }
  }, [activeLayout, yourDisposition]);

  // Launch Game
  const handleStartGame = () => {
    if (!yourMission || !opponentMission || !activeLayout) return;

    const userFactionName = factions.find((f) => f.id === effectiveUserFactionId)?.name || effectiveUserFactionId;
    const oppFactionName = factions.find((f) => f.id === effectiveOppFactionId)?.name || effectiveOppFactionId;

    const opponentConfig: MatchOpponentConfig = {
      name: manualOppName,
      factionId: effectiveOppFactionId,
      factionName: oppFactionName,
      detachmentIds: effectiveOppDetachments.map((d) => d.id),
      detachmentNames: effectiveOppDetachments.map((d) => d.name),
      forceDisposition: oppDisposition,
      opponentRosterId: oppRosterMode === 'saved' && selectedOppRosterId ? selectedOppRosterId : undefined,
    };

    const matchSetup: MatchSetupConfig = {
      yourDisposition,
      opponent: opponentConfig,
      yourMission,
      opponentMission,
      mapLayout: activeLayout.layout,
      mapDescriptor: activeLayout,
      battleReadyUser,
      battleReadyOpponent,
      userRole,
      userSecondaries: {
        mode: userSecMode,
        fixedCards: userSecMode === 'fixed' ? userFixedCards : [],
        activeCards: [],
        discardedCards: [],
      },
      opponentSecondaries: {
        mode: oppSecMode,
        fixedCards: oppSecMode === 'fixed' ? oppFixedCards : [],
        activeCards: [],
        discardedCards: [],
      },
      concededPlayer: null,
    };

    const initialSession: GameSessionState = {
      id: `session-${Date.now()}`,
      rosterId: effectiveUserRoster?.id || 'manual-roster',
      opponentRosterId: oppRosterMode === 'saved' && selectedOppRosterId ? selectedOppRosterId : undefined,
      battleRound: 1,
      currentTurn: firstTurn === 'user' ? 'your_turn' : 'opponent_turn',
      currentPhase: 'pre_game',
      firstTurnPlayer: firstTurn,
      userCp: 0,
      opponentCp: 0,
      scoresByRound: {
        1: { round: 1, userPrimaryVp: 0, userSecondaryVp: 0, opponentPrimaryVp: 0, opponentSecondaryVp: 0 },
        2: { round: 2, userPrimaryVp: 0, userSecondaryVp: 0, opponentPrimaryVp: 0, opponentSecondaryVp: 0 },
        3: { round: 3, userPrimaryVp: 0, userSecondaryVp: 0, opponentPrimaryVp: 0, opponentSecondaryVp: 0 },
        4: { round: 4, userPrimaryVp: 0, userSecondaryVp: 0, opponentPrimaryVp: 0, opponentSecondaryVp: 0 },
        5: { round: 5, userPrimaryVp: 0, userSecondaryVp: 0, opponentPrimaryVp: 0, opponentSecondaryVp: 0 },
      },
      unitStates: {},
      matchSetup,
      activeMissionScores: {},
      stratagemLog: [],
      updatedAt: Date.now(),
    };

    onStartGame(initialSession);
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 no-print select-none">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header with Step Tracker */}
        <div className="border-b border-slate-800 bg-slate-950 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Swords className="w-5 h-5 text-amber-400" />
            <div>
              <span className="text-xs uppercase font-extrabold tracking-wider text-amber-500">
                11th Edition Game Setup
              </span>
              <h2 className="text-base font-bold text-white">
                {step === 'rosters' && 'Step 1 · Select Rosters'}
                {step === 'preview' && 'Step 2 · Force Dispositions'}
                {step === 'missions' && 'Step 3 · Asymmetric Primary Missions'}
                {step === 'map' && 'Step 4 · Map & Terrain Layout'}
                {step === 'pregame' && 'Step 5 · Pre-Game Battle Parameters'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Tabs indicator */}
        <div className="bg-slate-950/80 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between overflow-x-auto text-xs">
          {[
            { id: 'rosters', label: '1. Rosters' },
            { id: 'preview', label: '2. Dispositions' },
            { id: 'missions', label: '3. Missions' },
            { id: 'map', label: '4. Map Layout' },
            { id: 'pregame', label: '5. Pre-Game' },
          ].map((tab, idx) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStep(tab.id as WizardStep)}
              className={`px-3 py-1 rounded-md font-semibold transition whitespace-nowrap ${
                step === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* STEP 1: ROSTERS */}
          {step === 'rosters' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* YOUR ROSTER */}
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-sm text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> Your Roster
                  </span>
                  <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setUserRosterMode('saved')}
                      className={`px-2.5 py-1 rounded ${userRosterMode === 'saved' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                    >
                      Saved
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserRosterMode('manual')}
                      className={`px-2.5 py-1 rounded ${userRosterMode === 'manual' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                    >
                      Manual
                    </button>
                  </div>
                </div>

                {userRosterMode === 'saved' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Choose Saved Roster</label>
                    <select
                      value={selectedUserRosterId}
                      onChange={(e) => setSelectedUserRosterId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      {allRosters.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.totalPoints} pts)
                        </option>
                      ))}
                    </select>
                    {effectiveUserRoster && (
                      <div className="mt-3 text-xs text-slate-400 space-y-1">
                        <div>
                          Faction:{' '}
                          <span className="text-white font-medium">
                            {factions.find((f) => f.id === effectiveUserRoster.factionId)?.name || effectiveUserRoster.factionId}
                          </span>
                        </div>
                        <div>
                          Detachments:{' '}
                          <span className="text-amber-300 font-medium">
                            {effectiveUserDetachments.map((d) => d.name).join(' + ') || 'None selected'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">List Name</label>
                      <input
                        type="text"
                        value={manualUserName}
                        onChange={(e) => setManualUserName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Army Faction</label>
                      <select
                        value={manualUserFaction}
                        onChange={(e) => {
                          setManualUserFaction(e.target.value);
                          setManualUserDets([]);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                      >
                        {factions.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Detachments (Select 1-2)
                      </label>
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-900 rounded-lg border border-slate-800">
                        {(factionDetachmentsCache[manualUserFaction] || allDetachments.filter((d) => d.factionId === manualUserFaction)).map((d) => {
                          const isSel = manualUserDets.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                if (isSel) setManualUserDets(manualUserDets.filter((id) => id !== d.id));
                                else setManualUserDets([...manualUserDets, d.id]);
                              }}
                              className={`px-2 py-1 rounded text-xs border font-medium transition ${
                                isSel
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                              }`}
                            >
                              {d.name} <span className="opacity-75 text-[10px]">({d.dp} DP)</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* OPPONENT ROSTER */}
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/50 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-bold text-sm text-rose-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Swords className="w-4 h-4" /> Opponent's Roster
                  </span>
                  <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setOppRosterMode('manual')}
                      className={`px-2.5 py-1 rounded ${oppRosterMode === 'manual' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                    >
                      Manual
                    </button>
                    <button
                      type="button"
                      onClick={() => setOppRosterMode('saved')}
                      className={`px-2.5 py-1 rounded ${oppRosterMode === 'saved' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                    >
                      Saved
                    </button>
                  </div>
                </div>

                {oppRosterMode === 'manual' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Opponent Name</label>
                      <input
                        type="text"
                        value={manualOppName}
                        onChange={(e) => setManualOppName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Opponent Army</label>
                      <select
                        value={manualOppFaction}
                        onChange={(e) => {
                          setManualOppFaction(e.target.value);
                          setManualOppDets([]);
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                      >
                        {factions.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">
                        Detachments (Select 1-2)
                      </label>
                      <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-slate-900 rounded-lg border border-slate-800">
                        {(factionDetachmentsCache[manualOppFaction] || allDetachments.filter((d) => d.factionId === manualOppFaction)).map((d) => {
                          const isSel = manualOppDets.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                if (isSel) setManualOppDets(manualOppDets.filter((id) => id !== d.id));
                                else setManualOppDets([...manualOppDets, d.id]);
                              }}
                              className={`px-2 py-1 rounded text-xs border font-medium transition ${
                                isSel
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-600'
                              }`}
                            >
                              {d.name} <span className="opacity-75 text-[10px]">({d.dp} DP)</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Choose Saved Roster</label>
                    <select
                      value={selectedOppRosterId}
                      onChange={(e) => setSelectedOppRosterId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      <option value="">-- Choose Opponent List --</option>
                      {allRosters.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.totalPoints} pts)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: DISPOSITIONS */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="border border-slate-800 rounded-xl p-5 bg-slate-950/60 space-y-4">
                <div className="text-xs uppercase font-bold text-slate-400 tracking-wider">YOUR SIDE</div>
                <div className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{factions.find((f) => f.id === effectiveUserFactionId)?.name || effectiveUserFactionId}</span>
                </div>
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-slate-400">Detachments: </span>
                  {effectiveUserDetachments.length > 0 ? (
                    effectiveUserDetachments.map((d, idx) => (
                      <span key={d.id}>
                        {idx > 0 && ' + '}
                        <span className="font-medium text-amber-300">{d.name}</span>
                        {d.forceDisposition && (
                          <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] border ${DISPOSITION_COLORS[d.forceDisposition].badge}`}>
                            {d.forceDisposition}
                          </span>
                        )}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">None chosen</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Active Force Disposition</label>
                  <select
                    value={yourDisposition}
                    onChange={(e) => setYourDisposition(e.target.value as ForceDisposition)}
                    className="w-full sm:w-80 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {ALL_FORCE_DISPOSITIONS.map((disp) => {
                      const isRec = userRecDisps.includes(disp);
                      return (
                        <option key={disp} value={disp}>
                          {disp} {isRec ? '★ recommended' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl p-5 bg-slate-950/60 space-y-4">
                <div className="text-xs uppercase font-bold text-slate-400 tracking-wider">OPPONENT'S SIDE</div>
                <div className="text-lg font-bold text-white flex items-center gap-2">
                  <span>{manualOppName} · {factions.find((f) => f.id === effectiveOppFactionId)?.name || effectiveOppFactionId}</span>
                </div>
                <div className="text-xs text-slate-300">
                  <span className="font-semibold text-slate-400">Detachments: </span>
                  {effectiveOppDetachments.length > 0 ? (
                    effectiveOppDetachments.map((d, idx) => (
                      <span key={d.id}>
                        {idx > 0 && ' + '}
                        <span className="font-medium text-amber-300">{d.name}</span>
                        {d.forceDisposition && (
                          <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] border ${DISPOSITION_COLORS[d.forceDisposition].badge}`}>
                            {d.forceDisposition}
                          </span>
                        )}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500">None chosen</span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Opponent's Force Disposition</label>
                  <select
                    value={oppDisposition}
                    onChange={(e) => setOppDisposition(e.target.value as ForceDisposition)}
                    className="w-full sm:w-80 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {ALL_FORCE_DISPOSITIONS.map((disp) => {
                      const isRec = oppRecDisps.includes(disp);
                      return (
                        <option key={disp} value={disp}>
                          {disp} {isRec ? '★ recommended' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: MISSIONS */}
          {step === 'missions' && yourMission && opponentMission && (
            <div className="space-y-6">
              {/* YOUR PRIMARY MISSION */}
              <div className="border border-slate-800 rounded-xl p-5 bg-slate-950/70 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      YOUR PRIMARY MISSION
                    </div>
                    <h3 className="text-xl font-extrabold text-amber-400 tracking-wide uppercase">
                      {yourMission.mission}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded border font-semibold ${DISPOSITION_COLORS[yourDisposition].badge}`}>
                      You: {yourDisposition}
                    </span>
                    <span className="text-slate-500">vs</span>
                    <span className={`px-2 py-0.5 rounded border font-semibold ${DISPOSITION_COLORS[oppDisposition].badge}`}>
                      Opp: {oppDisposition}
                    </span>
                  </div>
                </div>

                {yourMission.setup && (
                  <div className="bg-sky-950/30 border border-sky-800/50 rounded-lg p-3 text-xs text-sky-200 flex items-start gap-2">
                    <span className="text-sky-400 font-bold shrink-0">⚙️ Setup:</span>
                    <span>{yourMission.setup}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">SCORING</div>
                  {yourMission.score.map((group, gIdx) => (
                    <div key={gIdx} className="border-l-2 border-amber-500/40 pl-3 py-1 space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                        {group.when}
                      </div>
                      {group.items.map((item, iIdx) => (
                        <div key={iIdx} className="flex items-start gap-2 text-xs">
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/50 px-1.5 py-0.5 rounded font-bold text-[10px] shrink-0">
                            {item.vp} VP
                          </span>
                          <span className="text-slate-200">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* OPPONENT PRIMARY MISSION */}
              <div className="border border-slate-800 rounded-xl p-5 bg-slate-950/70 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      OPPONENT'S PRIMARY MISSION
                    </div>
                    <h3 className="text-xl font-extrabold text-amber-400 tracking-wide uppercase">
                      {opponentMission.mission}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded border font-semibold ${DISPOSITION_COLORS[oppDisposition].badge}`}>
                      Opp: {oppDisposition}
                    </span>
                    <span className="text-slate-500">vs</span>
                    <span className={`px-2 py-0.5 rounded border font-semibold ${DISPOSITION_COLORS[yourDisposition].badge}`}>
                      You: {yourDisposition}
                    </span>
                  </div>
                </div>

                {opponentMission.setup && (
                  <div className="bg-sky-950/30 border border-sky-800/50 rounded-lg p-3 text-xs text-sky-200 flex items-start gap-2">
                    <span className="text-sky-400 font-bold shrink-0">⚙️ Setup:</span>
                    <span>{opponentMission.setup}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">SCORING</div>
                  {opponentMission.score.map((group, gIdx) => (
                    <div key={gIdx} className="border-l-2 border-amber-500/40 pl-3 py-1 space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                        {group.when}
                      </div>
                      {group.items.map((item, iIdx) => (
                        <div key={iIdx} className="flex items-start gap-2 text-xs">
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/50 px-1.5 py-0.5 rounded font-bold text-[10px] shrink-0">
                            {item.vp} VP
                          </span>
                          <span className="text-slate-200">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: MAP LAYOUT */}
          {step === 'map' && activeLayout && (
            <div className="space-y-4">
              {/* Layout Switcher Tabs */}
              <div className="grid grid-cols-3 gap-2">
                {availableLayouts.map((l) => (
                  <button
                    key={l.layout}
                    type="button"
                    onClick={() => setSelectedLayoutKey(l.layout)}
                    className={`py-3 rounded-xl font-extrabold text-base border transition ${
                      selectedLayoutKey === l.layout
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    Layout {l.layout}
                  </button>
                ))}
              </div>

              {/* Map Preview Card */}
              <div className="border border-slate-800 rounded-xl p-3 bg-slate-950 flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-2 text-xs text-slate-400 px-1">
                  <span>Page {activeLayout.page} · Event Companion</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLightboxLayout(activeLayout)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
                    >
                      <Maximize2 className="w-3.5 h-3.5" /> Fullscreen View
                    </button>
                  </div>
                </div>

                <div
                  onClick={() => setLightboxLayout(activeLayout)}
                  className="cursor-pointer max-h-[55vh] overflow-hidden rounded-lg border border-slate-800/80 hover:border-amber-500/50 transition group relative"
                >
                  <img
                    src={getLayoutImageUrl(activeLayout.file)}
                    alt={`Layout ${activeLayout.layout}`}
                    className="w-auto h-auto max-h-[54vh] object-contain"
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs font-bold text-white gap-1.5">
                    <Maximize2 className="w-4 h-4" /> Tap map to view full screen
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: PRE-GAME */}
          {step === 'pregame' && (
            <div className="space-y-5">
              {/* Battle Ready */}
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/60">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  BATTLE READY (+10 VP EACH)
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBattleReadyUser(!battleReadyUser)}
                    className={`py-2.5 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition ${
                      battleReadyUser
                        ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    You {battleReadyUser && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBattleReadyOpponent(!battleReadyOpponent)}
                    className={`py-2.5 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition ${
                      battleReadyOpponent
                        ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    Opponent {battleReadyOpponent && <Check className="w-4 h-4 text-emerald-400" />}
                  </button>
                </div>
              </div>

              {/* Your Secondaries */}
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/60 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">YOUR SECONDARIES</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUserSecMode('tactical')}
                    className={`py-2 rounded-lg font-bold text-xs uppercase border transition ${
                      userSecMode === 'tactical'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Tactical
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserSecMode('fixed')}
                    className={`py-2 rounded-lg font-bold text-xs uppercase border transition ${
                      userSecMode === 'fixed'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Fixed
                  </button>
                </div>
                {userSecMode === 'fixed' && (
                  <button
                    type="button"
                    onClick={() => setIsUserFixedModalOpen(true)}
                    className="w-full mt-2 py-2 px-3 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-300 text-center"
                  >
                    Choose Fixed ({userFixedCards.length}/2): {userFixedCards.join(', ')}
                  </button>
                )}
              </div>

              {/* Opponent Secondaries */}
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/60 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">OPPONENT SECONDARIES</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOppSecMode('tactical')}
                    className={`py-2 rounded-lg font-bold text-xs uppercase border transition ${
                      oppSecMode === 'tactical'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Tactical
                  </button>
                  <button
                    type="button"
                    onClick={() => setOppSecMode('fixed')}
                    className={`py-2 rounded-lg font-bold text-xs uppercase border transition ${
                      oppSecMode === 'fixed'
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    Fixed
                  </button>
                </div>
                {oppSecMode === 'fixed' && (
                  <button
                    type="button"
                    onClick={() => setIsOppFixedModalOpen(true)}
                    className="w-full mt-2 py-2 px-3 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-300 text-center"
                  >
                    Choose Fixed ({oppFixedCards.length}/2): {oppFixedCards.join(', ')}
                  </button>
                )}
              </div>

              {/* Role & Initiative */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/60 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">YOUR ROLE</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUserRole('attacker')}
                      className={`py-2 rounded-lg font-bold text-xs uppercase border transition ${
                        userRole === 'attacker'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      Attacker
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserRole('defender')}
                      className={`py-2 rounded-lg font-bold text-xs uppercase border transition ${
                        userRole === 'defender'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      Defender
                    </button>
                  </div>
                </div>

                <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/60 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">WHO GOES FIRST</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFirstTurn('user')}
                      className={`py-2 rounded-lg font-bold text-xs uppercase border transition ${
                        firstTurn === 'user'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      You
                    </button>
                    <button
                      type="button"
                      onClick={() => setFirstTurn('opponent')}
                      className={`py-2 rounded-lg font-bold text-xs uppercase border transition ${
                        firstTurn === 'opponent'
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      Opponent
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 flex items-center justify-between">
          <div>
            {step !== 'rosters' && (
              <button
                type="button"
                onClick={() => {
                  if (step === 'preview') setStep('rosters');
                  if (step === 'missions') setStep('preview');
                  if (step === 'map') setStep('missions');
                  if (step === 'pregame') setStep('map');
                }}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-xs font-bold uppercase text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>

          <div className="hidden sm:block text-[11px] text-slate-500 text-center">
            11th Edition · Missions v{getMissionMetadata()?.missionsVersion?.split('-')[0] || '2026.10'} · {getMissionMetadata()?.totalLayouts ?? 45} Maps
          </div>

          <div>
            {step !== 'pregame' ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 'rosters') setStep('preview');
                  if (step === 'preview') setStep('missions');
                  if (step === 'missions') setStep('map');
                  if (step === 'map') setStep('pregame');
                }}
                className="flex items-center gap-1 px-5 py-2 rounded-lg text-xs font-bold uppercase text-slate-950 bg-amber-500 hover:bg-amber-400 transition shadow"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartGame}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-extrabold uppercase tracking-wider text-slate-950 bg-rose-500 hover:bg-rose-400 transition shadow-lg shadow-rose-500/20"
              >
                PRESS START ▶
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {isUserFixedModalOpen && (
        <FixedSecondariesModal
          initialSelectedCards={userFixedCards}
          sideLabel="You"
          onConfirm={(cards) => {
            setUserFixedCards(cards);
            setIsUserFixedModalOpen(false);
          }}
          onClose={() => setIsUserFixedModalOpen(false)}
        />
      )}

      {isOppFixedModalOpen && (
        <FixedSecondariesModal
          initialSelectedCards={oppFixedCards}
          sideLabel="Opponent"
          onConfirm={(cards) => {
            setOppFixedCards(cards);
            setIsOppFixedModalOpen(false);
          }}
          onClose={() => setIsOppFixedModalOpen(false)}
        />
      )}

      {lightboxLayout && (
        <MapLightboxModal
          layout={lightboxLayout}
          onClose={() => setLightboxLayout(null)}
        />
      )}
    </div>
  );
};
