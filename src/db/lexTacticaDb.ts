import Dexie, { type Table } from 'dexie';
import type {
  CoreAction,
  CoreDataBundle,
  Datasheet,
  Detachment,
  Enhancement,
  Faction,
  FactionDataBundle,
  GameSessionState,
  RulesSource,
  SavedRoster,
  Stratagem,
} from '../types/rules';
import { createInitialGameSession } from '../engine/gameSessionEngine';

export interface SyncMetaRecord {
  key: string;
  value: string;
  updatedAt: number;
}

export class LexTacticaDatabase extends Dexie {
  meta!: Table<SyncMetaRecord, string>;
  factions!: Table<Faction, string>;
  sources!: Table<RulesSource, string>;
  detachments!: Table<Detachment, string>;
  datasheets!: Table<Datasheet, string>;
  stratagems!: Table<Stratagem, string>;
  coreActions!: Table<CoreAction, string>;
  enhancements!: Table<Enhancement, string>;
  savedRosters!: Table<SavedRoster, string>;
  gameSessions!: Table<GameSessionState, string>;

  constructor() {
    super('LexTactica11thEdDB');
    this.version(1).stores({
      meta: 'key',
      factions: 'id, name',
      sources: 'id, edition, type',
      detachments: 'id, factionId, name, forceDisposition',
      datasheets: 'id, factionId, name, role, isSupport',
      stratagems: 'id, factionId, detachmentId, isCore, timing',
      coreActions: 'id, name, type, rawPhase',
      enhancements: 'id, factionId, detachmentId, isUnitUpgrade',
      savedRosters: 'id, factionId, updatedAt',
      gameSessions: 'id, rosterId, updatedAt',
    });

    this.version(2).stores({}).upgrade(async (tx) => {
      // Clear cached Wahapedia content tables so pure 11th Ed bundles are loaded
      await tx.table('meta').clear();
      await tx.table('stratagems').clear();
      await tx.table('datasheets').clear();
      await tx.table('detachments').clear();
      await tx.table('enhancements').clear();
      await tx.table('coreActions').clear();
    });

    this.version(3).stores({}).upgrade(async (tx) => {
      // Refresh cached Wahapedia bundles with enhanced CoreAction & Faction ability phase tags
      await tx.table('meta').clear();
      await tx.table('stratagems').clear();
      await tx.table('datasheets').clear();
      await tx.table('detachments').clear();
      await tx.table('enhancements').clear();
      await tx.table('coreActions').clear();
    });
  }
}

export const db = new LexTacticaDatabase();

/**
 * Requests durable local storage from the browser OS so cached Wahapedia 11th Ed data
 * and local rosters are never evicted under mobile storage pressure.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore in environments without StorageManager
  }
  return false;
}

/**
 * Ensures `core.json` (Factions, Sources, Core Stratagems, 30 Core Actions) is loaded into IndexedDB.
 */
export async function ensureCoreDataSynced(): Promise<{ lastUpdate: string; factions: Faction[]; lastSyncedAt?: number }> {
  await requestPersistentStorage();

  const res = await fetch('./data/wahapedia-11ed/core.json');
  if (!res.ok) {
    throw new Error(`Failed to fetch core.json: HTTP ${res.status}`);
  }
  const coreBundle = (await res.json()) as CoreDataBundle;
  const existingLastUpdate = await db.meta.get('core_last_update');
  const now = Date.now();

  if (existingLastUpdate?.value !== coreBundle.lastUpdate) {
    await db.transaction(
      'rw',
      [db.meta, db.factions, db.sources, db.stratagems, db.coreActions],
      async () => {
        await db.factions.bulkPut(coreBundle.factions);
        await db.sources.bulkPut(coreBundle.sources);
        await db.stratagems.filter((s) => s.isCore).delete();
        await db.stratagems.bulkPut(coreBundle.coreStratagems);
        await db.coreActions.bulkPut(coreBundle.coreActions);
        await db.meta.put({
          key: 'core_last_update',
          value: coreBundle.lastUpdate,
          updatedAt: now,
        });
        await db.meta.put({
          key: 'last_wahapedia_sync',
          value: new Date(now).toISOString(),
          updatedAt: now,
        });
      }
    );
  } else {
    // If not existing yet, record the initial sync time
    const existingSyncMeta = await db.meta.get('last_wahapedia_sync');
    if (!existingSyncMeta) {
      await db.meta.put({
        key: 'last_wahapedia_sync',
        value: new Date(existingLastUpdate.updatedAt || now).toISOString(),
        updatedAt: existingLastUpdate.updatedAt || now,
      });
    }
  }

  const lastSyncRecord = await db.meta.get('last_wahapedia_sync');

  return {
    lastUpdate: coreBundle.lastUpdate,
    factions: coreBundle.factions,
    lastSyncedAt: lastSyncRecord?.updatedAt ?? existingLastUpdate?.updatedAt ?? now,
  };
}

/**
 * Loads a specific Faction's bundle (`public/data/wahapedia-11ed/factions/<factionId>.json`)
 * into IndexedDB on demand if not already synced for the current `lastUpdate`.
 */
export async function ensureFactionDataSynced(factionId: string): Promise<void> {
  if (!factionId) return;
  const coreMeta = await db.meta.get('core_last_update');
  const factionMetaKey = `faction_sync_${factionId}`;
  const factionMeta = await db.meta.get(factionMetaKey);

  if (factionMeta && coreMeta && factionMeta.value === coreMeta.value) {
    const count = await db.datasheets.where('factionId').equals(factionId).count();
    if (count > 0) return;
  }

  const res = await fetch(`./data/wahapedia-11ed/factions/${factionId}.json`);
  if (!res.ok) {
    throw new Error(`Failed to load faction bundle ${factionId}: HTTP ${res.status}`);
  }
  const bundle = (await res.json()) as FactionDataBundle;

  await db.transaction(
    'rw',
    [db.meta, db.detachments, db.datasheets, db.stratagems, db.enhancements],
    async () => {
      await db.detachments.where('factionId').equals(factionId).delete();
      await db.datasheets.where('factionId').equals(factionId).delete();
      await db.stratagems.where('factionId').equals(factionId).delete();
      await db.enhancements.where('factionId').equals(factionId).delete();
      await db.detachments.bulkPut(bundle.detachments);
      await db.datasheets.bulkPut(bundle.datasheets);
      await db.stratagems.bulkPut(bundle.stratagems);
      await db.enhancements.bulkPut(bundle.enhancements);
      await db.meta.put({
        key: factionMetaKey,
        value: bundle.lastUpdate,
        updatedAt: Date.now(),
      });
    }
  );
}

/**
 * Downloads and indexes all 25 Warhammer 40k 11th Edition factions into IndexedDB
 * for 100% offline tournament use.
 */
export async function syncAllFactionsForOffline(
  onProgress?: (completed: number, total: number, factionName: string) => void
): Promise<number> {
  const { factions } = await ensureCoreDataSynced();
  for (let i = 0; i < factions.length; i++) {
    const f = factions[i];
    onProgress?.(i + 1, factions.length, f.name);
    await ensureFactionDataSynced(f.id);
  }
  const syncTime = Date.now();
  await db.meta.put({
    key: 'all_factions_offline_ready',
    value: 'true',
    updatedAt: syncTime,
  });
  await db.meta.put({
    key: 'last_wahapedia_sync',
    value: new Date(syncTime).toISOString(),
    updatedAt: syncTime,
  });
  return syncTime;
}

/**
 * Creates a default starter 11th Edition Space Marines ("Crimson Fists 2K") roster
 * modeled after the 40K Playbook reference screenshot if the user has no saved rosters yet.
 */
export async function ensureStarterRosterSeeded(): Promise<SavedRoster> {
  const existing = await db.savedRosters.orderBy('updatedAt').reverse().first();
  if (existing) return existing;

  await ensureFactionDataSynced('SM');
  const smDatasheets = await db.datasheets.where('factionId').equals('SM').toArray();
  const smDetachments = await db.detachments.where('factionId').equals('SM').toArray();
  const smEnhancements = await db.enhancements.where('factionId').equals('SM').toArray();

  const findDs = (name: string) =>
    smDatasheets.find((d) => d.name.toLowerCase() === name.toLowerCase()) ??
    smDatasheets.find((d) => d.name.toLowerCase().includes(name.toLowerCase()));

  // Pick up to 3 modular detachments totaling <= 3 DP (or fallback to first available detachments)
  const pickedDetachments: Detachment[] = [];
  let dpSum = 0;
  for (const d of smDetachments) {
    if (dpSum + d.dp <= 3 && pickedDetachments.length < 3) {
      pickedDetachments.push(d);
      dpSum += d.dp;
    }
  }

  const desiredUnits: Array<{
    name: string;
    models: number;
    pts: number;
    isLeaderFor?: string;
    isSupportFor?: string;
  }> = [
    { name: 'Chaplain with Jump Pack', models: 1, pts: 75 },
    { name: 'Librarian', models: 1, pts: 65 },
    { name: 'Librarian in Terminator Armour', models: 1, pts: 75 },
    { name: 'Lieutenant', models: 1, pts: 65 },
    { name: 'Techmarine', models: 1, pts: 55 },
    { name: 'Intercessor Squad', models: 10, pts: 160 },
    { name: 'Bladeguard Veteran Squad', models: 6, pts: 180 },
    { name: 'Scout Squad', models: 5, pts: 65 },
    { name: 'Terminator Squad', models: 5, pts: 175 },
    { name: 'Vanguard Veteran Squad with Jump Packs', models: 10, pts: 210 },
    { name: 'Ballistus Dreadnought', models: 1, pts: 140 },
  ];

  const units: SavedRoster['units'] = [];
  for (let i = 0; i < desiredUnits.length; i++) {
    const spec = desiredUnits[i];
    const ds = findDs(spec.name);
    if (!ds) continue;
    const enhForDet = smEnhancements.find(
      (e) =>
        pickedDetachments.some((d) => d.id === e.detachmentId) &&
        ds.validEnhancementIds.includes(e.id) &&
        !e.isUnitUpgrade
    );

    units.push({
      instanceId: `starter_unit_${i + 1}`,
      datasheetId: ds.id,
      startingModels: spec.models,
      startingWoundsPerModel: ds.models[0]?.W ?? 2,
      points: spec.pts,
      enhancementIds: i === 2 && enhForDet ? [enhForDet.id] : [],
      initialStatus: 'on_battlefield',
    });
  }

  // Attach Librarian in Terminator Armour -> Terminator Squad, Chaplain with Jump Pack -> Vanguard Veterans,
  // and Librarian + Lieutenant -> Intercessor Squad (demonstrating 1 Leader + 1 Support / Composite Cards!)
  const findUnitInstance = (nameSubstr: string) =>
    units.find((u) => {
      const ds = smDatasheets.find((d) => d.id === u.datasheetId);
      return ds?.name.toLowerCase() === nameSubstr.toLowerCase();
    });

  const termSquad = findUnitInstance('Terminator Squad');
  const termLib = findUnitInstance('Librarian in Terminator Armour');
  if (termSquad && termLib) {
    termSquad.attachedLeaderInstanceId = termLib.instanceId;
  }

  const vanVets = findUnitInstance('Vanguard Veteran Squad with Jump Packs');
  const jumpChaplain = findUnitInstance('Chaplain with Jump Pack');
  if (vanVets && jumpChaplain) {
    vanVets.attachedLeaderInstanceId = jumpChaplain.instanceId;
  }

  const intercessors = findUnitInstance('Intercessor Squad');
  const librarian = findUnitInstance('Librarian');
  const lieutenant = findUnitInstance('Lieutenant');
  if (intercessors && librarian) {
    intercessors.attachedLeaderInstanceId = librarian.instanceId;
  }
  if (intercessors && lieutenant) {
    intercessors.attachedSupportInstanceId = lieutenant.instanceId;
  }

  const totalPoints = units.reduce((s, u) => s + u.points, 0);
  const starterRoster: SavedRoster = {
    id: 'starter_crimson_fists_2k',
    name: 'CRIMSON FISTS 2K',
    factionId: 'SM',
    subFactionName: 'Imperial Fists',
    battleSize: 'strike_force',
    detachmentIds: pickedDetachments.map((d) => d.id),
    forceDisposition: pickedDetachments[0]?.forceDisposition ?? 'Take and Hold',
    totalPoints,
    totalDetachmentPoints: dpSum || 1,
    units,
    updatedAt: Date.now(),
  };

  await db.savedRosters.put(starterRoster);
  const initialSession = createInitialGameSession(starterRoster, 'user');
  // Start in Charge Phase or Command Phase so user immediately sees rich playbook content
  initialSession.currentPhase = 'command';
  initialSession.userCp = 1;
  initialSession.opponentCp = 1;
  await db.gameSessions.put(initialSession);

  return starterRoster;
}
