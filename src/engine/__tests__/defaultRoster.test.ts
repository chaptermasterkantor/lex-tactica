import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import defaultRosterJson from '../../config/defaultRoster.json';
import { validateRoster } from '../rosterValidator';
import type { Datasheet, Detachment, Enhancement, SavedRoster } from '../../types/rules';

describe('Default 10.21.26 2k Crimson Fists Roster', () => {
  it('validates without any errors against Wahapedia 11th Ed SM data', () => {
    const smDataRaw = fs.readFileSync(
      path.resolve(process.cwd(), 'public/data/wahapedia-11ed/factions/SM.json'),
      'utf8'
    );
    const smData = JSON.parse(smDataRaw);

    const dsMap = new Map<string, Datasheet>(smData.datasheets.map((d: Datasheet) => [d.id, d]));
    const detMap = new Map<string, Detachment>(smData.detachments.map((d: Detachment) => [d.id, d]));
    const enhMap = new Map<string, Enhancement>(smData.enhancements.map((e: Enhancement) => [e.id, e]));

    const roster = defaultRosterJson as unknown as SavedRoster;
    const issues = validateRoster(roster, dsMap, detMap, enhMap);

    expect(issues).toHaveLength(0);
    expect(roster.totalPoints).toBe(1990);
    expect(roster.units).toHaveLength(14);
    expect(roster.totalDetachmentPoints).toBe(3);
  });
});
