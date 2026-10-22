/**
 * Milestone 1: Automated Wahapedia 11th Edition CSV-to-JSON Build Pipeline
 * Run with: npm run sync-data
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  extractDatasheetSlug,
  parseStratagemHtmlSections,
  parseWahapediaPipeCsv,
  stripHtmlToText,
} from '../src/engine/csvParser';
import {
  analyzeAbilityText,
  normalizeAbilityCategory,
  normalizeCoreActionPhases,
  normalizeStratagemPhase,
  normalizeStratagemTurn,
  parseDamagedThreshold,
  parseDatasheetCosts,
  parseSupportLeaderOverride,
} from '../src/engine/phaseNormalizer';
import type {
  Ability,
  CoreAction,
  CoreDataBundle,
  Datasheet,
  Detachment,
  DetachmentAbility,
  Enhancement,
  Faction,
  FactionDataBundle,
  ForceDisposition,
  ModelStatProfile,
  RulesSource,
  Stratagem,
  WeaponProfile,
} from '../src/types/rules';
import { KEYWORD_GLOSSARY } from '../src/engine/keywordGlossary';
import { WAHAPEDIA_CSV_FILES } from './inspect-wahapedia';
import { runMissionsAndMapsSync } from './sync-missions-and-maps';

const BASE_URL = 'https://wahapedia.ru/wh40k11ed';
const CACHE_DIR = path.resolve(process.cwd(), '.cache/wahapedia-11ed');
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/data/wahapedia-11ed');

async function fetchCsvWithCache(fileName: string, forceRefresh = false): Promise<Record<string, string>[]> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = path.join(CACHE_DIR, fileName);

  let rawText: string;
  if (!forceRefresh && fileName !== 'Last_update.csv' && fs.existsSync(cachePath)) {
    rawText = fs.readFileSync(cachePath, 'utf8');
  } else {
    const res = await fetch(`${BASE_URL}/${fileName}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${fileName}: HTTP ${res.status}`);
    }
    rawText = await res.text();
    fs.writeFileSync(cachePath, rawText, 'utf8');
  }

  const parsed = parseWahapediaPipeCsv(rawText);
  if (parsed.leftover.length > 0) {
    console.warn(`[WARN] ${fileName} had ${parsed.leftover.length} bytes of unparsed leftover.`);
  }
  return parsed.rows;
}

function parseStratagemCategory(typeStr: string): Stratagem['category'] {
  if (/Battle Tactic/i.test(typeStr)) return 'Battle Tactic';
  if (/Strategic Ploy/i.test(typeStr)) return 'Strategic Ploy';
  if (/Epic Deed/i.test(typeStr)) return 'Epic Deed';
  if (/Wargear/i.test(typeStr)) return 'Wargear';
  return 'Other';
}

async function buildWahapediaData() {
  console.log('Checking Wahapedia 11th Edition Last_update.csv...');
  const lastUpdateRows = await fetchCsvWithCache('Last_update.csv', true);
  const liveLastUpdate = lastUpdateRows[0]?.last_update ?? new Date().toISOString();

  const metaCachePath = path.join(CACHE_DIR, 'last_update.txt');
  const cachedLastUpdate = fs.existsSync(metaCachePath)
    ? fs.readFileSync(metaCachePath, 'utf8').trim()
    : '';
  const forceRefresh = cachedLastUpdate !== liveLastUpdate;
  if (forceRefresh) {
    console.log(`New Wahapedia 11th Ed data snapshot detected (${liveLastUpdate}). Downloading all CSVs...`);
  } else {
    console.log(`Using cached Wahapedia 11th Ed CSVs (${liveLastUpdate})...`);
  }

  const csvData: Record<string, Record<string, string>[]> = {
    'Last_update.csv': lastUpdateRows,
  };

  for (const file of WAHAPEDIA_CSV_FILES) {
    if (file === 'Last_update.csv') continue;
    csvData[file] = await fetchCsvWithCache(file, forceRefresh);
  }
  fs.writeFileSync(metaCachePath, liveLastUpdate, 'utf8');

  // 1. Factions
  const factions: Faction[] = csvData['Factions.csv'].map((r) => ({
    id: r.id,
    name: r.name,
    link: r.link,
  }));

  // 2. Sources — Filter out legacy 10th Edition (edition === "10") and Boarding Actions
  const excludedSourceIds = new Set<string>();
  const sources: RulesSource[] = [];
  for (const r of csvData['Source.csv']) {
    const isLegacy10th = r.edition === '10';
    const isBoardingActions = /Boarding Actions/i.test(r.name);
    if (isLegacy10th || isBoardingActions) {
      excludedSourceIds.add(r.id);
      continue;
    }
    sources.push({
      id: r.id,
      name: r.name,
      type: r.type,
      edition: r.edition,
      version: r.version,
      errataDate: r.errata_date,
      errataLink: r.errata_link,
    });
  }

  // 3. Shared Abilities (Abilities.csv)
  const sharedAbilitiesById = new Map<string, { id: string; factionId: string; name: string; legend: string; description: string }>();
  const sharedAbilitiesList: CoreDataBundle['sharedAbilities'] = [];
  for (const r of csvData['Abilities.csv']) {
    const cleanDesc = stripHtmlToText(r.description);
    const entry = {
      id: r.id,
      factionId: r.faction_id,
      name: r.name,
      legend: stripHtmlToText(r.legend),
      description: cleanDesc,
    };
    if (!sharedAbilitiesById.has(r.id)) {
      sharedAbilitiesById.set(r.id, entry);
      sharedAbilitiesList.push(entry);
    }
  }

  // 4. Detachments & Detachment Abilities (Exclude Boarding Actions)
  const excludedDetachmentIds = new Set<string>();
  const detachmentsById = new Map<string, Detachment>();
  for (const r of csvData['Detachments.csv']) {
    if (/Boarding Actions/i.test(r.type)) {
      excludedDetachmentIds.add(r.id);
      continue;
    }
    const dpNum = parseInt(r.dp, 10);
    detachmentsById.set(r.id, {
      id: r.id,
      factionId: r.faction_id,
      name: r.name,
      legend: stripHtmlToText(r.legend),
      type: r.type,
      dp: Number.isNaN(dpNum) ? 1 : dpNum,
      forceDisposition: (r.force_disposition || undefined) as ForceDisposition | undefined,
      abilities: [],
    });
  }

  for (const r of csvData['Detachment_abilities.csv']) {
    if (excludedDetachmentIds.has(r.detachment_id)) continue;
    const analyzed = analyzeAbilityText(r.name, r.description, false);
    const ability: DetachmentAbility = {
      id: r.id,
      factionId: r.faction_id,
      detachmentId: r.detachment_id,
      detachmentName: r.detachment,
      name: stripHtmlToText(r.name),
      legend: stripHtmlToText(r.legend),
      description: stripHtmlToText(r.description),
      phases: analyzed.phases,
      timing: analyzed.timing,
    };
    const det = detachmentsById.get(r.detachment_id);
    if (det) {
      det.abilities.push(ability);
    }
  }

  // 5. Stratagems & 30 Core Actions
  const coreActions: CoreAction[] = [];
  const seenCoreActionNames = new Set<string>();
  const coreStratagems: Stratagem[] = [];
  const factionStratagemsById = new Map<string, Stratagem>();

  for (const r of csvData['Stratagems.csv']) {
    // Filter out Boarding Actions stratagems
    if (/^Boarding Actions/i.test(r.type) || excludedDetachmentIds.has(r.detachment_id)) {
      continue;
    }

    // Separate the 30 11th Edition Core Actions (`Ability "Move"`, `Ability "Shoot"`, `Ability "Fight"`)
    if (r.phase.startsWith('Ability "') || r.type === 'Movement Ability' || r.type === 'Shooting Ability') {
      const dedupeKey = `${r.name.toUpperCase()}_${r.phase}`;
      if (!seenCoreActionNames.has(dedupeKey)) {
        seenCoreActionNames.add(dedupeKey);
        coreActions.push({
          id: r.id,
          name: r.name,
          type: (r.type === 'Movement Ability' ? 'Movement Ability' : 'Shooting Ability'),
          rawPhase: r.phase as CoreAction['rawPhase'],
          phases: normalizeCoreActionPhases(r.name, r.phase, r.description),
          description: stripHtmlToText(r.description),
        });
      }
      continue;
    }

    const parsedSections = parseStratagemHtmlSections(r.description);
    const cpCost = parseInt(r.cp_cost, 10);
    const isCore = !r.faction_id && r.type === 'Core Stratagem';

    const stratagem: Stratagem = {
      id: r.id,
      factionId: r.faction_id,
      name: r.name,
      type: r.type,
      category: parseStratagemCategory(r.type),
      isCore,
      cpCost: Number.isNaN(cpCost) ? 1 : cpCost,
      legend: stripHtmlToText(r.legend),
      rawTurn: r.turn,
      timing: normalizeStratagemTurn(r.turn),
      rawPhase: r.phase,
      phases: normalizeStratagemPhase(r.phase),
      detachment: r.detachment,
      detachmentId: r.detachment_id,
      description: parsedSections.cleanDescription,
      whenText: parsedSections.whenText,
      targetText: parsedSections.targetText,
      effectText: parsedSections.effectText,
    };

    if (isCore) {
      coreStratagems.push(stratagem);
    } else if (r.faction_id) {
      factionStratagemsById.set(r.id, stratagem);
    }
  }

  // 6. Datasheets pre-index (for slug resolution in Enhancements.support_leader)
  const slugToDatasheetId = new Map<string, string>();
  const datasheetsById = new Map<string, Datasheet>();

  for (const r of csvData['Datasheets.csv']) {
    if (r.virtual === 'true' || excludedSourceIds.has(r.source_id)) continue;
    const slug = extractDatasheetSlug(r.link);
    if (slug) {
      slugToDatasheetId.set(slug, r.id);
    }
    const isSupport = r.is_support === 'true';
    datasheetsById.set(r.id, {
      id: r.id,
      name: r.name,
      factionId: r.faction_id,
      sourceId: r.source_id,
      legend: stripHtmlToText(r.legend),
      role: r.role || 'Infantry',
      loadout: stripHtmlToText(r.loadout),
      transport: stripHtmlToText(r.transport),
      virtual: false,
      isSupport,
      leaderHead: stripHtmlToText(r.leader_head),
      leaderFooter: stripHtmlToText(r.leader_footer),
      damagedW: r.damaged_w || undefined,
      damagedThreshold: parseDamagedThreshold(r.damaged_w),
      damagedDescription: r.damaged_description ? stripHtmlToText(r.damaged_description) : undefined,
      link: r.link,
      slug,
      models: [],
      rangedWeapons: [],
      meleeWeapons: [],
      abilities: [],
      coreAbilities: [],
      factionAbilities: [],
      keywords: [],
      factionKeywords: [],
      unitComposition: [],
      wargearOptions: [],
      costTiers: [],
      wargearCosts: [],
      canLeadDatasheetIds: [],
      validStratagemIds: [],
      validEnhancementIds: [],
      validDetachmentAbilityIds: [],
    });
  }

  // 7. Enhancements (Exclude Boarding Actions detachments)
  const enhancementsById = new Map<string, Enhancement>();
  for (const r of csvData['Enhancements.csv']) {
    if (excludedDetachmentIds.has(r.detachment_id)) continue;
    const costNum = parseInt(r.cost, 10) || 0;
    const analyzed = analyzeAbilityText(r.name, r.description, false);
    const supportLeaderOverride = parseSupportLeaderOverride(r.support_leader, slugToDatasheetId);

    enhancementsById.set(r.id, {
      id: r.id,
      factionId: r.faction_id,
      name: stripHtmlToText(r.name),
      cost: costNum,
      detachment: r.detachment,
      detachmentId: r.detachment_id,
      isUnitUpgrade: r.upgrade === 'true',
      legend: stripHtmlToText(r.legend),
      description: stripHtmlToText(r.description),
      phases: analyzed.phases,
      timing: analyzed.timing,
      supportLeaderOverride,
    });
  }

  // 8. Populate Datasheet child tables
  // 8a. Datasheets_models.csv
  for (const r of csvData['Datasheets_models.csv']) {
    const ds = datasheetsById.get(r.datasheet_id);
    if (!ds) continue;
    const model: ModelStatProfile = {
      line: parseInt(r.line, 10) || 1,
      name: r.name,
      M: r.M,
      T: parseInt(r.T, 10) || 4,
      Sv: r.Sv,
      invSv: r.inv_sv && r.inv_sv !== '-' ? `${r.inv_sv.replace(/\+$/, '')}+` : undefined,
      invSvDescr: r.inv_sv_descr ? stripHtmlToText(r.inv_sv_descr) : undefined,
      W: parseInt(r.W, 10) || 1,
      Ld: r.Ld,
      OC: parseInt(r.OC, 10) || 0,
      baseSize: r.base_size || undefined,
      baseSizeDescr: r.base_size_descr || undefined,
    };
    ds.models.push(model);
  }

  // 8b. Datasheets_wargear.csv
  for (const r of csvData['Datasheets_wargear.csv']) {
    const ds = datasheetsById.get(r.datasheet_id);
    if (!ds) continue;
    const line = parseInt(r.line, 10) || 1;
    const lineInWargear = parseInt(r.line_in_wargear, 10) || 1;
    const cleanDesc = stripHtmlToText(r.description);
    const keywords = cleanDesc
      ? cleanDesc
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean)
      : [];
    const weaponType: 'Ranged' | 'Melee' = /Melee/i.test(r.type) || /Melee/i.test(r.range) ? 'Melee' : 'Ranged';
    const bsWs = r.BS_WS && r.BS_WS !== '-' ? `${r.BS_WS.replace(/\+$/, '')}+` : '-';
    const weapon: WeaponProfile = {
      id: `${ds.id}_${line}_${lineInWargear}`,
      line,
      lineInWargear,
      dice: r.dice || undefined,
      name: r.name,
      description: cleanDesc,
      keywords,
      range: r.range === 'Melee' || !r.range ? 'Melee' : `${r.range.replace(/"$/, '')}"`,
      type: weaponType,
      A: r.A,
      BS_WS: bsWs,
      S: r.S,
      AP: r.AP,
      D: r.D,
      isOneShot: /one shot/i.test(cleanDesc),
    };
    if (weaponType === 'Melee') {
      ds.meleeWeapons.push(weapon);
    } else {
      ds.rangedWeapons.push(weapon);
    }
  }

  // 8c. Datasheets_abilities.csv
  for (const r of csvData['Datasheets_abilities.csv']) {
    const ds = datasheetsById.get(r.datasheet_id);
    if (!ds) continue;
    const category = normalizeAbilityCategory(r.type);
    const line = parseInt(r.line, 10) || 1;
    const param = r.parameter?.trim() || undefined;

    let resolvedName = stripHtmlToText(r.name);
    let resolvedDesc = stripHtmlToText(r.description);

    if ((category === 'Core' || category === 'Faction') && r.ability_id) {
      const shared = sharedAbilitiesById.get(r.ability_id);
      if (shared) {
        resolvedName = param ? `${shared.name} ${param}` : shared.name;
        resolvedDesc = shared.description;
      }
    } else if (param && resolvedName && !resolvedName.includes(param)) {
      resolvedName = `${resolvedName} ${param}`;
    }

    if (category === 'Core' && resolvedName) {
      if (!ds.coreAbilities.includes(resolvedName)) {
        ds.coreAbilities.push(resolvedName);
      }
    }
    if (category === 'Faction' && resolvedName) {
      if (!ds.factionAbilities.includes(resolvedName)) {
        ds.factionAbilities.push(resolvedName);
      }
    }

    const analyzed = analyzeAbilityText(resolvedName, resolvedDesc, ds.isSupport);
    const ability: Ability = {
      id: `${ds.id}_ab_${line}`,
      abilityId: r.ability_id || undefined,
      line,
      model: r.model || undefined,
      name: resolvedName || category,
      description: resolvedDesc,
      type: category,
      parameter: param,
      phases: analyzed.phases,
      timing: analyzed.timing,
      isLeaderBuff: analyzed.isLeaderBuff,
      isSupportBuff: analyzed.isSupportBuff,
      isAura: analyzed.isAura,
      isOncePerBattle: analyzed.isOncePerBattle,
      isDefensiveOrReactive: analyzed.isDefensiveOrReactive,
    };
    ds.abilities.push(ability);
  }

  // 8d. Datasheets_keywords.csv
  for (const r of csvData['Datasheets_keywords.csv']) {
    const ds = datasheetsById.get(r.datasheet_id);
    if (!ds || !r.keyword) continue;
    if (r.is_faction_keyword === 'true') {
      if (!ds.factionKeywords.includes(r.keyword)) {
        ds.factionKeywords.push(r.keyword);
      }
    } else {
      if (!ds.keywords.includes(r.keyword)) {
        ds.keywords.push(r.keyword);
      }
    }
  }

  // 8e. Datasheets_unit_composition.csv & Datasheets_options.csv
  for (const r of csvData['Datasheets_unit_composition.csv']) {
    const ds = datasheetsById.get(r.datasheet_id);
    if (!ds) continue;
    ds.unitComposition.push(stripHtmlToText(r.description));
  }
  for (const r of csvData['Datasheets_options.csv']) {
    const ds = datasheetsById.get(r.datasheet_id);
    if (!ds) continue;
    ds.wargearOptions.push(stripHtmlToText(r.description));
  }

  // 8f. Datasheets_models_cost.csv
  const costRowsByDatasheet = new Map<string, Array<{ line: string; description: string; cost: string }>>();
  for (const r of csvData['Datasheets_models_cost.csv']) {
    if (!datasheetsById.has(r.datasheet_id)) continue;
    let list = costRowsByDatasheet.get(r.datasheet_id);
    if (!list) {
      list = [];
      costRowsByDatasheet.set(r.datasheet_id, list);
    }
    list.push({ line: r.line, description: r.description, cost: r.cost });
  }
  for (const [dsId, rows] of costRowsByDatasheet.entries()) {
    const ds = datasheetsById.get(dsId);
    if (!ds) continue;
    const { costTiers, wargearCosts } = parseDatasheetCosts(rows);
    ds.costTiers = costTiers;
    ds.wargearCosts = wargearCosts;
  }

  // 8g. Junction tables: Datasheets_leader, Datasheets_stratagems, Datasheets_enhancements, Datasheets_detachment_abilities
  for (const r of csvData['Datasheets_leader.csv']) {
    const leaderDs = datasheetsById.get(r.leader_id);
    if (leaderDs && datasheetsById.has(r.attached_id)) {
      if (!leaderDs.canLeadDatasheetIds.includes(r.attached_id)) {
        leaderDs.canLeadDatasheetIds.push(r.attached_id);
      }
    }
  }
  for (const r of csvData['Datasheets_stratagems.csv']) {
    const ds = datasheetsById.get(r.datasheet_id);
    if (ds && (factionStratagemsById.has(r.stratagem_id) || coreStratagems.some((s) => s.id === r.stratagem_id))) {
      if (!ds.validStratagemIds.includes(r.stratagem_id)) {
        ds.validStratagemIds.push(r.stratagem_id);
      }
    }
  }
  for (const r of csvData['Datasheets_enhancements.csv']) {
    const ds = datasheetsById.get(r.datasheet_id);
    if (ds && enhancementsById.has(r.enhancement_id)) {
      if (!ds.validEnhancementIds.includes(r.enhancement_id)) {
        ds.validEnhancementIds.push(r.enhancement_id);
      }
    }
  }
  for (const r of csvData['Datasheets_detachment_abilities.csv']) {
    const ds = datasheetsById.get(r.datasheet_id);
    if (ds) {
      if (!ds.validDetachmentAbilityIds.includes(r.detachment_ability_id)) {
        ds.validDetachmentAbilityIds.push(r.detachment_ability_id);
      }
    }
  }

  // 9. Write output bundles to public/data/wahapedia-11ed/
  const factionsOutDir = path.join(OUTPUT_DIR, 'factions');
  fs.mkdirSync(factionsOutDir, { recursive: true });

  const coreBundle: CoreDataBundle = {
    lastUpdate: liveLastUpdate,
    factions,
    sources,
    detachments: [...detachmentsById.values()],
    coreStratagems,
    coreActions,
    sharedAbilities: sharedAbilitiesList,
    keywordGlossary: KEYWORD_GLOSSARY,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'core.json'), JSON.stringify(coreBundle), 'utf8');

  const manifestFactions: Array<{
    id: string;
    name: string;
    datasheetCount: number;
    detachmentCount: number;
    stratagemCount: number;
    enhancementCount: number;
  }> = [];

  for (const faction of factions) {
    const fDetachments = [...detachmentsById.values()].filter((d) => d.factionId === faction.id);
    const fDatasheets = [...datasheetsById.values()].filter((d) => d.factionId === faction.id);
    const fStratagems = [...factionStratagemsById.values()].filter((s) => s.factionId === faction.id);
    const fEnhancements = [...enhancementsById.values()].filter((e) => e.factionId === faction.id);

    const factionBundle: FactionDataBundle = {
      faction,
      lastUpdate: liveLastUpdate,
      detachments: fDetachments,
      datasheets: fDatasheets,
      stratagems: fStratagems,
      enhancements: fEnhancements,
    };

    fs.writeFileSync(
      path.join(factionsOutDir, `${faction.id}.json`),
      JSON.stringify(factionBundle),
      'utf8'
    );

    manifestFactions.push({
      id: faction.id,
      name: faction.name,
      datasheetCount: fDatasheets.length,
      detachmentCount: fDetachments.length,
      stratagemCount: fStratagems.length,
      enhancementCount: fEnhancements.length,
    });
  }

  const manifest = {
    edition: '11th Edition',
    lastUpdate: liveLastUpdate,
    generatedAt: new Date().toISOString(),
    totalFactions: factions.length,
    totalDatasheets: datasheetsById.size,
    totalDetachments: detachmentsById.size,
    totalStratagems: factionStratagemsById.size + coreStratagems.length,
    totalCoreActions: coreActions.length,
    totalEnhancements: enhancementsById.size,
    factions: manifestFactions,
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log('\nWahapedia 11th Edition JSON bundles generated successfully!');
  console.log(`  Snapshot:      ${liveLastUpdate}`);
  console.log(`  Factions:      ${manifest.totalFactions}`);
  console.log(`  Datasheets:    ${manifest.totalDatasheets} (strict 11th Ed, non-virtual)`);
  console.log(`  Detachments:   ${manifest.totalDetachments} (strict 11th Ed, Boarding Actions excluded)`);
  console.log(`  Stratagems:    ${manifest.totalStratagems}`);
  console.log(`  Core Actions:  ${manifest.totalCoreActions}`);
  console.log(`  Enhancements:  ${manifest.totalEnhancements}`);

  console.log('\nChecking and updating 11th Edition Mission Matrix & Maps...');
  await runMissionsAndMapsSync();
}

buildWahapediaData().catch((err) => {
  console.error(err);
  process.exit(1);
});
