# Lex Tactica — Warhammer 40,000 11th Edition Playbook PWA

**Lex Tactica** is a local-first, offline-capable React + Vite + Tailwind + IndexedDB (Dexie.js) Progressive Web App (PWA) for Warhammer 40,000 **11th Edition**, modeled after `40k-playbook.com` and `ironbuilt.app`.

---

## Key Features

- **Guided 11th Edition Game Setup:**
  - 5-step wizard covering Saved/Manual Roster selection for You and Opponent.
  - Automatic Detachment-driven Force Disposition recommendations (`★ recommended`).
  - Asymmetric Primary Mission generation via the 5×5 Force Disposition Matrix (25 pairings).
  - Official 11th Edition Event Companion Map Layout selection (45 high-res 1280×1811 maps + Terrain Key) with fullscreen zoom.
  - Pre-Game parameters (+10 Battle Ready, Fixed vs Tactical secondary card picker, Attacker/Defender, First Turn).
- **Live Tabletop HUD:**
  - Interactive round-by-round mission scoring checkboxes and counters.
  - Tactical secondary deck manager ("Draw 2 Cards", score, discard).
  - CP & VP tracking, phase checklists, and live unit wound/status tracking.
- **Wahapedia 11th Edition Integration:**
  - Full relational dataset of 25 factions, datasheets, support leaders, damaged brackets, and detachment points budgets.
- **100% Offline PWA:**
  - Zero runtime scraping or CORS dependencies; all assets, maps, and rules are served locally.

---

## Data Pipeline & Update Tooling

For full details on updating datasheets, rules, missions, and deployment maps, see **[DATA_PIPELINE.md](file:///c:/agy/Lex%20Tactica/DATA_PIPELINE.md)**.

### Quick Commands

```bash
# Development server
npm run dev

# Run automated test suite (Vitest)
npm run test

# Production build
npm run build

# Check for 11th Ed mission or map updates upstream
npm run check-maps

# Synchronize 11th Ed missions and map layout images
npm run sync-maps

# Full sync: Wahapedia CSVs + 11th Ed missions + maps
npm run sync-data
```
