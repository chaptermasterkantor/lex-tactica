import missionsData from '../config/missions11ed.json';
import mapsData from '../config/maps11ed.json';
import missionsMeta from '../config/missions-meta.json';
import type {
  Detachment,
  ForceDisposition,
  MapLayoutDescriptor,
  PrimaryMissionDefinition,
  SecondaryCard,
} from '../types/rules';

export const ALL_FORCE_DISPOSITIONS: ForceDisposition[] = [
  'Take and Hold',
  'Purge the Foe',
  'Disruption',
  'Reconnaissance',
  'Priority Assets',
];

export const DISPOSITION_COLORS: Record<ForceDisposition, { badge: string; border: string; bg: string; text: string }> = {
  'Take and Hold': {
    badge: 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50',
    border: 'border-emerald-500',
    bg: 'bg-emerald-950/40',
    text: 'text-emerald-300',
  },
  'Purge the Foe': {
    badge: 'bg-rose-600/30 text-rose-300 border-rose-500/50',
    border: 'border-rose-500',
    bg: 'bg-rose-950/40',
    text: 'text-rose-300',
  },
  'Disruption': {
    badge: 'bg-blue-600/30 text-blue-300 border-blue-500/50',
    border: 'border-blue-500',
    bg: 'bg-blue-950/40',
    text: 'text-blue-300',
  },
  'Reconnaissance': {
    badge: 'bg-amber-600/30 text-amber-300 border-amber-500/50',
    border: 'border-amber-500',
    bg: 'bg-amber-950/40',
    text: 'text-amber-300',
  },
  'Priority Assets': {
    badge: 'bg-purple-600/30 text-purple-300 border-purple-500/50',
    border: 'border-purple-500',
    bg: 'bg-purple-950/40',
    text: 'text-purple-300',
  },
};

/**
 * Returns the recommended force dispositions based on the player's chosen detachments.
 */
export function getRecommendedDispositions(
  detachmentIdsOrNames: string[],
  availableDetachments: Detachment[]
): ForceDisposition[] {
  const result: ForceDisposition[] = [];
  const set = new Set(detachmentIdsOrNames);

  for (const det of availableDetachments) {
    if ((set.has(det.id) || set.has(det.name)) && det.forceDisposition) {
      if (!result.includes(det.forceDisposition)) {
        result.push(det.forceDisposition);
      }
    }
  }

  return result;
}

/**
 * Resolves both players' asymmetric primary missions from the 5x5 directional matrix.
 */
export function resolvePrimaryMissions(
  yourDisp: ForceDisposition,
  oppDisp: ForceDisposition
): {
  yourMission: PrimaryMissionDefinition;
  opponentMission: PrimaryMissionDefinition;
} {
  const matrix = (missionsData as any).primaries.matrix;
  const yourMission = matrix?.[yourDisp]?.[oppDisp];
  const opponentMission = matrix?.[oppDisp]?.[yourDisp];

  if (!yourMission || !opponentMission) {
    throw new Error(`Invalid disposition pairing: ${yourDisp} vs ${oppDisp}`);
  }

  return { yourMission, opponentMission };
}

/**
 * Finds all 3 layouts (A, B, C) for an unordered disposition pair.
 */
export function getLayoutsForMatchup(
  yourDisp: ForceDisposition,
  oppDisp: ForceDisposition
): MapLayoutDescriptor[] {
  const layouts: MapLayoutDescriptor[] = (mapsData as any).layouts || [];
  const matches = layouts.filter((l) => {
    const isDirect =
      l.attacker.disposition === yourDisp && l.defender.disposition === oppDisp;
    const isReversed =
      l.attacker.disposition === oppDisp && l.defender.disposition === yourDisp;
    return isDirect || isReversed;
  });

  return matches.sort((a, b) => a.layout.localeCompare(b.layout));
}

/**
 * Helper to determine if a scoring item applies in the current battle round.
 */
export function isMissionItemActiveInRound(when: string, currentRound: number): boolean {
  if (!when) return true;
  if (/end of battle/i.test(when)) {
    return currentRound === 5;
  }
  const rangeMatch = when.match(/R(\d)[-\-](\d)/i);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    return currentRound >= min && currentRound <= max;
  }
  const plusMatch = when.match(/R(\d)\+/i);
  if (plusMatch) {
    const min = parseInt(plusMatch[1], 10);
    return currentRound >= min;
  }
  const exactMatch = when.match(/\bR(\d)\b/i);
  if (exactMatch) {
    const r = parseInt(exactMatch[1], 10);
    return currentRound === r;
  }
  return true;
}

/**
 * Returns all 18 standard 11th Edition secondary mission cards.
 */
export function getAllSecondaryCards(): SecondaryCard[] {
  return ((missionsData as any).secondaries?.cards || []) as SecondaryCard[];
}

/**
 * Returns the secondary mission cards eligible for Fixed mode (type === 'Fixed / Tactical').
 */
export function getFixedEligibleSecondaryCards(): SecondaryCard[] {
  return getAllSecondaryCards().filter((c) => c.type === 'Fixed / Tactical');
}

/**
 * Resolves the relative/local image path for a map layout JPEG.
 */
export function getLayoutImageUrl(fileName: string): string {
  return `/data/wahapedia-11ed/maps/${fileName}`;
}

/**
 * Resolves the Terrain Key image path.
 */
export function getTerrainKeyImageUrl(): string {
  return `/data/wahapedia-11ed/maps/_key.jpg`;
}

/**
 * Returns version and metadata for the active mission and map datasets.
 */
export function getMissionMetadata() {
  return missionsMeta;
}
