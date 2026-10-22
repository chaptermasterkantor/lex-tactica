import editionRules from '../config/editionRules.json';
import type {
  BattleSize,
  Datasheet,
  Detachment,
  Enhancement,
  RosterUnit,
  SavedRoster,
} from '../types/rules';
import { DARK_ANGELS_DETACHMENT_IDS, getDatasheetChapter } from './chapterKeywordRules';

export interface RosterValidationIssue {
  severity: 'error' | 'warning';
  code:
    | 'DP_EXCEEDED'
    | 'POINTS_EXCEEDED'
    | 'INVALID_LEADER_TARGET'
    | 'DUPLICATE_LEADER_SLOT'
    | 'ESCALATING_COST_MISMATCH'
    | 'CHAPTER_CONFLICT';
  message: string;
  unitInstanceId?: string;
}

/**
 * Determines whether a Character unit acts as a Regular Leader ('leader') or Support Leader ('support'),
 * and returns the list of valid Bodyguard Datasheet IDs it can attach to (including any 11th Ed
 * Enhancement `support_leader` overrides).
 */
export function resolveCharacterAttachmentCapabilities(
  characterDatasheet: Datasheet,
  equippedEnhancements: Enhancement[]
): {
  canAttach: boolean;
  slotType: 'leader' | 'support';
  validTargetDatasheetIds: string[];
} {
  let slotType: 'leader' | 'support' = characterDatasheet.isSupport ? 'support' : 'leader';
  const targetIds = new Set<string>(characterDatasheet.canLeadDatasheetIds);

  for (const enh of equippedEnhancements) {
    if (enh.supportLeaderOverride) {
      slotType = enh.supportLeaderOverride.roleOverride;
      for (const targetId of enh.supportLeaderOverride.targetDatasheetIds) {
        targetIds.add(targetId);
      }
    }
  }

  return {
    canAttach: targetIds.size > 0,
    slotType,
    validTargetDatasheetIds: [...targetIds],
  };
}

/**
 * Calculates the expected points cost for the Nth copy (1-indexed) of a unit in a roster,
 * accounting for 11th Edition escalating duplicate-unit cost tiers in `Datasheets_models_cost.csv`.
 */
export function getExpectedPointsForUnitCopy(
  datasheet: Datasheet,
  startingModels: number,
  copyIndexOneBased: number
): number {
  if (!datasheet.costTiers || datasheet.costTiers.length === 0) {
    return 0;
  }

  // Filter tiers applicable to this copy number
  const matchingGroupTiers = datasheet.costTiers.filter((t) => {
    switch (t.tierGroup) {
      case '1st':
        return copyIndexOneBased === 1;
      case '2nd+':
        return copyIndexOneBased >= 2;
      case '1st_to_2nd':
        return copyIndexOneBased <= 2;
      case '3rd+':
        return copyIndexOneBased >= 3;
      case '1st_to_3rd':
        return copyIndexOneBased <= 3;
      case '4th+':
        return copyIndexOneBased >= 4;
      case 'standard':
      default:
        return true;
    }
  });

  const pool = matchingGroupTiers.length > 0 ? matchingGroupTiers : datasheet.costTiers;

  // Match by model count if available
  const exactModelMatch = pool.find((t) => t.modelsCount === startingModels);
  if (exactModelMatch) return exactModelMatch.cost;

  // Otherwise pick closest model count >= startingModels or first tier
  const sortedByModels = [...pool]
    .filter((t) => t.modelsCount !== undefined)
    .sort((a, b) => (a.modelsCount ?? 0) - (b.modelsCount ?? 0));

  for (const tier of sortedByModels) {
    if ((tier.modelsCount ?? 1) >= startingModels) {
      return tier.cost;
    }
  }

  return pool[0]?.cost ?? 0;
}

/**
 * Validates a `SavedRoster` against 11th Edition Modular Detachment DP budgets,
 * Battle Size points limits, and 1 Regular Leader + 1 Support Leader attachment rules.
 */
export function validateRoster(
  roster: SavedRoster,
  datasheetsById: Map<string, Datasheet>,
  detachmentsById: Map<string, Detachment>,
  enhancementsById: Map<string, Enhancement>
): RosterValidationIssue[] {
  const issues: RosterValidationIssue[] = [];
  const sizeConfig =
    editionRules.battleSizes[roster.battleSize as BattleSize] ?? editionRules.battleSizes.strike_force;

  // 1. Validate Detachment Points (DP) budget
  const totalDp = roster.detachmentIds.reduce((sum, detId) => {
    const det = detachmentsById.get(detId);
    return sum + (det?.dp ?? 1);
  }, 0);

  if (totalDp > sizeConfig.maxDetachmentPoints) {
    issues.push({
      severity: 'error',
      code: 'DP_EXCEEDED',
      message: `Detachment Points (${totalDp} DP) exceed ${sizeConfig.label} maximum (${sizeConfig.maxDetachmentPoints} DP).`,
    });
  }

  // 2. Validate Total Points budget
  if (roster.totalPoints > sizeConfig.maxPoints) {
    issues.push({
      severity: 'warning',
      code: 'POINTS_EXCEEDED',
      message: `Total roster points (${roster.totalPoints} pts) exceed ${sizeConfig.label} limit (${sizeConfig.maxPoints} pts).`,
    });
  }

  // 3. Validate 1 Regular Leader + 1 Support Leader attachments
  const unitsByInstanceId = new Map<string, RosterUnit>(
    roster.units.map((u) => [u.instanceId, u])
  );
  const assignedCharacters = new Set<string>();

  for (const unit of roster.units) {
    const bodyguardDs = datasheetsById.get(unit.datasheetId);
    if (!bodyguardDs) continue;

    // Check Regular Leader slot
    if (unit.attachedLeaderInstanceId) {
      if (assignedCharacters.has(unit.attachedLeaderInstanceId)) {
        issues.push({
          severity: 'error',
          code: 'DUPLICATE_LEADER_SLOT',
          message: `Character is attached to more than one Bodyguard unit.`,
          unitInstanceId: unit.instanceId,
        });
      }
      assignedCharacters.add(unit.attachedLeaderInstanceId);

      const leaderUnit = unitsByInstanceId.get(unit.attachedLeaderInstanceId);
      const leaderDs = leaderUnit ? datasheetsById.get(leaderUnit.datasheetId) : undefined;
      if (leaderUnit && leaderDs) {
        const enhs = leaderUnit.enhancementIds
          .map((id) => enhancementsById.get(id))
          .filter((e): e is Enhancement => Boolean(e));
        const caps = resolveCharacterAttachmentCapabilities(leaderDs, enhs);
        if (caps.slotType !== 'leader') {
          issues.push({
            severity: 'error',
            code: 'INVALID_LEADER_TARGET',
            message: `${leaderDs.name} is a Support Character and must be placed in the Support slot, not the Leader slot.`,
            unitInstanceId: unit.instanceId,
          });
        } else if (
          caps.validTargetDatasheetIds.length > 0 &&
          !caps.validTargetDatasheetIds.includes(bodyguardDs.id)
        ) {
          issues.push({
            severity: 'warning',
            code: 'INVALID_LEADER_TARGET',
            message: `${leaderDs.name} does not list ${bodyguardDs.name} as an eligible Bodyguard unit.`,
            unitInstanceId: unit.instanceId,
          });
        }
      }
    }

    // Check Support Leader slot
    if (unit.attachedSupportInstanceId) {
      if (assignedCharacters.has(unit.attachedSupportInstanceId)) {
        issues.push({
          severity: 'error',
          code: 'DUPLICATE_LEADER_SLOT',
          message: `Support Character is attached to more than one Bodyguard unit.`,
          unitInstanceId: unit.instanceId,
        });
      }
      assignedCharacters.add(unit.attachedSupportInstanceId);

      const supportUnit = unitsByInstanceId.get(unit.attachedSupportInstanceId);
      const supportDs = supportUnit ? datasheetsById.get(supportUnit.datasheetId) : undefined;
      if (supportUnit && supportDs) {
        const enhs = supportUnit.enhancementIds
          .map((id) => enhancementsById.get(id))
          .filter((e): e is Enhancement => Boolean(e));
        const caps = resolveCharacterAttachmentCapabilities(supportDs, enhs);
        if (caps.slotType !== 'support') {
          issues.push({
            severity: 'error',
            code: 'INVALID_LEADER_TARGET',
            message: `${supportDs.name} is a Regular Leader and must be placed in the Leader slot, not the Support slot.`,
            unitInstanceId: unit.instanceId,
          });
        } else if (
          caps.validTargetDatasheetIds.length > 0 &&
          !caps.validTargetDatasheetIds.includes(bodyguardDs.id)
        ) {
          issues.push({
            severity: 'warning',
            code: 'INVALID_LEADER_TARGET',
            message: `${supportDs.name} does not list ${bodyguardDs.name} as an eligible Bodyguard unit.`,
            unitInstanceId: unit.instanceId,
          });
        }
      }
    }
  }

  // 6. Check Space Marine Chapter Consistency
  if (roster.factionId === 'SM') {
    const chaptersPresent = new Map<string, string[]>();
    for (const unit of roster.units) {
      const ds = datasheetsById.get(unit.datasheetId);
      if (ds) {
        const ch = getDatasheetChapter(ds);
        if (ch) {
          const list = chaptersPresent.get(ch) || [];
          list.push(ds.name);
          chaptersPresent.set(ch, list);
        }
      }
    }

    if (chaptersPresent.size > 1) {
      const details = Array.from(chaptersPresent.entries())
        .map(([ch, units]) => `${ch} (${units.join(', ')})`)
        .join(' vs ');
      issues.push({
        severity: 'error',
        code: 'CHAPTER_CONFLICT',
        message: `Space Marine armies cannot include units from multiple Chapters: ${details}.`,
      });
    }

    // Check if a Dark Angels detachment is selected but units from another chapter are included
    const hasDaDetachment = roster.detachmentIds.some((id) => DARK_ANGELS_DETACHMENT_IDS.has(id));
    if (hasDaDetachment) {
      for (const [ch, units] of chaptersPresent.entries()) {
        if (ch !== 'Dark Angels') {
          issues.push({
            severity: 'error',
            code: 'CHAPTER_CONFLICT',
            message: `Dark Angels detachments cannot include units drawn from other Chapters: ${ch} (${units.join(', ')}).`,
          });
        }
      }
    }
  }

  return issues;
}
