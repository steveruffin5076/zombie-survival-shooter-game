# Progress — Two-Side Roller Zombie Survival

**Source of truth for "what's next".** Update this before ending a session.

- **Full plan:** `~/.claude/plans/can-you-check-my-noble-catmull.md`
- **Prior plan (done):** `docs/superpowers/plans/2026-09-08-android-touch-and-packaging.md`
- **Last updated:** 2026-09-09 (Phase 5 done)

---

## Current status

Converting an endless wave shooter into a finite, mission-based tactical survivor. **Phases 0–5 are complete.** Section 5 of the spec (defend-the-base climax) is what Phases 5–6 are building; Phase 5 laid the arena groundwork, Phase 6 adds the boss fight on top of it.

**Immediate next action:** Phase 6 — The Juggernaut Alpha: `boss.ts` timing table, the 3-attack pattern (Ground Slam / Puke Mortar / Screaming Call), deployable-damaging slam, boss lock/HUD bar, anti-stacking with the ambush system.

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

### Phase 3 — Grid inventory, loot, save (~5 days, largest system) — DONE (2026-09-09)
- [x] `src/game/grid.ts` (pure) + tests (16) · `items.ts` · `loot.ts` (injected rng, 4 tests) · `save.ts` (versioned + `migrate()`, 6 tests — `saveRun`/`loadRun` themselves untested under vitest since `localStorage` doesn't exist in its `node` environment; covered by in-browser verification instead)
- [x] Extracted `ui.tsx` (`MenuButton`, `StatBox`, `RARITY_STYLE`, `ICONS`) from `Overlays.tsx`
- [x] `GridPanel.tsx` (pointer events, not HTML5 DnD) · `InventoryOverlay.tsx` (non-blocking backpack viewer, `I` to toggle) · `SafeHouseOverlay.tsx` (stage-clear → resupply/deposit → continue)
- [x] Crates spawn on wave clear (tier scales with boss waves), hold-to-open **while combat runs** via `updateCrates()`; tier 2/3 refuse above `threat > 0.5` with a "TOO LOUD TO OPEN" warning; `Hud.tsx` shows a hold-progress prompt near the player
- [x] Consumables on hotkeys `G`/`B`/`N`/`T` (grenade/bandage/decoy/stim) via `useConsumable()`; ammo boxes **class-typed**, auto-consumed from the backpack in `startReload()` when reserve hits 0; `pl.useT` blocks `fire()` during the use animation
- [x] Safe house (`completeStage()`): reserve tops up to **50%** floor (not full, and skips unlimited-reserve pistols correctly), `supp` fully restored, `writeCheckpoint()` saves progression + deposit (not backpack). `StageClear`'s continue button now opens `SafeHouseOverlay` instead of advancing immediately; its own continue is what calls `advanceStage()`
- [x] Death (`die()`): `loadRun(runMode)` — if a checkpoint exists, `retryStage()` (`reset()` then restores level/XP/score/kills/owned/equipped/stacks/deposit/intel from it, backpack explicitly dropped) instead of ending the run; `missionComplete()` calls `clearRun()` since a finished mission has nothing left to retry
- [x] `getInventory()` + `invVer` added as the React data path for bulk backpack/deposit state, polled on the same 66ms tick as `HudState` but gated so a grid re-render only happens when `invVer` actually changes — deliberately not folded into `HudState` itself
- [x] Bug found and fixed during verification: the grenade's original physics (420px/s throw, explode on a fixed 1.1s fuse regardless of where it was in the air) meant it detonated ~460px from the thrower — nearly 3.5x past its own 130px blast radius, so it could never hit anything thrown at a realistic target. Fixed by lobbing it slower (220px/s) and forcing detonation ~0.3s after it actually lands, so the explosion happens where the grenade physically is, not wherever the original flight timer happened to expire
- **Verified end-to-end in-browser** via the `?debug=1` → `window.__engine` hook: crate spawns after a wave clear and hold-`E` opens it with loot landing in the backpack grid; **looting against a full 16-item grid** doesn't crash or overfill it (16 in, 16 out, crate still marks opened); bandage heals 40→80 HP; the fixed grenade now does real blast damage to a zombie 60px from the thrower (200→190.5 HP) once isolated from the player's own gunfire; noise decoy zeroes threat; stim sets a ~6s buff; a class-typed ammo box auto-fills a limited-reserve weapon's reserve on reload (0→60) and is consumed; the full `StageClear → SafeHouseOverlay → ENTER STAGE` flow works, `DEPOSIT ALL` is correctly disabled on an empty backpack, and resupply correctly leaves an unlimited-reserve pistol's reserve at `-1` rather than corrupting it; death **with** a checkpoint restarts at the checkpoint's stage with level/score preserved, backpack emptied, and the run still playing (`over: false`); death **without** one still shows the classic GameOver screen; `InventoryOverlay` opens/closes on `I`; `GridPanel` drag-and-drop moves an item to a free cell and correctly snaps back (no state change) when dropped on an occupied one
- **Note:** touch affordances for crate-hold/inventory-drag are explicitly Phase 7's job ("Touch affordances for prep placement, inventory drag, interact/loot"), not built here — this phase's new interactions (`E`, `I`, `G`/`B`/`N`/`T`) are keyboard-only for now, consistent with Phase 1/2's `?mode=`/`?debug=` dev-hook pattern of shipping the system before its final input polish

### Phase 4 — Stealth vs Assault (~2.5 days) — DONE (2026-09-09)
- [x] `Zombie.dormant` sleepers: 0–2 spawn per travel gate (`startTravel()`, `chance(0.7)` each), inert (no movement, no attack timer, no contact damage — `updateZombies()` just `continue`s past them) until woken by `this.threat > 0.5`, or the player passing within 90px while `|vx| > 220` (running/dashing — a slow walk-by never wakes them)
- [x] `Hazard` noise traps (`alarm`/`glass`/`flare`, 0–N scattered along the travel corridor): trigger `addNoise(0.35)` — noise, never damage — only when the player is within 26px **and** moving fast; walking through at any speed under the threshold never trips one
- [x] `quietKill(z)`: a suppressed bullet (`supp[kind] > 0` or integral `>= 999`) landing on a still-dormant sleeper instant-kills it without the normal per-hit fx and, critically, without calling the wake-spread — nearby sleepers stay asleep. An unsuppressed hit instead wakes the target **and** spreads the wake to every dormant zombie within 220px (`wakeZombie(z, true)`) — same for a grenade's blast (spread radius 2.5x the blast radius, since an explosion is loud regardless of range). This is the payoff for suppressor durability the Phase 3 note called for
- [x] Gates now have two verbs in `updateTravel()`: walk within 30px and it opens the old way — instant, wakes nearby sleepers, always available, satisfying "never gate progress on quiet." Or hold `E` from 30–70px out while `threat < 0.35` for ~0.9s and it opens silently ("SLIPPED THROUGH") without waking anyone nearby — a reward, never a requirement
- [x] HUD: a `LOOT LOCK` tick + label at the 35% mark on the existing NOISE bar; a crate-style hold-progress prompt for the gate bypass (`gateBypassNear`/`gateBypassPct`/`gateBypassLocked` in `HudState`, mirroring the Phase 3 crate prompt pattern); dormant zombies render with closed/no-glow eyes, a frozen idle pose (no shamble animation), and drifting "z" characters as the only tell from a distance
- **Verified in-browser** via the `?debug=1` hook: standing/walking slowly inside a sleeper's 90px radius leaves it dormant after 250ms; approaching at >220px/s wakes it; `quietKill()` called directly kills a sleeper without waking one 150px away, while `wakeZombie(z, true)` called directly wakes both a 150px-away sleeper and leaves a 500px-away one untouched; the real bullet-hit path confirmed end-to-end — a suppressed pistol auto-engaging a sleeper removes it silently, an unsuppressed one wakes it and deals visible damage instead; a hazard didn't trip on a slow approach but did (with `threat` climbing) on a fast one; **holding E under threat 0.35 opened a gate with the sleeper next to it staying dormant, and separately walking straight into a gate opened it loud and woke that same sleeper** — the explicit "clear one stage-1 gate both ways" verify item · a full 4-stage mission fast-forward afterward confirmed no regressions (gates/sleepers spawned correctly every stage, mission still completed cleanly)
- **Rule honored:** stealth is never required to progress — the loud path through any gate or past any sleeper is always available and instant; quiet is strictly an optional, better outcome (no wake, no noise)

### Phase 5 — Stage 4: arena, prep, deployables, scrap (~4 days) — DONE (2026-09-09)
- [x] Arena: `this.cam` locked to a constant origin (`camOrigin() = (worldW - W) / 2`, no mode flag — gated purely on `stageDef.themeId === "arena"` at the one per-frame camera update site, plus the three stage-entry snap sites: `advanceStage()`, `retryStage()`, and `reset()`'s stage-1 default which is never arena); travel phase after the arena's own waves keeps the normal follow-cam. `worldW: 1600` in `stages.ts` (was 2880)
- [x] Prep phase: new `phase: "prep"` value (widened on both `Engine.phase` and `HudState.phase`); `beginRest(breakDur)` replaces every plain-`"break"` stage-entry/wave-clear site and branches to `prepT = 45, repairWindowT = 12` for arena or the old `breakT` for everything else — a single gated helper, not scattered `if (arena)` checks. `Enter` (checked in `onKeyDown`, **not** `modalOpen`) zeroes `prepT` for an instant READY skip; the `"prep"` branch in `update()` ticks `prepT`/`repairWindowT` down and calls the existing `startWave()` once it expires
- [x] Placement: `arena.ts` (pure, no engine state) — `DEPLOYABLE_DEFS`, `canPlaceAt()`, `worldXToSlot()`/`slotToWorldX()`, `MAX_PER_LANE = 6`; 13 vitest cases. `onMouseDown` intercepts prep-phase clicks (only when a tool is selected) into `tryPlaceDeployable()` instead of the usual lane-pivot; `drawPlacementGhost()` renders a green/red-tinted preview at the cursor's resolved slot every frame during prep
- [x] Barricade (220 hp): inline nearest-ahead-wall lookup in `updateZombies()` (not `arena.ts`'s `nearestBarricade()` — that helper's "closest to center" semantics didn't fit a per-zombie "closest to me, still ahead" query, so it stayed unused/tested-only and the real check lives next to the zombie loop that has the context). A blocked melee zombie redirects onto the wall and deals `dmg × 1.4` on its normal attack cooldown instead of touching the player (`!wall` now guards contact damage); spitters ignore walls entirely and lob over, per the checklist. Razor wire (90 hp): no collision, just `z.slowT = 0.4` on proximity. Claymore (40 hp): `updateDeployables()` checks proximity each frame and **returns immediately while `ambushT > 0`**, holding its trigger through an active ambush instead of wasting it on the first zombie; `explodeClaymore()` reuses the grenade's AOE-damage-and-particle pattern
- [x] `awardSupply(amount, cap)`: for every `WEAPON_IDS` entry, skips `WDEF[id].reserve <= 0` (pistols' `-1` unlimited, and any true 0), else tops reserve up by `amount` of max capacity capped at `cap` of it. Called at every non-final arena wave-clear with `(0.18, 0.6)` in place of the `+12 HP`/wave heal (which stays for stages 1–3)
- [x] Full heal on stage clear gated the same way, at its one call site in `completeStage()`: `if (this.stageDef.themeId !== "arena") this.pl.hp = this.st.maxHp` — checked against the *current* (just-cleared) stage's theme, since that's the only site that ever runs for an arena clear (mission mode's stage 4 clear goes through the separate, already-heal-free `missionComplete()`; endless mode's repeating arena laps go through `completeStage()` and are the case this actually gates)
- [x] Scrap: `Gem.kind: "xp" | "scrap"` — `killZombie()` gets a `chance(0.22)` scrap-drop block (arena only) alongside the existing xp-gem push; `updateGems()`'s pickup branch splits on `g.kind` into `this.scrap +=` vs the existing `gainXp()` call, each with its own pickup-particle color. `RepairPanel.tsx` — a small floating panel, visible while `repairWindowT > 0`, listing damaged deployables with `DEPLOYABLE_DEFS[kind].repairCost`; spends `this.scrap` via the new public `repairDeployable(id)` engine method
- [x] HUD: `arena`/`prepT`/`prepMax`/`placingKind`/`scrap`/`repairWindowT`/`repairWindowMax` added to `HudState` (simple scalars through the 66ms poll, same as the Phase 3/4 crate/gate fields); the small deployable array itself goes through a plain `getDeployables()` poll gated on `hud.arena` in `App.tsx`, not folded into `HudState` and not worth a Phase-3-style `invVer` channel at this size (≤12 items)
- **UI placement bug caught and fixed during verification:** the first cut put the scrap counter + tool-selector buttons at `bottom-40`, which is exactly the screen band players click through to place deployables near the ground — the HUD's `pointer-events-auto` button row was silently swallowing placement clicks aimed anywhere near it. Moved the tool selector up into the top-center prep readout (screen space nothing else needs) and the scrap counter into the top-right score cluster; re-verified placement clicks land cleanly everywhere near the ground line again
- **Verified in-browser** via the `?debug=1`/`window.__engine` hook: teleported to stage 4 and confirmed `cam` sits fixed at `camOrigin()` (160) through prep and active phases even while holding `D` to run the player across the arena, and that the player stays clamped inside `worldW` (1600); placed all 3 tools (via both hotkeys and the click-to-place path) into both lane 0 slots and confirmed `getDeployables()` returned all 6 with correct `lane`/`slot`; spawned a zombie behind a placed barricade and watched it get marked `blockedBy`, chip the wall's hp down over ~0.7s of real combat, and stop touching the player while blocked; confirmed a zombie crossing a placed wire picked up `slowT = 0.4`; triggered a claymore via proximity (`armed` flipped false, zombies took blast damage) and separately confirmed one held `armed = true` while `ambushT > 0`; called `repairDeployable()` on a damaged wall and confirmed it restored to `maxHp` for the correct scrap cost; ran a 4-wave arena loop with a limited-reserve SMG equipped and logged `reserve` climbing `20 → 54.56 → 89.12 → 115.2 → 115.2` (W3 delta clipped by the 60%-of-192 cap, W4 delta zero — already saturated) while the starter pistol's reserve stayed unlimited (`-1`) throughout, confirming the intended pistol-dependency-by-W4 fallback · a full 4-stage mission fast-forward (all stages, all waves, arena included) completed with no console errors and `over: true` on mission completion — no regressions to Phases 0–4's flow
- **Rule honored:** every arena-only system gates on `stageDef.themeId === "arena"` at exactly one call site each (`beginRest`, the camera update, `completeStage`'s heal, `awardSupply`'s call site, `updateDeployables`); nothing new was rebuilt — deployable damage reuses the existing hit-text/shake idiom, claymore explosion reuses `explodeGrenade()`'s AOE pattern, and scrap reuses the `Gem`/`gainXp()` pickup pipeline via a `kind` discriminant

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
- Keep new subsystem logic as **pure data + pure functions in their own modules**; `engine.ts` holds only arrays and `update*`/`draw*`. It's **3,203 lines now** — Phase 3 kept its data/rules in `grid.ts`/`items.ts`/`loot.ts`/`save.ts` as intended, but the crate/consumable/grenade *engine* glue (spawning, hold-to-open, `useConsumable()`, blast physics) — and now Phase 4's sleeper/hazard/gate-bypass logic too — still landed in `engine.ts` alongside the rest of combat, matching how `hitZombie()`/`killZombie()` etc. already live there rather than in a separate module. Phase 5/6 explicitly add `boss.ts` — worth actually using it as a real extraction rather than another `engine.ts` graft, or this file genuinely won't stop growing.
- Mission-only systems gate on `runMode === "mission"` at exactly **one** place each.
- Reuse, don't rebuild: `EngineEvent` union + single `switch` in `App.tsx`, the `getHud()` 66ms poll, callback props (children never get the engine), `announce()`/`drawBanner()`, the `Gem` pickup pipeline, `phase`/`breakT`, `triggerAmbush()`, the `ICONS` map.

## Open items / notes

- **P365 is ~27% lower DPS than the Glock 18 it replaces** (88 vs 120) because it is semi-auto, not full-auto. If early waves feel sluggish, raise per-shot damage (16 → 18), **not** the fire rate.
- Boss HP must be sized against **pistol** DPS, not carbine (88 vs 255), or the starving supply curve becomes a loss screen.
- `.claude/launch.json` is local dev-server tooling — deliberately untracked, do not commit.
