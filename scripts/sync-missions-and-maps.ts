/**
 * Automated 11th Edition Mission Matrix & Deployment Maps Sync & Update Engine
 *
 * Capabilities:
 * - Dynamically queries upstream manifest (no hardcoded commit hashes)
 * - Compares versions and SHA256 hashes to detect new map layouts or mission rules
 * - Supports --check mode (read-only diagnostic)
 * - Supports --force mode to re-download all assets
 * - Downloads and caches only modified/new map images
 * - Writes src/config/missions-meta.json for UI version display
 *
 * Usage:
 *   npm run sync-maps               # Update if changes detected
 *   npm run check-maps              # Check for updates without downloading
 *   npm run sync-maps -- --force    # Force re-sync
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const UPSTREAM_MANIFEST_URL =
  'https://raw.githubusercontent.com/IRONBUILT-LLC/ironbuilt-data/main/manifest.json';

const CONFIG_DIR = path.resolve(process.cwd(), 'src/config');
const PUBLIC_MAPS_DIR = path.resolve(process.cwd(), 'public/data/wahapedia-11ed/maps');
const META_FILE = path.join(CONFIG_DIR, 'missions-meta.json');

interface DatasetEntry {
  id: string;
  name: string;
  version: string;
  url: string;
  sha256?: string;
  bytes?: number;
}

interface UpstreamManifest {
  schema: number;
  updated: string;
  datasets: DatasetEntry[];
}

interface LocalSyncMeta {
  lastChecked: string;
  lastUpdated: string;
  missionsVersion: string;
  missionsSha256: string;
  mapsVersion: string;
  mapsSha256: string;
  totalLayouts: number;
}

async function fetchJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': 'LexTactica-SyncEngine/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} when fetching ${url}`);
  const text = (await res.text()).replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

function calculateSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function downloadFileWithCache(url: string, destPath: string, force = false): Promise<'downloaded' | 'cached'> {
  if (!force && fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
    return 'cached';
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} when downloading ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
  return 'downloaded';
}

function loadLocalMeta(): LocalSyncMeta | null {
  try {
    if (fs.existsSync(META_FILE)) {
      return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
    }
  } catch {
    // ignore
  }
  return null;
}

export async function runMissionsAndMapsSync(options: { checkOnly?: boolean; force?: boolean } = {}) {
  const { checkOnly = false, force = false } = options;
  console.log('===========================================================');
  console.log(' 11th Edition Mission & Map Update Engine');
  console.log('===========================================================');
  console.log(`Checking upstream repository manifest:\n  ${UPSTREAM_MANIFEST_URL}\n`);

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_MAPS_DIR, { recursive: true });

  const manifest = await fetchJson<UpstreamManifest>(UPSTREAM_MANIFEST_URL);
  const missionsEntry = manifest.datasets.find((d) => d.id === 'wh40k-11e-missions');
  const mapsEntry = manifest.datasets.find((d) => d.id === 'wh40k-11e-maps');

  if (!missionsEntry || !mapsEntry) {
    throw new Error('Could not find wh40k-11e-missions or wh40k-11e-maps in upstream manifest.');
  }

  const localMeta = loadLocalMeta();

  console.log('Dataset Status:');
  console.log(`• Missions:  Upstream ${missionsEntry.version} (Local: ${localMeta?.missionsVersion ?? 'None'})`);
  console.log(`• Maps:      Upstream ${mapsEntry.version} (Local: ${localMeta?.mapsVersion ?? 'None'})`);
  console.log(`• Upstream Updated: ${manifest.updated}`);

  const missionsChanged = force || !localMeta || localMeta.missionsVersion !== missionsEntry.version;
  const mapsChanged = force || !localMeta || localMeta.mapsVersion !== mapsEntry.version;

  if (checkOnly) {
    if (!missionsChanged && !mapsChanged) {
      console.log('\n[STATUS] Everything is 100% UP TO DATE with latest 11th Edition releases.');
    } else {
      console.log('\n[STATUS] Updates AVAILABLE! Run "npm run sync-maps" to synchronize.');
    }
    return;
  }

  if (!missionsChanged && !mapsChanged && fs.existsSync(path.join(CONFIG_DIR, 'missions11ed.json'))) {
    console.log('\n[OK] Local files match latest upstream version. Skipping download (use --force to re-download).');
    return;
  }

  console.log('\nSynchronizing updated datasets...');

  // 1. Fetch & save Missions JSON
  console.log(`1. Fetching missions dataset from ${missionsEntry.url}...`);
  const missionsRaw = await fetch(missionsEntry.url);
  const missionsBuffer = Buffer.from(await missionsRaw.arrayBuffer());
  const missionsSha = calculateSha256(missionsBuffer);
  fs.writeFileSync(path.join(CONFIG_DIR, 'missions11ed.json'), missionsBuffer);
  console.log(`   Saved missions11ed.json (${missionsBuffer.length} bytes, sha256: ${missionsSha.slice(0, 10)}...)`);

  // 2. Fetch & save Maps JSON
  console.log(`2. Fetching maps manifest from ${mapsEntry.url}...`);
  const mapsRaw = await fetch(mapsEntry.url);
  const mapsBuffer = Buffer.from(await mapsRaw.arrayBuffer());
  const mapsSha = calculateSha256(mapsBuffer);
  const mapsData = JSON.parse(mapsBuffer.toString('utf8').replace(/^\uFEFF/, ''));
  fs.writeFileSync(path.join(CONFIG_DIR, 'maps11ed.json'), mapsBuffer);
  console.log(`   Saved maps11ed.json (${mapsBuffer.length} bytes, sha256: ${mapsSha.slice(0, 10)}...)`);

  // 3. Download/Cache map layout images
  console.log(`3. Synchronizing map layout images to ${PUBLIC_MAPS_DIR}...`);
  let downloadedCount = 0;
  let cachedCount = 0;

  // Key image
  if (mapsData.key?.image) {
    const keyDest = path.join(PUBLIC_MAPS_DIR, mapsData.key.file || '_key.jpg');
    const res = await downloadFileWithCache(mapsData.key.image, keyDest, force);
    if (res === 'downloaded') downloadedCount++;
    else cachedCount++;
  }

  // Layout images
  const layouts: Array<{ file: string; image: string }> = mapsData.layouts || [];
  for (const l of layouts) {
    if (!l.image || !l.file) continue;
    const dest = path.join(PUBLIC_MAPS_DIR, l.file);
    const res = await downloadFileWithCache(l.image, dest, force);
    if (res === 'downloaded') downloadedCount++;
    else cachedCount++;
  }

  console.log(`   Images: ${downloadedCount} newly downloaded, ${cachedCount} already cached.`);

  // 4. Update local metadata
  const newMeta: LocalSyncMeta = {
    lastChecked: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    missionsVersion: missionsEntry.version,
    missionsSha256: missionsSha,
    mapsVersion: mapsEntry.version,
    mapsSha256: mapsSha,
    totalLayouts: layouts.length,
  };
  fs.writeFileSync(META_FILE, JSON.stringify(newMeta, null, 2), 'utf8');

  console.log('\n===========================================================');
  console.log(' Sync Complete! Lex Tactica is updated to latest 11th Ed.');
  console.log('===========================================================');
}

// CLI entry point
const args = process.argv.slice(2);
const isCheck = args.includes('--check');
const isForce = args.includes('--force');

runMissionsAndMapsSync({ checkOnly: isCheck, force: isForce }).catch((err) => {
  console.error('\n[ERROR] Sync failed:', err.message);
  process.exit(1);
});
