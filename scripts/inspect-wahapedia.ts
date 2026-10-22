/**
 * Phase 0 Live Wahapedia 11th Edition Schema Diagnostic Script
 * Run with: npm run inspect-wahapedia (or npx tsx scripts/inspect-wahapedia.ts)
 */

const BASE_URL = 'https://wahapedia.ru/wh40k11ed';

export const WAHAPEDIA_CSV_FILES = [
  'Last_update.csv',
  'Factions.csv',
  'Source.csv',
  'Detachments.csv',
  'Detachment_abilities.csv',
  'Datasheets.csv',
  'Datasheets_abilities.csv',
  'Datasheets_keywords.csv',
  'Datasheets_models.csv',
  'Datasheets_options.csv',
  'Datasheets_wargear.csv',
  'Datasheets_unit_composition.csv',
  'Datasheets_models_cost.csv',
  'Datasheets_stratagems.csv',
  'Datasheets_enhancements.csv',
  'Datasheets_detachment_abilities.csv',
  'Datasheets_leader.csv',
  'Stratagems.csv',
  'Abilities.csv',
  'Enhancements.csv',
] as const;

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  leftover: string;
}

/**
 * Multiline-safe pipe-delimited CSV parser for Wahapedia exports.
 * Every Wahapedia CSV record terminates with a trailing '|' and contains
 * exactly `headers.length` pipes, even when HTML descriptions contain raw '\n'.
 */
export function parseWahapediaPipeCsv(text: string): ParsedCsvResult {
  const rawLines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headerLine = rawLines[0] ?? '';
  const headers = headerLine.split('|').slice(0, -1);
  const expectedPipes = headers.length;

  const rows: Record<string, string>[] = [];
  let buffer = '';

  for (let i = 1; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!buffer && line.trim() === '') continue;
    buffer = buffer ? `${buffer}\n${line}` : line;
    const pipeCount = (buffer.match(/\|/g) || []).length;
    if (pipeCount >= expectedPipes && buffer.endsWith('|')) {
      const parts = buffer.split('|');
      const record: Record<string, string> = {};
      headers.forEach((h, idx) => {
        record[h] = parts[idx] ?? '';
      });
      rows.push(record);
      buffer = '';
    }
  }

  return { headers, rows, leftover: buffer };
}

async function inspectAllCsvs() {
  console.log(`Inspecting live Wahapedia 11th Edition CSVs at ${BASE_URL}...\n`);
  const parsedMap: Record<string, ParsedCsvResult> = {};

  for (const file of WAHAPEDIA_CSV_FILES) {
    const res = await fetch(`${BASE_URL}/${file}`);
    if (!res.ok) {
      console.error(`[ERROR] ${file}: HTTP ${res.status}`);
      continue;
    }
    const text = await res.text();
    const parsed = parseWahapediaPipeCsv(text);
    parsedMap[file] = parsed;

    console.log(`=== ${file} (${parsed.rows.length} rows, leftover=${parsed.leftover.length}) ===`);
    console.log(`Columns: ${parsed.headers.join('|')}|`);
    parsed.rows.slice(0, 5).forEach((row, idx) => {
      const preview = JSON.stringify(row);
      console.log(`  Sample ${idx + 1}: ${preview.slice(0, 180)}${preview.length > 180 ? '...' : ''}`);
    });
    console.log('');
  }

  const stratagems = parsedMap['Stratagems.csv']?.rows ?? [];
  console.log('=== Stratagems.csv Unique Values ===');
  console.log('Unique turn:', [...new Set(stratagems.map((r) => r.turn))]);
  console.log('Unique phase:', [...new Set(stratagems.map((r) => r.phase))]);
  console.log('Unique cp_cost:', [...new Set(stratagems.map((r) => r.cp_cost))]);
  console.log('Unique type (first 30):', [...new Set(stratagems.map((r) => r.type))].slice(0, 30));

  const abilities = parsedMap['Datasheets_abilities.csv']?.rows ?? [];
  console.log('\n=== Datasheets_abilities.csv Unique Values ===');
  console.log('Unique type:', [...new Set(abilities.map((r) => r.type))]);
  console.log('Unique parameter:', [...new Set(abilities.map((r) => r.parameter))]);
}

const isMain = process.argv[1]?.includes('inspect-wahapedia');
if (isMain) {
  inspectAllCsvs().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
