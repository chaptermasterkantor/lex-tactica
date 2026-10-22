import type { GameSessionState, Phase, SavedRoster } from '../types/rules';

export const TURN_SCOPED_PHASES: Phase[] = [
  'command',
  'movement',
  'shooting',
  'charge',
  'fight',
  'end_of_turn',
];

export const PHASE_LABELS: Record<Phase, string> = {
  pre_game: 'Pre-game',
  start_of_round: 'Start of Battle Round',
  command: 'Command Phase',
  movement: 'Movement Phase',
  shooting: 'Shooting Phase',
  charge: 'Charge Phase',
  fight: 'Fight Phase',
  end_of_turn: 'End of Turn',
  end_of_round: 'End of Battle Round',
  any: 'Any Phase',
};

export interface StepDescriptor {
  battleRound: number;
  currentTurn: 'your_turn' | 'opponent_turn';
  currentPhase: Phase;
  label: string;
}

/**
 * Builds the complete linear sequence of steps for a 5-round Warhammer 40k 11th Edition game,
 * respecting whether the user or opponent has the first turn.
 */
export function buildGameStepSequence(firstTurnPlayer: 'user' | 'opponent'): StepDescriptor[] {
  const firstTurn: 'your_turn' | 'opponent_turn' =
    firstTurnPlayer === 'user' ? 'your_turn' : 'opponent_turn';
  const secondTurn: 'your_turn' | 'opponent_turn' =
    firstTurnPlayer === 'user' ? 'opponent_turn' : 'your_turn';

  const steps: StepDescriptor[] = [
    {
      battleRound: 1,
      currentTurn: firstTurn,
      currentPhase: 'pre_game',
      label: 'Pre-game',
    },
  ];

  for (let round = 1; round <= 5; round++) {
    steps.push({
      battleRound: round,
      currentTurn: firstTurn,
      currentPhase: 'start_of_round',
      label: `Round ${round} · Start of Round`,
    });

    for (const phase of TURN_SCOPED_PHASES) {
      steps.push({
        battleRound: round,
        currentTurn: firstTurn,
        currentPhase: phase,
        label: PHASE_LABELS[phase],
      });
    }

    for (const phase of TURN_SCOPED_PHASES) {
      steps.push({
        battleRound: round,
        currentTurn: secondTurn,
        currentPhase: phase,
        label: PHASE_LABELS[phase],
      });
    }

    steps.push({
      battleRound: round,
      currentTurn: secondTurn,
      currentPhase: 'end_of_round',
      label: `Round ${round} · End of Round`,
    });
  }

  return steps;
}

export function createInitialGameSession(
  roster: SavedRoster,
  firstTurnPlayer: 'user' | 'opponent' = 'user'
): GameSessionState {
  const unitStates: GameSessionState['unitStates'] = {};
  for (const unit of roster.units) {
    unitStates[unit.instanceId] = {
      instanceId: unit.instanceId,
      status: unit.initialStatus ?? 'on_battlefield',
      remainingModels: unit.startingModels || 1,
      currentModelWounds: unit.startingWoundsPerModel || 1,
      isBattleShocked: false,
      usedOncePerBattleIds: [],
    };
  }

  const scoresByRound: GameSessionState['scoresByRound'] = {};
  for (let r = 1; r <= 5; r++) {
    scoresByRound[r] = {
      round: r,
      userPrimaryVp: 0,
      userSecondaryVp: 0,
      opponentPrimaryVp: 0,
      opponentSecondaryVp: 0,
    };
  }

  return {
    id: `session_${roster.id}`,
    rosterId: roster.id,
    battleRound: 1,
    currentTurn: firstTurnPlayer === 'user' ? 'your_turn' : 'opponent_turn',
    currentPhase: 'pre_game',
    firstTurnPlayer,
    userCp: 0,
    opponentCp: 0,
    scoresByRound,
    unitStates,
    stratagemLog: [],
    updatedAt: Date.now(),
  };
}

/**
 * Transitions the game session to a new step, automatically clearing phase-scoped
 * Stratagem locks (`lockedByStratagemIdInPhase`), resetting Battle-shock at the start
 * of the player's Command phase, and awarding +1 CP per player at the start of each Command phase.
 */
export function transitionGameSessionStep(
  state: GameSessionState,
  targetStep: StepDescriptor
): GameSessionState {
  const updatedUnitStates: GameSessionState['unitStates'] = {};

  for (const [instanceId, uState] of Object.entries(state.unitStates)) {
    const clearBattleShock =
      targetStep.currentPhase === 'command' && targetStep.currentTurn === 'your_turn'
        ? false
        : uState.isBattleShocked;

    updatedUnitStates[instanceId] = {
      ...uState,
      isBattleShocked: clearBattleShock,
      // Always clear 1-Stratagem-per-phase unit lock and phase activation status when changing phase/step
      lockedByStratagemIdInPhase: undefined,
      activatedInPhase: false,
    };
  }

  // Auto-increment +1 CP to both players when advancing forward into a Command Phase,
  // OR when jumping directly out of pre_game into a Round 1 post-Command phase with 0 CP and no spent stratagems
  let userCp = state.userCp;
  let opponentCp = state.opponentCp;
  const isEnteringNewCommandPhase =
    targetStep.currentPhase === 'command' &&
    (state.currentPhase !== 'command' ||
      state.currentTurn !== targetStep.currentTurn ||
      state.battleRound !== targetStep.battleRound);

  const isNonLinearJumpFromPreGameIntoRound1 =
    state.currentPhase === 'pre_game' &&
    targetStep.battleRound === 1 &&
    targetStep.currentPhase !== 'pre_game' &&
    targetStep.currentPhase !== 'start_of_round' &&
    targetStep.currentPhase !== 'command' &&
    state.userCp === 0 &&
    state.opponentCp === 0 &&
    state.stratagemLog.length === 0;

  if (
    (isEnteringNewCommandPhase && targetStep.battleRound >= state.battleRound) ||
    isNonLinearJumpFromPreGameIntoRound1
  ) {
    userCp += 1;
    opponentCp += 1;
  }

  // Clear round-scoped Army Rule selections when entering Your Turn's Command phase of a new round
  const shouldClearArmyRuleSelections =
    targetStep.currentPhase === 'pre_game' ||
    (targetStep.currentPhase === 'command' &&
      targetStep.currentTurn === 'your_turn' &&
      state.currentPhase !== 'command');

  return {
    ...state,
    battleRound: targetStep.battleRound,
    currentTurn: targetStep.currentTurn,
    currentPhase: targetStep.currentPhase,
    userCp,
    opponentCp,
    unitStates: updatedUnitStates,
    completedChecklistIds: [],
    activeArmyRuleSelections: shouldClearArmyRuleSelections
      ? {}
      : state.activeArmyRuleSelections,
    updatedAt: Date.now(),
  };
}
