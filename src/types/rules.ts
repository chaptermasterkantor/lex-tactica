export type Phase =
  | 'pre_game'
  | 'start_of_round'
  | 'command'
  | 'movement'
  | 'shooting'
  | 'charge'
  | 'fight'
  | 'end_of_turn'
  | 'end_of_round'
  | 'any';

export type TurnTiming = 'your_turn' | 'opponent_turn' | 'either';

export type ForceDisposition =
  | 'Disruption'
  | 'Purge the Foe'
  | 'Take and Hold'
  | 'Priority Assets'
  | 'Reconnaissance';

export type AbilityCategory =
  | 'Core'
  | 'Faction'
  | 'Datasheet'
  | 'Psychic'
  | 'Wargear'
  | 'Fortification'
  | 'Primarch'
  | 'Special'
  | 'Wargear profile';

export type UnitBattlefieldStatus =
  | 'on_battlefield'
  | 'reserves'
  | 'embarked'
  | 'destroyed';

export type BattleSize = 'incursion' | 'strike_force' | 'onslaught';

export interface KeywordDefinition {
  keyword: string;
  category: 'unit' | 'weapon' | 'core_rule' | 'faction_rule';
  name: string;
  summary: string;
  description: string;
  hasParameter?: boolean;
}

export interface Faction {
  id: string;
  name: string;
  link: string;
}

export interface RulesSource {
  id: string;
  name: string;
  type: string;
  edition: string;
  version: string;
  errataDate: string;
  errataLink: string;
}

export interface DetachmentAbility {
  id: string;
  factionId: string;
  detachmentId: string;
  detachmentName: string;
  name: string;
  legend: string;
  description: string;
  phases: Phase[];
  timing: TurnTiming;
}

export interface Detachment {
  id: string;
  factionId: string;
  name: string;
  legend: string;
  type: string;
  dp: number;
  forceDisposition?: ForceDisposition;
  abilities: DetachmentAbility[];
}

export interface ModelStatProfile {
  line: number;
  name: string;
  M: string;
  T: number;
  Sv: string;
  invSv?: string;
  invSvDescr?: string;
  W: number;
  Ld: string;
  OC: number;
  baseSize?: string;
  baseSizeDescr?: string;
}

export interface WeaponProfile {
  id: string;
  line: number;
  lineInWargear: number;
  dice?: string;
  name: string;
  description: string;
  keywords: string[];
  range: string;
  type: 'Ranged' | 'Melee';
  A: string;
  BS_WS: string;
  S: string;
  AP: string;
  D: string;
  isOneShot?: boolean;
}

export interface Ability {
  id: string;
  abilityId?: string;
  line: number;
  model?: string;
  name: string;
  description: string;
  type: AbilityCategory;
  parameter?: string;
  phases: Phase[];
  timing: TurnTiming;
  isLeaderBuff: boolean;
  isSupportBuff: boolean;
  isAura?: boolean;
  isOncePerBattle?: boolean;
  isDefensiveOrReactive?: boolean;
}

export interface CostTier {
  tierGroup: 'standard' | '1st' | '2nd+' | '1st_to_2nd' | '3rd+' | '1st_to_3rd' | '4th+';
  tierLabel: string;
  line: number;
  description: string;
  modelsCount?: number;
  cost: number;
}

export interface WargearCostOption {
  line: number;
  description: string;
  cost: number;
}

export interface Datasheet {
  id: string;
  name: string;
  factionId: string;
  sourceId: string;
  legend: string;
  role: string;
  loadout: string;
  transport: string;
  virtual: boolean;
  isSupport: boolean;
  leaderHead: string;
  leaderFooter: string;
  damagedW?: string;
  damagedThreshold?: number;
  damagedDescription?: string;
  link: string;
  slug: string;
  models: ModelStatProfile[];
  rangedWeapons: WeaponProfile[];
  meleeWeapons: WeaponProfile[];
  abilities: Ability[];
  coreAbilities: string[];
  factionAbilities: string[];
  keywords: string[];
  factionKeywords: string[];
  unitComposition: string[];
  wargearOptions: string[];
  costTiers: CostTier[];
  wargearCosts: WargearCostOption[];
  canLeadDatasheetIds: string[];
  validStratagemIds: string[];
  validEnhancementIds: string[];
  validDetachmentAbilityIds: string[];
}

export interface Stratagem {
  id: string;
  factionId: string;
  name: string;
  type: string;
  category: 'Battle Tactic' | 'Strategic Ploy' | 'Epic Deed' | 'Wargear' | 'Other';
  isCore: boolean;
  cpCost: number;
  legend: string;
  rawTurn: string;
  timing: TurnTiming;
  rawPhase: string;
  phases: Phase[];
  detachment: string;
  detachmentId: string;
  description: string;
  whenText: string;
  targetText: string;
  effectText: string;
}

export interface CoreAction {
  id: string;
  name: string;
  type: 'Movement Ability' | 'Shooting Ability';
  rawPhase: 'Ability "Move"' | 'Ability "Shoot"' | 'Ability "Fight"';
  phases: Phase[];
  description: string;
}

export interface SupportLeaderOverride {
  roleOverride: 'leader' | 'support';
  rawHtml: string;
  targetDatasheetSlugs: string[];
  targetDatasheetIds: string[];
}

export interface Enhancement {
  id: string;
  factionId: string;
  name: string;
  cost: number;
  detachment: string;
  detachmentId: string;
  isUnitUpgrade: boolean;
  legend: string;
  description: string;
  phases: Phase[];
  timing: TurnTiming;
  supportLeaderOverride?: SupportLeaderOverride;
}

export interface RosterUnit {
  instanceId: string;
  datasheetId: string;
  customName?: string;
  startingModels: number;
  startingWoundsPerModel: number;
  points: number;
  equippedWeaponIds?: string[];
  equippedWeaponCounts?: Record<string, number>;
  enhancementIds: string[];
  attachedLeaderInstanceId?: string;
  attachedSupportInstanceId?: string;
  initialStatus?: UnitBattlefieldStatus;
  notes?: string;
}

export interface SavedRoster {
  id: string;
  name: string;
  factionId: string;
  subFactionName?: string;
  battleSize: BattleSize;
  detachmentIds: string[];
  forceDisposition?: ForceDisposition;
  totalPoints: number;
  totalDetachmentPoints: number;
  units: RosterUnit[];
  updatedAt: number;
}

export interface LiveUnitState {
  instanceId: string;
  status: UnitBattlefieldStatus;
  remainingModels: number;
  currentModelWounds: number;
  isBattleShocked: boolean;
  isDetachedFromBodyguard?: boolean;
  usedOncePerBattleIds: string[];
  lockedByStratagemIdInPhase?: string;
  activatedInPhase?: boolean;
}

export interface RoundScore {
  round: number;
  userPrimaryVp: number;
  userSecondaryVp: number;
  opponentPrimaryVp: number;
  opponentSecondaryVp: number;
}

export interface MissionScoreItem {
  vp: string | number;
  text: string;
  counter?: boolean;
  maxFromItem?: number;
}

export interface MissionScoreGroup {
  when: string;
  items: MissionScoreItem[];
}

export interface PrimaryMissionDefinition {
  mission: string;
  setup?: string;
  action?: string;
  score: MissionScoreGroup[];
}

export interface SecondaryScoreGroup {
  mode: 'Fixed' | 'Tactical';
  when: string;
  items: MissionScoreItem[];
}

export interface SecondaryCard {
  name: string;
  type: 'Fixed / Tactical' | 'Tactical';
  whenDrawn?: string;
  score: SecondaryScoreGroup[];
}

export interface MapLayoutDescriptor {
  page: number;
  layout: 'A' | 'B' | 'C';
  attacker: {
    disposition: ForceDisposition;
    mission: string;
  };
  defender: {
    disposition: ForceDisposition;
    mission: string;
  };
  file: string;
  image: string;
}

export interface MatchOpponentConfig {
  name: string;
  factionId: string;
  factionName: string;
  detachmentIds: string[];
  detachmentNames: string[];
  forceDisposition: ForceDisposition;
  notes?: string;
}

export interface SecondaryDeckState {
  mode: 'tactical' | 'fixed';
  fixedCards: string[];
  activeCards: string[];
  discardedCards: string[];
}

export interface MatchSetupConfig {
  yourDisposition: ForceDisposition;
  opponent: MatchOpponentConfig;
  yourMission: PrimaryMissionDefinition;
  opponentMission: PrimaryMissionDefinition;
  mapLayout: 'A' | 'B' | 'C';
  mapDescriptor?: MapLayoutDescriptor;
  battleReadyUser: boolean;
  battleReadyOpponent: boolean;
  userRole: 'attacker' | 'defender';
  userSecondaries: SecondaryDeckState;
  opponentSecondaries: SecondaryDeckState;
  concededPlayer?: 'user' | 'opponent' | null;
}

export interface GameSessionState {
  id: string;
  rosterId: string;
  battleRound: number;
  currentTurn: 'your_turn' | 'opponent_turn';
  currentPhase: Phase;
  firstTurnPlayer: 'user' | 'opponent';
  userCp: number;
  opponentCp: number;
  scoresByRound: Record<number, RoundScore>;
  unitStates: Record<string, LiveUnitState>;
  matchSetup?: MatchSetupConfig;
  activeMissionScores?: Record<string, boolean | number>;
  completedChecklistIds?: string[];
  activeArmyRuleSelections?: Record<string, string>;
  stratagemLog: Array<{
    id: string;
    round: number;
    turn: 'your_turn' | 'opponent_turn';
    phase: Phase;
    stratagemId: string;
    unitInstanceId?: string;
    cpSpent: number;
    timestamp: number;
  }>;
  updatedAt: number;
}

export interface MatchHistoryRecord {
  id: string;
  completedAt: number;
  rosterId: string;
  rosterName: string;
  userFactionId: string;
  userFactionName: string;
  userDetachments: string[];
  userDisposition?: ForceDisposition;
  opponentName: string;
  opponentFactionId: string;
  opponentFactionName: string;
  opponentDetachments: string[];
  opponentDisposition?: ForceDisposition;
  mapLayout?: string;
  roundsPlayed: number;
  userTotalVp: number;
  userPrimaryVp: number;
  userSecondaryVp: number;
  opponentTotalVp: number;
  opponentPrimaryVp: number;
  opponentSecondaryVp: number;
  result: 'victory' | 'defeat' | 'draw';
  totalCpSpent: number;
  survivingUnitsCount: number;
  totalUnitsCount: number;
  scoresByRound: Record<number, RoundScore>;
}

export interface ResolvedAbility extends Ability {
  sourceName: string;
  sourceInstanceId: string;
  sourceType: 'unit' | 'leader' | 'support' | 'enhancement' | 'unit_upgrade' | 'detachment' | 'core' | 'faction';
  isFromAttachedCharacter: boolean;
  isDeactivatedByDeath: boolean;
}

export interface CompositeWeaponEntry {
  weapon: WeaponProfile;
  ownerName: string;
  ownerInstanceId: string;
  isOwnerDestroyed: boolean;
  count: number;
}

export interface CompositeUnit {
  primaryUnit: RosterUnit;
  primaryDatasheet: Datasheet;
  primaryLiveState: LiveUnitState;
  attachedLeader?: {
    rosterUnit: RosterUnit;
    datasheet: Datasheet;
    liveState: LiveUnitState;
    enhancements: Enhancement[];
  };
  attachedSupport?: {
    rosterUnit: RosterUnit;
    datasheet: Datasheet;
    liveState: LiveUnitState;
    enhancements: Enhancement[];
  };
  unitUpgrades: Enhancement[];
  displayName: string;
  combinedKeywords: string[];
  combinedFactionKeywords: string[];
  combinedCoreAbilities: string[];
  combinedAbilities: ResolvedAbility[];
  equippedRangedWeapons: CompositeWeaponEntry[];
  allRangedWeapons: CompositeWeaponEntry[];
  equippedMeleeWeapons: CompositeWeaponEntry[];
  allMeleeWeapons: CompositeWeaponEntry[];
  eligibleStratagemIds: string[];
  isBelowHalfStrength: boolean;
  isInDamagedBracket: boolean;
  hasDeadlyDemise: boolean;
  deadlyDemiseParameter?: string;
  totalPoints: number;
}

export interface FactionDataBundle {
  faction: Faction;
  lastUpdate: string;
  detachments: Detachment[];
  datasheets: Datasheet[];
  stratagems: Stratagem[];
  enhancements: Enhancement[];
}

export interface CoreDataBundle {
  lastUpdate: string;
  factions: Faction[];
  sources: RulesSource[];
  detachments: Detachment[];
  coreStratagems: Stratagem[];
  coreActions: CoreAction[];
  sharedAbilities: Array<{
    id: string;
    factionId: string;
    name: string;
    legend: string;
    description: string;
  }>;
  keywordGlossary?: KeywordDefinition[];
}
