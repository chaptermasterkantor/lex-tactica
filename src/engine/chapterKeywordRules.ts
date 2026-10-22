import type { Datasheet, SavedRoster } from '../types/rules';

export const KNOWN_SPACE_MARINE_CHAPTERS = [
  'Dark Angels',
  'Ultramarines',
  'Blood Angels',
  'Space Wolves',
  'Black Templars',
  'Deathwatch',
  'Imperial Fists',
  'Iron Hands',
  'Raven Guard',
  'Salamanders',
  'White Scars',
] as const;

export type SpaceMarineChapter = (typeof KNOWN_SPACE_MARINE_CHAPTERS)[number];

export const DARK_ANGELS_DETACHMENT_IDS = new Set<string>([
  '000000835', // Inner Circle Task Force
  '000001059', // Wrath of the Rock
  '000001205', // Darkflight Pursuit
]);

export const DARK_ANGELS_SUCCESSOR_HINTS = [
  'dark angels',
  'deathwing',
  'ravenwing',
  'unforgiven',
  'angels of absolution',
  'angels of redemption',
  'angels of vengeance',
  'blades of vengeance',
  'consecrators',
  'disciples of caliban',
  'guardians of the covenant',
  'knights of the crimson order',
  'cowled wardens',
  'penitent blades',
];

/**
 * Checks whether a datasheet originates natively from Dark Angels (source 000000023 or Dark Angels faction keyword).
 */
export function isNativeDarkAngelsDatasheet(datasheet: Datasheet): boolean {
  if (datasheet.factionId !== 'SM') return false;
  if (datasheet.sourceId === '000000023') return true;
  return datasheet.factionKeywords.some(
    (k) => k.toLowerCase().trim() === 'dark angels'
  );
}

/**
 * Extracts the specific Space Marine Chapter faction keyword from a datasheet if present (e.g. 'Dark Angels', 'Ultramarines').
 */
export function getDatasheetChapter(datasheet: Datasheet): SpaceMarineChapter | undefined {
  if (datasheet.factionId !== 'SM') return undefined;
  for (const chapter of KNOWN_SPACE_MARINE_CHAPTERS) {
    if (datasheet.factionKeywords.some((k) => k.toLowerCase().trim() === chapter.toLowerCase())) {
      return chapter;
    }
  }
  return undefined;
}

/**
 * Determines whether a Space Marine roster is running as Dark Angels (or a Dark Angels successor),
 * activating the Chapter rules "The Deathwing" and "The Ravenwing".
 *
 * Evaluated via:
 * 1. User-specified `subFactionName` matching Dark Angels or known successors.
 * 2. Selection of a Dark Angels detachment (Inner Circle Task Force, Wrath of the Rock, Darkflight Pursuit).
 * 3. Inclusion of any native Dark Angels datasheets in the roster (e.g. Azrael, Deathwing Knights, Lion El'Jonson).
 */
export function isDarkAngelsRoster(
  roster: SavedRoster,
  datasheetsById?: Map<string, Datasheet>
): boolean {
  if (roster.factionId !== 'SM') return false;

  // 1. Explicit Chapter / Sub-faction input
  if (roster.subFactionName) {
    const sub = roster.subFactionName.toLowerCase().trim();
    if (DARK_ANGELS_SUCCESSOR_HINTS.some((hint) => sub.includes(hint))) {
      return true;
    }
  }

  // 2. Dark Angels Detachment selected
  if (roster.detachmentIds && roster.detachmentIds.some((id) => DARK_ANGELS_DETACHMENT_IDS.has(id))) {
    return true;
  }

  // 3. Any unit in the roster is a native Dark Angels datasheet
  if (datasheetsById && roster.units) {
    for (const u of roster.units) {
      const ds = datasheetsById.get(u.datasheetId);
      if (ds && isNativeDarkAngelsDatasheet(ds)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Resolves the active keywords for a datasheet in the context of the roster's army rules.
 *
 * For Space Marine units:
 * - Native Dark Angels datasheets (e.g. Deathwing Knights, Ravenwing Black Knights) always retain Deathwing / Ravenwing.
 * - Eligible generic Space Marine datasheets (e.g. Terminators, Land Raiders, Dreadnoughts, Outriders) only receive
 *   the 'Deathwing' and 'Ravenwing' keywords when the army is running as Dark Angels.
 * - When running any other Chapter (e.g. Ultramarines, Blood Angels, Space Wolves) or generic codex Space Marines,
 *   pre-baked 'Deathwing' and 'Ravenwing' keywords are stripped.
 */
export function resolveActiveKeywords(datasheet: Datasheet, isDarkAngels: boolean): string[] {
  if (datasheet.factionId !== 'SM') {
    return datasheet.keywords;
  }

  // Native Dark Angels datasheets always keep Deathwing / Ravenwing
  if (isNativeDarkAngelsDatasheet(datasheet)) {
    return datasheet.keywords;
  }

  // If this is a Dark Angels army, eligible generic units retain their Deathwing / Ravenwing keywords
  if (isDarkAngels) {
    return datasheet.keywords;
  }

  // Otherwise, filter out Deathwing and Ravenwing from generic Space Marine units
  return datasheet.keywords.filter((k) => {
    const lower = k.toLowerCase().trim();
    return lower !== 'deathwing' && lower !== 'ravenwing';
  });
}
