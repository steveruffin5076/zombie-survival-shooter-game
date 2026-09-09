# Progress — Two-Side Roller Zombie Survival

**Source of truth for "what's next".** Update this before ending a session.

- **Full plan:** `~/.claude/plans/can-you-check-my-noble-catmull.md`
- **Prior plan (done):** `docs/superpowers/plans/2026-09-08-android-touch-and-packaging.md`
- **Last updated:** 2026-09-09 (Phase 3 in progress)

---

## Current status

Converting an endless wave shooter into a finite, mission-based tactical survivor. **Phases 0–2 are complete.** Phase 3 (grid inventory, loot, save) is in progress — the largest single system in the plan. Sections 4–5 of the spec (defend-the-base climax) still have no code — that's Phases 4–7 below.

**Immediate next action:** Phase 3 continued — build `SafeHouseOverlay.tsx`, wire `InventoryOverlay.tsx` + an inventory-toggle hotkey into `App.tsx`, add crate/consumable hints to `Hud.tsx`, then run the phase's in-browser verification pass (nothing in Phase 3 has touched a browser yet — see the checklist below for exactly what's done vs. not).

### Branch state

`android-touch-and-packaging` is merged into `main` (commit `17fb2ee`). `main` now has touch controls, Capacitor 6, the Vitest test runner (16 tests passing), the combat rework (lane-lock aim, fire mode, noise/suppressor economy), and Phase 0's fixes. The `android-touch-and-packaging` branch/worktree itself is left as-is (already merged forward, not deleted).

---

## Decisions locked

| Question | Decision |
|---|---|
| Movement model | Stages 1–3 free-roaming travel; **Stage 4 fixed-camera arena**, left/right lanes |
| Endless mode | **Keep both** — menu offers Mission and Endless (`Engine.runMode`) |
| Run length | **15–25 min** per full 4-stage mission |
| Hideout | **Stubbed** — backpack fixed 4x4; save format models it for later, never reads it |
| Boss attacks | **3 only** — Ground Slam, Puke Mortar, Screaming Call. Berserker Charge **cut** |
| Death penalty | **Restart at last safe house**, keep level/XP/upgrades/weapons, lose carried backpack |
| Intel items | **Auto-bank on pickup**, no grid cost (grid cost returns with a lore screen) |
| Default pistol | **SIG Sauer P365** — semi-auto, 330 rpm, 16 dmg, 12-round mag, unlimited reserve |

---

## Phases

### Phase 0 — Foundation (~0.5 day) — DONE (2026-09-09)
- [x] Commit the uncommitted combat rework (482 lines) — `6d485bf`
- [x] Merge `android-touch-and-packaging` into `main` — `17fb2ee`, conflicts resolved in `App.tsx`/`Hud.tsx` by combining the fire-mode toggle with the touch prop + `TouchControls` block
- [x] Fix Scatter Kit bug — `recompute()` now compares `w.cls === "shotgun"` instead of the always-false `this.kind === "shotgun"` — `755790e`
- [x] Add `p365` to `weapons.ts`, point `STARTER` at it, add `semiAuto?`/`pivotMul?`/`magUpgrades?` to `WeaponDef` — `755790e`
- [x] Add a `pivotT` turn delay (~0.12s × `pivotMul`, blocks `fire()`) on lane flip — `755790e`
- **Verified:** `npx tsc --noEmit` clean · `npm test` 16/16 passing · `npm run build` succeeds · played in-browser — P365 is the starting weapon (12/12 ammo, ∞ reserve), movement/pivot/laser-flip confirmed working
- **Note:** Scatter Kit's +2 pellets was verified by code inspection (the predicate fix is unambiguous), not by playing to the upgrade — reaching Scatter Kit requires a level-up mid-run

### Phase 1 — Stage & difficulty architecture (~1.5 days) — DONE (2026-09-09)
- [x] New `src/game/stages.ts` (`STAGES` table: 4 stages × 9 waves = 36-wave mission) and `src/game/themes.ts` (placeholder `ThemeDef`s, not yet consumed by `render()` — that's Phase 2)
- [x] Renamed `this.wave` → `this.power` (difficulty scalar, used by every balance formula); added `this.waveIndex` (monotonic global wave count, display-only — wave-subtitle pick, "next wave" gate, debug overlay)
- [x] `WORLD_W` → `this.worldW`, set per-stage via `setStage()`; `genDecor(theme, worldW)` now clears all 5 decor arrays before regenerating, so stage transitions (`advanceStage()`) can call it again safely
- [x] Deleted `WAVES_PER_STAGE`, `STAGE_NAMES`/`STAGE_SUBS`, `isBossWave()`, the `% STAGE_NAMES.length` loop — replaced by `this.stageDef` (`wavesPerStage`, `bossWaves: number[]`, `name`, `sub`)
- [x] Added `stageName` + `bossWaves` to `HudState`; fixed the duplicated `n === 5 || n === wavesPerStage` at `Hud.tsx:85` (now `hud.bossWaves.includes(n)`) and the hardcoded `"10 / 10 WAVES SURVIVED"` at `Overlays.tsx` (now `wavesPerStage` passed through the `stageclear` event)
- [x] `Engine.runMode: "mission" | "endless"` — `startGame(mode)`; mission clamps at stage 4 via `stageDefFor()`, endless cycles the same 4-stage table forever as a synthetic repeating `StageDef`
- [x] Replaced the `modalOpen` boolean with `private modals = new Set<ModalKind>()` + a `private get modalOpen()` getter (every read site unchanged; only the 5 write sites touch `this.modals` directly)
- [x] `?debug=1` renders a bottom-left readout (`mode/stage/wave/power/idx`); `?mode=mission` is a temporary dev hook in `App.tsx` to reach mission mode before Phase 2 builds a real menu selector — **no Mission/Endless UI exists yet**, `startGame()` still defaults to endless so today's play is unchanged
- **Verified:** `npx tsc --noEmit` clean · `npm test` 8/8 passing · `npm run build` succeeds · played both modes in-browser (screenshots) — stage 1 identical in both, boss-wave pips correctly light at 5 & 9, debug overlay showed `power`/`idx` climbing monotonically during live combat · `stageDefFor`/`cumulativeWaveIndex` checked directly via `tsx`: mission stage 5+ clamps to stage 4 ("GROUND ZERO", never wraps back to "THE CEMETERY"), endless stage 5 correctly wraps to a fresh "THE CEMETERY" instance, `cumulativeWaveIndex(4, 9, "mission")` === 36

### Phase 2 — Mission flow: travel, safe house, win (~3 days) — DONE (2026-09-09)
- [x] Travel gates: `startTravel()` seeds 0–3 `Gate`s ≥500px apart between wherever the last wave ended and `safeHouseX`; contact opens a gate, ratchets `travelMinX` forward (the "right-edge clamp only" — during travel only the world's right edge is a hard clamp, the left bound is the last opened gate, so backtracking past a cleared checkpoint is out), and cancels an in-progress `dashT`
- [x] `phase` gains `"travel"` (the old break/active if-else is now a 3-way branch); safe house is a physical glowing door at `safeHouseX`, drawn + reached via simple x-threshold contact — no interact key yet, that arrives with Phase 4's `[E] BYPASS`
- [x] Anti-camping: `updateTravel()` tracks `travelProgressX`/`travelIdleT`; past 40s without rightward progress, `threat += 0.055*dt` (reuses the existing threat bar/`triggerAmbush()` — no new punishment system)
- [x] `missionComplete()` (reuses `this.over`, the existing death-freezes-the-sim flag) + `MissionWin` overlay (`Overlays.tsx`) + best-mission-time in `localStorage` (`graveyard-shift-best-time`); fires only when `runMode === "mission"` and the safe house is reached on the final `STAGES` entry — endless just keeps calling `completeStage()`/`advanceStage()` forever
- [x] Per-stage themes: `ThemeDef` grew sky/ground gradient stops + `decorWeights`; `render()`'s sky/ground gradients and `genDecor()`'s decor-kind roll both read `this.theme` now. 3 new decor primitives — wrecked car, concrete road barrier, rubble pile with rebar — weighted per stage (cemetery stays tombstones/trees, suburbs mixes in cars+rubble, highway leans barriers+cars, arena is mostly rubble)
- [x] Found and fixed a real bug during verification: `advanceStage()` never repositioned the player, so a stage started wherever the *previous* stage's travel ended (near that stage's right edge) — stage 2+'s `safeHouseX` computation could land past the world's hard clamp, an unreachable door that hung travel forever. Fixed by having `advanceStage()` walk the player back to the new stage's left side, plus a defensive `Math.min(worldW - 60, ...)` in `startTravel()` so `safeHouseX` can never exceed what's physically reachable regardless of where combat left the player
- **Verified:** `npx tsc --noEmit` clean · `npm test` 8/8 passing · `npm run build` succeeds · a `?debug=1` build exposes `window.__engine`, used to fast-forward (insta-clear each wave's queue/zombies, zero `breakT`) through **all 4 mission stages end-to-end in-browser**: stage names/themes changed correctly, gates opened on contact, every safe house was reachable, `MissionWin` fired exactly at stage 4's door with a monotonic `power` of `1 → 36` and `NEW BEST TIME` set · separately confirmed **endless mode cycles past stage 4 into a fresh "THE CEMETERY" (stage 5) without ever calling `missionComplete()`** · a normal, non-cheated few seconds of play (no `?debug`) looked identical to Phase 1 — combat, HUD, movement all unaffected
- **Note:** no Mission/Endless menu selector exists yet (still the Phase 1 `?mode=mission` dev hook) — that's real Phase 2 scope the checklist didn't call out explicitly; worth doing before Phase 3 if a human is going to playtest this, otherwise mission mode is only reachable via URL param

### Phase 3 — Grid inventory, loot, save (~5 days, largest system) — IN PROGRESS (2026-09-09)
- [x] `src/game/grid.ts` (pure) + tests (16) · `items.ts` · `loot.ts` (injected rng, 4 tests) · `save.ts` (versioned + `migrate()`, 6 tests — `saveRun`/`loadRun` themselves untested under vitest since `localStorage` doesn't exist in its `node` environment; covered by in-browser verification instead)
- [x] Extracted `ui.tsx` (`MenuButton`, `StatBox`, `RARITY_STYLE`, `ICONS`) from `Overlays.tsx`
- [x] `GridPanel.tsx` (pointer events, not HTML5 DnD) · first pass at `InventoryOverlay.tsx` (non-blocking backpack viewer)
- [x] Crates spawn on wave clear (tier scales with boss waves), hold-to-open **while combat runs** via `updateCrates()`; tier 2/3 refuse above `threat > 0.5` with a "TOO LOUD TO OPEN" warning
- [x] Consumables on hotkeys `G`/`B`/`N`/`T` (grenade/bandage/decoy/stim) via `useConsumable()`; ammo boxes **class-typed**, auto-consumed from the backpack in `startReload()` when reserve hits 0; `pl.useT` blocks `fire()` during the use animation
- [x] Safe house (`completeStage()`): reserve tops up to **50%** floor (not full), `supp` fully restored, `writeCheckpoint()` saves progression + deposit (not backpack)
- [x] Death (`die()`): `loadRun(runMode)` — if a checkpoint exists, `retryStage()` (`reset()` then restores level/XP/score/kills/owned/equipped/stacks/deposit/intel from it, backpack explicitly dropped) instead of ending the run; `missionComplete()` calls `clearRun()` since a finished mission has nothing left to retry
- [x] `getInventory()` + `invVer` added as the React data path for bulk backpack/deposit state — deliberately not folded into the 66ms `HudState` poll
- [ ] `SafeHouseOverlay.tsx` (the stage-clear → resupply/deposit → continue screen) — not built yet
- [ ] App.tsx doesn't toggle `InventoryOverlay` yet (no hotkey wired), and `Hud.tsx` has no crate-proximity/consumable-count hints
- [ ] **Nothing in this phase has been exercised in-browser yet** — only `tsc`/`vitest`/`build` have run clean so far
- **Verify (not yet done):** loot with a full grid · die and confirm deposit + progression survive, backpack doesn't · reload mid-run restores · open a tier-2/3 crate above and below threat 0.5 · drag an item in `GridPanel` onto an occupied cell and confirm it snaps back

### Phase 4 — Stealth vs Assault (~2.5 days) — NOT STARTED
- [ ] `Zombie.dormant` sleepers (wake on threat/damage/proximity+speed)
- [ ] `Hazard` noise traps (car alarms, glass, flares) — noise, not damage
- [ ] `quietKill(z)` — gives suppressor durability a purpose beyond punishment
- [ ] Gates get two verbs: `[E] BYPASS` below `threat < 0.35` vs shoot it loud
- [ ] HUD `LOOT LOCK` tick at 0.35 on the existing threat bar
- **Verify:** clear one stage-1 gate **both** ways
- **Rule:** never gate progress on quiet, only reward — stealth failure fails *forward*

### Phase 5 — Stage 4: arena, prep, deployables, scrap (~4 days) — NOT STARTED
- [ ] Arena: set `this.cam` to a constant origin (no camera mode flag); `worldW ≈ 1600`, not 1280
- [ ] Prep phase: `phase = "prep"`, 45s + READY skip (**not** `modalOpen` — it would freeze the clock)
- [ ] Pointer-event placement with ghost + validity tint; pure `canPlaceAt()`; max 6 per lane
- [ ] Barricade (blocks + retargets zombies; spitters arc over) · Razor wire (`Zombie.slow`) · Claymore (deferred ambush if `ambushT > 0`)
- [ ] `awardSupply(a, cap)` — ammo as a fraction of **capacity**, skip `reserve <= 0`; `reserveCap: 0.6`
- [ ] Delete `+12 HP`/wave and the full heal on stage clear
- [ ] Scrap via `Gem.kind`; 12s break window + `RepairPanel.tsx`
- **Verify:** camera locked, player contained · all 3 tools in both lanes · log `reserve` deltas W1–4, genuinely pistol-dependent by W4

### Phase 6 — The Juggernaut Alpha (~3 days) — NOT STARTED
- [ ] `src/game/boss.ts` (pure types + timing table + `pickAttack`, never repeats `last`)
- [ ] `AimTarget` structural type so auto-aim sees the boss without a `Zombie` cast
- [ ] Ground Slam (1.9s windup) → Puke Mortar (1.1s) → Screaming Call (1.4s), one at a time
- [ ] Slam **damages** deployables (`0.6 × maxHp`), never wipes the lane
- [ ] 3 phases; slam windup **floors at 1.6s** — density, never reaction-time theft
- [ ] Boss lock rule: boss wins unless an add is within 130px; `◤BOSS◢` bracket; `KeyE` override
- [ ] HUD 3-segment boss bar; distinct sfx pitch per windup
- [ ] Anti-stacking: one active ambush max; suppress lane-edge spawns 2s after any windup
- **Verify:** each attack in isolation, then together · **beat wave 5 with the starter pistol only** (the fight's most important number)

### Phase 7 — Touch rework & Android (~1.5 days) — NOT STARTED
- [ ] Delete the drag-to-aim surface (~30 lines) + `setAimFromClient` + `canvasPointFromClient` + tests — obsoleted by lane auto-aim
- [ ] Replace with tap-left/tap-right pivot + FIRE button + fire-mode toggle
- [ ] Touch affordances for prep placement, inventory drag, interact/loot
- [ ] Android debug APK — **blocked on installing Android Studio + SDK** (`ANDROID_HOME` unset, no `adb`/`gradle`; Capacitor 6 + JDK 17 already matched)
- **Verify:** mobile-emulated viewport, then a real device; no HUD collisions

---

## Standing rules

- `npm test` + `npx tsc --noEmit` + `npm run build` every phase. Pure modules get Vitest; engine/UI is verified by playing it in the browser.
- Keep new subsystem logic as **pure data + pure functions in their own modules**; `engine.ts` holds only arrays and `update*`/`draw*`. It's ~2,680 lines now and heading past 3,500 — Phase 3's grid/loot/save work goes in their own modules, not here.
- Mission-only systems gate on `runMode === "mission"` at exactly **one** place each.
- Reuse, don't rebuild: `EngineEvent` union + single `switch` in `App.tsx`, the `getHud()` 66ms poll, callback props (children never get the engine), `announce()`/`drawBanner()`, the `Gem` pickup pipeline, `phase`/`breakT`, `triggerAmbush()`, the `ICONS` map.

## Open items / notes

- **P365 is ~27% lower DPS than the Glock 18 it replaces** (88 vs 120) because it is semi-auto, not full-auto. If early waves feel sluggish, raise per-shot damage (16 → 18), **not** the fire rate.
- Boss HP must be sized against **pistol** DPS, not carbine (88 vs 255), or the starving supply curve becomes a loss screen.
- `.claude/launch.json` is local dev-server tooling — deliberately untracked, do not commit.
