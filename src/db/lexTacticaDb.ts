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
import defaultRosterData from '../config/defaultRoster.json';

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

    this.version(4).stores({}).upgrade(async (tx) => {
      // Upgrade starter roster to 10.21.26 2k Crimson Fists list
      const existingStarter = await tx.table('savedRosters').get('starter_crimson_fists_2k');
      if (existingStarter && (existingStarter.units?.length !== 14 || existingStarter.totalPoints !== 1990)) {
        await tx.table('savedRosters').put({
          ...(defaultRosterData as unknown as SavedRoster),
          updatedAt: Date.now(),
        });
        await tx.table('gameSessions').delete('session_starter_crimson_fists_2k');
      }
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
 * Ensures `core.json` (Factions, Sources, Detachments, Core Stratagems, 30 Core Actions) is loaded into IndexedDB.
 */
export async function ensureCoreDataSynced(): Promise<{
  lastUpdate: string;
  factions: Faction[];
  detachments: Detachment[];
  lastSyncedAt?: number;
}> {
  await requestPersistentStorage();

  const res = await fetch('./data/wahapedia-11ed/core.json');
  if (!res.ok) {
    throw new Error(`Failed to fetch core.json: HTTP ${res.status}`);
  }
  const coreBundle = (await res.json()) as CoreDataBundle;
  const existingLastUpdate = await db.meta.get('core_last_update');
  const detachmentsCoreSynced = await db.meta.get('core_detachments_synced');
  const now = Date.now();

  if (existingLastUpdate?.value !== coreBundle.lastUpdate || !detachmentsCoreSynced) {
    await db.transaction(
      'rw',
      [db.meta, db.factions, db.sources, db.detachments, db.stratagems, db.coreActions],
      async () => {
        await db.factions.bulkPut(coreBundle.factions);
        await db.sources.bulkPut(coreBundle.sources);
        if (coreBundle.detachments && coreBundle.detachments.length > 0) {
          await db.detachments.bulkPut(coreBundle.detachments);
        }
        await db.stratagems.filter((s) => s.isCore).delete();
        await db.stratagems.bulkPut(coreBundle.coreStratagems);
        await db.coreActions.bulkPut(coreBundle.coreActions);
        await db.meta.put({
          key: 'core_last_update',
          value: coreBundle.lastUpdate,
          updatedAt: now,
        });
        await db.meta.put({
          key: 'core_detachments_synced',
          value: 'true',
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
    detachments: coreBundle.detachments || [],
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
 * Creates or updates the default starter 11th Edition Space Marines ("10.21.26 2k Crimson Fists") roster
 * modeled after 10.21.26 2k Crimson Fists.rosz.
 */
export async function ensureStarterRosterSeeded(): Promise<SavedRoster> {
  const existing = await db.savedRosters.orderBy('updatedAt').reverse().first();

  // If the user already has custom rosters (or already updated to the 10.21.26 default roster),
  // check if it's the legacy placeholder roster (11 units / != 1990 points).
  // If it's the legacy placeholder, upgrade it to the new 10.21.26 2k Crimson Fists list!
  const isLegacyStarter =
    existing &&
    (existing.id === 'starter_crimson_fists_2k' || existing.name === 'CRIMSON FISTS 2K') &&
    (existing.units.length !== 14 || existing.totalPoints !== 1990);

  // Also check if an older starter roster exists in the database even if another roster was last active
  const legacyStarterInDb = await db.savedRosters.get('starter_crimson_fists_2k');
  if (legacyStarterInDb && (legacyStarterInDb.units?.length !== 14 || legacyStarterInDb.totalPoints !== 1990)) {
    await db.savedRosters.put({
      ...(defaultRosterData as unknown as SavedRoster),
      updatedAt: Date.now(),
    });
    await db.gameSessions.delete('session_starter_crimson_fists_2k');
  }

  if (existing && !isLegacyStarter) return existing;

  await ensureFactionDataSynced('SM');

  const starterRoster: SavedRoster = {
    ...(defaultRosterData as unknown as SavedRoster),
    updatedAt: Date.now(),
  };

  await db.savedRosters.put(starterRoster);
  const initialSession = createInitialGameSession(starterRoster, 'user');
  initialSession.currentPhase = 'command';
  initialSession.userCp = 1;
  initialSession.opponentCp = 1;
  await db.gameSessions.put(initialSession);

  return starterRoster;
}
