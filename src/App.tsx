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
} from 'lucide-react';
import editionRules from './config/editionRules.json';
import {
  db,
  ensureCoreDataSynced,
  ensureFactionDataSynced,
  ensureStarterRosterSeeded,
  syncAllFactionsForOffline,
} from './db/lexTacticaDb';
import { buildCompositeUnits, isActiveInPhaseAndTurn } from './engine/compositeUnitBuilder';
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
import { WelcomeModal } from './components/WelcomeModal';
import { GameSetupWizardModal } from './components/GameSetupWizardModal';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [factions, setFactions] = useState<Faction[]>([]);
  const [allRosters, setAllRosters] = useState<SavedRoster[]>([]);
  const [roster, setRoster] = useState<SavedRoster | null>(null);
  const [session, setSession] = useState<GameSessionState | null>(null);

  const [datasheets, setDatasheets] = useState<Datasheet[]>([]);
  const [detachments, setDetachments] = useState<Detachment[]>([]);
  const [enhancements, setEnhancements] = useState<Enhancement[]>([]);
  const [stratagems, setStratagems] = useState<Stratagem[]>([]);
  const [coreActions, setCoreActions] = useState<CoreAction[]>([]);

  const [rosterBannerExpanded, setRosterBannerExpanded] = useState(false);
  const [unitsAccordionOpen, setUnitsAccordionOpen] = useState(false);
  const [forceCompactCards, setForceCompactCards] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | UnitBattlefieldStatus>('on_battlefield');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorInitialTab, setEditorInitialTab] = useState<'setup' | 'import' | 'rosters'>('setup');
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

  const handleOpenEditorTab = (tab: 'setup' | 'import' | 'rosters') => {
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const coreInfo = await ensureCoreDataSynced();
        if (!mounted) return;
        setLastUpdate(coreInfo.lastUpdate.split(' ')[0] || coreInfo.lastUpdate);
        setFactions(coreInfo.factions);

        const activeRoster = await ensureStarterRosterSeeded();
        const rostersList = await db.savedRosters.orderBy('updatedAt').reverse().toArray();
        if (!mounted) return;
        setAllRosters(rostersList);
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

  const handleUpdateSession = (updater: (prev: GameSessionState) => GameSessionState) => {
    if (!session) return;
    const next = updater(session);
    persistSession(next);
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
    const targetTurn = turnOverride ?? session.currentTurn;
    const next = transitionGameSessionStep(session, {
      battleRound: session.battleRound,
      currentTurn: targetTurn,
      currentPhase: phase,
      label: PHASE_LABELS[phase],
    });
    persistSession(next);
  };

  const handleNewGame = () => {
    setIsSetupWizardOpen(true);
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

  const handleDownloadAllOffline = async () => {
    setOfflineSyncStatus('Starting download of all 25 factions...');
    try {
      await syncAllFactionsForOffline((done, total, name) => {
        setOfflineSyncStatus(`Caching ${done}/${total}: ${name}...`);
      });
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

  // Active Stratagems in this Phase & Turn
  const rosterDetSet = new Set(roster.detachmentIds);
  const activePhaseStratagems = stratagems.filter(
    (s) =>
      (s.isCore ||
        (s.factionId === roster.factionId &&
          (rosterDetSet.size === 0 || rosterDetSet.has(s.detachmentId)))) &&
      isActiveInPhaseAndTurn(s.phases, s.timing, session.currentPhase, session.currentTurn)
  );

  const isYourTurn = session.currentTurn === 'your_turn';
  const showExpandedRosterHeader = session.currentPhase === 'pre_game' || rosterBannerExpanded;

  return (
    <div className="min-h-screen bg-[#0b0c10] text-slate-100 flex flex-col">
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
              onClick={() => prevStep && persistSession(transitionGameSessionStep(session, prevStep))}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-200 border border-slate-700 transition"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Prev</span>
            </button>

            <div className="flex flex-col items-center text-center">
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
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase transition ${
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
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase transition ${
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

              <div className="mt-1 flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-serif font-bold uppercase tracking-wider text-white">
                  {PHASE_LABELS[session.currentPhase]}
                </h1>
                {!isYourTurn && session.currentPhase !== 'pre_game' && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-950/90 text-rose-200 border border-rose-700">
                    Reactive Mode
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={!nextStep}
              onClick={() => nextStep && persistSession(transitionGameSessionStep(session, nextStep))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#eab308] hover:bg-amber-400 disabled:opacity-40 text-slate-950 shadow-md transition"
            >
              <span>
                Next: {nextStep ? PHASE_LABELS[nextStep.currentPhase].replace(' Phase', '') : 'End'}
              </span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Cockpit Row 2: Single Phase Strip + Pop-Out Stratagems & Core Actions Launchers */}
          <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            {/* Phase Pills */}
            <div className="flex flex-wrap items-center gap-1">
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
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

        {/* Prominent Match & Terrain Setup Banner (if match not yet configured) */}
        {!session.matchSetup && (
          <div className="bg-gradient-to-r from-amber-500/15 via-slate-900 to-amber-500/15 border-2 border-amber-500/50 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4 animate-pulse-subtle">
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
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 flex items-center gap-2 shrink-0"
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
          onToggleChecklistItem={handleToggleChecklistItem}
          onUpdateUnitState={handleUpdateUnitState}
          onOpenCoreAction={handleOpenCoreAction}
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
                  className={`px-2.5 py-1 rounded-lg border transition ${
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
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 transition"
                  title="Mark all units Ready again for this phase"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Done</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setForceCompactCards((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
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
      <footer className="border-t border-slate-900 bg-[#08090d] py-4 px-4 text-center text-[11px] text-slate-500 no-print">
        Lex Tactica — Unofficial fan-made Warhammer 40,000 11th Edition Playbook PWA. Powered by
        Wahapedia data export ({lastUpdate}). Not affiliated with or endorsed by Games Workshop.
      </footer>

      {/* Pop-Out Drawers & Modals */}
      <PhaseStratagemsDrawer
        isOpen={isStratDrawerOpen}
        onClose={() => setIsStratDrawerOpen(false)}
        currentPhase={session.currentPhase}
        currentTurn={session.currentTurn}
        userCp={session.userCp}
        phaseStratagems={activePhaseStratagems}
        compositeUnits={compositeUnits}
        filterUnitInstanceId={stratDrawerUnitId}
        onSelectUnitFilter={setStratDrawerUnitId}
        onUseStratagemOnUnit={handleUseStratagemOnUnit}
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
        onSaveRoster={handleSaveRoster}
        onSelectRoster={handleSelectRoster}
        onDeleteRoster={handleDeleteRoster}
        onChangeFaction={loadFactionStateFromDb}
      />

      {isSetupWizardOpen && (
        <GameSetupWizardModal
          currentRoster={roster}
          allRosters={allRosters}
          factions={factions}
          allDetachments={detachments}
          onStartGame={async (newSession) => {
            await persistSession(newSession);
            setIsSetupWizardOpen(false);
          }}
          onClose={() => setIsSetupWizardOpen(false)}
        />
      )}

      <WelcomeModal
        isOpen={isWelcomeOpen}
        onClose={() => setIsWelcomeOpen(false)}
        onOpenImport={() => handleOpenEditorTab('import')}
        onOpenSetup={() => handleOpenEditorTab('setup')}
        onOpenRosters={() => handleOpenEditorTab('rosters')}
      />
    </div>
  );
};

export default App;
