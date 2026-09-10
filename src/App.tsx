import { useCallback, useEffect, useRef, useState } from "react";
import { Engine } from "./game/engine";
import type {
  EngineEvent, GameStats, HudState, InventorySnapshot, ProfileSnapshot, UpgradeChoice,
} from "./game/types";
import type { Deployable, DeployableKind } from "./game/arena";
import type { ConsumableKey } from "./game/items";
import Hud from "./components/Hud";
import { Menu, LevelUpModal, PauseMenu, GameOver, StageClear } from "./components/Overlays";
import InventoryOverlay from "./components/InventoryOverlay";
import SafeHouseOverlay from "./components/SafeHouseOverlay";
import RepairPanel from "./components/RepairPanel";
import TouchControls from "./components/TouchControls";
import LoadoutProfile from "./components/LoadoutProfile";
import { isTouchCapable } from "./game/input";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);

  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [showLoadout, setShowLoadout] = useState(false);
  const [hud, setHud] = useState<HudState | null>(null);
  const [profile, setProfile] = useState<ProfileSnapshot | null>(null);
  const [choices, setChoices] = useState<UpgradeChoice[] | null>(null);
  const [over, setOver] = useState<GameStats | null>(null);
  const [paused, setPaused] = useState(false);
  const [touch] = useState(() =>
    isTouchCapable(navigator.maxTouchPoints, window.matchMedia("(pointer: coarse)").matches)
  );
  const [stageClear, setStageClear] = useState<{ stage: number; next: number; wavesPerStage: number } | null>(null);
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
          setStageClear({ stage: e.stage, next: e.next, wavesPerStage: e.wavesPerStage });
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
    setOver(null);
    setChoices(null);
    setStageClear(null);
    setSafeHouse(false);
    setShowInventory(false);
    setPaused(false);
  }, []);

  const openLoadout = useCallback(() => setShowLoadout(true), []);
  const closeLoadout = useCallback(() => setShowLoadout(false), []);
  const selectLoadout = useCallback((weaponId: string) => {
    engineRef.current?.setLoadout(weaponId);
    setProfile(engineRef.current?.getProfile() ?? null);
  }, []);

  const quit = useCallback(() => {
    engineRef.current?.toMenu();
    setScreen("menu");
    setShowLoadout(false);
    setOver(null);
    setChoices(null);
    setStageClear(null);
    setSafeHouse(false);
    setShowInventory(false);
    setPaused(false);
  }, []);

  // StageClear's "CONTINUE" opens the safe house's resupply/backpack screen
  // instead of advancing immediately; SafeHouseOverlay's own continue button
  // is what actually calls advanceStage().
  const openSafeHouse = useCallback(() => setSafeHouse(true), []);
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

  const moveStart = useCallback((dir: -1 | 1) => {
    engineRef.current?.pressKey(dir === -1 ? "KeyA" : "KeyD");
  }, []);
  const moveEnd = useCallback(() => {
    engineRef.current?.releaseKey("KeyA");
    engineRef.current?.releaseKey("KeyD");
  }, []);
  const triggerJump = useCallback(() => engineRef.current?.triggerJump(), []);
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
    <div className="fixed inset-0 grid place-items-center overflow-hidden bg-black select-none">
      <div className="relative" style={{ width: "min(100vw, 177.78vh)", aspectRatio: "16 / 9" }}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-none" />

        {/* film treatment */}
        <div className="vignette pointer-events-none absolute inset-0 z-10" />
        <div className="grain pointer-events-none absolute inset-0 z-10" />
        <div className="scanlines pointer-events-none absolute inset-0 z-10 opacity-60" />

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
            onMoveStart={moveStart}
            onMoveEnd={moveEnd}
            onJump={triggerJump}
            onDash={triggerDash}
            onTap={tap}
            onFireStart={fireStart}
            onFireEnd={fireEnd}
            showInteract={!!hud?.crateNear}
            onInteractStart={interactStart}
            onInteractEnd={interactEnd}
          />
        )}

        {screen === "menu" && !showLoadout && (
          <Menu
            onEndless={openLoadout}
            high={hud?.high ?? 0}
            muted={hud?.muted ?? false}
            onMute={toggleMute}
          />
        )}

        {showLoadout && profile && (
          <LoadoutProfile
            profile={profile}
            onClose={closeLoadout}
            onStart={start}
            onSelectLoadout={selectLoadout}
          />
        )}

        {choices && <LevelUpModal choices={choices} level={hud?.level ?? 1} onPick={choose} />}

        {stageClear && !safeHouse && !choices && !over && (
          <StageClear
            stage={stageClear.stage}
            next={stageClear.next}
            wavesPerStage={stageClear.wavesPerStage}
            onContinue={openSafeHouse}
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

        {paused && screen === "game" && !over && !choices && (
          <PauseMenu
            onResume={resume}
            onRestart={start}
            onQuit={quit}
            muted={hud?.muted ?? false}
            onMute={toggleMute}
          />
        )}

        {over && <GameOver stats={over} onRestart={start} onQuit={quit} />}
      </div>
    </div>
  );
}
