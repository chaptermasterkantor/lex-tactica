import type {
  AbilityCategory,
  CostTier,
  Phase,
  SupportLeaderOverride,
  TurnTiming,
  WargearCostOption,
} from '../types/rules';
import { extractDatasheetSlug, stripHtmlToText } from './csvParser';

/**
 * Maps all 13 unique `phase` values from Wahapedia 11th Edition `Stratagems.csv`
 * into normalized Playbook `Phase[]`.
 */
export function normalizeStratagemPhase(rawPhase: string): Phase[] {
  const normalized = (rawPhase ?? '').trim();
  switch (normalized) {
    case 'Command phase':
      return ['command'];
    case 'Movement phase':
    case 'Ability "Move"':
      return ['movement'];
    case 'Shooting phase':
    case 'Ability "Shoot"':
      return ['shooting'];
    case 'Charge phase':
      return ['charge'];
    case 'Fight phase':
    case 'Ability "Fight"':
      return ['fight'];
    case 'Movement or Charge phase':
      return ['movement', 'charge'];
    case 'Shooting or Charge phase':
      return ['shooting', 'charge'];
    case 'Shooting or Fight phase':
      return ['shooting', 'fight'];
    case 'Charge or Fight phase':
      return ['charge', 'fight'];
    case 'Any phase':
    default:
      return ['any'];
  }
}

/**
 * Infers the exact tabletop Phase(s) for a Wahapedia 11th Edition Core Action (`Ability "Move"`,
 * `Ability "Shoot"`, `Ability "Fight"`) from its name and `ELIGIBLE IF` description text.
 */
export function normalizeCoreActionPhases(
  name: string,
  rawPhase: string,
  description: string
): Phase[] {
  const cleanName = stripHtmlToText(name).toUpperCase();
  const cleanDesc = stripHtmlToText(description).toLowerCase();

  if (cleanName.includes('SCOUT MOVE') || /resolve pre-battle abilities/i.test(cleanDesc)) {
    return ['pre_game'];
  }
  if (cleanName.includes('CHARGE MOVE') || /declared a charge this phase/i.test(cleanDesc)) {
    return ['charge'];
  }
  if (
    cleanName.includes('PILE-IN') ||
    cleanName.includes('CONSOLIDATION') ||
    cleanName.includes('NORMAL FIGHT') ||
    cleanName.includes('OVERRUN FIGHT') ||
    /it is the fight phase/i.test(cleanDesc)
  ) {
    return ['fight'];
  }
  if (cleanName.includes('SURGE MOVE')) {
    return ['movement', 'shooting', 'charge'];
  }
  if (cleanName.includes('EMERGENCY DISEMBARK')) {
    return ['shooting', 'fight'];
  }
  if (cleanName.includes('SNAP SHOOTING')) {
    return ['movement', 'shooting', 'charge'];
  }

  return normalizeStratagemPhase(rawPhase);
}

/**
 * Maps `turn` values from `Stratagems.csv` into normalized `TurnTiming`.
 */
export function normalizeStratagemTurn(rawTurn: string): TurnTiming {
  const cleaned = (rawTurn ?? '').trim().toLowerCase();
  if (cleaned === 'your turn') return 'your_turn';
  if (cleaned.includes('opponent')) return 'opponent_turn';
  return 'either';
}

/**
 * Normalizes Russian column-layout annotations in `Datasheets_abilities.csv`
 * (`Fortification (левая колонка)` and `Special (правая колонка)`) into English categories.
 */
export function normalizeAbilityCategory(rawType: string): AbilityCategory {
  const trimmed = (rawType ?? '').trim();
  if (trimmed.startsWith('Fortification')) return 'Fortification';
  if (trimmed.startsWith('Special')) return 'Special';
  const valid: AbilityCategory[] = [
    'Core',
    'Faction',
    'Datasheet',
    'Psychic',
    'Wargear',
    'Fortification',
    'Primarch',
    'Special',
    'Wargear profile',
  ];
  return (valid.find((v) => v.toLowerCase() === trimmed.toLowerCase()) ?? 'Datasheet');
}

/**
 * Infers micro-phases, turn timing, leader/support buff flags, aura, once-per-battle,
 * and defensive/reactive flags from an ability's name and description.
 */
export function analyzeAbilityText(
  name: string,
  rawHtmlDescription: string,
  isFromSupportDatasheet = false
): {
  phases: Phase[];
  timing: TurnTiming;
  isLeaderBuff: boolean;
  isSupportBuff: boolean;
  isAura: boolean;
  isOncePerBattle: boolean;
  isDefensiveOrReactive: boolean;
} {
  const cleanName = stripHtmlToText(name);
  const cleanDesc = stripHtmlToText(rawHtmlDescription);
  const combined = `${cleanName} ${cleanDesc}`.toLowerCase();

  const phases = new Set<Phase>();

  if (
    /before the battle|declare battle formations|resolve pre-battle|scouts\b|infiltrators\b|strategic reserves|when mustering|cannot include|can include .* in your army|select army faction|select detachment rules/i.test(
      combined
    )
  ) {
    phases.add('pre_game');
  }
  if (/start of (?:the|each|every) battle round|start of the first battle round/i.test(combined)) {
    phases.add('start_of_round');
  }
  if (/command phase|battle-shock/i.test(combined)) {
    phases.add('command');
  }
  if (
    /movement phase|normal move|advance move|fall-back move|fall back|remain stationary|reinforcements step|ingress move|deep strike/i.test(
      combined
    )
  ) {
    phases.add('movement');
  }
  if (
    /shooting phase|selected to shoot|ranged attack|ranged weapon|benefit of cover|stealth\b|lone operative|overwatch/i.test(
      combined
    )
  ) {
    phases.add('shooting');
  }
  if (/charge phase|declare a charge|charge move|charge roll|heroic intervention|surge move/i.test(combined)) {
    phases.add('charge');
  }
  if (
    /fight phase|selected to fight|melee attack|melee weapon|pile-in|consolidat|fights first|engagement range|overrun fight/i.test(
      combined
    )
  ) {
    phases.add('fight');
  }
  if (/end of (?:the|your|each|your opponent['’]s) turn/i.test(combined)) {
    phases.add('end_of_turn');
  }
  if (/end of (?:the|each) battle round/i.test(combined)) {
    phases.add('end_of_round');
  }

  // Passive / universal defensive abilities (e.g. Feel No Pain, Invulnerable saves, Deadly Demise)
  if (phases.size === 0) {
    if (/each time an attack|lose a wound|feel no pain|deadly demise|invulnerable save|insv/i.test(combined)) {
      phases.add('shooting');
      phases.add('fight');
    } else {
      phases.add('any');
    }
  }

  let timing: TurnTiming = 'either';
  const hasYourTurn = /(?:in|at the start of|at the end of|during) your (?:command|movement|shooting|charge|fight) phase|at the start of your turn|at the end of your turn|when this unit is selected to shoot|made a charge move this turn/i.test(
    combined
  );
  const hasOpponentTurn =
    /opponent['’]s (?:command|movement|shooting|charge|fight|turn)|each time an attack (?:targets|is made against|is allocated)|each time a ranged attack targets|lose a wound|feel no pain|stealth|lone operative|invulnerable|insv|after an enemy unit has shot/i.test(
      combined
    );

  if (hasYourTurn && !hasOpponentTurn && !phases.has('fight')) {
    timing = 'your_turn';
  } else if (hasOpponentTurn && !hasYourTurn) {
    timing = 'opponent_turn';
  } else {
    timing = 'either';
  }

  const isWhileLeading = /while this (?:model|unit) is leading a unit|models in that unit|weapons equipped by models in that unit/i.test(
    combined
  );
  const isLeaderBuff = isWhileLeading && !isFromSupportDatasheet;
  const isSupportBuff = isWhileLeading && isFromSupportDatasheet;
  const isAura = /\(aura\)|within \d+" of this (?:model|unit), friendly/i.test(combined);
  const isOncePerBattle = /once per battle|one shot/i.test(combined);
  const isDefensiveOrReactive =
    /each time an attack (?:targets|is made against|is allocated)|each time a ranged attack targets|lose a wound|feel no pain|invulnerable|insv|stealth\b|lone operative|benefit of cover|subtract 1 from the (?:hit|wound) roll|worsen the armour penetration|after an enemy unit has shot|when an enemy unit ends a/i.test(
      combined
    );

  return {
    phases: [...phases],
    timing,
    isLeaderBuff,
    isSupportBuff,
    isAura,
    isOncePerBattle,
    isDefensiveOrReactive,
  };
}

/**
 * Parses `Enhancements.support_leader` HTML strings into structured `SupportLeaderOverride`.
 * Example input:
 * `<span class="kwb">LEADER:</span> <a class="kwbOne" href="/wh40k11ed/factions/astra-militarum/Bullgryn-Squad">...</a>`
 */
export function parseSupportLeaderOverride(
  rawHtml: string,
  slugToDatasheetId: Map<string, string>
): SupportLeaderOverride | undefined {
  const trimmed = (rawHtml ?? '').trim();
  if (!trimmed) return undefined;

  const isSupportRole = /SUPPORT:/i.test(trimmed);
  const roleOverride: 'leader' | 'support' = isSupportRole ? 'support' : 'leader';

  const hrefMatches = [...trimmed.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
  const targetDatasheetSlugs = hrefMatches
    .map((href) => extractDatasheetSlug(href))
    .filter((s) => s.length > 0);

  const targetDatasheetIds = targetDatasheetSlugs
    .map((slug) => slugToDatasheetId.get(slug))
    .filter((id): id is string => Boolean(id));

  return {
    roleOverride,
    rawHtml: trimmed,
    targetDatasheetSlugs,
    targetDatasheetIds,
  };
}

/**
 * Parses Wahapedia `Datasheets.damaged_w` (e.g. "1-4", "1-5") into the numeric upper threshold.
 */
export function parseDamagedThreshold(damagedW?: string): number | undefined {
  if (!damagedW) return undefined;
  const match = damagedW.match(/1\s*[-–]\s*(\d+)/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  const single = parseInt(damagedW, 10);
  return Number.isNaN(single) ? undefined : single;
}

/**
 * Parses `Datasheets_models_cost.csv` rows for a single datasheet into structured
 * 11th Edition `costTiers` (including escalating duplicate-unit costs) and `wargearCosts`.
 */
export function parseDatasheetCosts(
  rows: Array<{ line: string; description: string; cost: string }>
): {
  costTiers: CostTier[];
  wargearCosts: WargearCostOption[];
} {
  const costTiers: CostTier[] = [];
  const wargearCosts: WargearCostOption[] = [];

  let currentGroup: CostTier['tierGroup'] | 'wargear' = 'standard';
  let currentLabel = 'YOUR UNIT COSTS';

  const sorted = [...rows].sort((a, b) => parseInt(a.line, 10) - parseInt(b.line, 10));

  for (const row of sorted) {
    const lineNum = parseInt(row.line, 10) || 1;
    const desc = stripHtmlToText(row.description);
    const rawCost = (row.cost ?? '').trim();

    if (!rawCost) {
      const upper = desc.toUpperCase();
      currentLabel = desc;
      if (upper.includes('WARGEAR OPTIONS')) {
        currentGroup = 'wargear';
      } else if (upper.includes('1ST TO 2ND')) {
        currentGroup = '1st_to_2nd';
      } else if (upper.includes('3RD+')) {
        currentGroup = '3rd+';
      } else if (upper.includes('1ST TO 3RD')) {
        currentGroup = '1st_to_3rd';
      } else if (upper.includes('4TH+')) {
        currentGroup = '4th+';
      } else if (upper.includes('1ST UNIT')) {
        currentGroup = '1st';
      } else if (upper.includes('2ND+')) {
        currentGroup = '2nd+';
      } else {
        currentGroup = 'standard';
      }
      continue;
    }

    const numericCost = parseInt(rawCost.replace(/[^0-9]/g, ''), 10) || 0;
    if (currentGroup === 'wargear') {
      wargearCosts.push({
        line: lineNum,
        description: desc,
        cost: numericCost,
      });
    } else {
      const modelsMatch = desc.match(/(\d+)\s+models?/i);
      const modelsCount = modelsMatch ? parseInt(modelsMatch[1], 10) : undefined;
      costTiers.push({
        tierGroup: currentGroup,
        tierLabel: currentLabel,
        line: lineNum,
        description: desc,
        modelsCount,
        cost: numericCost,
      });
    }
  }

  return { costTiers, wargearCosts };
}
