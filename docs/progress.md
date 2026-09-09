# Progress — Two-Side Roller Zombie Survival

**Source of truth for "what's next".** Update this before ending a session.

- **Full plan:** `~/.claude/plans/can-you-check-my-noble-catmull.md`
- **Prior plan (done):** `docs/superpowers/plans/2026-09-08-android-touch-and-packaging.md`
- **Last updated:** 2026-09-09 (Phase 0 complete)

---

## Current status

Converting an endless wave shooter into a finite, mission-based tactical survivor. **Phase 0 is complete.** Sections 3–5 of the spec (inventory, mission structure, defend-the-base climax) still have no code — that's Phases 1–7 below.

**Immediate next action:** Phase 1 — stage & difficulty architecture (`stages.ts`, `this.wave` → `this.power` rename, `WORLD_W` → `this.worldW`).

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

### Phase 1 — Stage & difficulty architecture (~1.5 days) — NOT STARTED
- [ ] New `src/game/stages.ts` (`STAGES` table) and `src/game/themes.ts`
- [ ] Rename `this.wave` → `this.power` (float) so the compiler surfaces all **six** balance sites; add `waveIndex` for display
- [ ] `WORLD_W` → `this.worldW` (12 sites); `genDecor(theme, worldW)` must **clear** its 5 arrays first
- [ ] Delete `WAVES_PER_STAGE`, `STAGE_NAMES`/`STAGE_SUBS`, `isBossWave()`, hardcoded wave weights, the `% STAGE_NAMES.length` loop
- [ ] Add `stageName` + `bossWaves` to `HudState`; fix duplicated logic at `Hud.tsx:85` and hardcoded `"10 / 10 WAVES SURVIVED"` at `Overlays.tsx:191`
- [ ] `Engine.runMode` mode split — Endless as a synthetic repeating `StageDef`
- [ ] Replace `modalOpen` boolean with a `Set<ModalKind>` + private getter
- **Verify:** stage 1 plays as today · debug overlay prints monotonic `power` 1→36 · no looping past stage 4

### Phase 2 — Mission flow: travel, safe house, win (~3 days) — NOT STARTED
- [ ] Travel gates (right-edge clamp only; cancel `dashT` on contact, gates ≥500px apart)
- [ ] `phase` gains `"travel"`; safe house as a physical door at `safeHouseX`
- [ ] Anti-camping: `threat += 0.055*dt` after 40s without rightward progress
- [ ] `missionComplete()` + `MissionWin` overlay + best-mission-time persistence
- [ ] Per-stage themes in `render()` + 3 new decor primitives (~450 lines of canvas)
- **Verify:** walk stage 1 end to end through every gate into the safe house · reach the win screen

### Phase 3 — Grid inventory, loot, save (~5 days, largest system) — NOT STARTED
- [ ] `src/game/grid.ts` (pure) + tests · `items.ts` · `loot.ts` (injected rng) · `save.ts` (versioned + migrate)
- [ ] Extract `ui.tsx` (`MenuButton`, `StatBox`, `RARITY_STYLE`, `ICONS`) from `Overlays.tsx`
- [ ] `GridPanel.tsx` (pointer events, not HTML5 DnD) · `InventoryOverlay.tsx` · `SafeHouseOverlay.tsx`
- [ ] Crates with hold-to-open **while combat runs**; tier 2/3 refuse to open above `threat > 0.5`
- [ ] Consumables on hotkeys (`G`/`B`/`N`/`T`); ammo boxes **class-typed**; `pl.useT` blocks firing
- [ ] Safe house: refill reserve to **50%** (not full), restore `supp`, save
- [ ] Death: keep deposit + progression, drop backpack; `retryStage()` = `reset()` **then** `loadRun`
- [ ] Grid→React via `invVer` + `getInventory()`, **not** `HudState`
- **Verify:** loot with a full grid · die and confirm deposit + progression survive, backpack doesn't · reload mid-run restores

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
- Keep new subsystem logic as **pure data + pure functions in their own modules**; `engine.ts` holds only arrays and `update*`/`draw*`. It is already ~2,400 lines and heading past 3,500.
- Mission-only systems gate on `runMode === "mission"` at exactly **one** place each.
- Reuse, don't rebuild: `EngineEvent` union + single `switch` in `App.tsx`, the `getHud()` 66ms poll, callback props (children never get the engine), `announce()`/`drawBanner()`, the `Gem` pickup pipeline, `phase`/`breakT`, `triggerAmbush()`, the `ICONS` map.

## Open items / notes

- **P365 is ~27% lower DPS than the Glock 18 it replaces** (88 vs 120) because it is semi-auto, not full-auto. If early waves feel sluggish, raise per-shot damage (16 → 18), **not** the fire rate.
- Boss HP must be sized against **pistol** DPS, not carbine (88 vs 255), or the starving supply curve becomes a loss screen.
- `.claude/launch.json` is local dev-server tooling — deliberately untracked, do not commit.
