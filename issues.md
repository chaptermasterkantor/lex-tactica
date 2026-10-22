# Lex Tactica — Known Issues

> Issues identified during a code-vs-documentation audit on 2026-10-22. Each entry lists where the problem lives and a suggested fix.

---

## Bugs / Functional Gaps

### 1. Deployment map images are not available offline
- **Severity:** High (breaks the "100% offline" promise for match setup)
- **Where:** [vite.config.ts](file:///c:/agy/Lex%20Tactica/vite.config.ts) — Workbox `globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']`
- **Problem:** `jpg` is not in the precache glob and there is no `runtimeCaching` rule for images. The 46 map JPEGs in `public/data/wahapedia-11ed/maps/` (~15 MB) need a network connection the first time they are viewed. After that they may stay in the browser's HTTP cache, but that isn't guaranteed.
- **Suggested fix (pick one):**
  - Add `jpg` to `globPatterns`. This precaches all maps on install and adds about 15 MB to the install size.
  - Add a Workbox `runtimeCaching` rule (`CacheFirst`) for `/data/wahapedia-11ed/maps/*.jpg`. Optionally, have the existing **Offline Sync** button warm that cache.

### 2. No end-of-game summary screen or match history
- **Severity:** Medium (UX gap in the game lifecycle)
- **Where:** [App.tsx](file:///c:/agy/Lex%20Tactica/src/App.tsx) — the cockpit's `Next` button
- **Problem:** After Round 5 → End of Battle Round, `nextStep` is `undefined` and the button just turns off (its label reads "End"). Nothing shows the final result or winning margin, and finished matches aren't saved.
- **Suggested fix:** Add a post-game results view (final VP breakdown, winner, CP/stratagem log). Optionally, archive finished sessions to a `matchHistory` Dexie table.

### 3. Discarding a tactical secondary does not award CP
- **Severity:** Low
- **Where:** [ScoreboardHud.tsx](file:///c:/agy/Lex%20Tactica/src/components/ScoreboardHud.tsx) — `handleDiscardSecondary`
- **Problem:** Discards go into `discardedCards`, but `userCp` is never changed. If the current mission rules grant CP for discarding, the player has to add it by hand with the CP counter.
- **Suggested fix:** Confirm the 11th Ed discard rule. If CP is granted, apply it automatically (once per turn, if that's the rule) and give visual feedback.

### 4. UI preferences are not persisted
- **Severity:** Low
- **Where:** [App.tsx](file:///c:/agy/Lex%20Tactica/src/App.tsx) — `forceCompactCards`, `statusFilter`, `rosterBannerExpanded`
- **Problem:** The only thing saved in `localStorage` is `lex_tactica_welcome_seen`. View preferences reset on every reload, which is a problem for a PWA that may get backgrounded and reloaded mid-game.
- **Suggested fix:** Save view preferences to `localStorage` (or a Dexie `meta` key).

---

## UX Gaps (pending the UI/UX review)

### 5. Primary controls sit at the top of the screen
- **Where:** [App.tsx](file:///c:/agy/Lex%20Tactica/src/App.tsx) — Turn & Phase Cockpit, [ScoreboardHud.tsx](file:///c:/agy/Lex%20Tactica/src/components/ScoreboardHud.tsx) CP +/-
- **Problem:** Prev/Next, phase pills, the Stratagems and Core Actions launchers, and CP +/- are all at the top of the page, with no sticky bottom bar. That's hard to reach with one thumb while holding dice or a tape measure.
- **Suggested fix:** Decide after the UI/UX review. A sticky bottom action bar on mobile is a likely candidate.

### 6. 11th Ed sequencing rules are reminder text only
- **Where:** [editionRules.json](file:///c:/agy/Lex%20Tactica/src/config/editionRules.json) `phaseSequence` → [PhaseActionChecklist.tsx](file:///c:/agy/Lex%20Tactica/src/components/PhaseActionChecklist.tsx)
- **Problem:** Charge Roll-Before-Targeting, Simultaneous Pile-In/Consolidate and 15″ Hidden/Concealed terrain only show up as checklist text. The app doesn't guide players through them step by step, which matters for new players.
- **Suggested fix:** Decide after the UI/UX review, e.g. guided micro-steps in a "new player" mode.

---

## Testing

### 7. No UI / component tests
- **Where:** `src/engine/__tests__/` (3 files, 24 tests, all engine/pipeline)
- **Problem:** Nothing tests the React components (cockpit navigation, stratagem lock, unit card state, setup wizard).
- **Suggested fix:** Add React Testing Library tests for the critical in-game flows.

---

## Documentation Drift

### 8. `DATA_PIPELINE.md` test count is stale
- **Where:** [DATA_PIPELINE.md](file:///c:/agy/Lex%20Tactica/DATA_PIPELINE.md) §5 Step 3
- **Problem:** Says "Runs the 22 Vitest tests in `pipeline.test.ts` and `missionEngine.test.ts`". There are actually **24 tests across 3 files**, including `defaultRoster.test.ts`.
- **Suggested fix:** Update the count and the file list, or stop quoting a hard-coded number.

### 9. `GEMINI.md` tooltip delay mismatch
- **Where:** [GEMINI.md](file:///c:/agy/Lex%20Tactica/GEMINI.md) §4 vs [KeywordTooltip.tsx](file:///c:/agy/Lex%20Tactica/src/components/KeywordTooltip.tsx)
- **Problem:** The doc says there's a "120ms micro-delay", but the code uses `setTimeout(..., 100)`.
- **Suggested fix:** Make the doc and the code agree on one value.
