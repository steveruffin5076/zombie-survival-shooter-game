import { useCallback, useEffect, useRef, useState } from "react";
import { Engine } from "./game/engine";
import type {
  EngineEvent, GameStats, HudState, InventorySnapshot, ProfileSnapshot, UpgradeChoice,
} from "./game/types";
import type { Deployable, DeployableKind } from "./game/arena";
import type { ConsumableKey } from "./game/items";
import type { AttachmentId } from "./game/attachments";
import Hud from "./components/Hud";
import { Menu, LevelUpModal, PauseMenu, GameOver, StageClear } from "./components/Overlays";
import InventoryOverlay from "./components/InventoryOverlay";
import SafeHouseOverlay from "./components/SafeHouseOverlay";
import RepairPanel from "./components/RepairPanel";
import TouchControls from "./components/TouchControls";
import LoadoutProfile from "./components/LoadoutProfile";
import Tutorial from "./components/Tutorial";
import Settings from "./components/Settings";
import { isTouchCapable } from "./game/input";
import { loadSettings, saveSettings } from "./game/settings";

/** the canvas's own coordinate space — the UI layer is authored at this size
 * and scaled to the box, so HUD and canvas art stay in proportion everywhere */
const UI_W = 1280;
const UI_H = 720;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [uiScale, setUiScale] = useState(1);

  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [showLoadout, setShowLoadout] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [brightness, setBrightness] = useState(() => loadSettings().brightness);
  const [volume, setVolumeState] = useState(() => loadSettings().volume);
  const [hud, setHud] = useState<HudState | null>(null);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [choices, setChoices] = useState<UpgradeChoice[] | null>(null);
  const [over, setOver] = useState<GameStats | null>(null);
  const [paused, setPaused] = useState(false);
  const [touch] = useState(() =>
    isTouchCapable(navigator.maxTouchPoints, window.matchMedia("(pointer: coarse)").matches)
  );
  // Measured rather than computed in CSS: scale() needs a unitless number, and
  // CSS can't divide a length down to one (calc(100vw / 1280) is still a length).
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setUiScale(entry.contentRect.width / UI_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [stageClear, setStageClear] = useState<{ stage: number; next: number; stageName: string; wavesPerStage: number } | null>(null);
  const [stageLoadout, setStageLoadout] = useState(false);
  const [safeHouse, setSafeHouse] = useState(false);
  const [inv, setInv] = useState<InventorySnapshot | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [deployables, setDeployables] = useState<Deployable[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, (e: EngineEvent) => {
      switch (e.type) {
        case "levelup":
          setChoices(e.choices);
          break;
        case "resume":
          setChoices(null);
          break;
        case "gameover":
          setOver(e.stats);
          setChoices(null);
          setStageClear(null);
          setSafeHouse(false);
          setPaused(false);
          break;
        case "stageclear":
          setStageClear({ stage: e.stage, next: e.next, stageName: e.stageName, wavesPerStage: e.wavesPerStage });
          setStageLoadout(false);
          setSafeHouse(false);
          break;
        case "pause":
          setPaused(e.value);
          break;
      }
    });
    engineRef.current = engine;
    engine.begin();
    // ?debug=1 exposes the engine on window for the same debug tooling that
    // draws the ?debug=1 HUD overlay (see engine.ts render()) — lets manual
    // QA fast-forward wave/stage state instead of grinding real playtime.
    if (new URLSearchParams(window.location.search).get("debug") === "1") {
      (window as unknown as { __engine?: Engine }).__engine = engine;
    }

    const iv = window.setInterval(() => {
      const eng = engineRef.current;
      if (!eng) return;
      const h = eng.getHud();
      setHud(h);
      setProfile(eng.getProfile());
      // bulk backpack/deposit state is polled on the same tick but gated on
      // invVer so it doesn't force a re-render of grid UI every 66ms for no reason
      const snap = eng.getInventory();
      setInv((prev) => (prev && prev.invVer === snap.invVer ? prev : snap));
      // the arena's deployable list is small (<=12) — cheap to just re-poll while it's relevant
      if (h.arena) setDeployables(eng.getDeployables());
    }, 66);

    return () => {
      window.clearInterval(iv);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    engineRef.current?.startGame();
    setScreen("game");
    setShowLoadout(false);
    setShowTutorial(false);
    setShowSettings(false);
    setOver(null);
    setChoices(null);
    setStageClear(null);
    setStageLoadout(false);
    setSafeHouse(false);
    setShowInventory(false);
    setPaused(false);
  }, []);

  const openLoadout = useCallback(() => setShowLoadout(true), []);
  const closeLoadout = useCallback(() => setShowLoadout(false), []);
  const openTutorial = useCallback(() => setShowTutorial(true), []);
  const closeTutorial = useCallback(() => setShowTutorial(false), []);
  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  const changeBrightness = useCallback((v: number) => {
    setBrightness(v);
    saveSettings({ ...loadSettings(), brightness: v });
  }, []);
  const changeVolume = useCallback((v: number) => {
    setVolumeState(v);
    engineRef.current?.setVolume(v);
  }, []);
  const selectLoadout = useCallback((weaponId: string) => {
    engineRef.current?.setLoadout(weaponId);
    setProfile(engineRef.current?.getProfile() ?? null);
  }, []);
  const equipAttachment = useCallback((weaponId: string, attachmentId: AttachmentId | null) => {
    engineRef.current?.equipAttachment(weaponId, attachmentId);
    setProfile(engineRef.current?.getProfile() ?? null);
  }, []);

  const quit = useCallback(() => {
    engineRef.current?.toMenu();
    setScreen("menu");
    setShowLoadout(false);
    setShowTutorial(false);
    setShowSettings(false);
    setOver(null);
    setChoices(null);
    setStageClear(null);
    setStageLoadout(false);
    setSafeHouse(false);
    setShowInventory(false);
    setPaused(false);
  }, []);

  // StageClear's "CONTINUE" opens the loadout screen first — a level gained
  // mid-stage can actually be spent on a new weapon before the next stage —
  // then the safe house's resupply/backpack screen; SafeHouseOverlay's own
  // continue button is what actually calls advanceStage().
  const openStageLoadout = useCallback(() => setStageLoadout(true), []);
  const confirmStageLoadout = useCallback(() => {
    setStageLoadout(false);
    setSafeHouse(true);
  }, []);
  const confirmSafeHouse = useCallback(() => {
    engineRef.current?.advanceStage();
    setSafeHouse(false);
    setStageClear(null);
  }, []);
  const depositAll = useCallback(() => engineRef.current?.depositAll(), []);
  const moveBackpackItem = useCallback(
    (id: string, x: number, y: number) => engineRef.current?.moveBackpackItem(id, x, y) ?? false,
    []
  );

  const switchWeapon = useCallback(
    (cls: string) => engineRef.current?.selectClass(cls as never),
    []
  );
  const selectTool = useCallback(
    (kind: DeployableKind) => engineRef.current?.selectDeployable(kind),
    []
  );
  const repairDeployable = useCallback(
    (id: string) => engineRef.current?.repairDeployable(id),
    []
  );
  const toggleFireMode = useCallback(() => engineRef.current?.toggleFireMode(), []);
  const useItem = useCallback((key: ConsumableKey) => engineRef.current?.useConsumable(key), []);
  const choose = useCallback((id: string) => engineRef.current?.applyUpgrade(id), []);
  const resume = useCallback(() => engineRef.current?.setPaused(false), []);
  const togglePause = useCallback(() => engineRef.current?.togglePause(), []);
  const toggleMute = useCallback(() => engineRef.current?.toggleMute(), []);

  const move = useCallback((x: number, y: number) => {
    engineRef.current?.setMoveVector(x, y);
  }, []);
  const aim = useCallback((x: number, y: number) => {
    engineRef.current?.setAimVector(x, y);
  }, []);
  const triggerDash = useCallback(() => engineRef.current?.triggerDash(), []);
  const tap = useCallback((x: number, y: number) => engineRef.current?.triggerTap(x, y), []);
  const fireStart = useCallback(() => engineRef.current?.setFiring(true), []);
  const fireEnd = useCallback(() => engineRef.current?.setFiring(false), []);
  const interactStart = useCallback(() => {
    engineRef.current?.pressKey("KeyE");
    engineRef.current?.toggleBossForceTarget();
  }, []);
  const interactEnd = useCallback(() => engineRef.current?.releaseKey("KeyE"), []);

  // keyboard shortcuts for upgrade choices
  useEffect(() => {
    if (!choices) return;
    const handler = (ev: KeyboardEvent) => {
      const i = ["1", "2", "3"].indexOf(ev.key);
      if (i >= 0 && choices[i]) choose(choices[i].id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [choices, choose]);

  // I toggles the non-blocking backpack viewer during normal play
  useEffect(() => {
    if (screen !== "game") return;
    const handler = (ev: KeyboardEvent) => {
      if (ev.code === "KeyI") setShowInventory((v) => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen]);

  return (
    <div className="viewport-fit fixed left-0 top-0 grid place-items-center overflow-hidden bg-black select-none">
      <div ref={boxRef} className="game-box relative">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-none"
          style={{ filter: `brightness(${brightness})` }}
        />

        {/* film treatment */}
        <div className="vignette pointer-events-none absolute inset-0 z-10" />
        <div className="grain pointer-events-none absolute inset-0 z-10" />
        <div className="scanlines pointer-events-none absolute inset-0 z-10 opacity-60" />

        {/* Scaled UI layer. The canvas renders at a fixed 1280x720 stretched to
         * the box, so its art shrinks with the box; this layer is authored at
         * that same size and scaled by the same factor, so the HUD stays in
         * proportion instead of keeping desktop pixel sizes over a phone-sized
         * game view. pointer-events-none so the canvas still gets mouse aim —
         * every interactive child opts back in with pointer-events-auto. */}
        <div
          className="pointer-events-none absolute left-0 top-0 z-20 origin-top-left"
          style={{ width: UI_W, height: UI_H, transform: `scale(${uiScale})` }}
        >
        {screen === "game" && hud && inv && (
          <Hud
            hud={hud}
            inv={inv}
            onMute={toggleMute}
            onPause={togglePause}
            onSwitch={switchWeapon}
            onFireMode={toggleFireMode}
            onSelectTool={selectTool}
            onUseItem={useItem}
            touch={touch}
          />
        )}
        {screen === "game" && hud && hud.repairWindowT > 0 && (
          <RepairPanel
            deployables={deployables}
            scrap={hud.scrap}
            windowT={hud.repairWindowT}
            windowMax={hud.repairWindowMax}
            onRepair={repairDeployable}
          />
        )}
        {screen === "game" && touch && !paused && !choices && !over && !stageClear && !showInventory && (
          <TouchControls
            onMove={move}
            onAim={aim}
            onDash={triggerDash}
            onTap={tap}
            onFireStart={fireStart}
            onFireEnd={fireEnd}
            showInteract={!!hud?.crateNear}
            onInteractStart={interactStart}
            onInteractEnd={interactEnd}
            dashReady={(hud?.dashT ?? 0) <= 0}
            autoFire={!!hud?.autoFire}
            onToggleFireMode={toggleFireMode}
          />
        )}

        {screen === "menu" && !showLoadout && !showTutorial && !showSettings && (
          <Menu
            onEndless={openLoadout}
            onTutorial={openTutorial}
            onSettings={openSettings}
            high={hud?.high ?? 0}
            muted={hud?.muted ?? false}
            onMute={toggleMute}
            touch={touch}
          />
        )}

        {showSettings && (screen === "menu" || (screen === "game" && paused)) && (
          <Settings
            volume={volume}
            brightness={brightness}
            onVolumeChange={changeVolume}
            onBrightnessChange={changeBrightness}
            onClose={closeSettings}
          />
        )}

        {screen === "menu" && showTutorial && <Tutorial onClose={closeTutorial} />}

        {showLoadout && profile && (
          <LoadoutProfile
            profile={profile}
            onClose={closeLoadout}
            onStart={start}
            onSelectLoadout={selectLoadout}
            onEquipAttachment={equipAttachment}
          />
        )}

        {choices && <LevelUpModal choices={choices} level={hud?.level ?? 1} onPick={choose} />}

        {stageClear && !stageLoadout && !safeHouse && !choices && !over && (
          <StageClear
            stage={stageClear.stage}
            next={stageClear.next}
            stageName={stageClear.stageName}
            wavesPerStage={stageClear.wavesPerStage}
            onContinue={openStageLoadout}
          />
        )}

        {stageClear && stageLoadout && !safeHouse && !choices && !over && profile && (
          <LoadoutProfile
            profile={profile}
            onClose={confirmStageLoadout}
            onStart={confirmStageLoadout}
            onSelectLoadout={selectLoadout}
            onEquipAttachment={equipAttachment}
            ctaLabel="CONTINUE"
          />
        )}

        {stageClear && safeHouse && !choices && !over && inv && (
          <SafeHouseOverlay
            next={stageClear.next}
            inv={inv}
            onMove={moveBackpackItem}
            onDepositAll={depositAll}
            onContinue={confirmSafeHouse}
          />
        )}

        {showInventory && screen === "game" && inv && !choices && !stageClear && !paused && !over && (
          <InventoryOverlay inv={inv} onMove={moveBackpackItem} onClose={() => setShowInventory(false)} />
        )}

        {paused && screen === "game" && !over && !choices && !showSettings && (
          <PauseMenu
            onResume={resume}
            onRestart={start}
            onQuit={quit}
            muted={hud?.muted ?? false}
            onMute={toggleMute}
            onSettings={openSettings}
          />
        )}

        {over && <GameOver stats={over} onRestart={start} onQuit={quit} />}
        </div>
      </div>
    </div>
  );
}
