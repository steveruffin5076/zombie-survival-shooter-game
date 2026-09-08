# Android Touch Controls & Native Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing desktop (keyboard + mouse) canvas game fully playable on Android by adding touch controls, then package it as a sideloadable debug APK via Capacitor.

**Architecture:** The game engine ([src/game/engine.ts](../../../src/game/engine.ts)) already separates simulation from input via a private `keys: Set<string>` and a `mouse: {x,y,down}` object that `onKeyDown`/`onMouseMove`/`onMouseDown` mutate. We add a small public touch-input API on `Engine` that mutates the exact same internal state, so the simulation code (`inputDir()`, `update()`, `fire()`, `jump()`, `dash()`) needs zero changes. A new `TouchControls` React component (movement buttons + jump/dash buttons + a drag-to-aim surface) calls that API, gated to touch-capable devices only — desktop mouse/keyboard play is unaffected. Once touch works in the browser, Capacitor wraps the existing Vite single-file build (`dist/index.html`) into a native Android shell with no code changes required for that half.

**Tech Stack:** React 19, TypeScript, Vite 7, Vitest (new, unit tests for pure helpers only — canvas/native steps are verified manually since they aren't meaningfully unit-testable), Capacitor 6 (`@capacitor/core`, `@capacitor/android`, `@capacitor/cli`), Gradle (via Capacitor's generated `android/` project), existing OpenJDK 17.

## Global Constraints

- Zero behavior change for existing desktop keyboard/mouse controls — every task that touches `engine.ts` must be manually re-verified with mouse/keyboard in `npm run dev` before moving on.
- Touch controls use the **buttons + drag-to-aim** scheme: left/right move buttons, dedicated jump and dash buttons, drag-anywhere-on-canvas sets aim point and fires continuously while held (same semantics as holding the mouse button now).
- Target is a **debug APK for sideloading** — no release signing, no store icons/splash, no Play Console work.
- No test framework exists yet in this repo (`package.json` has none) — add Vitest, but only write automated tests for pure, DOM-free functions. UI and native-packaging tasks use explicit manual verification steps instead of unit tests.
- This environment has OpenJDK 17 but **no Android SDK** (`ANDROID_HOME`/`ANDROID_SDK_ROOT` unset, no `adb`/`gradle` on PATH). The final build task is gated on the user installing Android Studio + SDK first — this cannot be done by the agent.
- Follow existing code conventions: Tailwind utility classes matching the HUD's dark-glass look (`rounded-lg border border-white/10 bg-black/50 backdrop-blur-sm`), `lucide-react` icons, callback-prop pattern (App.tsx owns `engineRef`, children receive callbacks — never the engine instance itself).

---

### Task 1: Vitest setup + pure input helpers

**Files:**
- Create: `src/game/input.ts`
- Create: `src/game/input.test.ts`
- Modify: `package.json` (add `vitest` devDependency + `"test": "vitest run"` script)
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `canvasPointFromClient(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }, W: number, H: number): { x: number; y: number }` — converts a client-space point to the engine's fixed `W×H` canvas coordinate space (used by both mouse and touch aiming).
- Produces: `isTouchCapable(maxTouchPoints: number, coarsePointer: boolean): boolean` — pure predicate combining `navigator.maxTouchPoints` and a `matchMedia("(pointer: coarse)")` result, both passed in by the caller so this function stays DOM-free.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add Vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 3: Add the `test` script**

Modify `package.json` scripts block to:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

- [ ] **Step 4: Write the failing tests**

```typescript
// src/game/input.test.ts
import { describe, expect, it } from "vitest";
import { canvasPointFromClient, isTouchCapable } from "./input";

describe("canvasPointFromClient", () => {
  it("maps a client point at the canvas origin to (0,0)", () => {
    const rect = { left: 100, top: 50, width: 1280, height: 720 };
    expect(canvasPointFromClient(100, 50, rect, 1280, 720)).toEqual({ x: 0, y: 0 });
  });

  it("maps a client point at the canvas center to (W/2, H/2)", () => {
    const rect = { left: 100, top: 50, width: 1280, height: 720 };
    expect(canvasPointFromClient(100 + 640, 50 + 360, rect, 1280, 720)).toEqual({ x: 640, y: 360 });
  });

  it("scales when the on-screen rect is smaller than the logical canvas", () => {
    // rect is 640x360 on screen but logical space is 1280x720 -> 2x scale
    const rect = { left: 0, top: 0, width: 640, height: 360 };
    expect(canvasPointFromClient(320, 180, rect, 1280, 720)).toEqual({ x: 640, y: 360 });
  });
});

describe("isTouchCapable", () => {
  it("is true when the device reports touch points", () => {
    expect(isTouchCapable(5, false)).toBe(true);
  });

  it("is true when the pointer is coarse even with 0 reported touch points", () => {
    expect(isTouchCapable(0, true)).toBe(true);
  });

  it("is false for a mouse-only desktop", () => {
    expect(isTouchCapable(0, false)).toBe(false);
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL with "Cannot find module './input'" (or similar) since `src/game/input.ts` doesn't exist yet.

- [ ] **Step 6: Write the implementation**

```typescript
// src/game/input.ts

/** Converts a client-space (e.g. PointerEvent clientX/Y) point into the
 * engine's fixed logical canvas coordinate space, accounting for the
 * canvas being scaled to fit the viewport. */
export function canvasPointFromClient(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  W: number,
  H: number
): { x: number; y: number } {
  return {
    x: ((clientX - rect.left) / rect.width) * W,
    y: ((clientY - rect.top) / rect.height) * H,
  };
}

/** True if the device should show touch controls instead of relying on
 * mouse/keyboard. Takes raw signals so this stays testable without a DOM. */
export function isTouchCapable(maxTouchPoints: number, coarsePointer: boolean): boolean {
  return maxTouchPoints > 0 || coarsePointer;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all 6 tests green.

- [ ] **Step 8: Commit**

```bash
git add package.json vitest.config.ts src/game/input.ts src/game/input.test.ts
git commit -m "test: add vitest and pure touch/coordinate input helpers"
```

---

### Task 2: Engine touch-input API

**Files:**
- Modify: `src/game/engine.ts:344-357` (`onMouseMove`, `onMouseDown`, `onMouseUp`)
- Modify: `src/game/engine.ts:316-330` (near `onKeyDown`, to add public wrappers below it)

**Interfaces:**
- Consumes: `canvasPointFromClient` from `./input` (Task 1).
- Produces (new public methods on `Engine`, for `TouchControls` in Task 3 to call):
  - `pressKey(code: string): void`
  - `releaseKey(code: string): void`
  - `setAimFromClient(clientX: number, clientY: number): void`
  - `setFiring(down: boolean): void`
  - `triggerJump(): void`
  - `triggerDash(): void`

- [ ] **Step 1: Import the shared coordinate helper**

Modify the top of `src/game/engine.ts`:

```typescript
import { UPGRADES, type UpgradeDef } from "./upgrades";
import { Sfx } from "./audio";
import { canvasPointFromClient } from "./input";
import type { EngineEvent, GameStats, HudState, UpgradeChoice } from "./types";
```

- [ ] **Step 2: Refactor `onMouseMove` to use the shared helper (no behavior change)**

Replace:

```typescript
  private onMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * W;
    this.mouse.y = ((e.clientY - rect.top) / rect.height) * H;
  };
```

with:

```typescript
  private onMouseMove = (e: MouseEvent) => {
    this.setAimFromClient(e.clientX, e.clientY);
  };
```

- [ ] **Step 3: Add the public touch-input API**

Add these public methods directly below `onMouseUp`/`onCtx` (still inside the `Engine` class):

```typescript
  /* ---------------- touch input (mirrors keyboard/mouse state) ---------------- */

  /** Marks a virtual key as held — same effect as a keydown for movement keys. */
  pressKey(code: string) {
    this.keys.add(code);
  }

  /** Releases a virtual key — same effect as a keyup. */
  releaseKey(code: string) {
    this.keys.delete(code);
  }

  /** Sets the aim point from a raw touch/pointer client position. */
  setAimFromClient(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const p = canvasPointFromClient(clientX, clientY, rect, W, H);
    this.mouse.x = p.x;
    this.mouse.y = p.y;
  }

  /** Starts/stops continuous fire — same effect as holding/releasing the mouse button. */
  setFiring(down: boolean) {
    if (down) this.sfx.ensure();
    this.mouse.down = down;
  }

  /** Triggers a jump, respecting the same game-state guards as the keyboard handler. */
  triggerJump() {
    if (this.mode !== "play" || this.over || this.paused || this.modalOpen) return;
    this.sfx.ensure();
    this.jump();
  }

  /** Triggers a dash, respecting the same game-state guards as the keyboard handler. */
  triggerDash() {
    if (this.mode !== "play" || this.over || this.paused || this.modalOpen) return;
    this.sfx.ensure();
    this.dash();
  }
```

- [ ] **Step 4: Manually verify desktop controls are unaffected**

Run: `npm run dev`, open the game in the Browser tool, start a run, and confirm: mouse aim still tracks the cursor, click-and-hold still fires continuously, A/D still move, Space/W still double-jumps, Shift still dashes. This must look identical to before the refactor.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine.ts
git commit -m "feat: add public touch-input API to Engine, reusing keyboard/mouse state"
```

---

### Task 3: TouchControls component

**Files:**
- Create: `src/components/TouchControls.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `isTouchCapable` from `src/game/input.ts` (Task 1); `Engine.pressKey/releaseKey/setAimFromClient/setFiring/triggerJump/triggerDash` (Task 2).
- Produces: `TouchControls` component with props `{ onMoveStart: (dir: -1 | 1) => void; onMoveEnd: () => void; onJump: () => void; onDash: () => void; onAimStart: (clientX: number, clientY: number) => void; onAimMove: (clientX: number, clientY: number) => void; onAimEnd: () => void }`.

- [ ] **Step 1: Build the component**

```typescript
// src/components/TouchControls.tsx
import { useRef } from "react";
import { ChevronLeft, ChevronRight, ArrowUp, Zap } from "lucide-react";

interface Props {
  onMoveStart: (dir: -1 | 1) => void;
  onMoveEnd: () => void;
  onJump: () => void;
  onDash: () => void;
  onAimStart: (clientX: number, clientY: number) => void;
  onAimMove: (clientX: number, clientY: number) => void;
  onAimEnd: () => void;
}

const btnClass =
  "flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/80 backdrop-blur-sm active:bg-white/20 active:text-white touch-none select-none";

export default function TouchControls({
  onMoveStart,
  onMoveEnd,
  onJump,
  onDash,
  onAimStart,
  onAimMove,
  onAimEnd,
}: Props) {
  const aiming = useRef(false);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {/* drag-to-aim surface: right two-thirds of the screen */}
      <div
        className="pointer-events-auto absolute right-0 top-0 h-full w-2/3 touch-none"
        onPointerDown={(e) => {
          aiming.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          onAimStart(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (aiming.current) onAimMove(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          aiming.current = false;
          onAimEnd();
        }}
        onPointerCancel={() => {
          aiming.current = false;
          onAimEnd();
        }}
      />

      {/* bottom-left: move buttons */}
      <div className="pointer-events-auto absolute bottom-8 left-6 flex gap-4">
        <button
          className={btnClass}
          onPointerDown={(e) => {
            e.preventDefault();
            onMoveStart(-1);
          }}
          onPointerUp={onMoveEnd}
          onPointerCancel={onMoveEnd}
          onPointerLeave={onMoveEnd}
          aria-label="Move left"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
        <button
          className={btnClass}
          onPointerDown={(e) => {
            e.preventDefault();
            onMoveStart(1);
          }}
          onPointerUp={onMoveEnd}
          onPointerCancel={onMoveEnd}
          onPointerLeave={onMoveEnd}
          aria-label="Move right"
        >
          <ChevronRight className="h-7 w-7" />
        </button>
      </div>

      {/* bottom-right: jump + dash */}
      <div className="pointer-events-auto absolute bottom-8 right-6 flex gap-4">
        <button
          className={btnClass}
          onPointerDown={(e) => {
            e.preventDefault();
            onDash();
          }}
          aria-label="Dash"
        >
          <Zap className="h-7 w-7" />
        </button>
        <button
          className={btnClass}
          onPointerDown={(e) => {
            e.preventDefault();
            onJump();
          }}
          aria-label="Jump"
        >
          <ArrowUp className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `App.tsx`**

Add the import near the top:

```typescript
import TouchControls from "./components/TouchControls";
import { isTouchCapable } from "./game/input";
```

Add a `touch` flag computed once (functional component body, alongside the existing `useState` calls):

```typescript
  const [touch] = useState(() =>
    isTouchCapable(navigator.maxTouchPoints, window.matchMedia("(pointer: coarse)").matches)
  );
```

Add the move-hold callbacks near the other `useCallback`s:

```typescript
  const moveStart = useCallback((dir: -1 | 1) => {
    engineRef.current?.pressKey(dir === -1 ? "KeyA" : "KeyD");
  }, []);
  const moveEnd = useCallback(() => {
    engineRef.current?.releaseKey("KeyA");
    engineRef.current?.releaseKey("KeyD");
  }, []);
  const triggerJump = useCallback(() => engineRef.current?.triggerJump(), []);
  const triggerDash = useCallback(() => engineRef.current?.triggerDash(), []);
  const aimStart = useCallback((x: number, y: number) => {
    engineRef.current?.setAimFromClient(x, y);
    engineRef.current?.setFiring(true);
  }, []);
  const aimMove = useCallback((x: number, y: number) => engineRef.current?.setAimFromClient(x, y), []);
  const aimEnd = useCallback(() => engineRef.current?.setFiring(false), []);
```

Render it only during gameplay, only on touch devices, right after the `Hud` block:

```typescript
        {screen === "game" && hud && <Hud hud={hud} onMute={toggleMute} onPause={togglePause} />}
        {screen === "game" && touch && !paused && !choices && !over && (
          <TouchControls
            onMoveStart={moveStart}
            onMoveEnd={moveEnd}
            onJump={triggerJump}
            onDash={triggerDash}
            onAimStart={aimStart}
            onAimMove={aimMove}
            onAimEnd={aimEnd}
          />
        )}
```

- [ ] **Step 3: Manually verify in an emulated mobile viewport**

Use the Browser tool: `resize_window` with `preset: "mobile"`, reload the page, start a game, and confirm: the drag-to-aim layer, move buttons, jump button, and dash button all render and respond (tap-and-hold left/right button moves the player; dragging on the right side aims and fires; jump/dash buttons trigger their actions). Then call `resize_window` with `preset: "desktop"` and confirm the buttons do **not** appear and mouse/keyboard still work.

- [ ] **Step 4: Commit**

```bash
git add src/components/TouchControls.tsx src/App.tsx
git commit -m "feat: add on-screen touch controls for mobile play"
```

---

### Task 4: Mobile viewport & touch-action polish

**Files:**
- Modify: `index.html`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new (styling/meta only).

- [ ] **Step 1: Lock the viewport against pinch-zoom and double-tap-zoom**

In `index.html`, replace:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

with:

```html
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
    />
```

- [ ] **Step 2: Stop the page from scrolling/pull-to-refreshing under touch**

Add to the top of `src/index.css` (after the existing `@import`/Tailwind directives, before other rules):

```css
html,
body {
  overscroll-behavior: none;
  touch-action: none;
}
```

- [ ] **Step 3: Manually verify**

In the Browser tool with `resize_window` `preset: "mobile"`, load the game, and confirm: pinch-to-zoom does nothing, dragging near the top of the page doesn't trigger a pull-to-refresh gesture, and the on-screen buttons from Task 3 still respond immediately (no 300ms tap delay, no accidental text selection/callout on long-press).

- [ ] **Step 4: Commit**

```bash
git add index.html src/index.css
git commit -m "style: lock mobile viewport zoom/scroll for touch play"
```

---

### Task 5: Capacitor Android project setup

**Files:**
- Create: `capacitor.config.ts` (generated by `cap init`, then reviewed)
- Create: `android/` (generated by `cap add android` — do not hand-edit generated Gradle files beyond what's specified below)
- Modify: `package.json` (add Capacitor deps + `android:sync` script)

**Interfaces:**
- Consumes: the production build at `dist/index.html` (produced by the existing `npm run build`, unchanged by this plan).
- Produces: a syncable native Android project consuming that build as its `webDir`.

- [ ] **Step 1: Install Capacitor**

```bash
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
```

- [ ] **Step 2: Build the web app once so `dist/` exists**

```bash
npm run build
```

Expected: `dist/index.html` is created (single-file build, per the existing `vite-plugin-singlefile` config).

- [ ] **Step 3: Initialize Capacitor**

```bash
npx cap init "Graveyard Shift" "com.graveyardshift.app" --web-dir=dist
```

Expected: creates `capacitor.config.ts` in the project root. Open it and confirm it contains:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.graveyardshift.app',
  appName: 'Graveyard Shift',
  webDir: 'dist',
};

export default config;
```

(If the user wants a different package/app id later, this is the only file to edit before re-running `cap sync`.)

- [ ] **Step 4: Add the Android platform**

```bash
npx cap add android
```

Expected: a new `android/` directory appears containing a full Gradle project (`android/app`, `android/gradlew`, `android/gradlew.bat`, etc.).

- [ ] **Step 5: Add a combined build+sync script**

Modify `package.json` scripts block to:

```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "android:sync": "vite build && npx cap sync android"
  },
```

- [ ] **Step 6: Verify the sync pipeline end-to-end**

```bash
npm run android:sync
```

Expected: runs the Vite build, then `cap sync` reports something like `√ copy android in Xs` and `√ Sync finished in Xs` with no errors. This confirms the native project is correctly wired to the web build — it does not yet require the Android SDK.

- [ ] **Step 7: Commit**

```bash
git add capacitor.config.ts android package.json package-lock.json
git commit -m "feat: add Capacitor Android wrapper around the existing web build"
```

---

### Task 6: Debug APK build & sideload verification

**Files:**
- None (build-only task; no source changes).

**Interfaces:**
- Consumes: the `android/` project from Task 5.
- Produces: `android/app/build/outputs/apk/debug/app-debug.apk`.

- [ ] **Step 1: Prerequisite gate — confirm the Android SDK is installed**

This environment currently has **no Android SDK** (`ANDROID_HOME`/`ANDROID_SDK_ROOT` are unset, `adb` and `gradle` are not on PATH). This step cannot be done by the agent — it requires installing Android Studio (which bundles the SDK) from https://developer.android.com/studio, then either:
- opening `android/` in Android Studio once (it prompts to install any missing SDK/build-tools and writes `android/local.properties` automatically), or
- manually creating `android/local.properties` with `sdk.dir=<path to Android SDK>` and installing the required platform + build-tools via `sdkmanager`.

Run this check before continuing:

```bash
echo $ANDROID_HOME
```

Expected: a real path. If empty, stop here and complete the prerequisite above before Step 2.

- [ ] **Step 2: Build the debug APK**

```bash
cd android
./gradlew assembleDebug
```

(On Windows without a POSIX shell: `android\gradlew.bat assembleDebug`.)

Expected: `BUILD SUCCESSFUL`, and the APK appears at:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

- [ ] **Step 3: Install it on a device or emulator**

With a device connected (USB debugging enabled) or an emulator running:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Expected: `Success`.

- [ ] **Step 4: Manual play-test on device**

Launch "Graveyard Shift" on the device and confirm:
- The disclaimer-free menu screen renders correctly in the device's aspect ratio.
- Starting a game shows the Task 3 touch controls (move buttons, jump, dash, drag-to-aim).
- Audio plays after the first tap (WebAudio unlock via a user gesture — already triggered by `sfx.ensure()` in `pressKey`/`setFiring`/`triggerJump`/`triggerDash` from Task 2).
- A full wave plays through: move, jump, dash, aim-and-fire, level-up modal choice via tap, pause menu via the existing HUD pause button.

- [ ] **Step 5: Commit (if any generated files changed, e.g. `local.properties` should stay untracked)**

Confirm `android/local.properties` is git-ignored (Capacitor's default `android/.gitignore` already excludes it — verify with `git status` that it does not appear as untracked-to-be-added). No code changes to commit for this task; it's a verification-only milestone.

---

## Self-Review

**Spec coverage:**
- Corrected control scheme (buttons + drag-to-aim, preserving free-angle aim/fire) → Tasks 2–3.
- One combined plan (not split) → this single document covers input, UI, and packaging.
- Debug APK for sideloading, no store/signing work → Tasks 5–6 stop at `assembleDebug`, no signing config added.
- Desktop behavior must stay identical → explicit manual re-verification step in Task 2, and touch controls are gated by `isTouchCapable` so desktop never renders them.
- Android SDK not installed in this environment → explicitly gated and explained in Task 6 Step 1, mirroring how the user must separately install any native toolchain the agent can't install for them.

**Placeholder scan:** No TBD/TODO markers; every code step has literal file content; native-build steps that can't be unit-tested carry concrete manual verification checklists instead of vague "test it" instructions.

**Type consistency:** `Engine` public methods (`pressKey`, `releaseKey`, `setAimFromClient`, `setFiring`, `triggerJump`, `triggerDash`) are named identically in Task 2 (definition) and Task 3 (`App.tsx` usage). `canvasPointFromClient`/`isTouchCapable` signatures match between Task 1 (definition + tests) and Task 2/3 (call sites).
