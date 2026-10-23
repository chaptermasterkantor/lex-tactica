/**
 * Lex Tactica — 11th Edition Mathhammer Discrete Probability Engine
 *
 * Implements 100% exact discrete probability convolution across attacker dice
 * (attacks, hits, criticals, wounds, damage) and defender rolls (saves, cover,
 * damage reduction, Feel No Pain, and 1D multi-wound model allocation waste).
 */

export interface DiceExpression {
  numDice: number; // e.g. 1 for D6, 2 for 2D6, 0 for static
  dieSides: number; // 3 or 6 (0 if static)
  modifier: number; // e.g. +2
  rawString: string;
}

export type ReRollMode = 'none' | 'ones' | 'failed' | 'non_crit';
export type SaveReRollMode = 'none' | 'ones' | 'failed';

export interface WeaponCombatProfile {
  id: string;
  name: string;
  count: number; // number of this weapon active in the squad
  A: string;
  BS_WS: string;
  S: number;
  AP: number; // e.g. -1, -2, 0
  D: string;
  // Intrinsic & conditional keywords
  isTorrent?: boolean;
  hasLethalHits?: boolean;
  sustainedHitsVal?: number; // 0 for none, 1, 2, 3, or -1 for D3
  hasDevastatingWounds?: boolean;
  hasTwinLinked?: boolean;
  antiKeywordThreshold?: number; // e.g. 2, 3, 4, 5 for Anti-X
  hasLance?: boolean;
  hasHeavy?: boolean;
  hasIgnoresCover?: boolean;
  meltaVal?: number; // e.g. 2 for Melta 2
  rapidFireVal?: number; // e.g. 1, 2, 4 (or -1 for D3)
  blastVal?: number; // e.g. 1 for Blast 1
  cleaveVal?: number; // e.g. 1 for Cleave 1 (melee counterpart to Blast)
  isConversion?: boolean; // Crit on 4+ at conversion range
  reRollDamage?: boolean; // e.g. Eradicators Total Obliteration
  // Overrides & Context
  attacksBonus?: number; // e.g. +1 Attack from ability
  strengthBonus?: number;
  apImprovement?: number; // e.g. +1 AP (makes -1 into -2)
  damageBonus?: number; // e.g. +1 Damage
  hitModifier?: number; // -1, 0, +1
  woundModifier?: number; // -1, 0, +1
  critHitThreshold?: number; // default 6, can be 5 or 4
  critWoundThreshold?: number; // default 6 (or from Anti-X)
  hitReRoll?: ReRollMode;
  woundReRoll?: ReRollMode;
}

export interface DefenderCombatProfile {
  name: string;
  models: number;
  woundsPerModel: number;
  currentModelWounds: number; // wounds remaining on the currently wounded model (1 to woundsPerModel)
  T: number;
  Sv: number; // e.g. 3 for 3+
  invSv?: number | null; // e.g. 4 for 4+ (null if none)
  fnp?: number | null; // e.g. 6 for 6+
  fnpMortalDev?: number | null; // e.g. 5 for 5+ vs mortal/devastating (Aegis of the Emperor)
  // Defensive buffs / debuffs
  hasCover?: boolean;
  apWorsen?: number; // e.g. 1 for Armour of Contempt
  damageReduction?: 'none' | 'minus_one' | 'halve_up';
  hitPenalty?: number; // e.g. 1 for Stealth (-1 to Hit)
  woundPenalty?: number; // e.g. 1 for -1 to Wound
  saveReRoll?: SaveReRollMode;
}

export interface PercentileBandResult {
  min: number;
  max: number;
  median: number;
  bandMean: number; // Exact Conditional Expectation (CVaR) in this probability slice
}

export interface OutcomeMetricSummary {
  expectedMean: number;
  bottom25: PercentileBandResult; // Worst 25% for attacker / best saves for defender
  middle50: PercentileBandResult; // Typical range (25th to 75th percentile)
  top25: PercentileBandResult; // Best 25% for attacker / failed saves for defender
  distribution: Array<{ value: number; probability: number; cumulativeAbove: number }>;
}

export interface WeaponBreakdownResult {
  weaponId: string;
  weaponName: string;
  count: number;
  expectedAttacks: number;
  expectedHits: number;
  expectedWounds: number;
  expectedUnsaved: number;
  expectedRawDamage: number;
  expectedEffectiveDamage: number;
}

export interface MathhammerResult {
  killProbabilityPercent: number; // Exact probability of wiping all models (P(H === 0))
  modelsKilled: OutcomeMetricSummary;
  effectiveWoundsInflicted: OutcomeMetricSummary;
  uncappedRawDamage: OutcomeMetricSummary;
  remainingModels: {
    expectedMean: number;
    median: number;
    bottom25: number; // High remaining (attacker bottom 25%)
    middle50Min: number;
    middle50Max: number;
    top25: number; // Low remaining (attacker top 25%)
  };
  remainingWounds: {
    expectedMean: number;
    median: number;
  };
  weaponBreakdowns: WeaponBreakdownResult[];
  calculationTimeMs: number;
}

// ============================================================================
// 1. DICE PARSING & CONVOLUTION HELPERS
// ============================================================================

export function parseDiceExpression(expr: string): DiceExpression {
  const clean = (expr || '').trim();
  if (!clean || clean === '-') {
    return { numDice: 0, dieSides: 0, modifier: 0, rawString: '0' };
  }
  // Matches: "D6", "2D6", "D3", "2D3", "D6+1", "2D6+3", "D3+2", "3", "12"
  const match = clean.match(/^(?:(\d*)D(3|6))?(?:\+(\d+))?$|^(\d+)$/i);
  if (!match) {
    const fallbackNum = parseInt(clean, 10);
    return {
      numDice: 0,
      dieSides: 0,
      modifier: isNaN(fallbackNum) ? 0 : fallbackNum,
      rawString: clean,
    };
  }
  if (match[4] !== undefined) {
    // Static number
    return {
      numDice: 0,
      dieSides: 0,
      modifier: parseInt(match[4], 10),
      rawString: clean,
    };
  }
  const numDice = match[1] ? parseInt(match[1], 10) : 1;
  const dieSides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;
  return { numDice, dieSides, modifier, rawString: clean };
}

/**
 * Convolves two discrete probability mass functions (Float64Array).
 */
export function convolvePMFs(a: Float64Array, b: Float64Array): Float64Array {
  if (a.length === 0) return new Float64Array(b);
  if (b.length === 0) return new Float64Array(a);
  const out = new Float64Array(a.length + b.length - 1);
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    if (ai === 0) continue;
    for (let j = 0; j < b.length; j++) {
      out[i + j] += ai * b[j];
    }
  }
  return out;
}

/**
 * Generates the discrete PMF for a single D3 or D6 die (1-indexed, so index 0 = prob of 0).
 * If reRollBelowMean is true, values strictly below (sides+1)/2 are re-rolled once.
 */
export function getSingleDiePMF(sides: number, reRollBelowMean = false): Float64Array {
  const pmf = new Float64Array(sides + 1);
  if (!reRollBelowMean) {
    const p = 1.0 / sides;
    for (let i = 1; i <= sides; i++) {
      pmf[i] = p;
    }
    return pmf;
  }
  // Re-roll die if outcome < (sides + 1) / 2
  const reRollCount = Math.floor(sides / 2); // 1 for D3, 3 for D6
  const pReRoll = reRollCount / sides; // 1/3 for D3, 0.5 for D6
  for (let i = 1; i <= sides; i++) {
    if (i < (sides + 1) / 2) {
      pmf[i] = (1.0 / sides) * pReRoll;
    } else {
      pmf[i] = (1.0 / sides) * (1.0 + pReRoll);
    }
  }
  return pmf;
}

/**
 * Computes the PMF for a dice expression kDm + B (with optional damage re-roll).
 */
export function getDiceExpressionPMF(
  expr: DiceExpression,
  reRollBelowMean = false
): Float64Array {
  if (expr.numDice <= 0 || expr.dieSides <= 0) {
    const staticVal = Math.max(0, expr.modifier);
    const pmf = new Float64Array(staticVal + 1);
    pmf[staticVal] = 1.0;
    return pmf;
  }
  const singleDie = getSingleDiePMF(expr.dieSides, reRollBelowMean);
  let current = singleDie;
  for (let d = 1; d < expr.numDice; d++) {
    current = convolvePMFs(current, singleDie);
  }
  if (expr.modifier > 0) {
    const shifted = new Float64Array(current.length + expr.modifier);
    for (let i = 0; i < current.length; i++) {
      shifted[i + expr.modifier] = current[i];
    }
    return shifted;
  }
  return current;
}

// ============================================================================
// 2. HIT ROLL & WOUND ROLL MATHEMATICS
// ============================================================================

export interface HitProbabilities {
  pMiss: number;
  pNormHit: number;
  pCritHit: number;
}

export function computeHitProbabilities(
  bsWsStr: string,
  isTorrent: boolean,
  isOverwatch: boolean,
  hitModifier: number,
  critThreshold: number,
  reRollMode: ReRollMode,
  isIndirectNotVisible = false
): HitProbabilities {
  if (isTorrent || bsWsStr === '-' || bsWsStr === '7+') {
    return { pMiss: 0, pNormHit: 1.0, pCritHit: 0 };
  }

  const rawMatch = bsWsStr.match(/(\d+)/);
  const baseTarget = rawMatch ? parseInt(rawMatch[1], 10) : 4;
  const netHitMod = Math.max(-1, Math.min(1, hitModifier));
  const critThresholdClamped = Math.max(4, Math.min(6, critThreshold));

  let qMiss = 0;
  let qNormHit = 0;
  let qCritHit = 0;

  for (let r = 1; r <= 6; r++) {
    if (isOverwatch) {
      if (r === 6) {
        qCritHit += 1 / 6;
      } else {
        qMiss += 1 / 6;
      }
    } else {
      if (r === 1) {
        qMiss += 1 / 6;
      } else if (r >= critThresholdClamped) {
        qCritHit += 1 / 6;
      } else if (isIndirectNotVisible && r <= 3) {
        qMiss += 1 / 6;
      } else if (r + netHitMod >= baseTarget) {
        qNormHit += 1 / 6;
      } else {
        qMiss += 1 / 6;
      }
    }
  }

  // Apply Re-rolls
  let pMiss = qMiss;
  let pNormHit = qNormHit;
  let pCritHit = qCritHit;

  if (reRollMode === 'ones') {
    const pOne = 1 / 6;
    pMiss = qMiss - pOne + pOne * qMiss;
    pNormHit = qNormHit * (1 + pOne);
    pCritHit = qCritHit * (1 + pOne);
  } else if (reRollMode === 'failed') {
    pMiss = qMiss * qMiss;
    pNormHit = qNormHit * (1 + qMiss);
    pCritHit = qCritHit * (1 + qMiss);
  } else if (reRollMode === 'non_crit') {
    const pNonCrit = 1 - qCritHit;
    pCritHit = qCritHit + pNonCrit * qCritHit;
    pNormHit = pNonCrit * qNormHit;
    pMiss = pNonCrit * qMiss;
  }

  return { pMiss, pNormHit, pCritHit };
}

export interface WoundProbabilities {
  pFailWound: number;
  pNormWound: number;
  pCritWound: number;
}

export function computeWoundProbabilities(
  strength: number,
  toughness: number,
  woundModifier: number,
  critThreshold: number,
  reRollMode: ReRollMode
): WoundProbabilities {
  let baseTarget: number;
  if (strength >= toughness * 2) {
    baseTarget = 2;
  } else if (strength > toughness) {
    baseTarget = 3;
  } else if (strength === toughness) {
    baseTarget = 4;
  } else if (strength * 2 <= toughness) {
    baseTarget = 6;
  } else {
    baseTarget = 5;
  }

  const netWoundMod = Math.max(-1, Math.min(1, woundModifier));
  const critThresholdClamped = Math.max(2, Math.min(6, critThreshold));

  let qFail = 0;
  let qNorm = 0;
  let qCrit = 0;

  for (let w = 1; w <= 6; w++) {
    if (w === 1) {
      qFail += 1 / 6;
    } else if (w >= critThresholdClamped) {
      qCrit += 1 / 6;
    } else if (w + netWoundMod >= baseTarget) {
      qNorm += 1 / 6;
    } else {
      qFail += 1 / 6;
    }
  }

  let pFailWound = qFail;
  let pNormWound = qNorm;
  let pCritWound = qCrit;

  if (reRollMode === 'ones') {
    const pOne = 1 / 6;
    pFailWound = qFail - pOne + pOne * qFail;
    pNormWound = qNorm * (1 + pOne);
    pCritWound = qCrit * (1 + pOne);
  } else if (reRollMode === 'failed') {
    pFailWound = qFail * qFail;
    pNormWound = qNorm * (1 + qFail);
    pCritWound = qCrit * (1 + qFail);
  } else if (reRollMode === 'non_crit') {
    const pNonCrit = 1 - qCrit;
    pCritWound = qCrit + pNonCrit * qCrit;
    pNormWound = pNonCrit * qNorm;
    pFailWound = pNonCrit * qFail;
  }

  return { pFailWound, pNormWound, pCritWound };
}

// ============================================================================
// 3. DEFENDER SAVES, DAMAGE MODIFIERS & FEEL NO PAIN
// ============================================================================

export function computeSaveFailureProbability(
  baseSv: number,
  invSv: number | null | undefined,
  ap: number, // AP is <= 0, e.g. -2
  hasCover: boolean,
  ignoresCover: boolean,
  reRollMode: SaveReRollMode = 'none'
): number {
  // In 40k, Cover adds +1 to armor save (lowering target by 1), UNLESS
  // baseSv <= 3 and net AP is 0.
  const coverBonus =
    hasCover && !ignoresCover && !(baseSv <= 3 && ap === 0) ? 1 : 0;
  // Subtracting AP (which is <= 0) increases target: e.g. Sv 3+, AP -2 -> 3 - (-2) = 5+
  const armorTarget = Math.max(2, baseSv - ap - coverBonus);
  const invulnTarget = invSv !== null && invSv !== undefined && invSv >= 2 ? invSv : 999;
  const effectiveTarget = Math.min(armorTarget, invulnTarget);

  if (effectiveTarget > 6) {
    return 1.0;
  }
  const qFail = Math.max(0, Math.min(1, (effectiveTarget - 1) / 6));

  if (reRollMode === 'ones') {
    return Math.max(0, qFail - (1 / 6) * (1 - qFail));
  } else if (reRollMode === 'failed') {
    return qFail * qFail;
  }
  return qFail;
}

/**
 * Computes single-wound damage PMF after damage modifiers and Feel No Pain binomial reduction.
 */
export function computeFinalDamagePMF(
  rawDamagePMF: Float64Array,
  damageReduction: 'none' | 'minus_one' | 'halve_up',
  damageBonus: number,
  meltaBonus: number,
  fnpTarget: number | null | undefined
): Float64Array {
  // 1. Transform raw damage values according to 40k Rules Commentary modifier order:
  // Division (Halve Damage) -> Additions (Damage Bonus, Melta) -> Subtractions (-1 Damage, min 1)
  const modifiedPMFMap: Record<number, number> = {};

  for (let d0 = 0; d0 < rawDamagePMF.length; d0++) {
    const prob = rawDamagePMF[d0];
    if (prob === 0) continue;

    let d = d0;
    // Step A: Halve Damage (round up)
    if (damageReduction === 'halve_up') {
      d = Math.ceil(d / 2);
    }
    // Step B: Additions
    d += damageBonus + meltaBonus;
    // Step C: Subtractions (min 1)
    if (damageReduction === 'minus_one') {
      d = Math.max(1, d - 1);
    }
    d = Math.max(0, d);
    modifiedPMFMap[d] = (modifiedPMFMap[d] || 0) + prob;
  }

  // Max damage after modifiers
  let maxD = 0;
  for (const k of Object.keys(modifiedPMFMap)) {
    maxD = Math.max(maxD, parseInt(k, 10));
  }

  // 2. If no Feel No Pain, return modified distribution directly
  const fnpClamped = fnpTarget !== null && fnpTarget !== undefined && fnpTarget >= 2 && fnpTarget <= 6 ? fnpTarget : null;
  if (!fnpClamped) {
    const out = new Float64Array(maxD + 1);
    for (const [k, p] of Object.entries(modifiedPMFMap)) {
      out[parseInt(k, 10)] = p;
    }
    return out;
  }

  // 3. Feel No Pain X+: Each point of damage has independent binomial test.
  // Probability of ignoring 1 point of damage: pIgnore = (7 - fnp) / 6.
  const pIgnore = (7 - fnpClamped) / 6;
  const pTake = 1.0 - pIgnore;

  const fnpPMF = new Float64Array(maxD + 1);

  for (const [kStr, probD] of Object.entries(modifiedPMFMap)) {
    const d = parseInt(kStr, 10);
    if (d === 0) {
      fnpPMF[0] += probD;
      continue;
    }
    // Binomial expansion: k final wounds taken out of d damage points
    // P(k taken) = C(d, k) * (pTake)^k * (pIgnore)^(d - k)
    const binomCoeff = new Float64Array(d + 1);
    binomCoeff[0] = 1;
    for (let i = 1; i <= d; i++) {
      binomCoeff[i] = (binomCoeff[i - 1] * (d - i + 1)) / i;
    }
    for (let k = 0; k <= d; k++) {
      const probK = binomCoeff[k] * Math.pow(pTake, k) * Math.pow(pIgnore, d - k);
      fnpPMF[k] += probD * probK;
    }
  }

  return fnpPMF;
}

// ============================================================================
// 4. 1D ALLOCATION STATE MACHINE & ATTACK OPERATOR
// ============================================================================

/**
 * Computes next health state h' after receiving d non-spillover damage.
 * State h represents total remaining wounds in the unit.
 * Excess damage from a single attack does NOT spill over when the currently
 * wounded model dies.
 */
export function getNextAllocationState(
  h: number,
  damage: number,
  woundsPerModel: number
): number {
  if (h <= 0 || damage <= 0) return h;
  const activeModelRemaining = ((h - 1) % woundsPerModel) + 1;
  const damageApplied = Math.min(damage, activeModelRemaining);
  return h - damageApplied;
}

/**
 * Single-hit linear transition on the health distribution vector p.
 */
export function applyDamageTransition(
  p: Float64Array,
  damagePMF: Float64Array,
  woundsPerModel: number
): Float64Array {
  const pNext = new Float64Array(p.length);
  for (let h = 0; h < p.length; h++) {
    const ph = p[h];
    if (ph === 0) continue;
    for (let d = 0; d < damagePMF.length; d++) {
      const pd = damagePMF[d];
      if (pd === 0) continue;
      const hNext = getNextAllocationState(h, d, woundsPerModel);
      pNext[hNext] += ph * pd;
    }
  }
  return pNext;
}

// ============================================================================
// 5. MASTER SIMULATION & STATISTICAL METRICS
// ============================================================================

export function calculateMathhammer(
  attackerWeapons: WeaponCombatProfile[],
  defender: DefenderCombatProfile,
  isOverwatch = false
): MathhammerResult {
  const startTime = performance.now();

  const totalStartingWounds =
    (defender.models - 1) * defender.woundsPerModel +
    Math.max(1, Math.min(defender.woundsPerModel, defender.currentModelWounds));

  // State vector p: index h represents probability of h total wounds remaining
  let pUnitHealth: Float64Array = new Float64Array(totalStartingWounds + 1);
  pUnitHealth[totalStartingWounds] = 1.0;

  // Uncapped Raw Damage PMF: convolved across all weapons
  let pUncappedRawDamage: Float64Array = new Float64Array(1);
  pUncappedRawDamage[0] = 1.0;

  const weaponBreakdowns: WeaponBreakdownResult[] = [];

  for (const weapon of attackerWeapons) {
    if (weapon.count <= 0) continue;

    // Check phantom/dummy weapon rows
    if (!weapon.name.trim() || weapon.A === '0' || weapon.D === '-') continue;

    // 1. Hit Probabilities
    const hitProbs = computeHitProbabilities(
      weapon.BS_WS,
      Boolean(weapon.isTorrent),
      isOverwatch,
      weapon.hitModifier ?? 0,
      weapon.critHitThreshold ?? (weapon.isConversion ? 4 : 6),
      weapon.hitReRoll ?? 'none',
      false
    );

    // 2. Wound Probabilities
    const woundProbs = computeWoundProbabilities(
      weapon.S + (weapon.strengthBonus ?? 0),
      defender.T,
      (weapon.woundModifier ?? 0) + (weapon.hasLance ? 1 : 0) - (defender.woundPenalty ?? 0),
      weapon.critWoundThreshold ?? weapon.antiKeywordThreshold ?? 6,
      weapon.woundReRoll ?? (weapon.hasTwinLinked ? 'failed' : 'none')
    );

    // 3. Save Probabilities
    const netAP = Math.min(
      0,
      weapon.AP - (weapon.apImprovement ?? 0) + (defender.apWorsen ?? 0)
    );
    const pUnsavedNormal = computeSaveFailureProbability(
      defender.Sv,
      defender.invSv,
      netAP,
      Boolean(defender.hasCover),
      Boolean(weapon.hasIgnoresCover),
      defender.saveReRoll ?? 'none'
    );
    const pUnsavedDevastating = 1.0; // Devastating wounds bypass saves

    // 4. Damage PMFs
    const rawDamageDice = parseDiceExpression(weapon.D);
    const rawDamagePMF = getDiceExpressionPMF(rawDamageDice, Boolean(weapon.reRollDamage));

    const finalDamageNormal = computeFinalDamagePMF(
      rawDamagePMF,
      defender.damageReduction ?? 'none',
      weapon.damageBonus ?? 0,
      weapon.meltaVal ?? 0,
      defender.fnp
    );

    const finalDamageDevastating = computeFinalDamagePMF(
      rawDamagePMF,
      defender.damageReduction ?? 'none',
      weapon.damageBonus ?? 0,
      weapon.meltaVal ?? 0,
      defender.fnpMortalDev ?? defender.fnp
    );

    // 5. Per-Hit Damage PMFs
    // A Normal Hit rolls to wound; on crit wound (if Dev Wounds) it deals dev damage, else normal damage if unsaved
    const hasDev = Boolean(weapon.hasDevastatingWounds);
    const pNormalWoundUnsaved = woundProbs.pNormWound * pUnsavedNormal;
    const pCritWoundUnsaved = hasDev
      ? woundProbs.pCritWound * pUnsavedDevastating
      : woundProbs.pCritWound * pUnsavedNormal;
    const pNoWoundOrSaved = 1.0 - pNormalWoundUnsaved - pCritWoundUnsaved;

    const maxDamageLen = Math.max(finalDamageNormal.length, finalDamageDevastating.length);
    const dNormHit = new Float64Array(maxDamageLen);
    dNormHit[0] += pNoWoundOrSaved;
    for (let d = 0; d < finalDamageNormal.length; d++) {
      dNormHit[d] += pNormalWoundUnsaved * finalDamageNormal[d];
      if (!hasDev) {
        dNormHit[d] += pCritWoundUnsaved * finalDamageNormal[d];
      }
    }
    if (hasDev) {
      for (let d = 0; d < finalDamageDevastating.length; d++) {
        dNormHit[d] += pCritWoundUnsaved * finalDamageDevastating[d];
      }
    }

    // A Lethal Auto-Wound skips the wound roll as a Normal Wound, then must be saved
    const dLethalHit = new Float64Array(finalDamageNormal.length);
    dLethalHit[0] += 1.0 - pUnsavedNormal;
    for (let d = 0; d < finalDamageNormal.length; d++) {
      dLethalHit[d] += pUnsavedNormal * finalDamageNormal[d];
    }

    // 6. Attack Count Distribution for this weapon across all active gun models
    const rawAttackDice = parseDiceExpression(weapon.A);
    const blastBonus = weapon.blastVal
      ? Math.floor(defender.models / 5) * weapon.blastVal
      : 0;
    const cleaveBonus = weapon.cleaveVal
      ? Math.floor(defender.models / 5) * weapon.cleaveVal
      : 0;
    const rapidFireBonus = weapon.rapidFireVal ?? 0;
    const perGunAttackBonus =
      (weapon.attacksBonus ?? 0) + blastBonus + cleaveBonus + rapidFireBonus;

    const perGunAttackDice: DiceExpression = {
      ...rawAttackDice,
      modifier: rawAttackDice.modifier + perGunAttackBonus,
    };
    const perGunAttackPMF = getDiceExpressionPMF(perGunAttackDice);

    // Convolve across weapon.count models
    let totalAttacksPMF = perGunAttackPMF;
    for (let c = 1; c < weapon.count; c++) {
      totalAttacksPMF = convolvePMFs(totalAttacksPMF, perGunAttackPMF);
    }

    // 7. Single-Attack Transition Operator
    const hasLethal = Boolean(weapon.hasLethalHits);
    const sustainedVal = weapon.sustainedHitsVal ?? 0;

    // Helper to evaluate T_crit
    const evaluateCritTransition = (pCurrent: Float64Array, sHits: number): Float64Array => {
      if (hasLethal) {
        let pTemp = applyDamageTransition(pCurrent, dLethalHit, defender.woundsPerModel);
        for (let s = 0; s < sHits; s++) {
          pTemp = applyDamageTransition(pTemp, dNormHit, defender.woundsPerModel);
        }
        return pTemp;
      } else {
        let pTemp = pCurrent;
        for (let s = 0; s < 1 + sHits; s++) {
          pTemp = applyDamageTransition(pTemp, dNormHit, defender.woundsPerModel);
        }
        return pTemp;
      }
    };

    const applySingleAttack = (pCurrent: Float64Array): Float64Array => {
      const pNext = new Float64Array(pCurrent.length);
      // Branch 1: Miss
      if (hitProbs.pMiss > 0) {
        for (let h = 0; h < pCurrent.length; h++) {
          pNext[h] += hitProbs.pMiss * pCurrent[h];
        }
      }
      // Branch 2: Normal Hit
      if (hitProbs.pNormHit > 0) {
        const pAfterNorm = applyDamageTransition(pCurrent, dNormHit, defender.woundsPerModel);
        for (let h = 0; h < pNext.length; h++) {
          pNext[h] += hitProbs.pNormHit * pAfterNorm[h];
        }
      }
      // Branch 3: Critical Hit
      if (hitProbs.pCritHit > 0) {
        if (sustainedVal === -1) {
          // Sustained Hits D3: 1, 2, or 3 with equal probability 1/3
          for (const sHits of [1, 2, 3]) {
            const pCritS = evaluateCritTransition(pCurrent, sHits);
            for (let h = 0; h < pNext.length; h++) {
              pNext[h] += (hitProbs.pCritHit / 3) * pCritS[h];
            }
          }
        } else {
          const pCritS = evaluateCritTransition(pCurrent, sustainedVal);
          for (let h = 0; h < pNext.length; h++) {
            pNext[h] += hitProbs.pCritHit * pCritS[h];
          }
        }
      }
      return pNext;
    };

    // 8. Propagate across the attack count distribution
    const maxAttacks = totalAttacksPMF.length - 1;
    const healthAtStep: Float64Array[] = [pUnitHealth];
    for (let a = 1; a <= maxAttacks; a++) {
      healthAtStep.push(applySingleAttack(healthAtStep[a - 1]));
    }

    const pUnitHealthNext = new Float64Array(totalStartingWounds + 1);
    for (let a = 0; a <= maxAttacks; a++) {
      const probA = totalAttacksPMF[a];
      if (probA === 0) continue;
      const ha = healthAtStep[a];
      for (let h = 0; h <= totalStartingWounds; h++) {
        pUnitHealthNext[h] += probA * ha[h];
      }
    }

    // 9. Uncapped Raw Damage for this single attack
    // Build single-attack raw damage PMF
    const singleAttackRawD = new Float64Array(maxDamageLen * (1 + (sustainedVal > 0 ? sustainedVal : 1)));
    singleAttackRawD[0] += hitProbs.pMiss;

    // Normal hit raw damage
    const normHitD = new Float64Array(finalDamageNormal.length);
    normHitD[0] += pNoWoundOrSaved;
    for (let d = 0; d < finalDamageNormal.length; d++) {
      normHitD[d] += pNormalWoundUnsaved * finalDamageNormal[d];
      if (!hasDev) normHitD[d] += pCritWoundUnsaved * finalDamageNormal[d];
    }
    if (hasDev) {
      for (let d = 0; d < finalDamageDevastating.length; d++) {
        normHitD[d] += pCritWoundUnsaved * finalDamageDevastating[d];
      }
    }
    for (let d = 0; d < normHitD.length; d++) {
      singleAttackRawD[d] += hitProbs.pNormHit * normHitD[d];
    }

    // Crit hit raw damage
    const lethalHitD = new Float64Array(finalDamageNormal.length);
    lethalHitD[0] += 1.0 - pUnsavedNormal;
    for (let d = 0; d < finalDamageNormal.length; d++) {
      lethalHitD[d] += pUnsavedNormal * finalDamageNormal[d];
    }

    let critHitD: Float64Array;
    const sHits = sustainedVal === -1 ? 2 : sustainedVal; // use expected 2 for D3 raw breakdown
    if (hasLethal) {
      critHitD = lethalHitD;
      for (let s = 0; s < sHits; s++) {
        critHitD = convolvePMFs(critHitD, normHitD);
      }
    } else {
      critHitD = normHitD;
      for (let s = 0; s < sHits; s++) {
        critHitD = convolvePMFs(critHitD, normHitD);
      }
    }
    for (let d = 0; d < critHitD.length; d++) {
      singleAttackRawD[d] += hitProbs.pCritHit * critHitD[d];
    }

    // Convolve uncapped raw damage across max expected attacks
    let expAttacks = 0;
    for (let a = 0; a <= maxAttacks; a++) {
      expAttacks += a * totalAttacksPMF[a];
    }
    const roundedAttacks = Math.max(1, Math.round(expAttacks));
    let weaponRawD: Float64Array = singleAttackRawD;
    for (let a = 1; a < roundedAttacks; a++) {
      weaponRawD = convolvePMFs(weaponRawD, singleAttackRawD);
    }
    pUncappedRawDamage = convolvePMFs(pUncappedRawDamage, weaponRawD);

    // Compute expected damage difference on this unit
    let prevExpWounds = 0;
    let nextExpWounds = 0;
    for (let h = 0; h <= totalStartingWounds; h++) {
      prevExpWounds += (totalStartingWounds - h) * pUnitHealth[h];
      nextExpWounds += (totalStartingWounds - h) * pUnitHealthNext[h];
    }

    const expHits = expAttacks * (hitProbs.pNormHit + hitProbs.pCritHit * (1 + (sustainedVal === -1 ? 2 : sustainedVal)));
    const expWounds = expHits * (woundProbs.pNormWound + woundProbs.pCritWound);
    const expUnsaved = expWounds * pUnsavedNormal;
    let expRawD = 0;
    for (let d = 0; d < weaponRawD.length; d++) {
      expRawD += d * weaponRawD[d];
    }

    weaponBreakdowns.push({
      weaponId: weapon.id,
      weaponName: weapon.name,
      count: weapon.count,
      expectedAttacks: Math.round(expAttacks * 10) / 10,
      expectedHits: Math.round(expHits * 10) / 10,
      expectedWounds: Math.round(expWounds * 10) / 10,
      expectedUnsaved: Math.round(expUnsaved * 10) / 10,
      expectedRawDamage: Math.round(expRawD * 10) / 10,
      expectedEffectiveDamage: Math.round((nextExpWounds - prevExpWounds) * 10) / 10,
    });

    pUnitHealth = pUnitHealthNext;
  }

  // 10. Extract Metrics & Percentile Bands from Final Distribution
  // A. Models Killed PMF: k = defender.models - ceil(h / defender.woundsPerModel)
  const modelsKilledPMF = new Float64Array(defender.models + 1);
  for (let h = 0; h <= totalStartingWounds; h++) {
    const k = defender.models - Math.ceil(h / defender.woundsPerModel);
    modelsKilledPMF[k] += pUnitHealth[h];
  }

  // B. Effective Wounds Inflicted PMF: w = totalStartingWounds - h
  const effectiveWoundsPMF = new Float64Array(totalStartingWounds + 1);
  for (let h = 0; h <= totalStartingWounds; h++) {
    effectiveWoundsPMF[totalStartingWounds - h] = pUnitHealth[h];
  }

  const modelsKilledSummary = extractMetricSummary(modelsKilledPMF);
  const effectiveWoundsSummary = extractMetricSummary(effectiveWoundsPMF);
  const uncappedRawSummary = extractMetricSummary(pUncappedRawDamage);

  const killProbabilityPercent = Math.round(pUnitHealth[0] * 1000) / 10;

  // Remaining Models calculation
  const remModelsMean = Math.max(0, defender.models - modelsKilledSummary.expectedMean);
  const remModelsMedian = Math.max(0, defender.models - modelsKilledSummary.middle50.median);
  const remModelsBottom25 = Math.max(0, defender.models - modelsKilledSummary.bottom25.max);
  const remModelsMiddle50Min = Math.max(0, defender.models - modelsKilledSummary.middle50.max);
  const remModelsMiddle50Max = Math.max(0, defender.models - modelsKilledSummary.middle50.min);
  const remModelsTop25 = Math.max(0, defender.models - modelsKilledSummary.top25.min);

  const remWoundsMean = Math.max(0, totalStartingWounds - effectiveWoundsSummary.expectedMean);
  const remWoundsMedian = Math.max(0, totalStartingWounds - effectiveWoundsSummary.middle50.median);

  const calculationTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    killProbabilityPercent,
    modelsKilled: modelsKilledSummary,
    effectiveWoundsInflicted: effectiveWoundsSummary,
    uncappedRawDamage: uncappedRawSummary,
    remainingModels: {
      expectedMean: Math.round(remModelsMean * 10) / 10,
      median: remModelsMedian,
      bottom25: remModelsBottom25,
      middle50Min: remModelsMiddle50Min,
      middle50Max: remModelsMiddle50Max,
      top25: remModelsTop25,
    },
    remainingWounds: {
      expectedMean: Math.round(remWoundsMean * 10) / 10,
      median: remWoundsMedian,
    },
    weaponBreakdowns,
    calculationTimeMs,
  };
}

/**
 * Computes exact quantiles and Tail Conditional Expectations (CVaR) on [0, 0.25], [0.25, 0.75], and [0.75, 1.0].
 */
export function extractMetricSummary(pmf: Float64Array): OutcomeMetricSummary {
  let expectedMean = 0;
  for (let x = 0; x < pmf.length; x++) {
    expectedMean += x * pmf[x];
  }

  // Build CDF
  const cdf = new Float64Array(pmf.length);
  let cum = 0;
  for (let x = 0; x < pmf.length; x++) {
    cum += pmf[x];
    cdf[x] = cum;
  }
  // Ensure last is exactly 1.0
  if (cdf.length > 0) cdf[cdf.length - 1] = 1.0;

  const quantile = (u: number): number => {
    for (let x = 0; x < cdf.length; x++) {
      if (cdf[x] >= u - 1e-9) return x;
    }
    return cdf.length - 1;
  };

  // Exact conditional expectation (CVaR) in interval [u1, u2]
  const bandExpectation = (u1: number, u2: number): number => {
    let sum = 0;
    for (let x = 0; x < pmf.length; x++) {
      const pPrev = x > 0 ? cdf[x - 1] : 0;
      const pCurr = cdf[x];
      const overlap = Math.max(0, Math.min(pCurr, u2) - Math.max(pPrev, u1));
      sum += x * overlap;
    }
    return sum / (u2 - u1);
  };

  const bottom25Min = quantile(0.01);
  const bottom25Max = quantile(0.25);
  const bottom25Median = quantile(0.125);
  const bottom25Mean = bandExpectation(0.0, 0.25);

  const mid50Min = quantile(0.25);
  const mid50Max = quantile(0.75);
  const mid50Median = quantile(0.5);
  const mid50Mean = bandExpectation(0.25, 0.75);

  const top25Min = quantile(0.75);
  const top25Max = quantile(0.99);
  const top25Median = quantile(0.875);
  const top25Mean = bandExpectation(0.75, 1.0);

  const distribution: Array<{ value: number; probability: number; cumulativeAbove: number }> = [];
  for (let x = 0; x < pmf.length; x++) {
    if (pmf[x] > 0.0001 || (x > 0 && x < cdf.length - 1 && cdf[x] < 0.999)) {
      const probAbove = x > 0 ? 1.0 - cdf[x - 1] : 1.0;
      distribution.push({
        value: x,
        probability: Math.round(pmf[x] * 1000) / 10, // e.g. 24.5%
        cumulativeAbove: Math.round(probAbove * 1000) / 10,
      });
    }
  }

  return {
    expectedMean: Math.round(expectedMean * 10) / 10,
    bottom25: {
      min: bottom25Min,
      max: bottom25Max,
      median: bottom25Median,
      bandMean: Math.round(bottom25Mean * 10) / 10,
    },
    middle50: {
      min: mid50Min,
      max: mid50Max,
      median: mid50Median,
      bandMean: Math.round(mid50Mean * 10) / 10,
    },
    top25: {
      min: top25Min,
      max: top25Max,
      median: top25Median,
      bandMean: Math.round(top25Mean * 10) / 10,
    },
    distribution,
  };
}
