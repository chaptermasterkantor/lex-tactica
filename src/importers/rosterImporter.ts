import JSZip from 'jszip';
import type {
  BattleSize,
  Datasheet,
  Detachment,
  Enhancement,
  ForceDisposition,
  RosterUnit,
  SavedRoster,
} from '../types/rules';
import { getExpectedPointsForUnitCopy } from '../engine/rosterValidator';

function normalizeLookupName(str: string): string {
  return str
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function findBestDatasheetMatch(
  rawName: string,
  datasheets: Datasheet[]
): Datasheet | undefined {
  const target = normalizeLookupName(rawName);
  if (!target) return undefined;

  // 1. Exact normalized match
  const exact = datasheets.find((d) => normalizeLookupName(d.name) === target);
  if (exact) return exact;

  // 2. Singular/plural or prefix match
  const close = datasheets.find((d) => {
    const dn = normalizeLookupName(d.name);
    return dn.startsWith(target) || target.startsWith(dn);
  });
  if (close) return close;

  // 3. Substring match
  return datasheets.find((d) => {
    const dn = normalizeLookupName(d.name);
    return dn.includes(target) || target.includes(dn);
  });
}

function inferBattleSize(totalPoints: number): BattleSize {
  if (totalPoints <= 1000) return 'incursion';
  if (totalPoints <= 2000) return 'strike_force';
  return 'onslaught';
}

export interface RawWeaponEntry {
  name: string;
  count?: number;
}

/**
 * Matches weapon names and quantities from an imported unit selection against the Datasheet's weapons.
 */
export function matchEquippedWeaponData(
  rawWeapons: RawWeaponEntry[],
  datasheet: Datasheet,
  startingModels: number
): { equippedWeaponIds: string[]; equippedWeaponCounts: Record<string, number> } {
  const allWeapons = [...datasheet.rangedWeapons, ...datasheet.meleeWeapons];
  if (rawWeapons.length === 0) {
    const ids = allWeapons.map((w) => w.id);
    const counts: Record<string, number> = {};
    for (const id of ids) {
      counts[id] = startingModels;
    }
    return { equippedWeaponIds: ids, equippedWeaponCounts: counts };
  }

  const matchedIds = new Set<string>();
  const counts: Record<string, number> = {};

  for (const raw of rawWeapons) {
    const normW = normalizeLookupName(raw.name);
    if (!normW) continue;
    const rawQty = raw.count && raw.count > 0 ? raw.count : undefined;

    for (const w of allWeapons) {
      const baseWeaponName = normalizeLookupName(w.name.split(' - ')[0]);
      const fullWeaponName = normalizeLookupName(w.name);
      if (
        fullWeaponName === normW ||
        baseWeaponName === normW ||
        fullWeaponName.includes(normW) ||
        normW.includes(baseWeaponName) ||
        (normW.includes('power weapon') && baseWeaponName.includes('power sword')) ||
        (normW.includes('power sword') && baseWeaponName.includes('power weapon'))
      ) {
        matchedIds.add(w.id);
        if (rawQty !== undefined) {
          counts[w.id] = (counts[w.id] ?? 0) + rawQty;
        }
      }
    }
  }

  // Always include standard default melee weapon (e.g. Close combat weapon) if no melee weapon was matched
  const hasMelee = [...matchedIds].some((id) =>
    datasheet.meleeWeapons.some((mw) => mw.id === id)
  );
  if (!hasMelee && datasheet.meleeWeapons.length > 0) {
    const defaultMelee =
      datasheet.meleeWeapons.find((w) => /close combat weapon|armoured hull|combat weapon/i.test(w.name)) ??
      datasheet.meleeWeapons[0];
    if (defaultMelee) {
      matchedIds.add(defaultMelee.id);
      counts[defaultMelee.id] = startingModels;
    }
  }

  const equippedWeaponIds = matchedIds.size > 0 ? [...matchedIds] : allWeapons.map((w) => w.id);

  // For any matched weapon that didn't have an explicit count:
  for (const id of equippedWeaponIds) {
    if (counts[id] === undefined) {
      const w = allWeapons.find((x) => x.id === id);
      const isBase = w ? (datasheet.loadout || '').toLowerCase().includes(w.name.toLowerCase().split(' - ')[0]) : false;
      counts[id] = startingModels > 1 ? (isBase ? startingModels : 1) : 1;
    }
  }

  return { equippedWeaponIds, equippedWeaponCounts: counts };
}

/**
 * Matches weapon names from an imported unit selection against the Datasheet's ranged & melee weapons.
 */
function matchEquippedWeaponIds(rawWeaponNames: string[], datasheet: Datasheet): string[] {
  return matchEquippedWeaponData(
    rawWeaponNames.map((name) => ({ name })),
    datasheet,
    1
  ).equippedWeaponIds;
}

/**
 * Parses a New Recruit / BattleScribe JSON export (or a Lex Tactica SavedRoster backup JSON)
 * into a normalized `SavedRoster`.
 */
export function importFromNewRecruitJson(
  jsonText: string,
  factionId: string,
  datasheets: Datasheet[],
  detachments: Detachment[],
  enhancements: Enhancement[]
): SavedRoster {
  const data = JSON.parse(jsonText);

  // Direct Lex Tactica SavedRoster backup format
  if (data && Array.isArray(data.units) && data.factionId) {
    return {
      ...data,
      id: data.id || `roster_${Date.now()}`,
      updatedAt: Date.now(),
    } as SavedRoster;
  }

  const rosterObj = data?.roster ?? data;
  const rosterName = rosterObj?.name || 'Imported 11th Ed Roster';
  const forces = rosterObj?.forces ?? [];

  const units: RosterUnit[] = [];
  const detachmentIds: string[] = [];
  const copyCounts = new Map<string, number>();

  const walkSelections = (selections: any[]) => {
    for (const sel of selections ?? []) {
      const selName: string = sel.name || '';
      const selType: string = (sel.type || '').toLowerCase();

      // Check if selection is a Detachment
      const matchedDet = detachments.find(
        (d) =>
          normalizeLookupName(d.name) === normalizeLookupName(selName) ||
          normalizeLookupName(selName).includes(normalizeLookupName(d.name))
      );
      if (matchedDet && !detachmentIds.includes(matchedDet.id)) {
        detachmentIds.push(matchedDet.id);
      }

      // Check child selections for detachment names too
      for (const sub of sel.selections ?? []) {
        const subDet = detachments.find(
          (d) => normalizeLookupName(d.name) === normalizeLookupName(sub.name || '')
        );
        if (subDet && !detachmentIds.includes(subDet.id)) {
          detachmentIds.push(subDet.id);
        }
      }

      if (selType === 'unit' || selType === 'model') {
        const ds = findBestDatasheetMatch(selName, datasheets);
        if (ds) {
          const copyNum = (copyCounts.get(ds.id) ?? 0) + 1;
          copyCounts.set(ds.id, copyNum);

          // Sum points from selection + nested selections
          const calcPoints = (node: any): number => {
            const ownPts = (node.costs ?? [])
              .filter((c: any) => /pts|points/i.test(c.name || ''))
              .reduce((s: number, c: any) => s + (Number(c.value) || 0), 0);
            const childPts = (node.selections ?? []).reduce(
              (s: number, ch: any) => s + calcPoints(ch),
              0
            );
            return ownPts + childPts;
          };

          // Count models & collect weapon / enhancement names
          let modelCount = Number(sel.number) || 1;
          const rawWeapons: RawWeaponEntry[] = [];
          const unitEnhancementIds: string[] = [];

          const inspectChildren = (children: any[], depth = 0, parentModelQty = 1) => {
            let subModels = 0;
            for (const ch of children ?? []) {
              const chName = ch.name || '';
              const chType = (ch.type || '').toLowerCase();
              const chNum = Number(ch.number) || 1;
              if (chType === 'model') {
                subModels += chNum;
              }
              const matchedEnh = enhancements.find(
                (e) => normalizeLookupName(e.name) === normalizeLookupName(chName)
              );
              if (matchedEnh && !unitEnhancementIds.includes(matchedEnh.id)) {
                unitEnhancementIds.push(matchedEnh.id);
              } else if (chType !== 'model') {
                const effectiveCount = chNum > 1 ? chNum : parentModelQty;
                rawWeapons.push({ name: chName, count: effectiveCount });
              }
              inspectChildren(ch.selections, depth + 1, chType === 'model' ? chNum : parentModelQty);
            }
            if (depth === 0 && subModels > 0) {
              modelCount = subModels;
            }
          };
          inspectChildren(sel.selections, 0);

          const importedPts = calcPoints(sel);
          const fallbackPts = getExpectedPointsForUnitCopy(ds, modelCount, copyNum);
          const primaryModel = ds.models[0];
          const weaponData = matchEquippedWeaponData(rawWeapons, ds, modelCount);

          units.push({
            instanceId: `unit_${Date.now()}_${units.length + 1}`,
            datasheetId: ds.id,
            customName: sel.customName || undefined,
            startingModels: modelCount,
            startingWoundsPerModel: primaryModel?.W ?? 1,
            points: importedPts > 0 ? importedPts : fallbackPts,
            equippedWeaponIds: weaponData.equippedWeaponIds,
            equippedWeaponCounts: weaponData.equippedWeaponCounts,
            enhancementIds: unitEnhancementIds,
            initialStatus: 'on_battlefield',
          });
          continue;
        }
      }

      if (sel.selections) {
        walkSelections(sel.selections);
      }
    }
  };

  for (const force of forces) {
    walkSelections(force.selections ?? []);
  }

  const totalPoints = units.reduce((sum, u) => sum + u.points, 0);
  const totalDetachmentPoints = detachmentIds.reduce((sum, id) => {
    const d = detachments.find((det) => det.id === id);
    return sum + (d?.dp ?? 1);
  }, 0);
  const primaryDet = detachments.find((d) => d.id === detachmentIds[0]);

  return {
    id: `roster_${Date.now()}`,
    name: rosterName,
    factionId,
    battleSize: inferBattleSize(totalPoints),
    detachmentIds: detachmentIds.length > 0 ? detachmentIds : detachments.slice(0, 1).map((d) => d.id),
    forceDisposition: primaryDet?.forceDisposition as ForceDisposition | undefined,
    totalPoints,
    totalDetachmentPoints: totalDetachmentPoints || 1,
    units,
    updatedAt: Date.now(),
  };
}

/**
 * Parses a New Recruit / BattleScribe `.rosz` (ZIP) or `.ros` (XML) file into a `SavedRoster`.
 */
export async function importFromRoszOrRosFile(
  file: File,
  factionId: string,
  datasheets: Datasheet[],
  detachments: Detachment[],
  enhancements: Enhancement[]
): Promise<SavedRoster> {
  let xmlText = '';
  if (file.name.toLowerCase().endsWith('.rosz')) {
    const zip = await JSZip.loadAsync(file);
    const rosFile = Object.values(zip.files).find((f) => f.name.toLowerCase().endsWith('.ros'));
    if (!rosFile) {
      throw new Error('No .ros XML file found inside .rosz archive.');
    }
    xmlText = await rosFile.async('string');
  } else {
    xmlText = await file.text();
  }

  // If user selected a JSON file with .ros/.json extension
  if (xmlText.trim().startsWith('{')) {
    return importFromNewRecruitJson(xmlText, factionId, datasheets, detachments, enhancements);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const rosterEl = doc.querySelector('roster');
  const rosterName = rosterEl?.getAttribute('name') || file.name.replace(/\.(rosz|ros)$/i, '');

  const selectionToObj = (el: Element): any => {
    const costs = [...el.querySelectorAll(':scope > costs > cost')].map((c) => ({
      name: c.getAttribute('name') || '',
      value: Number(c.getAttribute('value') || 0),
    }));
    const selections = [...el.querySelectorAll(':scope > selections > selection')].map(selectionToObj);
    return {
      name: el.getAttribute('name') || '',
      type: el.getAttribute('type') || '',
      number: Number(el.getAttribute('number') || 1),
      costs,
      selections,
    };
  };

  const forces = [...doc.querySelectorAll('forces > force')].map((f) => ({
    name: f.getAttribute('name') || '',
    selections: [...f.querySelectorAll(':scope > selections > selection')].map(selectionToObj),
  }));

  return importFromNewRecruitJson(
    JSON.stringify({ roster: { name: rosterName, forces } }),
    factionId,
    datasheets,
    detachments,
    enhancements
  );
}

/**
 * Parses a plain-text army list (from Official 40K App, New Recruit text export, or WTC format)
 * into a structured `SavedRoster`.
 */
export function importFromPlainTextList(
  rawText: string,
  factionId: string,
  datasheets: Datasheet[],
  detachments: Detachment[],
  enhancements: Enhancement[]
): SavedRoster {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let rosterName = lines[0]?.replace(/\(\d+\s*pts?\)/i, '').trim() || 'Imported Army List';
  const detachmentIds: string[] = [];
  const units: RosterUnit[] = [];
  const copyCounts = new Map<string, number>();

  // Scan all lines for Detachment names first
  for (const line of lines) {
    for (const det of detachments) {
      if (normalizeLookupName(line).includes(normalizeLookupName(det.name))) {
        if (!detachmentIds.includes(det.id)) {
          detachmentIds.push(det.id);
        }
      }
    }
  }

  let currentUnit: RosterUnit | undefined;
  let currentUnitDs: Datasheet | undefined;
  let currentWeapons: RawWeaponEntry[] = [];

  const flushUnitWeapons = () => {
    if (currentUnit && currentUnitDs) {
      const weaponData = matchEquippedWeaponData(
        currentWeapons,
        currentUnitDs,
        currentUnit.startingModels
      );
      currentUnit.equippedWeaponIds = weaponData.equippedWeaponIds;
      currentUnit.equippedWeaponCounts = weaponData.equippedWeaponCounts;
    }
    currentWeapons = [];
  };

  for (const line of lines) {
    // Check if this line is an Enhancement on the current unit
    const enhMatch = enhancements.find((e) =>
      normalizeLookupName(line).includes(normalizeLookupName(e.name))
    );
    if (enhMatch && currentUnit) {
      if (!currentUnit.enhancementIds.includes(enhMatch.id)) {
        currentUnit.enhancementIds.push(enhMatch.id);
      }
      continue;
    }

    // Check if this line is a bulleted weapon/model line under the current unit
    if (/^[•\-*]\s+/.test(line) && currentUnit) {
      const cleanBullet = line.replace(/^[•\-*]\s+/, '').replace(/^\d+x?\s+/i, '');
      const countMatch = line.match(/^[•\-*]\s+(\d+)x?\s+/i);
      const parsedCount = countMatch ? parseInt(countMatch[1], 10) : 1;
      if (countMatch && currentUnitDs && currentUnitDs.models.length > 0) {
        if (
          parsedCount > currentUnit.startingModels &&
          normalizeLookupName(cleanBullet).includes(
            normalizeLookupName(currentUnitDs.models[0].name)
          )
        ) {
          currentUnit.startingModels = parsedCount;
        }
      }
      currentWeapons.push({ name: cleanBullet, count: parsedCount });
      continue;
    }

    // Try matching a Datasheet unit header line: e.g. "Intercessor Squad (x10) (160 Points)" or "10x Intercessor Squad [160 pts]"
    const ptsMatch = line.match(/[\(\[](\d+)\s*(?:pts?|points?)[\)\]]|\b(\d+)\s*(?:pts?|points?)$/i);
    const pointsVal = ptsMatch ? parseInt(ptsMatch[1] || ptsMatch[2], 10) : 0;

    const leadingCountMatch = line.match(/^(\d+)x?\s+(.+)/i);
    const bracketCountMatch = line.match(/[\(\[](?:x|×)?(\d+)(?:\s*models?)?[\)\]]/i);

    const candidateName = line
      .replace(/^(\d+)x?\s+/i, '')
      .replace(/[\(\[][^)\]]*[\)\]]/g, '')
      .replace(/[-–—]\s*\d+\s*(?:pts?|points?)$/i, '')
      .trim();

    const matchedDs = findBestDatasheetMatch(candidateName, datasheets);
    if (matchedDs && (pointsVal > 0 || normalizeLookupName(candidateName) === normalizeLookupName(matchedDs.name))) {
      flushUnitWeapons();

      const copyNum = (copyCounts.get(matchedDs.id) ?? 0) + 1;
      copyCounts.set(matchedDs.id, copyNum);

      const defaultModels = matchedDs.costTiers[0]?.modelsCount ?? 1;
      const modelCount = bracketCountMatch
        ? parseInt(bracketCountMatch[1], 10)
        : leadingCountMatch
        ? parseInt(leadingCountMatch[1], 10)
        : defaultModels;

      const resolvedPts =
        pointsVal > 0 ? pointsVal : getExpectedPointsForUnitCopy(matchedDs, modelCount, copyNum);

      currentUnitDs = matchedDs;
      currentUnit = {
        instanceId: `unit_${Date.now()}_${units.length + 1}`,
        datasheetId: matchedDs.id,
        startingModels: modelCount,
        startingWoundsPerModel: matchedDs.models[0]?.W ?? 1,
        points: resolvedPts,
        enhancementIds: [],
        initialStatus: 'on_battlefield',
      };
      units.push(currentUnit);
    } else if (currentUnit) {
      const lineCountMatch = line.match(/^(\d+)x?\s+/i);
      const parsedCount = lineCountMatch ? parseInt(lineCountMatch[1], 10) : 1;
      currentWeapons.push({
        name: line.replace(/^(\d+)x?\s+/i, ''),
        count: parsedCount,
      });
    }
  }
  flushUnitWeapons();

  const totalPoints = units.reduce((sum, u) => sum + u.points, 0);
  const finalDetachments =
    detachmentIds.length > 0 ? detachmentIds : detachments.slice(0, 1).map((d) => d.id);
  const totalDetachmentPoints = finalDetachments.reduce((sum, id) => {
    const d = detachments.find((det) => det.id === id);
    return sum + (d?.dp ?? 1);
  }, 0);
  const primaryDet = detachments.find((d) => d.id === finalDetachments[0]);

  return {
    id: `roster_${Date.now()}`,
    name: rosterName,
    factionId,
    battleSize: inferBattleSize(totalPoints),
    detachmentIds: finalDetachments,
    forceDisposition: primaryDet?.forceDisposition as ForceDisposition | undefined,
    totalPoints,
    totalDetachmentPoints: totalDetachmentPoints || 1,
    units,
    updatedAt: Date.now(),
  };
}
