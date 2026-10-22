# DESIGN_PHILOSOPHY.md — Lex Tactica UI/UX Architecture & Tabletop Ergonomics Guardrails

> **Purpose:** This document is the single source of truth for **Lex Tactica's** user experience, visual hierarchy, onboarding scaffolding, and physical tabletop ergonomics. All future features, pull requests, and AI agent sessions **must** adhere to these invariants and must never backtrack into mode-split UI drift, small touch targets, or out-of-phase rule clutter.

---

## 1. Core UX Thesis: One Unified Cockpit + Decaying Scaffolding

Lex Tactica serves two audiences simultaneously at a physical Warhammer 40,000 11th Edition table:
- **The Cadet (0–5 games):** Needs reassurance, plain-language "What do I do next?" phase guidance, and instant explanations of stats (`M`, `T`, `Sv`, `OC`) and roll math (`S vs. T` Wound Chart).
- **The Warmaster (50+ games):** Plays on a chess clock; needs zero-latency score/CP entry, instant phase stratagem filtering, and zero tutorial popups.

### Why We Reject a Binary "New Player vs. Veteran" Mode Split
1. **40k Competence is Contextual, Not Binary:** A tournament veteran playing a brand-new faction or learning 11th Edition mechanics (Force Dispositions, Support Leaders, Roll-Before-Target Charges) needs contextual rules help without losing power-user controls. Conversely, a beginner on Battle Round 3 of their first game already knows how the Movement Phase works, but still needs help in the Fight Phase.
2. **"Hiding Controls" Breaks Real Tabletop Games:** At a physical table, you cannot control what your opponent does on Turn 1. If a "Beginner Mode" hides `Reserves`, `Embarked`, `Battle-shock`, or `Opponent CP`, a new player cannot represent their actual board state.
3. **Muscle-Memory Continuity (No Product Drift):** If controls move or cards change layout when switching modes, players must re-learn the app when they graduate from beginner to veteran, and the codebase drifts into two separate products.

### The Solution: `🎓 Coach: ON / OFF` + Automatic Local Decay
Every player uses the **exact same spatial layout and functional controls**. Guidance is a lightweight, toggleable scaffolding layer (`🎓 Coach: ON / OFF` in the header, persisted in `localStorage`) that automatically fades as the user completes phases and games.

| Surface / Dimension | Immutable Across Both States (Zero Drift) | `🎓 Coach: ON` (Guided Scaffolding) | `🎓 Coach: OFF` (Veteran High-Speed) |
| :--- | :--- | :--- | :--- |
| **Spatial Layout & Controls** | Every button, counter (`CP`, `VP`, `Mdl`, `W`), status selector, and drawer launcher stays in the exact same position. **Zero hidden controls.** | Identical controls. | Identical controls. |
| **Smart Entry Default** | User can toggle `🎓 Coach` in 1 tap at any time in the top header. | Default when clicking **Explore Demo Army** or **Build Formation** in the Welcome Launchpad. | Default when clicking **Import List** (`.rosz` / New Recruit JSON / text). |
| **Active Phase Banner** | Phase title, Round `1–5` badge, and Turn toggle (`🟢 Your Turn` / `🛡️ Opponent's Turn`). | Shows a **1-line plain-English phase objective** beneath the phase title. | 1-line subtitle is hidden to save vertical height. |
| **11th Ed Phase Sequence Guide** | The `? Phase Sequence` button and step list from `editionRules.json`. | **Auto-expanded the first time a player enters each phase** (`phaseSeenCount[phase] === 0`), then **auto-collapses in subsequent rounds** once seen. | Always collapsed by default behind the `? Phase Sequence` pill. |
| **Unit Card Stat & Weapon Headers** | `M`, `T`, `Sv`, `Inv`, `W`, `Ld`, `OC` and `Range`, `A`, `BS/WS`, `S`, `AP`, `D` columns. | Column headers display a subtle dotted underline (`border-b border-dotted border-amber-400/60`) signaling tap-to-explain & the **`S vs T` Wound Chart**. | Tap-to-explain **still works when tapped**, but dotted underlines are hidden for visual density. |
| **Reactive Turn Coaching** (`Opponent's Turn`) | Crimson cockpit border and reactive stratagem filtering. | Shows a compact 1-line Reactive Callout explaining how to check `T`/`Sv` and use defensive Stratagems. | Hidden. |

---

## 2. The 7 Non-Negotiable UX Invariants

Every future feature or UI change must pass these seven guardrails:

### Invariant 1: Thumb-Zone Primacy (Mobile One-Handed Ergonomics)
- Players stand next to a 44" × 60" table holding dice, miniatures, or a tape measure in their dominant hand.
- High-frequency tabletop actions (`< Prev`, `CP -/+`, `⚡ Stratagems`, `📖 Core Actions`, and `Next: [Phase] >`) **must** remain anchored in the **Sticky Bottom Thumb-Bar** (`fixed bottom-0 inset-x-0 z-40`) on mobile/tablet viewports, never exclusively at the top of the page.

### Invariant 2: True 44×44px Minimum Touch Targets
- By Battle Round 4 (Hour 3 of play), cognitive and physical fatigue set in.
- Every interactive stepper (`-` / `+` on wounds, models, CP, and VP), unit activation button (`Mark Moved / Shot / Charged / Fought`), and drawer launcher must enforce a minimum touch target of **`44px × 44px`** (`min-h-[44px] min-w-[44px]`) or equivalent hit padding.

### Invariant 3: Strict Phase & Turn Truthfulness (Zero False Positives)
- **Action Checkboxes (`[ ]`) vs. Passive Buffs:** Checkboxes in `PhaseActionChecklist.tsx` are strictly reserved for **actionable phase decisions** (e.g., selecting a *Combat Doctrine* or *Oath of Moment* target in the Command Phase, rolling *Battle-shock* in the Command Phase, deploying *Reserves* in the Movement Phase). Passive detachment/army buffs that apply across phases must render as non-checkbox reference pills, and rules belonging to other phases (e.g., *"re-roll advance rolls"* during the Shooting Phase) must be hidden.
- **Turn-Accurate Stratagems:** Multi-phase stratagems tagged `either` turn in Wahapedia (such as *Armour of Contempt*: `"Your opponent's Shooting phase or the Fight phase"`) must inspect `whenText` so opponent-turn-only shooting/movement stratagems never appear as playable during `Your Turn`.

### Invariant 4: Arm's-Length Mobile Glanceability
- Phones are frequently set flat on the table edge.
- **Collapsed Unit Cards** must **never** hide the core defensive/movement statline (`M · T · Sv · Inv · OC`) on `<640px` mobile screens (`hidden sm:inline-flex` is forbidden on the primary stat pill).
- **Ready vs. Completed Visual Hierarchy:** Ready unit cards must display a high-contrast left accent bar (`border-l-4 border-l-emerald-500` on Your Turn, `border-l-rose-500` on Opponent's Turn), while Completed/Activated units auto-collapse to the bottom section with muted opacity (`opacity-60`).
- **Active Army Rule Badges:** Stateful Command-phase selections (e.g., `✨ ASSAULT DOCTRINE` or `🎯 OATH TARGET`) must surface directly as a live badge on unit cards for the remainder of the Battle Round.

### Invariant 5: Temporal Progressive Disclosure
- **Auto-Collapse Unit Cards on Phase Change:** Transitioning to a new phase or turn automatically resets manual card expansions (`setManualExpanded(null)`) so every phase begins with a clean, scannable list of Ready units.
- **Auto-Collapse Mission Scoring During Combat Phases:** The Scoreboard HUD's detailed Primary & Secondary scoring panels automatically expand during **`Start of Round`**, **`Command`**, **`End of Turn`**, and **`End of Round`**, and automatically collapse into a compact 1-line summary bar during **`Movement`**, **`Shooting`**, **`Charge`**, and **`Fight`** so unit cards stay above the fold.
- **Pre-Game Setup Banner Scope:** The full `11th Edition Board & Match Setup` callout card is displayed only in `Pre-game`. If a player advances into Round 1 without running the setup wizard, it collapses into a single slim bar inside the Scoreboard HUD.

### Invariant 6: Teach 40k in Tabletop Encounter Order (Just-in-Time Curriculum)
- Never front-load walls of rules text before play. Introduce rules at the exact micro-moment they are needed:
  1. **Pre-Game:** Leader/Support attachments, Reserves/Transports, Infiltrators & Scouts.
  2. **Command Phase:** `+1 CP` generation, Army Rule selection, Below Half-Strength Battle-shock (`2D6 ≥ Ld`).
  3. **Movement Phase:** Normal Move (`M"`), Advance (`M" + D6"`), Fall Back, Reinforcements (`>9"` / 11th Ed rules).
  4. **Shooting Phase:** Weapon `Range`, `A`, `BS`, interactive **`S vs. T` Wound Roll Chart**, `AP`, `D`.
  5. **Charge Phase:** 11th Ed **Roll `2D6"` Before Selecting Targets** sequence.
  6. **Fight Phase:** Simultaneous Pile-In (`3"`), Melee `WS` attacks, Consolidate (`3"`).
  7. **End of Turn:** Primary objective checkboxes & Tactical Secondary scoring or discarding (`+1 CP` prompt).

### Invariant 7: Complete Match Lifecycle & Error-Proof State Transitions
- **Non-Linear Phase Jump Safety:** If a player jumps directly from `Pre-game` into Round 1 `Movement` or `Shooting` (bypassing `Command`) with `0 CP` and zero logged stratagems, auto-credit Round 1's starting `+1 CP` so Stratagems are immediately usable during demo exploration or casual games.
- **Opponent Watchlist Transparency:** When an opponent faction/detachment is configured, the Stratagems Drawer provides an **`👁️ Opponent Watchlist`** tab surfacing the opponent's reactive stratagems legal in the current phase/turn.
- **Celebratory Post-Game Closure:** Round 5 `End of Round` (and an optional early `Finish Match` action) opens the **Victory & After-Action Summary Modal**, capping total VP at 100, summarizing CP spent and surviving units, and persisting the battle to Dexie `matchHistory`.

---

## 3. Semantic Color & Typography System

| Semantic Token | Tailwind Palette | Strictly Reserved For |
| :--- | :--- | :--- |
| **Proactive / Ready** | Emerald (`#10b981`) | `🟢 Your Turn` cockpit state, Ready unit left accent border, User VP/CP, Completed checkmarks. |
| **Reactive / Threat** | Crimson/Rose (`#e11d48`) | `🛡️ Opponent's Turn` (Reactive Mode), Damaged bracket / Destroyed alerts, Opponent VP/CP, Opponent Watchlist tab. |
| **Tactical Accent / CTA** | Amber (`#eab308`) | Primary phase progression CTA (`Next: [Phase]`), Stratagems (`⚡`), Objective Control (`OC`), Battle-shock warnings, `🎓 Coach: ON`. |
| **Invulnerable / Support** | Cyan (`#06b6d4`) | Invulnerable Saves (`Inv 4+`), Attached Support Leaders, Deployment/Reserves callouts. |
| **Surface Hierarchy** | Deep Slate (`#0b0c10` $\rightarrow$ `#14161f`) | High-contrast dark mode optimized for harsh overhead store lighting and 3-hour battery efficiency. |

- **Typography Rules:**
  - Minimum font size for any interactive or stat element is `11px` (`text-[11px]`); primary stat values (`M`, `T`, `Sv`, `W`, `OC`, `A`, `BS/WS`, `S`, `AP`, `D`) must use `text-xs` or `text-sm` `font-bold tabular-nums`.
  - Deduplicate identical model stat rows inside `CompositeUnitCard.tsx` (e.g., merge `Intercessor` and `Intercessor Sergeant` when their stat profiles are identical) to minimize vertical scrolling.
