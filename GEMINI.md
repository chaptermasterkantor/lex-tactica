# GEMINI.md — Lex Tactica (Warhammer 40,000 11th Edition Playbook PWA) Single Source of Truth

## 1. Mission & Core Engineering Principles
**Lex Tactica** is a local-first, offline-capable React + Vite + Tailwind + IndexedDB (Dexie.js) Progressive Web App (PWA) for Warhammer 40,000 **11th Edition**, modeled after `40k-playbook.com` and enhanced with full live tabletop state tracking.

- **Discovery Before Architecture:** All TypeScript schemas and build pipelines are grounded in live inspection of `https://wahapedia.ru/wh40k11ed/` (`Last_update.csv`: `2026-10-16 21:03:46`).
- **2-Layer Decoupled Architecture:**
  - **Layer 1 (`src/config/editionRules.json`):** Configurable 11th Edition tabletop mechanics not present in unit CSVs (Micro-phase sequence, Simultaneous Pile-In/Consolidate, Charge Roll-Before-Target, Max 1 Stratagem per unit per phase lock, 1 Regular Leader + 1 Support Leader attachment slots, Detachment Points [DP] budgets per battle size, and 15" Hidden/Concealed terrain status).
  - **Layer 2 (Dexie.js IndexedDB Content Store):** Normalized, strict 11th Edition Wahapedia content seeded from pre-built static JSON bundles (`public/data/wahapedia-11ed/`), plus local-first user rosters and live game sessions (`No account needed — rosters are saved on this device`).

---

## 2. Live Wahapedia 11th Edition Relational Schema

All 20 CSV files at `https://wahapedia.ru/wh40k11ed/<File>.csv` use pipe (`|`) delimiters with a **trailing pipe** at the end of every header and row (`col1|col2|...|colN|`).

> **Critical Parser Invariant:** Several CSV files (`Stratagems.csv`, `Abilities.csv`, `Detachment_abilities.csv`) contain embedded `\n` line breaks inside HTML `description` fields before the row-terminating `|`. Always parse by buffering lines until `pipeCount >= expectedColumns && buffer.endsWith('|')`.

| CSV File | Live Rows | Exact Column Headers (`|`-delimited) | Primary / Foreign Keys & 11th Ed Specifics |
| :--- | :---: | :--- | :--- |
| `Last_update.csv` | 1 | `last_update|` | Timestamp (`YYYY-MM-DD HH:mm:ss`) |
| `Factions.csv` | 25 | `id|name|link|` | PK: `id` (e.g. `SM`, `AC`, `NEC`, `AE`, `ORK`) |
| `Source.csv` | 70 | `id|name|type|edition|version|errata_date|errata_link|` | PK: `id`. **Filter Rule:** Exclude `edition === "10"` and `Boarding Actions` |
| `Detachments.csv` | 315 | `id|faction_id|name|legend|type|dp|force_disposition|` | PK: `id`, FK: `faction_id`. **11th Ed:** `dp` (`"1"|"2"|"3"|""`), `force_disposition` (`Disruption`, `Purge the Foe`, `Take and Hold`, `Priority Assets`, `Reconnaissance`). Exclude `type === "Boarding Actions"` |
| `Detachment_abilities.csv` | 328 | `id|faction_id|name|legend|description|detachment|detachment_id|` | PK: `id`, FK: `faction_id`, `detachment_id` |
| `Datasheets.csv` | 1,512 | `id|name|faction_id|source_id|legend|role|loadout|transport|virtual|is_support|leader_head|leader_footer|damaged_w|damaged_description|link|` | PK: `id`, FK: `faction_id`, `source_id`. **11th Ed:** `is_support` (`"true"|"false"`, 48 Support Leaders), `virtual` (`"true"|"false"`, exclude `virtual === "true"`). `damaged_w` defines damaged wound threshold (e.g. `"1-4"`) |
| `Datasheets_models.csv` | 1,679 | `datasheet_id|line|name|M|T|Sv|inv_sv|inv_sv_descr|W|Ld|OC|base_size|base_size_descr|` | PK: `(datasheet_id, line)`, FK: `datasheet_id` |
| `Datasheets_wargear.csv` | 7,783 | `datasheet_id|line|line_in_wargear|dice|name|description|range|type|A|BS_WS|S|AP|D|` | PK: `(datasheet_id, line, line_in_wargear)`. `type` in `"Ranged" | "Melee"` |
| `Datasheets_abilities.csv` | 6,429 | `datasheet_id|line|ability_id|model|name|description|type|parameter|` | PK: `(datasheet_id, line)`. When `type` is `"Core"` or `"Faction"`, `name`/`description` are resolved from `Abilities.csv` via `ability_id` and `parameter` |
| `Datasheets_keywords.csv` | 12,959 | `datasheet_id|keyword|model|is_faction_keyword|` | FK: `datasheet_id`. `is_faction_keyword` (`"true"|"false"`) |
| `Datasheets_leader.csv` | 1,254 | `leader_id|attached_id|` | PK: `(leader_id, attached_id)`, both FK -> `Datasheets.id` |
| `Datasheets_models_cost.csv` | 5,477 | `datasheet_id|line|description|cost|` | PK: `(datasheet_id, line)`. Empty `cost` rows define 11th Ed escalating duplicate-unit cost tiers (`YOUR 1ST TO 2ND UNITS COST`, `YOUR 3RD+ UNIT COSTS`, `WARGEAR OPTIONS`, etc.) |
| `Datasheets_unit_composition.csv` | 1,918 | `datasheet_id|line|description|` | PK: `(datasheet_id, line)` |
| `Datasheets_options.csv` | 2,357 | `datasheet_id|line|button|description|` | PK: `(datasheet_id, line)` |
| `Datasheets_stratagems.csv` | 55,309 | `datasheet_id|stratagem_id|` | M:N junction `Datasheets.id <-> Stratagems.id` |
| `Datasheets_enhancements.csv` | 7,272 | `datasheet_id|enhancement_id|` | M:N junction `Datasheets.id <-> Enhancements.id` |
| `Datasheets_detachment_abilities.csv` | 8,765 | `datasheet_id|detachment_ability_id|` | M:N junction `Datasheets.id <-> Detachment_abilities.id` |
| `Stratagems.csv` | 1,513 | `faction_id|name|id|type|cp_cost|legend|turn|phase|detachment|detachment_id|description|` | PK: `id`, FK: `faction_id`, `detachment_id`. Contains true Stratagems AND 30 zero-CP 11th Ed Core Actions (`type`: `"Movement Ability" | "Shooting Ability"`, `phase`: `'Ability "Move"' | 'Ability "Shoot"' | 'Ability "Fight"'`) |
| `Abilities.csv` | 100 | `id|name|legend|faction_id|description|` | PK: `(id, faction_id)` |
| `Enhancements.csv` | 934 | `faction_id|name|id|cost|detachment|detachment_id|upgrade|legend|description|support_leader|` | PK: `id`, FK: `faction_id`, `detachment_id`. **11th Ed:** `upgrade === "true"` indicates a Unit Upgrade; `support_leader` contains HTML links granting `LEADER:` or `SUPPORT:` attachment overrides |

---

## 3. Enumerations & Normalization Rules

### `Stratagems.csv` Phase & Turn Values
- **Unique `turn` values:**
  - `'Your turn'` $\rightarrow$ `'your_turn'`
  - `'Opponent’s turn'` $\rightarrow$ `'opponent_turn'`
  - `'Either player’s turn'` / `''` $\rightarrow$ `'either'`
- **Unique `phase` values:**
  - `'Command phase'` $\rightarrow$ `['command']`
  - `'Movement phase'` $\rightarrow$ `['movement']`
  - `'Shooting phase'` $\rightarrow$ `['shooting']`
  - `'Charge phase'` $\rightarrow$ `['charge']`
  - `'Fight phase'` $\rightarrow$ `['fight']`
  - `'Any phase'` $\rightarrow$ `['any']`
  - `'Movement or Charge phase'` $\rightarrow$ `['movement', 'charge']`
  - `'Shooting or Charge phase'` $\rightarrow$ `['shooting', 'charge']`
  - `'Shooting or Fight phase'` $\rightarrow$ `['shooting', 'fight']`
  - `'Charge or Fight phase'` $\rightarrow$ `['charge', 'fight']`
  - `'Ability "Move"'`, `'Ability "Shoot"'`, `'Ability "Fight"'` $\rightarrow$ Split out into `CoreAction` store (`coreActions` table in Dexie).

### `Datasheets_abilities.csv` Category Normalization
- `'Fortification (левая колонка)'` $\rightarrow$ `'Fortification'`
- `'Special (правая колонка)'` $\rightarrow$ `'Special'`

---

## 4. Interactive Keyword & Weapon Ability Tooltips
- **`src/engine/keywordGlossary.ts` & `src/components/KeywordTooltip.tsx`:**
  - Provides instant desktop hover tooltips (120ms micro-delay) and mobile tap popovers on all unit keywords (`INFANTRY`, `CHARACTER`, `FLY`, `GRENADES`, `SMOKE`, `VEHICLE`, `MONSTER`, etc.), Core/Faction ability badges (`DEEP STRIKE`, `FEEL NO PAIN X+`, `SCOUTS X"`, `STEALTH`, `LONE OPERATIVE`, `DEADLY DEMISE X`), and weapon profile tags (`[LETHAL HITS]`, `[SUSTAINED HITS X]`, `[DEVASTATING WOUNDS]`, `[ANTI-KEYWORD X+]`, `[HAZARDOUS]`, `[PRECISION]`, `[TWIN-LINKED]`, `[MELTA X]`, `[RAPID FIRE X]`, `[PIERCING]`, etc.).
  - Dynamically interpolates parameterized rules (e.g. `[SUSTAINED HITS 2]`, `[ANTI-VEHICLE 4+]`, `FEEL NO PAIN 5+`).

---

## 5. Distribution & Future-Proofing Guardrails
- **Zero Runtime Scraping/CORS:** All Wahapedia CSVs are compiled at build time (`npm run sync-data`) into `public/data/wahapedia-11ed/manifest.json`, `core.json`, and 25 per-faction `factions/<id>.json` bundles.
- **Google Play Store (TWA) & Static Web Hosting Ready:** Uses relative asset paths, client-side routing, `navigator.storage.persist()` for durable offline IndexedDB storage, and full JSON roster import/export backup.

---

## 6. 11th Edition Mission Matrix & Map Layout Pipeline
- **Comprehensive Documentation:** Full pipeline details and agent workflows are documented in `DATA_PIPELINE.md`.
- **`npm run check-maps`:** Read-only diagnostic checking upstream manifest (`IRONBUILT-LLC/ironbuilt-data/main/manifest.json`) against local `src/config/missions-meta.json`.
- **`npm run sync-maps`:** Synchronizes updated 5×5 Force Disposition Mission Matrix (`src/config/missions11ed.json`), 18 secondary mission cards, and all 46 official 11th Edition Event Companion map JPEGs (`public/data/wahapedia-11ed/maps/`).
- **`python scripts/extract-maps-from-pdf.py`:** Automates image extraction from any tournament PDF without manual cropping.
- **`npm run sync-data`:** Master build command that synchronizes Wahapedia datasheets/detachments and runs the mission & map sync engine.

---

## 7. UI/UX Design Philosophy & Tabletop Ergonomics Guardrails
- **Canonical Reference:** All UI/UX changes must strictly follow **[`DESIGN_PHILOSOPHY.md`](file:///c:/agy/Lex%20Tactica/DESIGN_PHILOSOPHY.md)**.
- **Non-Negotiable UX Invariants:**
  1. **Single Unified Cockpit (No Mode-Split Drift):** Never hide functional controls or change spatial layouts between beginner and veteran users. Use the `🎓 Coach: ON / OFF` scaffolding layer (with automatic local decay) to control default expansion states, 1-line phase prompts, and tap-to-explain stat underlines.
  2. **Thumb-Zone Primacy & 44×44px Touch Targets:** Keep primary phase/CP/stratagem navigation in the Sticky Bottom Thumb-Bar on mobile viewports, and enforce `min-h-[44px] min-w-[44px]` hit areas on all steppers and primary action controls.
  3. **Strict Phase & Turn Truthfulness:** Never display action checkboxes (`[ ]`) for passive buffs or out-of-phase rules in `PhaseActionChecklist.tsx`, and filter multi-phase stratagems (`whenText`) so opponent-turn stratagems never leak into `Your Turn`.
  4. **Mobile Glanceability & Temporal Disclosure:** Keep `M · T · Sv · Inv · OC` and active Army Rule badges visible on collapsed mobile unit cards; auto-collapse expanded unit cards on phase/turn transitions; auto-collapse Scoreboard mission details during combat phases (`Movement`–`Fight`).
