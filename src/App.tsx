import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Printer,
  RotateCcw,
  SlidersHorizontal,
  BookOpen,
  DownloadCloud,
  Zap,
  Crown,
  Footprints,
  Crosshair,
  Swords,
  Hourglass,
  MapPin,
  Sparkles,
  CheckCircle2,
  LayoutList,
  HelpCircle,
  GraduationCap,
  Trophy,
  Minus,
  Plus,
} from 'lucide-react';
import editionRules from './config/editionRules.json';
import {
  db,
  ensureCoreDataSynced,
  ensureFactionDataSynced,
  ensureStarterRosterSeeded,
  syncAllFactionsForOffline,
} from './db/lexTacticaDb';
import {
  buildCompositeUnits,
  isStratagemActiveInPhaseAndTurn,
} from './engine/compositeUnitBuilder';
import {
  buildGameStepSequence,
  createInitialGameSession,
  PHASE_LABELS,
  transitionGameSessionStep,
} from './engine/gameSessionEngine';
import type {
  CoreAction,
  Datasheet,
  Detachment,
  Enhancement,
  Faction,
  GameSessionState,
  LiveUnitState,
  MatchHistoryRecord,
  Phase,
  SavedRoster,
  Stratagem,
  UnitBattlefieldStatus,
} from './types/rules';
import { ScoreboardHud } from './components/ScoreboardHud';
import { CompositeUnitCard } from './components/CompositeUnitCard';
import { CoreActionsDrawer } from './components/CoreActionsDrawer';
import { PhaseStratagemsDrawer } from './components/PhaseStratagemsDrawer';
import { PhaseActionChecklist } from './components/PhaseActionChecklist';
import { RosterEditorModal } from './components/RosterEditorModal';
import { LexTacticaLogo } from './components/LexTacticaLogo';
import dornImg from './assets/dorn.png';
import { WelcomeModal } from './components/WelcomeModal';
import { GameSetupWizardModal } from './components/GameSetupWizardModal';
import { MatchSummaryModal } from './components/MatchSummaryModal';

interface CoachState {
  enabled: boolean;
  phaseSeenCount: Record<string, number>;
  gamesFinished: number;
}

const DEFAULT_COACH_STATE: CoachState = {
  enabled: true,
  phaseSeenCount: {},
  gamesFinished: 0,
};

function loadCoachState(): CoachState {
  try {
    const raw = localStorage.getItem('lex_tactica_coach_state');
    if (!raw) return DEFAULT_COACH_STATE;
    const parsed = JSON.parse(raw);
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      phaseSeenCount: parsed.phaseSeenCount ?? {},
      gamesFinished: typeof parsed.gamesFinished === 'number' ? parsed.gamesFinished : 0,
    };
  } catch {
    return DEFAULT_COACH_STATE;
  }
}

const COACH_PHASE_SUBTITLES: Record<Phase, { your_turn: string; opponent_turn: string }> = {
  pre_game: {
    your_turn: 'Attach Characters to Bodyguards, set Reserves/Transports, and configure Mission & Terrain.',
    opponent_turn: 'Attach Characters to Bodyguards, set Reserves/Transports, and configure Mission & Terrain.',
  },
  start_of_round: {
    your_turn: 'Resolve Start-of-Battle-Round rules and check Primary Mission round triggers.',
    opponent_turn: 'Resolve Start-of-Battle-Round rules and check Primary Mission round triggers.',
  },
  command: {
    your_turn: 'Both players gain +1 CP • Test Battle-shock for Below Half-Strength units • Score Primary VP (Round 2+).',
    opponent_turn: 'Both players gain +1 CP • Opponent tests Battle-shock and scores Primary VP.',
  },
  movement: {
    your_turn: 'Move units (Normal, Advance, Fall Back, Stationary) • Bring in Reinforcements (Round 2+) >9" from enemies.',
    opponent_turn: 'Watch for Fire Overwatch (1 CP) when enemy moves/sets up within 24" & visible, or Rapid Ingress at end of phase.',
  },
  shooting: {
    your_turn: 'Select eligible units to shoot (Visible + in Range) • Note 11th Ed 15" Hidden/Concealed terrain limits.',
    opponent_turn: 'Use defensive reactions (Smokescreen, Go to Ground, Armour of Contempt) when your units are targeted.',
  },
  charge: {
    your_turn: '11th Ed Charge: Declare charging unit & roll 2D6 FIRST, then pick visible enemy targets within that roll distance.',
    opponent_turn: 'Watch for Heroic Intervention (1 CP) or Fire Overwatch after an enemy declares a charge.',
  },
  fight: {
    your_turn: '11th Ed Fight: Simultaneous 3" Pile-In → Fights First → Remaining Combats → Simultaneous 3" Consolidate.',
    opponent_turn: 'Alternate selecting eligible units to fight • Use Counter-Offensive (2 CP) to interrupt after an enemy unit fights.',
  },
  end_of_turn: {
    your_turn: 'Score Achieved Secondary Missions or discard 1 Secondary Card to gain +1 CP.',
    opponent_turn: 'Verify opponent Secondary Mission scoring and end-of-turn unit positioning.',
  },
  end_of_round: {
    your_turn: 'Resolve end-of-round mission scoring (Round 5 final scoring) and advance to the next Battle Round.',
    opponent_turn: 'Resolve end-of-round mission scoring (Round 5 final scoring) and advance to the next Battle Round.',
  },
  any: {
    your_turn: '',
    opponent_turn: '',
  },
};

export const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [allRosters, setAllRosters] = useState<SavedRoster[]>([]);
  const [roster, setRoster] = useState<SavedRoster | null>(null);
  const [session, setSession] = useState<GameSessionState | null>(null);

  const [datasheets, setDatasheets] = useState<Datasheet[]>([]);
  const [detachments, setDetachments] = useState<Detachment[]>([]);
  const [allDetachments, setAllDetachments] = useState<Detachment[]>([]);
  const [enhancements, setEnhancements] = useState<Enhancement[]>([]);
  const [stratagems, setStratagems] = useState<Stratagem[]>([]);
  const [opponentStratagems, setOpponentStratagems] = useState<Stratagem[]>([]);
  const [coreActions, setCoreActions] = useState<CoreAction[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryRecord[]>([]);

  const [coachState, setCoachState] = useState<CoachState>(loadCoachState);
  const [rosterBannerExpanded, setRosterBannerExpanded] = useState(false);
  const [unitsAccordionOpen, setUnitsAccordionOpen] = useState(false);
  const [forceCompactCards, setForceCompactCards] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | UnitBattlefieldStatus>('on_battlefield');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorInitialTab, setEditorInitialTab] = useState<'setup' | 'import' | 'rosters' | 'history'>('setup');
  const [isWelcomeOpen, setIsWelcomeOpen] = useState(() => {
    try {
      return localStorage.getItem('lex_tactica_welcome_seen') !== 'true';
    } catch {
      return false;
    }
  });
  const [isCoreActionsOpen, setIsCoreActionsOpen] = useState(false);
  const [coreActionInitialSearch, setCoreActionInitialSearch] = useState('');
  const [isStratDrawerOpen, setIsStratDrawerOpen] = useState(false);
  const [stratDrawerUnitId, setStratDrawerUnitId] = useState<string | null>(null);
  const [offlineSyncStatus, setOfflineSyncStatus] = useState<string | null>(null);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);
  const [isMatchSummaryOpen, setIsMatchSummaryOpen] = useState(false);
  const [isDornDismissed, setIsDornDismissed] = useState(false);
  const [isDornFading, setIsDornFading] = useState(false);

  const handleDornClick = () => {
    setIsDornFading(true);
    setTimeout(() => {
      setIsDornDismissed(true);
    }, 700);
  };

  const updateCoachState = (updater: (prev: CoachState) => CoachState) => {
    setCoachState((prev) => {
      const next = updater(prev);
      try {
        localStorage.setItem('lex_tactica_coach_state', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const handleSetCoachMode = (enabled: boolean) => {
    updateCoachState((prev) => ({ ...prev, enabled }));
  };

  const handleOpenEditorTab = (tab: 'setup' | 'import' | 'rosters' | 'history') => {
    setEditorInitialTab(tab);
    setIsEditorOpen(true);
  };

  const loadFactionStateFromDb = async (factionId: string) => {
    await ensureFactionDataSynced(factionId);
    const [fDatasheets, fDetachments, fEnhancements, fStratagems, coreStrats, cActions] =
      await Promise.all([
        db.datasheets.where('factionId').equals(factionId).toArray(),
        db.detachments.where('factionId').equals(factionId).toArray(),
        db.enhancements.where('factionId').equals(factionId).toArray(),
        db.stratagems.where('factionId').equals(factionId).toArray(),
        db.stratagems.filter((s) => s.isCore).toArray(),
        db.coreActions.toArray(),
      ]);
    setDatasheets(fDatasheets);
    setDetachments(fDetachments);
    setEnhancements(fEnhancements);
    setStratagems([...coreStrats, ...fStratagems]);
    setCoreActions(cActions);
  };

  // Load opponent faction stratagems whenever opponent faction changes
  const opponentFactionId = session?.matchSetup?.opponent.factionId;
  useEffect(() => {
    if (!opponentFactionId) {
      setOpponentStratagems([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        await ensureFactionDataSynced(opponentFactionId);
        const [oppStrats, coreStrats] = await Promise.all([
          db.stratagems.where('factionId').equals(opponentFactionId).toArray(),
          db.stratagems.filter((s) => s.isCore).toArray(),
        ]);
        if (active) {
          setOpponentStratagems([...coreStrats, ...oppStrats]);
        }
      } catch {
        // Ignore if opponent faction fails to load
      }
    })();
    return () => {
      active = false;
    };
  }, [opponentFactionId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const coreInfo = await ensureCoreDataSynced();
        if (!mounted) return;
        setLastUpdate(coreInfo.lastUpdate.split(' ')[0] || coreInfo.lastUpdate);
        if (coreInfo.lastSyncedAt) {
          setLastSyncedAt(coreInfo.lastSyncedAt);
        }
        setFactions(coreInfo.factions);
        setAllDetachments(coreInfo.detachments);

        const activeRoster = await ensureStarterRosterSeeded();
        const [rostersList, historyList] = await Promise.all([
          db.savedRosters.orderBy('updatedAt').reverse().toArray(),
          db.matchHistory.orderBy('completedAt').reverse().toArray(),
        ]);
        if (!mounted) return;
        setAllRosters(rostersList);
        setMatchHistory(historyList);
        setRoster(activeRoster);

        await loadFactionStateFromDb(activeRoster.factionId);

        let existingSession = await db.gameSessions.get(`session_${activeRoster.id}`);
        if (!existingSession) {
          existingSession = createInitialGameSession(activeRoster, 'user');
          await db.gameSessions.put(existingSession);
        }
        if (mounted) {
          setSession(existingSession);
        }
      } catch (err) {
        console.error('Initialization error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const persistSession = async (nextSession: GameSessionState) => {
    setSession(nextSession);
    await db.gameSessions.put(nextSession);
  };

  const recordCurrentPhaseSeen = () => {
    if (!session) return;
    const visitKey = `${session.currentPhase}_${session.currentTurn}`;
    updateCoachState((prev) => ({
      ...prev,
      phaseSeenCount: {
        ...prev.phaseSeenCount,
        [visitKey]: (prev.phaseSeenCount[visitKey] ?? 0) + 1,
      },
    }));
  };

  const handleUpdateSession = (updater: (prev: GameSessionState) => GameSessionState) => {
    if (!session) return;
    const next = updater(session);
    persistSession(next);
  };

  const handleSelectArmyRuleOption = (ruleId: string, optionLabel: string) => {
    if (!session) return;
    const prevSelections = { ...(session.activeArmyRuleSelections ?? {}) };
    if (!optionLabel) {
      delete prevSelections[ruleId];
    } else {
      prevSelections[ruleId] = optionLabel;
    }
    persistSession({
      ...session,
      activeArmyRuleSelections: prevSelections,
      updatedAt: Date.now(),
    });
  };

  const handleUpdateUnitState = (
    instanceId: string,
    updater: (prev: LiveUnitState) => LiveUnitState
  ) => {
    if (!session || !roster) return;
    const unit = roster.units.find((u) => u.instanceId === instanceId);
    const prevUnitState: LiveUnitState = session.unitStates[instanceId] ?? {
      instanceId,
      status: unit?.initialStatus ?? 'on_battlefield',
      remainingModels: unit?.startingModels ?? 1,
      currentModelWounds: unit?.startingWoundsPerModel ?? 1,
      isBattleShocked: false,
      usedOncePerBattleIds: [],
    };
    const updatedUnitState = updater(prevUnitState);
    const nextSession: GameSessionState = {
      ...session,
      unitStates: {
        ...session.unitStates,
        [instanceId]: updatedUnitState,
      },
      updatedAt: Date.now(),
    };
    persistSession(nextSession);
  };

  const handleToggleChecklistItem = (itemId: string) => {
    if (!session) return;
    const currentList = session.completedChecklistIds ?? [];
    const exists = currentList.includes(itemId);
    const nextList = exists
      ? currentList.filter((id) => id !== itemId)
      : [...currentList, itemId];
    persistSession({
      ...session,
      completedChecklistIds: nextList,
      updatedAt: Date.now(),
    });
  };

  const handleResetPhaseActivations = () => {
    if (!session) return;
    const nextUnitStates: GameSessionState['unitStates'] = {};
    for (const [id, st] of Object.entries(session.unitStates)) {
      nextUnitStates[id] = {
        ...st,
        activatedInPhase: false,
      };
    }
    persistSession({
      ...session,
      unitStates: nextUnitStates,
      updatedAt: Date.now(),
    });
  };

  const datasheetsById = useMemo(() => new Map(datasheets.map((d) => [d.id, d])), [datasheets]);
  const enhancementsById = useMemo(
    () => new Map(enhancements.map((e) => [e.id, e])),
    [enhancements]
  );

  const compositeUnits = useMemo(() => {
    if (!roster) return [];
    return buildCompositeUnits(
      roster,
      session ?? undefined,
      datasheetsById,
      enhancementsById,
      stratagems
    );
  }, [roster, session, datasheetsById, enhancementsById, stratagems]);

  const stepSequence = useMemo(
    () => buildGameStepSequence(session?.firstTurnPlayer ?? 'user'),
    [session?.firstTurnPlayer]
  );

  const currentStepIndex = useMemo(() => {
    if (!session) return 0;
    const idx = stepSequence.findIndex(
      (s) =>
        s.battleRound === session.battleRound &&
        s.currentTurn === session.currentTurn &&
        s.currentPhase === session.currentPhase
    );
    return idx >= 0 ? idx : 0;
  }, [stepSequence, session]);

  const prevStep = currentStepIndex > 0 ? stepSequence[currentStepIndex - 1] : undefined;
  const nextStep =
    currentStepIndex < stepSequence.length - 1 ? stepSequence[currentStepIndex + 1] : undefined;

  const handleJumpToPhase = (phase: Phase, turnOverride?: 'your_turn' | 'opponent_turn') => {
    if (!session) return;
    recordCurrentPhaseSeen();
    const targetTurn = turnOverride ?? session.currentTurn;
    const next = transitionGameSessionStep(session, {
      battleRound: session.battleRound,
      currentTurn: targetTurn,
      currentPhase: phase,
      label: PHASE_LABELS[phase],
    });
    persistSession(next);
  };

  const handleAdvanceStep = (targetStep: typeof nextStep) => {
    if (!session || !targetStep) return;
    recordCurrentPhaseSeen();
    persistSession(transitionGameSessionStep(session, targetStep));
  };

  const handleNewGame = () => {
    setIsSetupWizardOpen(true);
  };

  const handleSaveMatchHistory = async (record: MatchHistoryRecord) => {
    await db.matchHistory.put(record);
    const updatedList = await db.matchHistory.orderBy('completedAt').reverse().toArray();
    setMatchHistory(updatedList);
    updateCoachState((prev) => ({
      ...prev,
      gamesFinished: prev.gamesFinished + 1,
    }));
  };

  const handleDeleteMatchHistory = async (id: string) => {
    await db.matchHistory.delete(id);
    const updatedList = await db.matchHistory.orderBy('completedAt').reverse().toArray();
    setMatchHistory(updatedList);
  };

  const handleToggleFirstTurn = () => {
    if (!session) return;
    const nextFirst: 'user' | 'opponent' =
      session.firstTurnPlayer === 'user' ? 'opponent' : 'user';
    const nextTurn: 'your_turn' | 'opponent_turn' =
      nextFirst === 'user' ? 'your_turn' : 'opponent_turn';
    persistSession({
      ...session,
      firstTurnPlayer: nextFirst,
      currentTurn: session.currentPhase === 'pre_game' ? nextTurn : session.currentTurn,
      updatedAt: Date.now(),
    });
  };

  const handleSaveRoster = async (updated: SavedRoster) => {
    if (updated.factionId !== roster?.factionId) {
      await loadFactionStateFromDb(updated.factionId);
    }
    await db.savedRosters.put(updated);
    const rostersList = await db.savedRosters.orderBy('updatedAt').reverse().toArray();
    setAllRosters(rostersList);
    setRoster(updated);

    const currentSess =
      (await db.gameSessions.get(`session_${updated.id}`)) ??
      createInitialGameSession(updated, session?.firstTurnPlayer ?? 'user');
    const syncedUnitStates = { ...currentSess.unitStates };
    for (const u of updated.units) {
      if (!syncedUnitStates[u.instanceId]) {
        syncedUnitStates[u.instanceId] = {
          instanceId: u.instanceId,
          status: u.initialStatus ?? 'on_battlefield',
          remainingModels: u.startingModels || 1,
          currentModelWounds: u.startingWoundsPerModel || 1,
          isBattleShocked: false,
          usedOncePerBattleIds: [],
        };
      }
    }
    const nextSess = { ...currentSess, unitStates: syncedUnitStates, updatedAt: Date.now() };
    await persistSession(nextSess);
  };

  const handleSelectRoster = async (rosterId: string) => {
    const target = await db.savedRosters.get(rosterId);
    if (!target) return;
    await loadFactionStateFromDb(target.factionId);
    setRoster(target);
    let sess = await db.gameSessions.get(`session_${target.id}`);
    if (!sess) {
      sess = createInitialGameSession(target, 'user');
      await db.gameSessions.put(sess);
    }
    setSession(sess);
  };

  const handleDeleteRoster = async (rosterId: string) => {
    await db.savedRosters.delete(rosterId);
    await db.gameSessions.delete(`session_${rosterId}`);
    const remaining = await db.savedRosters.orderBy('updatedAt').reverse().toArray();
    setAllRosters(remaining);
    if (remaining.length > 0) {
      await handleSelectRoster(remaining[0].id);
    }
  };

  const handleUseStratagemOnUnit = (strat: Stratagem, unitInstanceId: string) => {
    if (!session) return;
    const targetState = session.unitStates[unitInstanceId];
    if (targetState?.lockedByStratagemIdInPhase) return;

    const nextSession: GameSessionState = {
      ...session,
      userCp: Math.max(0, session.userCp - strat.cpCost),
      unitStates: unitInstanceId
        ? {
            ...session.unitStates,
            [unitInstanceId]: {
              ...session.unitStates[unitInstanceId],
              lockedByStratagemIdInPhase: strat.id,
            },
          }
        : session.unitStates,
      stratagemLog: [
        {
          id: `log_${Date.now()}`,
          round: session.battleRound,
          turn: session.currentTurn,
          phase: session.currentPhase,
          stratagemId: strat.id,
          unitInstanceId: unitInstanceId || undefined,
          cpSpent: strat.cpCost,
          timestamp: Date.now(),
        },
        ...session.stratagemLog,
      ],
      updatedAt: Date.now(),
    };
    persistSession(nextSession);
  };

  const handleAdjustCp = (player: 'user' | 'opponent', delta: number) => {
    if (!session) return;
    if (player === 'user') {
      persistSession({
        ...session,
        userCp: Math.max(0, session.userCp + delta),
        updatedAt: Date.now(),
      });
    } else {
      persistSession({
        ...session,
        opponentCp: Math.max(0, session.opponentCp + delta),
        updatedAt: Date.now(),
      });
    }
  };

  const handleDownloadAllOffline = async () => {
    setOfflineSyncStatus('Starting download of all 25 factions...');
    try {
      const syncTimestamp = await syncAllFactionsForOffline((done, total, name) => {
        setOfflineSyncStatus(`Caching ${done}/${total}: ${name}...`);
      });
      setLastSyncedAt(syncTimestamp);
      const allDets = await db.detachments.toArray();
      setAllDetachments(allDets);
      setOfflineSyncStatus('✓ All 25 Factions cached in IndexedDB for 100% offline play!');
      setTimeout(() => setOfflineSyncStatus(null), 5000);
    } catch (err: any) {
      setOfflineSyncStatus(`Error caching offline data: ${err?.message}`);
    }
  };

  const handleOpenCoreAction = (actionName: string) => {
    setCoreActionInitialSearch(actionName);
    setIsCoreActionsOpen(true);
  };

  const handleOpenUnitStratagems = (unitInstanceId: string) => {
    setStratDrawerUnitId(unitInstanceId);
    setIsStratDrawerOpen(true);
  };

  if (loading || !roster || !session) {
    return (
      <div className="min-h-screen bg-[#0b0c10] text-slate-200 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-amber-300">
            Loading Lex Tactica — Warhammer 40,000 11th Edition Playbook...
          </p>
        </div>
      </div>
    );
  }

  const currentFaction = factions.find((f) => f.id === roster.factionId);
  const selectedDetachments = detachments.filter((d) => roster.detachmentIds.includes(d.id));
  const detachmentChainText =
    selectedDetachments.length > 0
      ? selectedDetachments.map((d) => d.name).join(' + ')
      : 'No Detachment Selected';

  const statusCounts = {
    on_battlefield: compositeUnits.filter((c) => c.primaryLiveState.status === 'on_battlefield').length,
    reserves: compositeUnits.filter((c) => c.primaryLiveState.status === 'reserves').length,
    embarked: compositeUnits.filter((c) => c.primaryLiveState.status === 'embarked').length,
    destroyed: compositeUnits.filter((c) => c.primaryLiveState.status === 'destroyed').length,
  };

  const displayedComposites = compositeUnits.filter((c) => {
    if (statusFilter === 'all') return true;
    if (session.currentPhase === 'pre_game') return true;
    return c.primaryLiveState.status === statusFilter;
  });

  // Sort Ready Units first, Done/Destroyed Units below
  const readyUnits = displayedComposites.filter(
    (c) => !c.primaryLiveState.activatedInPhase && c.primaryLiveState.status !== 'destroyed'
  );
  const doneOrDestroyedUnits = displayedComposites.filter(
    (c) => Boolean(c.primaryLiveState.activatedInPhase) || c.primaryLiveState.status === 'destroyed'
  );

  // Active Stratagems in this Phase & Turn (using strict turn/text verification)
  const rosterDetSet = new Set(roster.detachmentIds);
  const activePhaseStratagems = stratagems.filter(
    (s) =>
      (s.isCore ||
        (s.factionId === roster.factionId &&
          (rosterDetSet.size === 0 || rosterDetSet.has(s.detachmentId)))) &&
      isStratagemActiveInPhaseAndTurn(s, session.currentPhase, session.currentTurn)
  );

  // Opponent Watchlist Stratagems (evaluated from the opponent's turn perspective!)
  const opponentDetSet = new Set(session.matchSetup?.opponent.detachmentIds ?? []);
  const opponentPerspectiveTurn =
    session.currentTurn === 'your_turn' ? 'opponent_turn' : 'your_turn';
  const opponentSourcePool =
    opponentStratagems.length > 0 ? opponentStratagems : stratagems.filter((s) => s.isCore);
  const opponentWatchlistStratagems = opponentSourcePool.filter(
    (s) =>
      (s.isCore ||
        (opponentFactionId &&
          s.factionId === opponentFactionId &&
          (opponentDetSet.size === 0 || opponentDetSet.has(s.detachmentId)))) &&
      isStratagemActiveInPhaseAndTurn(s, session.currentPhase, opponentPerspectiveTurn)
  );

  const isYourTurn = session.currentTurn === 'your_turn';
  const showExpandedRosterHeader = session.currentPhase === 'pre_game' || rosterBannerExpanded;
  const currentPhaseVisitKey = `${session.currentPhase}_${session.currentTurn}`;
  const hasSeenCurrentPhaseBefore = (coachState.phaseSeenCount[currentPhaseVisitKey] ?? 0) >= 1;

  return (
    <div className="min-h-screen bg-[#0b0c10] text-slate-100 flex flex-col pb-20">
      {/* Top Navigation & Slim Roster Bar */}
      <header className="border-b border-slate-800/80 bg-[#0e1017]/95 z-30 backdrop-blur no-print">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-serif tracking-wider text-sm font-bold text-amber-400">
              <LexTacticaLogo className="w-5 h-5 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
              <span>LEX TACTICA</span>
            </div>
            <span className="text-slate-700">|</span>
            <button
              type="button"
              onClick={() => setRosterBannerExpanded((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:text-amber-300 transition"
              title="Toggle full roster summary"
            >
              <span>{roster.name}</span>
              <span className="text-slate-400 font-normal">
                ({currentFaction?.name || roster.factionId} · {roster.totalPoints} pts)
              </span>
              {showExpandedRosterHeader ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Tactical Coach Toggle Pill & Rogal Dorn Easter Egg */}
            <div className="inline-flex items-center gap-1.5">
              {!isDornDismissed && (
                <button
                  type="button"
                  onClick={handleDornClick}
                  title="Lord Commander Rogal Dorn (Click to dismiss)"
                  aria-label="Lord Commander Rogal Dorn"
                  className={`relative inline-flex items-center justify-center transition-all duration-700 ease-out focus:outline-none ${
                    isDornFading
                      ? 'opacity-0 scale-50 max-w-0 -mr-1.5 pointer-events-none'
                      : 'opacity-100 scale-100 max-w-10 hover:scale-110 active:scale-95 cursor-pointer'
                  }`}
                >
                  <img
                    src={dornImg}
                    alt="Rogal Dorn Coach"
                    className="w-7 h-7 sm:w-8 sm:h-8 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] select-none pointer-events-none"
                    draggable={false}
                  />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSetCoachMode(!coachState.enabled)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                  coachState.enabled
                    ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                }`}
                title="Toggle Tactical Coach guidance (1-line phase prompts, auto-expanded first-visit sequences, and stat underline hints)"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Coach: {coachState.enabled ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsWelcomeOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
              title="How to Play & 11th Edition Guide"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">How It Works</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenEditorTab('setup')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-100 border border-slate-700 transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>Roster & Setup</span>
            </button>

            <button
              type="button"
              onClick={handleNewGame}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
              title="Reset game session to Pre-game"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Game</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
              title="Print Playbook Cheat-Sheet"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Print</span>
            </button>

            {offlineSyncStatus ? (
              <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                {offlineSyncStatus}
              </span>
            ) : (
              <button
                type="button"
                onClick={handleDownloadAllOffline}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800"
                title="Cache all 25 factions in IndexedDB for offline play"
              >
                <DownloadCloud className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden lg:inline">Offline Sync</span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Roster Details Banner (Default open in Pre-Game, collapsed in Rounds 1-5) */}
        {showExpandedRosterHeader && (
          <div className="max-w-5xl mx-auto px-4 pb-3 pt-1 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
            <div className="flex flex-wrap items-center gap-1.5">
              {roster.subFactionName && (
                <>
                  <span className="text-amber-400 font-semibold">{roster.subFactionName}</span>
                  <span>·</span>
                </>
              )}
              <span>{currentFaction?.name || roster.factionId}</span>
              <span>·</span>
              <span className="text-slate-200 font-medium">{detachmentChainText}</span>
              {roster.forceDisposition && (
                <>
                  <span>·</span>
                  <span className="text-amber-200/90">{roster.forceDisposition}</span>
                </>
              )}
              <span>·</span>
              <span>
                Modular DP: {roster.totalDetachmentPoints}/
                {editionRules.battleSizes[roster.battleSize]?.maxDetachmentPoints ?? 3} DP
              </span>
              <span className="text-slate-500">· Data {lastUpdate}</span>
            </div>

            <button
              type="button"
              onClick={handleToggleFirstTurn}
              className="inline-flex items-center gap-2 text-xs text-slate-300 hover:text-white bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 transition"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  session.firstTurnPlayer === 'user' ? 'bg-emerald-400' : 'bg-rose-500'
                }`}
              />
              <span>
                {session.firstTurnPlayer === 'user'
                  ? '1st Turn: You (Click to switch)'
                  : '1st Turn: Opponent (Click to switch)'}
              </span>
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-4 space-y-4">
        {/* =====================================================================
            1. UNIFIED TURN & PHASE COCKPIT (Color-Coded by Turn)
           ===================================================================== */}
        <section
          className={`rounded-xl border-2 p-3.5 shadow-xl space-y-3 transition-colors no-print ${
            session.currentPhase === 'pre_game'
              ? 'bg-[#121620] border-teal-500/60'
              : isYourTurn
              ? 'bg-[#111818] border-emerald-500/60'
              : 'bg-[#1a1116] border-rose-500/60'
          }`}
        >
          {/* Cockpit Row 1: Prev | Active Turn & Phase Banner | Next */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={!prevStep}
              onClick={() => prevStep && handleAdvanceStep(prevStep)}
              className="min-h-[44px] inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-700 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Prev</span>
            </button>

            <div className="flex flex-col items-center text-center flex-1 min-w-[200px]">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {session.currentPhase === 'pre_game' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/40">
                    Pre-Battle Setup & Deployment
                  </span>
                ) : (
                  <>
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-300">
                      Round {session.battleRound}/5
                    </span>
                    <div className="inline-flex rounded-lg p-0.5 bg-slate-950 border border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleJumpToPhase(session.currentPhase, 'your_turn')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition ${
                          isYourTurn
                            ? 'bg-emerald-500 text-slate-950 shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🟢 Your Turn
                      </button>
                      <button
                        type="button"
                        onClick={() => handleJumpToPhase(session.currentPhase, 'opponent_turn')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase transition ${
                          !isYourTurn
                            ? 'bg-rose-600 text-white shadow'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        🛡️ Opponent&apos;s Turn
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-1 flex items-center justify-center gap-2">
                <h1 className="text-xl sm:text-2xl font-serif font-bold uppercase tracking-wider text-white">
                  {PHASE_LABELS[session.currentPhase]}
                </h1>
                {!isYourTurn && session.currentPhase !== 'pre_game' && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-950/90 text-rose-200 border border-rose-700">
                    Reactive Mode
                  </span>
                )}
              </div>

              {/* 1-Line Tactical Coach Phase Objective Prompt */}
              {coachState.enabled && (
                <p className="mt-1 text-xs text-slate-300 max-w-xl">
                  {COACH_PHASE_SUBTITLES[session.currentPhase]?.[session.currentTurn]}
                </p>
              )}
            </div>

            {nextStep ? (
              <button
                type="button"
                onClick={() => handleAdvanceStep(nextStep)}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#eab308] hover:bg-amber-400 text-slate-950 shadow-md transition"
              >
                <span>
                  Next: {PHASE_LABELS[nextStep.currentPhase].replace(' Phase', '')}
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsMatchSummaryOpen(true)}
                className="min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition"
              >
                <Trophy className="w-4 h-4" />
                <span>Finish Match</span>
              </button>
            )}
          </div>

          {/* Cockpit Row 2: Horizontally Scrollable Phase Strip + Pop-Out Stratagems & Core Actions Launchers */}
          <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            {/* Phase Pills (Single-Row Horizontally Scrollable on Mobile) */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
              {(
                [
                  { id: 'pre_game', label: 'Pre-game', icon: MapPin },
                  { id: 'start_of_round', label: 'Start Rnd', icon: Sparkles },
                  { id: 'command', label: 'Command', icon: Crown },
                  { id: 'movement', label: 'Movement', icon: Footprints },
                  { id: 'shooting', label: 'Shooting', icon: Crosshair },
                  { id: 'charge', label: 'Charge', icon: Zap },
                  { id: 'fight', label: 'Fight', icon: Swords },
                  { id: 'end_of_turn', label: 'End Turn', icon: Hourglass },
                  { id: 'end_of_round', label: 'End Rnd', icon: Hourglass },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const isActive = session.currentPhase === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleJumpToPhase(item.id)}
                    className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow'
                        : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Pop-Out Drawers Launchers: Phase Stratagems & Core Actions */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => {
                  setStratDrawerUnitId(null);
                  setIsStratDrawerOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 shadow transition"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Phase Stratagems ({activePhaseStratagems.length})</span>
                {opponentWatchlistStratagems.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-rose-500/30 text-rose-200 text-[10px]">
                    👁️ {opponentWatchlistStratagems.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCoreActionInitialSearch('');
                  setIsCoreActionsOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Core Actions</span>
              </button>
            </div>
          </div>
        </section>

        {/* Prominent Match & Terrain Setup Banner (ONLY in Pre-game if match not yet configured) */}
        {!session.matchSetup && session.currentPhase === 'pre_game' && (
          <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/15 border-2 border-amber-500/50 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shrink-0">
                <Swords className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>11th Edition Board & Match Setup</span>
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-extrabold">
                    Recommended
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  Select opponent, choose Force Dispositions, generate asymmetric missions, and view official Event Companion terrain layouts (A, B, C) with deployment measurements.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSetupWizardOpen(true)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 flex items-center gap-2 shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Launch Board & Mission Setup</span>
            </button>
          </div>
        )}

        {/* Persistent Scoreboard HUD */}
        <ScoreboardHud
          session={session}
          onUpdateSession={handleUpdateSession}
          onOpenSetupWizard={() => setIsSetupWizardOpen(true)}
          onOpenMatchSummary={() => setIsMatchSummaryOpen(true)}
        />

        {/* =====================================================================
            2. WAHAPEDIA PHASE ACTION CHECKLIST & ACTIVE ARMY/DETACHMENT RULES
           ===================================================================== */}
        <PhaseActionChecklist
          currentPhase={session.currentPhase}
          currentTurn={session.currentTurn}
          compositeUnits={compositeUnits}
          selectedDetachments={selectedDetachments}
          coreActions={coreActions}
          completedChecklistIds={session.completedChecklistIds ?? []}
          activeArmyRuleSelections={session.activeArmyRuleSelections}
          coachEnabled={coachState.enabled}
          hasSeenPhaseBefore={hasSeenCurrentPhaseBefore}
          onToggleChecklistItem={handleToggleChecklistItem}
          onUpdateUnitState={handleUpdateUnitState}
          onOpenCoreAction={handleOpenCoreAction}
          onSelectArmyRuleOption={handleSelectArmyRuleOption}
        />

        {/* =====================================================================
            3. ACTION-FIRST UNIT WORKSPACE (Ready Units vs. Done Units)
           ===================================================================== */}
        <section className="space-y-3">
          {/* Unit Filter & View Mode Toolbar */}
          <div className="rounded-xl bg-[#14161f] border border-slate-800/90 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 no-print">
            {/* Filter Tabs with Live Counts */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'on_battlefield', label: `🟢 Battlefield (${statusCounts.on_battlefield})` },
                  { id: 'reserves', label: `📦 Reserves (${statusCounts.reserves})` },
                  { id: 'embarked', label: `🚐 Embarked (${statusCounts.embarked})` },
                  { id: 'destroyed', label: `💀 Destroyed (${statusCounts.destroyed})` },
                  { id: 'all', label: `All (${compositeUnits.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg border transition ${
                    statusFilter === tab.id
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Right Controls: Activation Progress + Compact All Toggle + Quick Status Grid */}
            <div className="flex flex-wrap items-center gap-2">
              {doneOrDestroyedUnits.some((u) => u.primaryLiveState.activatedInPhase) && (
                <button
                  type="button"
                  onClick={handleResetPhaseActivations}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 transition"
                  title="Mark all units Ready again for this phase"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Done</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setForceCompactCards((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                  forceCompactCards
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                    : 'bg-indigo-500/20 border-indigo-400 text-indigo-200'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>{forceCompactCards ? 'Expand Ready Units' : 'Collapse All Units'}</span>
              </button>

              <button
                type="button"
                onClick={() => setUnitsAccordionOpen((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
              >
                <span>Batch Status</span>
                {unitsAccordionOpen ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Collapsible Batch Unit Status Switcher */}
          {unitsAccordionOpen && (
            <div className="p-3 rounded-xl bg-[#14161f] border border-slate-800/90 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 no-print">
              {compositeUnits.map((c) => (
                <div
                  key={c.primaryUnit.instanceId}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                >
                  <span className="font-medium text-slate-200 truncate">{c.displayName}</span>
                  <select
                    value={c.primaryLiveState.status}
                    onChange={(e) =>
                      handleUpdateUnitState(c.primaryUnit.instanceId, (prev) => ({
                        ...prev,
                        status: e.target.value as UnitBattlefieldStatus,
                      }))
                    }
                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-200"
                  >
                    <option value="on_battlefield">Battlefield</option>
                    <option value="reserves">Reserves</option>
                    <option value="embarked">Embarked</option>
                    <option value="destroyed">Destroyed</option>
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Ready to Act Units */}
          {readyUnits.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Ready in {PHASE_LABELS[session.currentPhase]} ({readyUnits.length})
                </span>
                <span className="text-[11px] text-slate-400 no-print">
                  Tap any unit to expand • Tap &quot;Mark Done&quot; once finished
                </span>
              </div>
              {readyUnits.map((comp) => (
                <CompositeUnitCard
                  key={comp.primaryUnit.instanceId}
                  composite={comp}
                  currentPhase={session.currentPhase}
                  currentTurn={session.currentTurn}
                  phaseStratagems={activePhaseStratagems}
                  userCp={session.userCp}
                  forceCompact={forceCompactCards}
                  coachEnabled={coachState.enabled}
                  activeArmyRuleSelections={session.activeArmyRuleSelections}
                  onUpdateUnitState={handleUpdateUnitState}
                  onUseStratagemOnUnit={handleUseStratagemOnUnit}
                  onOpenUnitStratagems={handleOpenUnitStratagems}
                />
              ))}
            </div>
          )}

          {/* Completed / Activated or Destroyed Units (Auto-Collapsed 1-Line Rows) */}
          {doneOrDestroyedUnits.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Completed This Phase / Inactive ({doneOrDestroyedUnits.length})
                </span>
              </div>
              {doneOrDestroyedUnits.map((comp) => (
                <CompositeUnitCard
                  key={comp.primaryUnit.instanceId}
                  composite={comp}
                  currentPhase={session.currentPhase}
                  currentTurn={session.currentTurn}
                  phaseStratagems={activePhaseStratagems}
                  userCp={session.userCp}
                  forceCompact={forceCompactCards}
                  coachEnabled={coachState.enabled}
                  activeArmyRuleSelections={session.activeArmyRuleSelections}
                  onUpdateUnitState={handleUpdateUnitState}
                  onUseStratagemOnUnit={handleUseStratagemOnUnit}
                  onOpenUnitStratagems={handleOpenUnitStratagems}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Footer Attribution & Fan-Use Disclaimer */}
      <footer className="border-t border-slate-900 bg-[#08090d] py-4 px-4 text-center text-[11px] text-slate-500 no-print space-y-1">
        <div>
          Lex Tactica — Unofficial fan-made Warhammer 40,000 11th Edition Playbook PWA. Powered by Wahapedia.
        </div>
        <div className="text-slate-400">
          Wahapedia Rules Version: {lastUpdate}
          {lastSyncedAt && (
            <span className="ml-1">
              · Offline Cache: {new Date(lastSyncedAt).toLocaleDateString()} {new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div>Not affiliated with or endorsed by Games Workshop.</div>
      </footer>

      {/* =====================================================================
          STICKY BOTTOM THUMB-BAR (One-Handed Standing Tabletop Ergonomics)
         ===================================================================== */}
      <nav
        aria-label="Tabletop Quick Controls"
        className="fixed bottom-0 inset-x-0 z-40 bg-[#0b0c10]/95 backdrop-blur-md border-t border-slate-800 px-2 sm:px-4 py-1.5 no-print shadow-[0_-8px_24px_rgba(0,0,0,0.6)]"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
          {/* 1. Prev Phase */}
          <button
            type="button"
            disabled={!prevStep}
            onClick={() => prevStep && handleAdvanceStep(prevStep)}
            className="min-w-[44px] min-h-[44px] px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-700 inline-flex items-center justify-center gap-1 text-xs font-bold transition"
            title="Previous Phase"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          {/* 2. Quick CP Stepper */}
          <div className="inline-flex items-center rounded-xl bg-slate-900 border border-slate-700 p-0.5">
            <button
              type="button"
              onClick={() => handleAdjustCp('user', -1)}
              className="min-w-[38px] sm:min-w-[44px] min-h-[40px] rounded-lg hover:bg-slate-800 text-slate-300 flex items-center justify-center transition"
              title="Spend 1 CP"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <div className="px-2 text-center">
              <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                Your CP
              </div>
              <div className="text-sm font-black text-amber-400 leading-tight">
                {session.userCp}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleAdjustCp('user', 1)}
              className="min-w-[38px] sm:min-w-[44px] min-h-[40px] rounded-lg hover:bg-slate-800 text-slate-300 flex items-center justify-center transition"
              title="Gain 1 CP"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* 3. Phase Stratagems + Opponent Watchlist Drawer */}
          <button
            type="button"
            onClick={() => {
              setStratDrawerUnitId(null);
              setIsStratDrawerOpen(true);
            }}
            className="min-h-[44px] px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 inline-flex items-center justify-center gap-1.5 text-xs font-bold transition"
          >
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Strats ({activePhaseStratagems.length})</span>
            {opponentWatchlistStratagems.length > 0 && (
              <span className="hidden md:inline px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-200 text-[10px]">
                👁️ {opponentWatchlistStratagems.length}
              </span>
            )}
          </button>

          {/* 4. Core Actions Drawer */}
          <button
            type="button"
            onClick={() => {
              setCoreActionInitialSearch('');
              setIsCoreActionsOpen(true);
            }}
            className="min-w-[44px] min-h-[44px] px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 inline-flex items-center justify-center gap-1.5 text-xs font-semibold transition"
            title="11th Edition Core Actions Reference"
          >
            <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Rules</span>
          </button>

          {/* 5. Next Phase / Finish Match */}
          {nextStep ? (
            <button
              type="button"
              onClick={() => handleAdvanceStep(nextStep)}
              className="min-h-[44px] px-3.5 rounded-xl bg-[#eab308] hover:bg-amber-400 text-slate-950 font-extrabold text-xs inline-flex items-center justify-center gap-1 shadow-md transition"
            >
              <span className="truncate max-w-[110px] sm:max-w-none">
                Next: {PHASE_LABELS[nextStep.currentPhase].replace(' Phase', '')}
              </span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsMatchSummaryOpen(true)}
              className="min-h-[44px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs inline-flex items-center justify-center gap-1.5 shadow-md transition"
            >
              <Trophy className="w-4 h-4 shrink-0" />
              <span>Finish Match</span>
            </button>
          )}
        </div>
      </nav>

      {/* Pop-Out Drawers & Modals */}
      <PhaseStratagemsDrawer
        isOpen={isStratDrawerOpen}
        onClose={() => setIsStratDrawerOpen(false)}
        currentPhase={session.currentPhase}
        currentTurn={session.currentTurn}
        userCp={session.userCp}
        opponentCp={session.opponentCp}
        phaseStratagems={activePhaseStratagems}
        opponentWatchlistStratagems={opponentWatchlistStratagems}
        compositeUnits={compositeUnits}
        filterUnitInstanceId={stratDrawerUnitId}
        onSelectUnitFilter={setStratDrawerUnitId}
        onUseStratagemOnUnit={handleUseStratagemOnUnit}
        onAdjustCp={handleAdjustCp}
      />

      <CoreActionsDrawer
        isOpen={isCoreActionsOpen}
        onClose={() => setIsCoreActionsOpen(false)}
        coreActions={coreActions}
        currentPhase={session.currentPhase}
        initialSearch={coreActionInitialSearch}
      />

      <RosterEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        initialTab={editorInitialTab}
        roster={roster}
        allRosters={allRosters}
        factions={factions}
        datasheets={datasheets}
        detachments={detachments}
        enhancements={enhancements}
        matchHistory={matchHistory}
        onSaveRoster={handleSaveRoster}
        onSelectRoster={handleSelectRoster}
        onDeleteRoster={handleDeleteRoster}
        onChangeFaction={loadFactionStateFromDb}
        onDeleteMatchHistory={handleDeleteMatchHistory}
      />

      {isSetupWizardOpen && (
        <GameSetupWizardModal
          currentRoster={roster}
          allRosters={allRosters}
          factions={factions}
          allDetachments={allDetachments.length > 0 ? allDetachments : detachments}
          onStartGame={async (newSession) => {
            await persistSession(newSession);
            setIsSetupWizardOpen(false);
          }}
          onClose={() => setIsSetupWizardOpen(false)}
        />
      )}

      <MatchSummaryModal
        isOpen={isMatchSummaryOpen}
        onClose={() => setIsMatchSummaryOpen(false)}
        session={session}
        roster={roster}
        currentFaction={currentFaction}
        selectedDetachments={selectedDetachments}
        compositeUnits={compositeUnits}
        stratagems={stratagems}
        onSaveMatchHistory={handleSaveMatchHistory}
        onStartNewMatch={() => {
          setIsMatchSummaryOpen(false);
          handleNewGame();
        }}
      />

      <WelcomeModal
        isOpen={isWelcomeOpen}
        onClose={() => setIsWelcomeOpen(false)}
        onOpenImport={() => handleOpenEditorTab('import')}
        onOpenSetup={() => handleOpenEditorTab('setup')}
        onOpenRosters={() => handleOpenEditorTab('rosters')}
        onSelectCoachPreference={handleSetCoachMode}
      />
    </div>
  );
};

export default App;
