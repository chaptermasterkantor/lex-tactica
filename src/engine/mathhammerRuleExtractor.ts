import type {
  CompositeUnit,
  CompositeWeaponEntry,
  Datasheet,
  ResolvedAbility,
  WeaponProfile,
} from '../types/rules';
import type {
  DefenderCombatProfile,
  ReRollMode,
  WeaponCombatProfile,
} from './mathhammerEngine';

export interface WeaponVariantOption {
  variantKey: string; // e.g. "standard", "hunter", "supercharge"
  variantLabel: string; // e.g. "Standard", "🎯 Hunter", "Supercharge"
  weapon: WeaponProfile;
  isHunter: boolean;
}

export interface WeaponGroupUI {
  groupKey: string;
  baseName: string;
  ownerName: string;
  ownerInstanceId: string;
  type: 'Ranged' | 'Melee';
  count: number; // editable active count
  maxCount: number; // max equipped count in squad
  selectedVariantKey: string;
  variants: WeaponVariantOption[];
  enabled: boolean;
  isPistol: boolean;
  isExtraAttacks: boolean;
  autoHunterTriggered: boolean;
}

export interface DetectedAbilityChip {
  id: string;
  name: string;
  description: string;
  side: 'attacker' | 'defender';
  effectType:
    | 'damage_reroll'
    | 'hit_reroll_ones'
    | 'hit_reroll_all'
    | 'wound_reroll_ones'
    | 'wound_reroll_all'
    | 'fnp'
    | 'fnp_mortal_dev'
    | 'stealth'
    | 'invuln'
    | 'damage_minus_one'
    | 'plus_one_ap'
    | 'lethal_hits'
    | 'other';
  enabled: boolean;
  parameter?: number;
}

/**
 * Normalizes keyword comparison (removes brackets, trims, lowercases).
 */
export function normalizeKeyword(kw: string): string {
  return (kw || '')
    .replace(/[\[\]]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Parses all 11th Edition weapon keywords and evaluates conditional rules against target keywords.
 */
export function parseWeaponKeywords(
  weapon: WeaponProfile,
  targetKeywords: Set<string>
): {
  isTorrent: boolean;
  hasLethalHits: boolean;
  sustainedHitsVal: number;
  hasDevastatingWounds: boolean;
  hasTwinLinked: boolean;
  antiKeywordThreshold?: number;
  hasLance: boolean;
  hasHeavy: boolean;
  hasIgnoresCover: boolean;
  meltaVal: number;
  rapidFireVal: number;
  blastVal: number;
  cleaveVal: number;
  isConversion: boolean;
  hasPrecision: boolean;
  hasExtraAttacks: boolean;
  isPistol: boolean;
} {
  const allKws = [
    ...(weapon.keywords || []),
    ...(weapon.description ? weapon.description.split(/,\s*/) : []),
  ].map(normalizeKeyword);

  const hasAnyKw = (...tests: string[]) =>
    allKws.some((k) => tests.some((t) => k.includes(t.toLowerCase())));

  const targetHas = (kw: string) => targetKeywords.has(kw.toLowerCase().trim());

  // 1. Torrent / Auto-hit
  const isTorrent =
    hasAnyKw('torrent') || weapon.BS_WS === '-' || weapon.BS_WS === '7+';

  // 2. Lethal Hits & Target Conditions
  let hasLethalHits = false;
  if (hasAnyKw('lethal hits')) {
    if (hasAnyKw('lethal hits: monster/vehicle')) {
      hasLethalHits = targetHas('monster') || targetHas('vehicle');
    } else if (hasAnyKw('lethal hits: non-monster/vehicle')) {
      hasLethalHits = !targetHas('monster') && !targetHas('vehicle');
    } else {
      hasLethalHits = true;
    }
  }

  // 3. Sustained Hits X & Target Conditions
  let sustainedHitsVal = 0;
  for (const kw of allKws) {
    if (kw.includes('sustained hits')) {
      let isEligible = true;
      if (kw.includes(': monster/vehicle')) {
        isEligible = targetHas('monster') || targetHas('vehicle');
      } else if (kw.includes(': non-monster/vehicle')) {
        isEligible = !targetHas('monster') && !targetHas('vehicle');
      }
      if (isEligible) {
        if (kw.includes('d3')) {
          sustainedHitsVal = -1; // -1 represents D3
        } else {
          const match = kw.match(/sustained hits\s*(\d+)/i);
          if (match) {
            sustainedHitsVal = Math.max(sustainedHitsVal, parseInt(match[1], 10));
          } else {
            sustainedHitsVal = Math.max(sustainedHitsVal, 1);
          }
        }
      }
    }
  }

  // 4. Devastating Wounds & Target Conditions
  let hasDevastatingWounds = false;
  if (hasAnyKw('devastating wounds')) {
    if (hasAnyKw('devastating wounds: infantry')) {
      hasDevastatingWounds = targetHas('infantry');
    } else if (hasAnyKw('devastating wounds: monster/vehicle')) {
      hasDevastatingWounds = targetHas('monster') || targetHas('vehicle');
    } else if (hasAnyKw('devastating wounds: psyker')) {
      hasDevastatingWounds = targetHas('psyker');
    } else if (hasAnyKw('devastating wounds: non-monster/vehicle')) {
      hasDevastatingWounds = !targetHas('monster') && !targetHas('vehicle');
    } else {
      hasDevastatingWounds = true;
    }
  }

  // 5. Twin-linked
  const hasTwinLinked = hasAnyKw('twin-linked');

  // 6. Anti-<Keyword> X+
  let antiKeywordThreshold: number | undefined;
  for (const kw of allKws) {
    const match = kw.match(/anti-([\w\/\-]+)\s*(\d)\+/i);
    if (match) {
      const antiTarget = match[1].toLowerCase();
      const threshold = parseInt(match[2], 10);
      let matched = false;
      if (antiTarget === 'monster/vehicle') {
        matched = targetHas('monster') || targetHas('vehicle');
      } else if (antiTarget === 'non-monster/vehicle') {
        matched = !targetHas('monster') && !targetHas('vehicle');
      } else {
        matched = targetHas(antiTarget);
      }
      if (matched) {
        antiKeywordThreshold =
          antiKeywordThreshold !== undefined
            ? Math.min(antiKeywordThreshold, threshold)
            : threshold;
      }
    }
  }

  // 7. Lance, Heavy, Ignores Cover, Conversion, Precision, Extra Attacks, Pistol
  const hasLance = hasAnyKw('lance');
  const hasHeavy = hasAnyKw('heavy');
  const hasIgnoresCover = hasAnyKw('ignores cover');
  const isConversion = hasAnyKw('conversion');
  const hasPrecision = hasAnyKw('precision');
  const hasExtraAttacks = hasAnyKw('extra attacks');
  const isPistol = hasAnyKw('pistol', 'close-quarters');

  // 8. Melta X
  let meltaVal = 0;
  for (const kw of allKws) {
    const match = kw.match(/melta\s*(\d+)/i);
    if (match) {
      meltaVal = Math.max(meltaVal, parseInt(match[1], 10));
    }
  }

  // 9. Rapid Fire X
  let rapidFireVal = 0;
  for (const kw of allKws) {
    const match = kw.match(/rapid fire\s*(\d+)/i);
    if (match) {
      rapidFireVal = Math.max(rapidFireVal, parseInt(match[1], 10));
    }
  }

  // 10. Blast X & Cleave X
  let blastVal = 0;
  if (hasAnyKw('blast')) {
    blastVal = 1;
    for (const kw of allKws) {
      const match = kw.match(/blast\s*(\d+)/i);
      if (match) blastVal = Math.max(blastVal, parseInt(match[1], 10));
    }
  }

  let cleaveVal = 0;
  for (const kw of allKws) {
    const match = kw.match(/cleave\s*(\d+)/i);
    if (match) {
      cleaveVal = Math.max(cleaveVal, parseInt(match[1], 10));
    }
  }

  return {
    isTorrent,
    hasLethalHits,
    sustainedHitsVal,
    hasDevastatingWounds,
    hasTwinLinked,
    antiKeywordThreshold,
    hasLance,
    hasHeavy,
    hasIgnoresCover,
    meltaVal,
    rapidFireVal,
    blastVal,
    cleaveVal,
    isConversion,
    hasPrecision,
    hasExtraAttacks,
    isPistol,
  };
}

/**
 * Builds clean UI weapon groups from a CompositeUnit (or raw Datasheet weapons).
 * Automatically groups profiles sharing base names (e.g. Melta Rifle vs Melta Rifle - Hunter),
 * auto-detects `- Hunter` when targeting MONSTER or VEHICLE, handles pistol exclusion,
 * and scales active weapon counts to live surviving models.
 */
export function buildWeaponGroups(
  weaponEntries: CompositeWeaponEntry[],
  combatMode: 'Ranged' | 'Melee',
  targetKeywords: Set<string>,
  isAttackerMonsterOrVehicle: boolean,
  primaryRemainingModels: number
): WeaponGroupUI[] {
  const filtered = weaponEntries.filter((entry) => {
    const w = entry.weapon;
    // Filter mode
    if (w.type !== combatMode) return false;
    // Filter phantom/empty rows
    if (!w.name.trim() || w.A === '0' || w.S === '-' || w.D === '-') return false;
    return true;
  });

  const isTargetMonsterOrVehicle =
    targetKeywords.has('monster') || targetKeywords.has('vehicle');

  // Group by: `${ownerInstanceId}::${type}::${baseNameLower}`
  const groupsMap = new Map<
    string,
    {
      baseName: string;
      ownerName: string;
      ownerInstanceId: string;
      type: 'Ranged' | 'Melee';
      count: number;
      variants: WeaponVariantOption[];
    }
  >();

  for (const entry of filtered) {
    const w = entry.weapon;
    const baseName = w.name.split(' - ')[0].trim();
    const groupKey = `${entry.ownerInstanceId}::${w.type}::${baseName.toLowerCase()}`;

    const isHunter = w.name.toLowerCase().includes(' - hunter');
    let variantLabel = 'Standard';
    let variantKey = 'standard';

    if (w.name.includes(' - ')) {
      const sub = w.name.split(' - ').slice(1).join(' - ').trim();
      variantKey = sub.toLowerCase();
      variantLabel = isHunter ? '🎯 Hunter' : sub;
    }

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, {
        baseName,
        ownerName: entry.ownerName,
        ownerInstanceId: entry.ownerInstanceId,
        type: w.type,
        count: entry.count,
        variants: [],
      });
    }

    const group = groupsMap.get(groupKey)!;
    // Keep max non-zero count
    if (entry.count > group.count) {
      group.count = entry.count;
    }
    // Avoid duplicate variant entries
    if (!group.variants.some((v) => v.variantKey === variantKey)) {
      group.variants.push({
        variantKey,
        variantLabel,
        weapon: w,
        isHunter,
      });
    }
  }

  // Build final array of WeaponGroupUI
  const result: WeaponGroupUI[] = [];
  let nonExtraMeleeEnabledCount = 0;

  for (const [groupKey, g] of groupsMap.entries()) {
    // Determine active profile
    let selectedVariantKey = g.variants[0]?.variantKey || 'standard';
    let autoHunterTriggered = false;

    const hunterVariant = g.variants.find((v) => v.isHunter);
    if (hunterVariant && isTargetMonsterOrVehicle) {
      selectedVariantKey = hunterVariant.variantKey;
      autoHunterTriggered = true;
    }

    const activeWeapon =
      g.variants.find((v) => v.variantKey === selectedVariantKey)?.weapon ||
      g.variants[0]?.weapon;

    const parsedKw = activeWeapon
      ? parseWeaponKeywords(activeWeapon, targetKeywords)
      : { isPistol: false, hasExtraAttacks: false };

    // Default enabled rules:
    let enabled = true;

    // Ranged mode: exclude Pistols unless attacker is MONSTER/VEHICLE
    if (combatMode === 'Ranged' && parsedKw.isPistol && !isAttackerMonsterOrVehicle) {
      const hasOtherRanged = filtered.some(
        (e) => !parseWeaponKeywords(e.weapon, targetKeywords).isPistol
      );
      if (hasOtherRanged) {
        enabled = false;
      }
    }

    // Melee mode: if single-model and multiple non-extra weapons, only enable the first
    if (combatMode === 'Melee' && !parsedKw.hasExtraAttacks) {
      if (primaryRemainingModels <= 1 && nonExtraMeleeEnabledCount >= 1) {
        enabled = false;
      } else {
        nonExtraMeleeEnabledCount++;
      }
    }

    // Casualty scaling: cap squad weapons so total primary weapons <= primaryRemainingModels
    let effectiveCount = g.count;
    if (primaryRemainingModels > 0 && effectiveCount > primaryRemainingModels) {
      effectiveCount = primaryRemainingModels;
    }

    result.push({
      groupKey,
      baseName: g.baseName,
      ownerName: g.ownerName,
      ownerInstanceId: g.ownerInstanceId,
      type: g.type,
      count: effectiveCount,
      maxCount: g.count,
      selectedVariantKey,
      variants: g.variants,
      enabled,
      isPistol: parsedKw.isPistol,
      isExtraAttacks: parsedKw.hasExtraAttacks,
      autoHunterTriggered,
    });
  }

  return result;
}

/**
 * Scans Wahapedia abilities on a CompositeUnit (or Datasheet abilities) and extracts
 * combat-relevant modifiers into toggleable rule chips.
 */
export function scanUnitAbilitiesForMathhammer(
  abilities: ResolvedAbility[] | Datasheet['abilities'],
  side: 'attacker' | 'defender'
): DetectedAbilityChip[] {
  const chips: DetectedAbilityChip[] = [];
  const seenIds = new Set<string>();

  for (const ab of abilities) {
    if (seenIds.has(ab.name.toLowerCase())) continue;
    const lowerName = ab.name.toLowerCase();
    const lowerDesc = (ab.description || '').toLowerCase();

    // 1. Damage Re-rolls (e.g. Total Obliteration)
    if (side === 'attacker' && lowerDesc.includes('re-roll damage')) {
      seenIds.add(lowerName);
      chips.push({
        id: `chip_${ab.name}`,
        name: ab.name,
        description: ab.description,
        side: 'attacker',
        effectType: 'damage_reroll',
        enabled: true,
      });
    }

    // 2. Hit Re-rolls of 1 (e.g. Death Totem)
    if (side === 'attacker' && (lowerDesc.includes('re-roll hit rolls of 1') || lowerDesc.includes('re-roll hit rolls of 1'))) {
      seenIds.add(lowerName);
      chips.push({
        id: `chip_${ab.name}`,
        name: ab.name,
        description: ab.description,
        side: 'attacker',
        effectType: 'hit_reroll_ones',
        enabled: true,
      });
    }

    // 3. Feel No Pain X+
    const fnpMatch = lowerName.match(/feel no pain\s*(\d)\+/i) || lowerDesc.match(/feel no pain\s*(\d)\+/i);
    if (side === 'defender' && fnpMatch) {
      seenIds.add(lowerName);
      const isMortalOnly = lowerDesc.includes('mortal wounds') || lowerDesc.includes('psychic');
      chips.push({
        id: `chip_${ab.name}`,
        name: ab.name,
        description: ab.description,
        side: 'defender',
        effectType: isMortalOnly ? 'fnp_mortal_dev' : 'fnp',
        parameter: parseInt(fnpMatch[1], 10),
        enabled: true,
      });
    }

    // 4. Stealth (-1 to Hit)
    if (side === 'defender' && (lowerName === 'stealth' || lowerDesc.includes('subtract 1 from that attack’s hit roll'))) {
      seenIds.add(lowerName);
      chips.push({
        id: `chip_${ab.name}`,
        name: ab.name,
        description: ab.description,
        side: 'defender',
        effectType: 'stealth',
        enabled: true,
      });
    }

    // 5. Praesidium Shield / Damage Reduction
    if (side === 'defender' && (lowerDesc.includes('-1 d') || lowerDesc.includes('subtract 1 from the damage'))) {
      seenIds.add(lowerName);
      chips.push({
        id: `chip_${ab.name}`,
        name: ab.name,
        description: ab.description,
        side: 'defender',
        effectType: 'damage_minus_one',
        enabled: true,
      });
    }

    // 6. Invulnerable save grants (e.g. Serpent Shield 5+, Forceshield 4+, Waaagh! 5+)
    const invMatch = lowerDesc.match(/(\d)\+\s*invulnerable save/i) || lowerDesc.match(/has\s*(\d)\+\s*insv/i);
    if (side === 'defender' && invMatch) {
      seenIds.add(lowerName);
      chips.push({
        id: `chip_${ab.name}`,
        name: ab.name,
        description: ab.description,
        side: 'defender',
        effectType: 'invuln',
        parameter: parseInt(invMatch[1], 10),
        enabled: true,
      });
    }
  }

  return chips;
}

/**
 * Compiles UI weapon groups into ready-to-calculate `WeaponCombatProfile[]`.
 */
export function compileWeaponProfiles(
  weaponGroups: WeaponGroupUI[],
  targetKeywords: Set<string>,
  globalModifiers: {
    halfRange: boolean;
    remainedStationary: boolean;
    chargedThisTurn: boolean;
    hitMod: number; // -1, 0, 1
    woundMod: number;
    apImprove: number;
    damageBonus: number;
    hitReRoll: ReRollMode;
    woundReRoll: ReRollMode;
    critHitThreshold?: number;
    critWoundThreshold?: number;
    reRollDamage?: boolean;
    grantLethalHits?: boolean;
    grantSustainedHits1?: boolean;
    grantDevastatingWounds?: boolean;
    grantIgnoresCover?: boolean;
  }
): WeaponCombatProfile[] {
  const result: WeaponCombatProfile[] = [];

  for (const g of weaponGroups) {
    if (!g.enabled || g.count <= 0) continue;

    const variant =
      g.variants.find((v) => v.variantKey === g.selectedVariantKey) ||
      g.variants[0];
    if (!variant) continue;

    const w = variant.weapon;
    const kw = parseWeaponKeywords(w, targetKeywords);

    const sVal = parseInt(w.S, 10) || 4;
    const apVal = parseInt(w.AP, 10) || 0;

    // Resolve Rapid Fire & Melta bonuses if at Half Range
    const rapidFireBonus = globalModifiers.halfRange ? kw.rapidFireVal : 0;
    const meltaBonus = globalModifiers.halfRange ? kw.meltaVal : 0;

    // Resolve Heavy bonus if Remained Stationary
    const heavyHitBonus = globalModifiers.remainedStationary && kw.hasHeavy ? 1 : 0;

    // Resolve Lance bonus if Charged
    const lanceBonus = globalModifiers.chargedThisTurn && kw.hasLance ? 1 : 0;

    const finalHitMod = globalModifiers.hitMod + heavyHitBonus;
    const finalWoundMod = globalModifiers.woundMod + lanceBonus;

    result.push({
      id: `${g.groupKey}::${variant.variantKey}`,
      name: `${g.baseName} (${variant.variantLabel})`,
      count: g.count,
      A: w.A,
      BS_WS: w.BS_WS,
      S: sVal,
      AP: apVal,
      D: w.D,
      isTorrent: kw.isTorrent,
      hasLethalHits: kw.hasLethalHits || Boolean(globalModifiers.grantLethalHits),
      sustainedHitsVal:
        globalModifiers.grantSustainedHits1 && kw.sustainedHitsVal === 0
          ? 1
          : kw.sustainedHitsVal,
      hasDevastatingWounds:
        kw.hasDevastatingWounds || Boolean(globalModifiers.grantDevastatingWounds),
      hasTwinLinked: kw.hasTwinLinked,
      antiKeywordThreshold: kw.antiKeywordThreshold,
      hasLance: kw.hasLance,
      hasHeavy: kw.hasHeavy,
      hasIgnoresCover:
        kw.hasIgnoresCover || Boolean(globalModifiers.grantIgnoresCover),
      meltaVal: meltaBonus,
      rapidFireVal: rapidFireBonus,
      blastVal: kw.blastVal,
      cleaveVal: kw.cleaveVal,
      isConversion: kw.isConversion,
      reRollDamage: Boolean(globalModifiers.reRollDamage),
      damageBonus: globalModifiers.damageBonus,
      apImprovement: globalModifiers.apImprove,
      hitModifier: finalHitMod,
      woundModifier: finalWoundMod,
      critHitThreshold: globalModifiers.critHitThreshold,
      critWoundThreshold: globalModifiers.critWoundThreshold,
      hitReRoll: globalModifiers.hitReRoll,
      woundReRoll: globalModifiers.woundReRoll,
    });
  }

  return result;
}
