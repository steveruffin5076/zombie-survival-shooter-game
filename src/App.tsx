import { useCallback, useEffect, useRef, useState } from "react";
import { Engine } from "./game/engine";
import type { EngineEvent, GameStats, HudState, UpgradeChoice } from "./game/types";
import Hud from "./components/Hud";
import { Menu, LevelUpModal, PauseMenu, GameOver } from "./components/Overlays";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);

  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [hud, setHud] = useState<HudState | null>(null);
  const [choices, setChoices] = useState<UpgradeChoice[] | null>(null);
  const [over, setOver] = useState<GameStats | null>(null);
  const [paused, setPaused] = useState(false);

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
          setPaused(false);
          break;
        case "pause":
          setPaused(e.value);
          break;
      }
    });
    engineRef.current = engine;
    engine.begin();

    const iv = window.setInterval(() => {
      const eng = engineRef.current;
      if (eng) setHud(eng.getHud());
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
    setOver(null);
    setChoices(null);
    setPaused(false);
  }, []);

  const quit = useCallback(() => {
    engineRef.current?.toMenu();
    setScreen("menu");
    setOver(null);
    setChoices(null);
    setPaused(false);
  }, []);

  const choose = useCallback((id: string) => engineRef.current?.applyUpgrade(id), []);
  const resume = useCallback(() => engineRef.current?.setPaused(false), []);
  const togglePause = useCallback(() => engineRef.current?.togglePause(), []);
  const toggleMute = useCallback(() => engineRef.current?.toggleMute(), []);

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

  return (
    <div className="fixed inset-0 grid place-items-center overflow-hidden bg-black select-none">
      <div className="relative" style={{ width: "min(100vw, 177.78vh)", aspectRatio: "16 / 9" }}>
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-none" />

        {/* film treatment */}
        <div className="vignette pointer-events-none absolute inset-0 z-10" />
        <div className="grain pointer-events-none absolute inset-0 z-10" />
        <div className="scanlines pointer-events-none absolute inset-0 z-10 opacity-60" />

        {screen === "game" && hud && <Hud hud={hud} onMute={toggleMute} onPause={togglePause} />}

        {screen === "menu" && (
          <Menu onStart={start} high={hud?.high ?? 0} muted={hud?.muted ?? false} onMute={toggleMute} />
        )}

        {choices && <LevelUpModal choices={choices} level={hud?.level ?? 1} onPick={choose} />}

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
