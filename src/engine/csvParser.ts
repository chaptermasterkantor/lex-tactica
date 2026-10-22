export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  leftover: string;
}

/**
 * Multiline-safe pipe-delimited CSV parser for Wahapedia 11th Edition exports.
 * Buffers lines when embedded '\n' exists inside HTML description columns until
 * the row has at least `headers.length` pipes and ends with '|'.
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
        record[h] = (parts[idx] ?? '').trim();
      });
      rows.push(record);
      buffer = '';
    }
  }

  return { headers, rows, leftover: buffer };
}

/**
 * Converts Wahapedia HTML snippets into clean, readable plain text while preserving
 * bullet points and line breaks and removing fluff headers.
 */
export function stripHtmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<p class="ShowFluff[^>]*>[\s\S]*?<\/p>/gi, '')
    .replace(/<span class="h_number">[\s\S]*?<\/span>/gi, '')
    .replace(/<div class="abName">[\s\S]*?<\/div>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line, idx, arr) => !(line === '' && (idx === 0 || idx === arr.length - 1 || arr[idx - 1] === '')))
    .join('\n')
    .trim();
}

/**
 * Extracts normalized `<faction-slug>/<datasheet-slug>` from a Wahapedia URL or path.
 * Example: "https://wahapedia.ru/wh40k11ed/factions/astra-militarum/Bullgryn-Squad"
 * -> "astra-militarum/bullgryn-squad"
 */
export function extractDatasheetSlug(urlOrPath: string): string {
  if (!urlOrPath) return '';
  const match = urlOrPath.match(/\/factions\/([^/#?"']+\/[^/#?"']+)/i);
  if (match && match[1]) {
    return match[1].toLowerCase().replace(/\/+$/, '');
  }
  return urlOrPath.toLowerCase().trim();
}

/**
 * Extracts WHEN, TARGET, and EFFECT sections from a Wahapedia Stratagem HTML description.
 */
export function parseStratagemHtmlSections(descriptionHtml: string): {
  whenText: string;
  targetText: string;
  effectText: string;
  cleanDescription: string;
} {
  const cleanDescription = stripHtmlToText(descriptionHtml);
  const whenMatch = cleanDescription.match(/WHEN:\s*([\s\S]*?)(?=\n?(?:TARGET:|EFFECT:|RESTRICTIONS?:|$))/i);
  const targetMatch = cleanDescription.match(/TARGET:\s*([\s\S]*?)(?=\n?(?:EFFECT:|RESTRICTIONS?:|$))/i);
  const effectMatch = cleanDescription.match(/EFFECT:\s*([\s\S]*?)$/i);

  return {
    whenText: whenMatch?.[1]?.trim() ?? '',
    targetText: targetMatch?.[1]?.trim() ?? '',
    effectText: effectMatch?.[1]?.trim() ?? cleanDescription,
    cleanDescription,
  };
}
