import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Volume2, VolumeX, Shield, Zap, Flame, Award, Gamepad2, Settings, Crosshair, ArrowRight } from 'lucide-react';
import { sound, stageTrack } from '../game/audioEngine';
import { GameEngine, GameEngineState } from '../game/gameEngine';
import { InputManager, InputState } from '../game/inputManager';
import { rankFromXp, xpForRun } from '../game/ranks';
import { SECTORS } from '../game/sectors';
import { GameMode, INITIAL_SHIPS, ShipDef, UserSaveData } from '../game/types';
import { ShipLab } from './ShipLab';

function RankTrack({ xp }: { xp: number }) {
  const standing = rankFromXp(xp);
  return (
    <div className="mt-1">
      <div className="flex items-center justify-between gap-2 text-[9px] font-mono-tech text-slate-400">
        <span>RK {standing.rank} {standing.title}</span>
        <span className="tabular-nums">{standing.nextXp == null ? 'MAX' : `${standing.xp} / ${standing.nextXp}`}</span>
      </div>
      <div className="mt-0.5 h-1.5 bg-slate-800 rounded overflow-hidden">
        <div className="h-full bg-sky-400" style={{ width: `${Math.round(standing.progress * 100)}%` }} />
      </div>
      {standing.nextTitle && (
        <div className="text-[8px] font-mono-tech text-slate-500">NEXT {standing.nextTitle}</div>
      )}
    </div>
  );
}

function ClearedSectors({ stage, victory }: { stage: number; victory: boolean }) {
  const names = (victory ? SECTORS : SECTORS.slice(0, Math.max(0, stage - 1))).map((sector) => sector.name);
  return (
    <div className="flex justify-between gap-3 text-slate-300">
      <span className="shrink-0">Sectors cleared:</span>
      <span className="text-right text-emerald-300">{names.length ? names.join(' · ') : 'None yet'}</span>
    </div>
  );
}

function AudioMenu({
  saveData,
  onSaveUpdate,
  musicPaused,
  onToggleMusic
}: {
  saveData: UserSaveData;
  onSaveUpdate: (updated: UserSaveData) => void;
  musicPaused: boolean;
  onToggleMusic: () => void;
}) {
  const bgm = Math.round(saveData.settings.bgmVolume * 100);
  const sfx = Math.round(saveData.settings.sfxVolume * 100);
  const muted = saveData.settings.muted;

  const writeSettings = (patch: Partial<UserSaveData['settings']>) => {
    onSaveUpdate({
      ...saveData,
      settings: { ...saveData.settings, ...patch }
    });
  };

  return (
    <div className="w-full max-w-xl flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-lg">
      <label className="flex items-center gap-2 flex-1 min-w-[150px] text-[10px] font-mono-tech text-slate-400">
        <span className="w-10">MUSIC</span>
        <input
          type="range"
          min={0}
          max={100}
          value={bgm}
          aria-label="Music volume"
          className="flex-1 accent-sky-400"
          onChange={(event) => {
            const bgmVolume = Number(event.target.value) / 100;
            sound.setVolumes(bgmVolume, saveData.settings.sfxVolume);
            writeSettings({ bgmVolume });
          }}
        />
        <span className="w-7 text-right tabular-nums text-slate-300">{bgm}</span>
      </label>
      <label className="flex items-center gap-2 flex-1 min-w-[140px] text-[10px] font-mono-tech text-slate-400">
        <span className="w-7">SFX</span>
        <input
          type="range"
          min={0}
          max={100}
          value={sfx}
          aria-label="Sound effects volume"
          className="flex-1 accent-emerald-400"
          onChange={(event) => {
            const sfxVolume = Number(event.target.value) / 100;
            sound.setVolumes(saveData.settings.bgmVolume, sfxVolume);
            writeSettings({ sfxVolume });
          }}
        />
        <span className="w-7 text-right tabular-nums text-slate-300">{sfx}</span>
      </label>
      <button
        type="button"
        onClick={() => {
          const next = !muted;
          sound.setMuted(next);
          writeSettings({ muted: next });
          if (!next) sound.playMenuBlip();
        }}
        aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        className={`px-2.5 py-1.5 rounded text-[10px] font-arcade border flex items-center gap-1.5 ${
          muted
            ? 'border-rose-500 text-rose-300 bg-rose-950/50'
            : 'border-slate-700 text-slate-300 bg-slate-950/60 hover:border-slate-500'
        }`}
      >
        {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        {muted ? 'Muted' : 'Mute'}
      </button>
      <button
        type="button"
        onClick={onToggleMusic}
        aria-label={musicPaused ? 'Play music' : 'Pause music'}
        className="px-2.5 py-1.5 rounded text-[10px] font-arcade border border-slate-700 text-slate-200 bg-slate-950/60 hover:border-slate-500 flex items-center gap-1.5"
      >
        {musicPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5" />}
        {musicPaused ? 'Play Music' : 'Pause Music'}
      </button>
    </div>
  );
}

interface ArcadeScreenProps {
  saveData: UserSaveData;
  onSaveUpdate: (updated: UserSaveData) => void;
  activeShip: ShipDef;
  onOpenShipLab: () => void;
  gameMode?: GameMode;
  dailyModifier?: { multiplier: number; id: string; name: string };
  /** Bumped by App when Header Play, Ship Lab Deploy, or Daily Deploy asks for an immediate run. */
  startRequest?: number;
}

/** Phone lobby: short side under 768, or a touch pointer on a screen whose long side is under 1100. */
function isCompactViewport(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const shortSide = Math.min(w, h);
  const longSide = Math.max(w, h);
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  return shortSide < 768 || (coarse && longSide < 1100);
}

let lastHandledStartRequest = 0;

export const ArcadeScreen: React.FC<ArcadeScreenProps> = ({
  saveData,
  onSaveUpdate,
  activeShip,
  onOpenShipLab,
  gameMode = 'standard',
  dailyModifier,
  startRequest = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<InputManager>(new InputManager());

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [crtFilter, setCrtFilter] = useState(saveData.settings.crtFilter);
  const [musicPaused, setMusicPaused] = useState(false);
  const [hudState, setHudState] = useState<GameEngineState | null>(null);
  const [gamepadName, setGamepadName] = useState<string | null>(null);
  const [pauseIndex, setPauseIndex] = useState(0);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const [narrowLayout, setNarrowLayout] = useState(false);
  const [compactLobby, setCompactLobby] = useState(() => isCompactViewport());
  const [showExtras, setShowExtras] = useState(false);
  const handledStartRef = useRef(0);
  const pauseIndexRef = useRef(0);
  const menuArmedRef = useRef(false);
  const sawPauseRef = useRef(false);
  const playingRef = useRef(false);
  const uiRef = useRef({ isPlaying: false, isPaused: false, gameOver: false, victory: false, docked: false });
  const saveRef = useRef(saveData);
  saveRef.current = saveData;
  const dockBankedRef = useRef(false);
  const resumeStageRef = useRef(1);
  const exitMusicRef = useRef(() => {});
  exitMusicRef.current = () => {
    sound.playBgm(stageTrack(resumeStageRef.current));
  };
  const liveRef = useRef({
    start: () => {},
    cycleShip: (_dir: number) => {},
    resume: () => {},
    activatePause: (_index: number) => {},
    restart: () => {},
    quit: () => {}
  });
  const [pilotCallsign, setPilotCallsign] = useState(saveData.pilotName || 'PILOT-1');
  const [hasSubmittedScore, setHasSubmittedScore] = useState(false);
  const [submitSuccessRank, setSubmitSuccessRank] = useState<number | null>(null);
  const [runReward, setRunReward] = useState<{ xp: number; rank: number; title: string; rankedUp: boolean } | null>(null);
  const settledRef = useRef(false);
  const standing = rankFromXp(saveData.pilotXp);

  // Virtual touch controls state
  const [touchStickPos, setTouchStickPos] = useState({ x: 0, y: 0 });
  const [stickOrigin, setStickOrigin] = useState({ x: 0, y: 0 });
  const [isStickActive, setIsStickActive] = useState(false);
  const stickPointer = useRef<number | null>(null);

  useEffect(() => {
    const input = inputRef.current;
    return () => {
      engineRef.current?.stop();
      input.destroy();
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) sound.playBgm('title');
  }, [isPlaying]);

  useEffect(() => {
    inputRef.current.vibrationEnabled = saveData.settings.vibration;
  }, [saveData.settings.vibration]);

  useEffect(() => {
    document.body.classList.toggle('play-lock', isPlaying);
    return () => document.body.classList.remove('play-lock');
  }, [isPlaying]);

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)');
    const narrow = window.matchMedia('(max-width: 900px)');
    const sync = () => {
      setCoarsePointer(coarse.matches);
      setNarrowLayout(narrow.matches);
      setCompactLobby(isCompactViewport());
    };
    sync();
    coarse.addEventListener('change', sync);
    narrow.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      coarse.removeEventListener('change', sync);
      narrow.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  useEffect(() => {
    const onFrame = (inp: InputState) => {
      const name = inputRef.current.activeGamepadName;
      setGamepadName((prev) => (prev === name ? prev : name));
      const ui = uiRef.current;
      const playing = playingRef.current || ui.isPlaying;

      if (!playing) {
        if (inp.confirm || inp.start) {
          queueMicrotask(() => {
            if (playingRef.current) return;
            liveRef.current.start();
          });
        } else if (inp.menuLeft !== inp.menuRight) {
          const dir = inp.menuRight ? 1 : -1;
          queueMicrotask(() => liveRef.current.cycleShip(dir));
        }
        return;
      }

      if (ui.docked) return;

      if (ui.isPaused) {
        if (!sawPauseRef.current) {
          sawPauseRef.current = true;
          menuArmedRef.current = false;
          pauseIndexRef.current = 0;
          setPauseIndex(0);
        }
        if (inp.cancel) {
          queueMicrotask(() => liveRef.current.resume());
          return;
        }
        if (!menuArmedRef.current) {
          if (inp.menuNeutral) menuArmedRef.current = true;
          else return;
        }
        if (inp.menuDown !== inp.menuUp) {
          const dir = inp.menuDown ? 1 : -1;
          const next = (pauseIndexRef.current + dir + 4) % 4;
          pauseIndexRef.current = next;
          setPauseIndex(next);
        }
        if (inp.confirm) {
          const index = pauseIndexRef.current;
          queueMicrotask(() => liveRef.current.activatePause(index));
        }
        return;
      }

      sawPauseRef.current = false;
      const typing = document.activeElement instanceof HTMLInputElement
        || document.activeElement instanceof HTMLTextAreaElement;
      if ((ui.gameOver || ui.victory) && !typing) {
        if (inp.confirm) queueMicrotask(() => liveRef.current.restart());
        else if (inp.cancel) queueMicrotask(() => liveRef.current.quit());
      }
    };

    inputRef.current.onFrame = onFrame;
    let raf = 0;
    const tick = () => {
      if (!engineRef.current) inputRef.current.poll();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (inputRef.current.onFrame === onFrame) inputRef.current.onFrame = null;
    };
  }, []);

  const startGame = () => {
    if (!canvasRef.current) return;
    playingRef.current = true;
    sound.init();
    sound.resume();

    const standing = rankFromXp(saveData.pilotXp);
    const engine = new GameEngine(
      canvasRef.current,
      inputRef.current,
      activeShip,
      saveData.mutations,
      gameMode,
      dailyModifier,
      standing.rank,
      saveData.selectedPodMode
    );

    dockBankedRef.current = false;
    engine.onStateUpdate = (state) => {
      if (state.docked && !dockBankedRef.current) {
        dockBankedRef.current = true;
        const pocket = state.biomatter;
        engineRef.current?.releaseBiomatter();
        const current = saveRef.current;
        onSaveUpdate({ ...current, credits: current.credits + pocket });
      }
      setHudState(state);
      setIsPaused(state.isPaused);
      if ((state.isGameOver || state.isVictory) && !settledRef.current) {
        settledRef.current = true;
        const current = saveRef.current;
        const gained = xpForRun(state.score, state.stage, state.isVictory, state.biomatterEarned);
        const nextXp = current.pilotXp + gained;
        const before = rankFromXp(current.pilotXp);
        const after = rankFromXp(nextXp);
        const bossesDown = state.isVictory ? state.stage : Math.max(0, state.stage - 1);
        setRunReward({
          xp: gained,
          rank: after.rank,
          title: after.title,
          rankedUp: after.rank > before.rank
        });
        onSaveUpdate({
          ...current,
          credits: current.credits + state.biomatter,
          highScore: Math.max(current.highScore, state.score),
          totalRuns: current.totalRuns + 1,
          totalBossesDefeated: current.totalBossesDefeated + bossesDown,
          pilotXp: nextXp,
          bestStage: Math.max(current.bestStage, state.stage)
        });
      }
    };

    engineRef.current = engine;
    settledRef.current = false;
    setRunReward(null);
    setMusicPaused(false);
    engine.start();
    setIsPlaying(true);
    setHasSubmittedScore(false);
    setSubmitSuccessRank(null);
  };

  const restartGame = () => {
    sound.playMenuBlip();
    if (engineRef.current) {
      engineRef.current.stop();
    }
    startGame();
  };

  const launchFromLab = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const stage = engine.continueFromLab(activeShip, saveData.mutations);
    resumeStageRef.current = stage;
    dockBankedRef.current = false;
  };

  const quitToTitle = () => {
    sound.playMenuBlip();
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }
    sound.playBgm('title');
    playingRef.current = false;
    setMusicPaused(false);
    setIsPlaying(false);
    setHudState(null);
  };

  const toggleMusic = () => {
    sound.resume();
    setMusicPaused(sound.toggleMusicPaused());
  };

  const persistCrt = (next: boolean) => {
    setCrtFilter(next);
    onSaveUpdate({
      ...saveData,
      settings: { ...saveData.settings, crtFilter: next }
    });
  };

  const togglePause = () => {
    sound.playMenuBlip();
    if (engineRef.current) {
      const next = !isPaused;
      engineRef.current.setPaused(next);
      setIsPaused(next);
      if (next) {
        pauseIndexRef.current = 0;
        setPauseIndex(0);
      }
    }
  };

  // Submit score to backend
  const handleSubmitScore = async () => {
    if (!hudState || hasSubmittedScore) return;
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pilotCallsign,
          score: hudState.score,
          shipId: activeShip.id,
          shipName: activeShip.name,
          stage: hudState.stage,
          mode: gameMode,
          dailyDate: gameMode === 'daily' ? new Date().toISOString().split('T')[0] : undefined,
          platform: gamepadName ? 'Arcade Gamepad' : (coarsePointer ? 'Mobile' : 'Keyboard')
        })
      });
      const data = await res.json();
      if (data.success) {
        sound.playUpgradeSuccess();
        setHasSubmittedScore(true);
        setSubmitSuccessRank(data.rank);
      }
    } catch (e) {
      console.warn('Failed to submit score:', e);
    }
  };

  const beginStick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || stickPointer.current !== null) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The stick still tracks while the finger stays in the left zone.
    }
    stickPointer.current = event.pointerId;
    const rect = containerRef.current?.getBoundingClientRect();
    setStickOrigin({
      x: rect ? event.clientX - rect.left : 0,
      y: rect ? event.clientY - rect.top : 0
    });
    inputRef.current.touchStick.active = true;
    inputRef.current.touchStick.startX = event.clientX;
    inputRef.current.touchStick.startY = event.clientY;
    inputRef.current.touchStick.vecX = 0;
    inputRef.current.touchStick.vecY = 0;
    setTouchStickPos({ x: 0, y: 0 });
    setIsStickActive(true);
  };

  const moveStick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== stickPointer.current) return;
    const dx = event.clientX - inputRef.current.touchStick.startX;
    const dy = event.clientY - inputRef.current.touchStick.startY;
    const maxRadius = 56;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    const nx = dist > 0 ? (dx / dist) * (clamped / maxRadius) : 0;
    const ny = dist > 0 ? (dy / dist) * (clamped / maxRadius) : 0;
    inputRef.current.touchStick.vecX = nx;
    inputRef.current.touchStick.vecY = ny;
    setTouchStickPos({
      x: dist > 0 ? (dx / dist) * clamped : 0,
      y: dist > 0 ? (dy / dist) * clamped : 0
    });
  };

  const endStick = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== stickPointer.current) return;
    stickPointer.current = null;
    inputRef.current.touchStick.active = false;
    inputRef.current.touchStick.vecX = 0;
    inputRef.current.touchStick.vecY = 0;
    setIsStickActive(false);
    setTouchStickPos({ x: 0, y: 0 });
  };

  const pressFire = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Fire still holds until pointerup on the button.
    }
    inputRef.current.touchShoot = true;
    inputRef.current.touchShootJustPressed = true;
  };

  const releaseFire = () => {
    inputRef.current.touchShoot = false;
  };

  const pressBomb = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    inputRef.current.touchSpecial = true;
    inputRef.current.touchSpecialJustPressed = true;
  };

  const pressPod = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    inputRef.current.touchTogglePod = true;
  };

  const updateAimFromPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const scaleX = 640 / rect.width;
    const scaleY = 360 / rect.height;
    const x = Math.max(0, Math.min(640, (clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(360, (clientY - rect.top) * scaleY));
    inputRef.current.setMousePos(x, y);
  };

  uiRef.current = {
    isPlaying,
    isPaused,
    gameOver: !!hudState?.isGameOver,
    victory: !!hudState?.isVictory,
    docked: !!hudState?.docked
  };
  liveRef.current.start = startGame;

  // External start (Header Play, Ship Lab Deploy, Daily Deploy). Each token starts at most one run.
  // The token is remembered at module scope so leaving the arena tab cannot replay the same request.
  useEffect(() => {
    if (!startRequest || lastHandledStartRequest === startRequest || handledStartRef.current === startRequest) return;
    if (playingRef.current) {
      lastHandledStartRequest = startRequest;
      handledStartRef.current = startRequest;
      return;
    }
    let raf = 0;
    const attempt = () => {
      if (playingRef.current) {
        lastHandledStartRequest = startRequest;
        handledStartRef.current = startRequest;
        return;
      }
      if (!canvasRef.current) {
        raf = requestAnimationFrame(attempt);
        return;
      }
      lastHandledStartRequest = startRequest;
      handledStartRef.current = startRequest;
      liveRef.current.start();
    };
    attempt();
    return () => cancelAnimationFrame(raf);
  }, [startRequest]);
  liveRef.current.restart = restartGame;
  liveRef.current.quit = quitToTitle;
  liveRef.current.resume = () => {
    engineRef.current?.setPaused(false);
    setIsPaused(false);
  };
  liveRef.current.activatePause = (index: number) => {
    if (index === 0) {
      engineRef.current?.setPaused(false);
      setIsPaused(false);
    } else if (index === 1) {
      restartGame();
    } else if (index === 2) {
      persistCrt(!crtFilter);
    } else {
      quitToTitle();
    }
  };
  liveRef.current.cycleShip = (dir: number) => {
    const ids = INITIAL_SHIPS.map((ship) => ship.id);
    const idx = Math.max(0, ids.indexOf(saveData.activeShipId));
    const next = ids[(idx + dir + ids.length) % ids.length];
    onSaveUpdate({ ...saveData, activeShipId: next });
    sound.playMenuBlip();
  };

  const showTouch = isPlaying && !gamepadName && (coarsePointer || narrowLayout);
  const touchBlocked = !!(hudState?.isGameOver || hudState?.isVictory || isPaused);
  const focusRing = (index: number) => (pauseIndex === index ? 'ring-2 ring-sky-300' : '');

  useEffect(() => {
    if (showTouch && !touchBlocked) return;
    inputRef.current.touchShoot = false;
    inputRef.current.touchStick.active = false;
    inputRef.current.touchStick.vecX = 0;
    inputRef.current.touchStick.vecY = 0;
    stickPointer.current = null;
  }, [showTouch, touchBlocked]);

  return (
    <div
      className={isPlaying
        ? 'play-stage fixed inset-0 z-[60] bg-black flex items-center justify-center select-none touch-none'
        : compactLobby
          ? 'relative w-full flex flex-col items-center justify-start p-2 select-none'
          : 'relative w-full flex flex-col items-center justify-center p-2 sm:p-4 select-none'}
      style={isPlaying ? {
        paddingTop: 'env(safe-area-inset-top)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)'
      } : undefined}
    >
      {!isPlaying && gamepadName && (
        <div className="mb-2 w-full max-w-5xl px-3 py-1.5 bg-sky-950/70 border border-sky-500/40 rounded text-sky-300 text-[10px] sm:text-xs flex items-center gap-2 font-mono-tech">
          <Gamepad2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span><strong className="text-white">{gamepadName}</strong> ready. Start launches. Left stick moves, right stick aims, A / RT fire, B / LT bomb, X / RB pod.</span>
        </div>
      )}

      {/* Main Arcade Frame Container */}
      <div
        ref={containerRef}
        className={isPlaying
          ? `play-frame relative bg-black overflow-hidden ${crtFilter ? 'crt-screen' : ''}`
          : compactLobby
            ? 'relative w-full max-w-xl'
            : `relative w-full max-w-5xl sm:aspect-[16/9] sm:bg-black sm:rounded-lg sm:overflow-hidden sm:border-2 sm:border-slate-800 sm:shadow-2xl sm:shadow-sky-950/20 ${crtFilter ? 'sm:crt-screen' : ''}`}
      >
        {/* Game Canvas with mouse-aim and cursor */}
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          onMouseDown={(e) => {
            updateAimFromPointer(e.clientX, e.clientY);
            if (coarsePointer) return;
            inputRef.current.touchShoot = true;
            inputRef.current.touchShootJustPressed = true;
          }}
          onMouseUp={() => {
            if (!coarsePointer) inputRef.current.touchShoot = false;
          }}
          onMouseLeave={() => {
            if (!coarsePointer) inputRef.current.touchShoot = false;
            inputRef.current.clearMousePos();
          }}
          onPointerMove={(e) => {
            if (e.pointerType === 'mouse' || !showTouch) updateAimFromPointer(e.clientX, e.clientY);
          }}
          className={`pixel-art block cursor-crosshair touch-none ${
            isPlaying ? 'w-full h-full' : compactLobby ? 'hidden' : 'hidden sm:block sm:absolute sm:inset-0 sm:w-full sm:h-full'
          }`}
        />

        {/* 16-Bit HUD Overlay (Active when playing) */}
        {isPlaying && hudState && (
          <div className="absolute top-0 left-0 right-0 p-2 sm:p-3 pointer-events-none flex flex-col gap-1 z-30 font-arcade text-[10px] sm:text-xs">
            {/* Top Stat Row */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-slate-100 bg-slate-950/70 backdrop-blur-sm px-2 sm:px-3 py-1.5 rounded border border-slate-800/80">
              {/* 1P Score & Combo */}
              <div className="flex items-center gap-3">
                <span className="text-emerald-400">S{hudState.stage}</span>
                <span className="hidden md:inline text-emerald-200/80">{hudState.sectorName}</span>
                <span className="text-sky-400">1P:</span>
                <span className="font-mono-tech tabular-nums font-bold text-yellow-300 text-xs sm:text-sm">
                  {String(hudState.score).padStart(6, '0')}
                </span>
                {hudState.combo > 1.0 && (
                  <span className="flex items-center gap-1.5 text-amber-400 text-[10px]">
                    <span className="animate-pulse">{hudState.combo.toFixed(1)}x COMBO</span>
                    <span className="w-8 h-1 bg-slate-800 rounded overflow-hidden">
                      <span
                        className="block h-full bg-amber-300"
                        style={{ width: `${Math.max(0, Math.min(100, (hudState.comboTimer / 2.5) * 100))}%` }}
                      />
                    </span>
                  </span>
                )}
              </div>

              {/* Bio-Hull & Lives */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-rose-400">HULL:</span>
                  <div className="w-16 sm:w-24 h-2.5 bg-slate-800 rounded overflow-hidden border border-slate-700">
                    <div 
                      className={`h-full transition-all duration-150 ${
                        hudState.health > 50 ? 'bg-emerald-500' : hudState.health > 25 ? 'bg-amber-500' : 'bg-rose-500 animate-pulse'
                      }`}
                      style={{ width: `${Math.max(0, (hudState.health / hudState.maxHealth) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-sky-300">LIVES:</span>
                  <span className="text-white font-mono-tech text-xs">{hudState.lives}</span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-amber-400">BOMBS:</span>
                  <span className="text-amber-200 font-mono-tech text-xs">{hudState.bombs}</span>
                </div>
              </div>

              {/* Pod Mode & Charge */}
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-1 text-[10px] text-purple-300">
                  <span>POD:</span>
                  <span className="uppercase text-purple-200">{hudState.podMode}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] ${hudState.charge >= 85 ? 'text-sky-200' : 'text-purple-400'}`}>
                    {hudState.charge >= 85 ? 'READY' : 'CHARGE:'}
                  </span>
                  <div className={`w-12 sm:w-16 h-2 bg-slate-900 rounded overflow-hidden border ${hudState.charge >= 85 ? 'border-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.85)]' : 'border-purple-500/50'}`}>
                    <div
                      className={`h-full ${hudState.charge >= 85 ? 'bg-sky-300 animate-pulse' : 'bg-gradient-to-r from-purple-500 to-sky-400'}`}
                      style={{ width: `${hudState.charge}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {dailyModifier && (
              <div className="self-start px-2 py-0.5 text-[10px] text-amber-200 bg-amber-950/70 border border-amber-500/40 rounded">
                {dailyModifier.name}
              </div>
            )}

            {/* Boss Health Bar if Boss Active */}
            {hudState.isBossActive && (
              <div className="w-full max-w-md mx-auto mt-1 px-3 py-1 bg-red-950/80 border border-red-500/60 rounded flex flex-col items-center">
                <div className="text-[10px] text-red-300 font-bold tracking-widest flex items-center gap-2">
                  <Flame className="w-3 h-3 text-red-500 animate-pulse" />
                  <span>{hudState.bossName}</span>
                  {hudState.bossPhase > 1 && (
                    <span className="text-amber-300">PHASE {hudState.bossPhase}</span>
                  )}
                </div>
                <div className="w-full h-2.5 bg-slate-950 rounded border border-red-800 overflow-hidden mt-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-red-600 to-yellow-500 transition-all duration-100"
                    style={{ width: `${Math.max(0, (hudState.bossHp / hudState.bossMaxHp) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {isPlaying && hudState?.stageBanner && !hudState.isGameOver && !hudState.isVictory && (
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none px-4">
            <div className={`max-w-full px-5 py-3 bg-black/75 border rounded text-center ${hudState.bannerTone === 'alert' ? 'border-rose-400/80' : 'border-emerald-400/70'}`}>
              <div className={`font-arcade text-xs sm:text-sm tracking-widest ${hudState.bannerTone === 'alert' ? 'text-rose-200' : 'text-emerald-300'}`}>{hudState.stageBanner}</div>
            </div>
          </div>
        )}

        {/* Compact phone lobby: ship picker + one big Start, extras tucked away */}
        {!isPlaying && compactLobby && (
          <div className="relative z-30 w-full flex flex-col items-stretch gap-3 p-1">
            {dailyModifier && (
              <div className="px-3 py-2 text-center font-arcade text-[10px] text-amber-200 bg-amber-950/70 border border-amber-500/40 rounded">
                DAILY: {dailyModifier.name}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {INITIAL_SHIPS.map((ship) => {
                const isSelected = activeShip.id === ship.id;
                return (
                  <button
                    key={ship.id}
                    type="button"
                    onClick={() => {
                      onSaveUpdate({ ...saveData, activeShipId: ship.id });
                      sound.playPickup();
                    }}
                    aria-pressed={isSelected}
                    className={`min-h-14 min-w-0 px-2 py-2 rounded border-2 font-arcade text-[10px] font-bold flex items-center justify-center gap-2 transition-all ${
                      isSelected
                        ? 'bg-sky-500 border-sky-200 text-slate-950 shadow-md shadow-sky-500/30'
                        : 'bg-slate-950/80 border-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ship.color }} />
                    <span className="truncate">{ship.name.split('-')[0]}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={startGame}
              className="w-full min-h-16 justify-center px-6 py-4 bg-gradient-to-r from-sky-400 to-sky-500 text-slate-950 font-arcade text-sm font-bold uppercase tracking-wider rounded shadow-lg shadow-sky-500/30 flex items-center gap-2 transition-all active:scale-95"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Insert Coin / Play</span>
            </button>

            <button
              type="button"
              onClick={() => setShowExtras((v) => !v)}
              aria-expanded={showExtras}
              className="self-end min-h-11 px-3 rounded border border-slate-700 bg-slate-900/90 text-[10px] font-arcade text-slate-300 flex items-center gap-1.5"
            >
              <Settings className="w-4 h-4" />
              {showExtras ? 'Hide' : 'Sound / CRT'}
            </button>

            {showExtras && (
              <div className="flex flex-col gap-2">
                <AudioMenu
                  saveData={saveData}
                  onSaveUpdate={onSaveUpdate}
                  musicPaused={musicPaused}
                  onToggleMusic={toggleMusic}
                />
                <button
                  type="button"
                  onClick={() => persistCrt(!crtFilter)}
                  className={`min-h-11 px-3 rounded text-xs font-mono-tech border ${
                    crtFilter ? 'bg-sky-950/60 border-sky-500 text-sky-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  CRT Scanlines: {crtFilter ? 'ON' : 'OFF'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Title Screen View (Before Game Starts) */}
        {!isPlaying && !compactLobby && (
          <div className="relative z-30 flex flex-col items-center gap-3 p-3 sm:absolute sm:inset-0 sm:justify-between sm:overflow-y-auto sm:p-6 sm:bg-[#070b12]">
            {/* Title Pixel Art Hero Banner */}
            <div className="relative w-full max-w-xl aspect-[16/9] rounded-md overflow-hidden border border-slate-700/80 shadow-lg">
              <img 
                src="/src/assets/images/crucible_title_hero_1791943891412.jpg"
                alt="Bio-Hazard Crucible presented by Ultrademic Studios"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover object-top pixel-art"
              />
            </div>

            {/* 4-Ship Quick Switcher */}
            <div className="w-full max-w-xl grid grid-cols-4 gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800 rounded-lg">
              {INITIAL_SHIPS.map((ship) => {
                const isSelected = activeShip.id === ship.id;
                return (
                  <button
                    key={ship.id}
                    onClick={() => {
                      onSaveUpdate({ ...saveData, activeShipId: ship.id });
                      sound.playPickup();
                    }}
                    className={`min-w-0 py-2 px-1 rounded font-arcade text-[8px] sm:text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/30'
                        : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: ship.color }} 
                    />
                    <span className="truncate">{ship.name.split('-')[0]}</span>
                  </button>
                );
              })}
            </div>

            <AudioMenu
              saveData={saveData}
              onSaveUpdate={onSaveUpdate}
              musicPaused={musicPaused}
              onToggleMusic={toggleMusic}
            />

            {/* Action Buttons & Customization link */}
            <div className="w-full max-w-xl flex flex-col sm:flex-row items-center justify-between gap-4 mt-1">
              <div 
                onClick={onOpenShipLab}
                className="cursor-pointer flex items-center gap-2.5 p-2 bg-slate-900/90 border border-slate-800 rounded hover:border-sky-500 transition-colors"
              >
                <div 
                  className="w-7 h-7 rounded flex items-center justify-center font-arcade text-xs font-bold"
                  style={{ backgroundColor: `${activeShip.color}25`, color: activeShip.color }}
                >
                  {activeShip.name.charAt(0)}
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-200 font-arcade">{activeShip.name} ({activeShip.alias})</div>
                  <div className="text-[10px] text-sky-400 font-mono-tech">{activeShip.specialWeapon} · Open Bio-Lab</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => persistCrt(!crtFilter)}
                  className={`px-3 py-2 rounded text-xs font-mono-tech border transition-colors ${
                    crtFilter ? 'bg-sky-950/60 border-sky-500 text-sky-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  CRT Scanlines: {crtFilter ? 'ON' : 'OFF'}
                </button>

                <button
                  onClick={startGame}
                  className="w-full sm:w-auto justify-center px-6 py-3 sm:py-2.5 bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-slate-950 font-arcade text-xs sm:text-sm font-bold uppercase tracking-wider rounded shadow-lg shadow-sky-500/30 flex items-center gap-2 transition-all active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Insert Coin / Play</span>
                </button>
              </div>
            </div>

            {/* Quick Controls Cheat Sheet */}
            <div className="text-center text-[10px] leading-relaxed text-slate-500 font-mono-tech max-w-xl">
              Arrows or WASD, Space/Z fire, X bomb, C pod. Hold fire to charge, then release at full for a bio-blast. Gamepad: left stick and D-pad move, right stick aims, A/RT fire, B/LT bomb, X/RB pod, Start pauses. On a phone, hold the left side to move.
            </div>
          </div>
        )}

        {/* Pause Overlay */}
        {isPlaying && isPaused && !hudState?.docked && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm z-40 flex flex-col items-center justify-start sm:justify-center gap-2 overflow-y-auto overscroll-contain p-4 sm:p-6 text-center">
            <h2 className="text-2xl font-bold font-arcade text-sky-400 mb-4 tracking-wider">GAME PAUSED</h2>

            <div className="w-full max-w-md mb-4">
              <AudioMenu
                saveData={saveData}
                onSaveUpdate={onSaveUpdate}
                musicPaused={musicPaused}
                onToggleMusic={toggleMusic}
              />
            </div>

            {gamepadName && (
              <p className="mb-3 text-[10px] text-slate-400 font-mono-tech">Stick or D-pad selects. A confirms. B resumes.</p>
            )}

            <div className="w-full max-w-xs flex flex-col gap-3 font-mono-tech text-sm">
              <button
                onClick={togglePause}
                className={`w-full min-h-11 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-arcade text-xs font-bold rounded transition-colors ${focusRing(0)}`}
              >
                Resume Battle
              </button>
              <button
                onClick={restartGame}
                className={`w-full min-h-11 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded transition-colors flex items-center justify-center gap-2 ${focusRing(1)}`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart Sector</span>
              </button>
              <button
                onClick={() => persistCrt(!crtFilter)}
                className={`w-full min-h-11 py-3 bg-slate-900 border border-slate-700 text-slate-300 rounded transition-colors ${focusRing(2)}`}
              >
                Toggle CRT Scanlines ({crtFilter ? 'Active' : 'Disabled'})
              </button>
              <button
                onClick={quitToTitle}
                className={`w-full min-h-11 py-3 bg-red-950/50 border border-red-800/60 hover:bg-red-900/40 text-red-300 rounded transition-colors ${focusRing(3)}`}
              >
                Return to Title Menu
              </button>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {isPlaying && hudState?.isGameOver && (
          <div className="absolute inset-0 bg-black/90 z-40 flex flex-col items-center justify-start sm:justify-center gap-2 overflow-y-auto overscroll-contain p-4 sm:p-6 text-center">
            <div className="text-red-500 font-arcade text-xl sm:text-2xl font-bold mb-2 tracking-widest animate-pulse">
              BIO-VESSEL DESTROYED
            </div>
            <p className="text-slate-400 text-xs font-mono-tech mb-4">
              The mutagenic contagion overwhelmed your cybernetic vascular shell.
            </p>

            <div className="w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded p-4 mb-4 flex flex-col gap-2 font-mono-tech text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Final Score:</span>
                <span className="text-yellow-400 font-bold tabular-nums">{hudState.score}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Biomatter Harvested:</span>
                <span className="text-emerald-400 tabular-nums">+{hudState.biomatter}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Ship Vessel:</span>
                <span className="text-sky-300">{activeShip.name}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Sector Reached:</span>
                <span className="text-emerald-300">{hudState.stage} · {hudState.sectorName}</span>
              </div>
              <ClearedSectors stage={hudState.stage} victory={false} />
              {runReward && (
                <div className="flex justify-between text-slate-300">
                  <span>Pilot XP:</span>
                  <span className="text-sky-300 tabular-nums">+{runReward.xp} · RK {runReward.rank} {runReward.title}</span>
                </div>
              )}
              {runReward?.rankedUp && (
                <div className="text-center text-amber-300 font-arcade text-[10px]">RANK UP</div>
              )}
              <RankTrack xp={saveData.pilotXp} />

              {/* Submit to Global Leaderboard */}
              {!hasSubmittedScore ? (
                <div className="mt-2 pt-2 border-t border-slate-800 flex flex-col gap-2">
                  <div className="text-[11px] text-slate-400 text-left">Submit Pilot Callsign to Leaderboard:</div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      maxLength={10}
                      value={pilotCallsign}
                      onChange={(e) => setPilotCallsign(e.target.value.toUpperCase())}
                      className="flex-1 bg-slate-950 border border-slate-700 px-2 py-1 rounded text-white text-xs font-arcade uppercase"
                      placeholder="CALLSIGN"
                    />
                    <button
                      onClick={handleSubmitScore}
                      className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-arcade text-[10px] font-bold rounded transition-colors whitespace-nowrap"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 p-2 bg-emerald-950/40 border border-emerald-500/40 rounded text-emerald-300 text-xs flex items-center justify-center gap-1.5 font-arcade">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <span>Recorded! Rank #{submitSuccessRank}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={restartGame}
                className="min-h-11 px-5 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-arcade text-xs font-bold rounded transition-colors"
              >
                Play Again
              </button>
              <button
                onClick={quitToTitle}
                className="min-h-11 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-arcade text-xs rounded transition-colors"
              >
                Menu
              </button>
            </div>
            {gamepadName && (
              <p className="mt-3 text-[10px] text-slate-500 font-mono-tech">A plays again. B returns to the menu.</p>
            )}
          </div>
        )}

        {/* Victory Screen */}
        {isPlaying && hudState?.isVictory && (
          <div className="absolute inset-0 bg-emerald-950/90 z-40 flex flex-col items-center justify-start sm:justify-center gap-2 overflow-y-auto overscroll-contain p-4 sm:p-6 text-center">
            <div className="text-emerald-400 font-arcade text-xl sm:text-2xl font-bold mb-2 tracking-widest">
              CRUCIBLE SECURED
            </div>
            <p className="text-emerald-200 text-xs font-mono-tech mb-4">
              {hudState.bossName} is down. The crucible is quiet.
            </p>

            <div className="w-full max-w-sm bg-slate-900/90 border border-emerald-500/40 rounded p-4 mb-4 flex flex-col gap-2 font-mono-tech text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Final Score:</span>
                <span className="text-yellow-400 font-bold tabular-nums">{hudState.score}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Biomatter Bonus:</span>
                <span className="text-emerald-400 tabular-nums">+{hudState.biomatter}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Ship Vessel:</span>
                <span className="text-sky-300">{activeShip.name}</span>
              </div>
              <ClearedSectors stage={hudState.stage} victory />
              {runReward && (
                <div className="flex justify-between text-slate-300">
                  <span>Pilot XP:</span>
                  <span className="text-sky-300 tabular-nums">+{runReward.xp} · RK {runReward.rank} {runReward.title}</span>
                </div>
              )}
              {runReward?.rankedUp && (
                <div className="text-center text-amber-300 font-arcade text-[10px]">RANK UP</div>
              )}
              <RankTrack xp={saveData.pilotXp} />

              {!hasSubmittedScore ? (
                <div className="mt-2 pt-2 border-t border-slate-800 flex flex-col gap-2">
                  <div className="text-[11px] text-slate-400 text-left">Record Victory Score:</div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      maxLength={10}
                      value={pilotCallsign}
                      onChange={(e) => setPilotCallsign(e.target.value.toUpperCase())}
                      className="flex-1 bg-slate-950 border border-slate-700 px-2 py-1 rounded text-white text-xs font-arcade uppercase"
                    />
                    <button
                      onClick={handleSubmitScore}
                      className="px-3 py-1 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-arcade text-[10px] font-bold rounded transition-colors whitespace-nowrap"
                    >
                      Record
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 p-2 bg-yellow-950/40 border border-yellow-500/40 rounded text-yellow-300 text-xs flex items-center justify-center gap-1.5 font-arcade">
                  <Award className="w-4 h-4 text-yellow-400" />
                  <span>Leaderboard Rank #{submitSuccessRank}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={restartGame}
                className="min-h-11 px-5 py-3 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-arcade text-xs font-bold rounded transition-colors"
              >
                Run the Crucible
              </button>
              <button
                onClick={quitToTitle}
                className="min-h-11 px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-arcade text-xs rounded transition-colors"
              >
                Menu
              </button>
            </div>
            {gamepadName && (
              <p className="mt-3 text-[10px] text-emerald-200/80 font-mono-tech">A runs it again. B returns to the menu.</p>
            )}
          </div>
        )}

        {isPlaying && !gamepadName && !touchBlocked && (
          <>
            {showTouch && (
              <div
                className="absolute inset-y-0 left-0 w-[48%] z-30 touch-none"
                onPointerDown={beginStick}
                onPointerMove={moveStick}
                onPointerUp={endStick}
                onPointerCancel={endStick}
                onContextMenu={(event) => event.preventDefault()}
              />
            )}
            {showTouch && !isStickActive && (
              <div className="absolute bottom-5 left-5 w-16 h-16 rounded-full border border-white/25 bg-white/5 pointer-events-none z-30" />
            )}
            {showTouch && isStickActive && (
              <div className="absolute z-30 pointer-events-none" style={{ left: stickOrigin.x, top: stickOrigin.y }}>
                <div className="absolute w-28 h-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sky-200/40 bg-sky-400/10" />
                <div
                  className="absolute w-12 h-12 rounded-full bg-sky-400/90 border-2 border-white shadow-lg"
                  style={{ transform: `translate(calc(-50% + ${touchStickPos.x}px), calc(-50% + ${touchStickPos.y}px))` }}
                />
              </div>
            )}
            <div className="absolute bottom-3 right-3 z-30 flex items-end gap-2 touch-none">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={togglePause}
                  className="min-h-11 px-3 rounded-full bg-slate-950/80 border border-slate-500 text-slate-100 text-[10px] font-arcade"
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button
                  type="button"
                  onPointerDown={pressPod}
                  className="min-h-12 min-w-12 px-3 rounded-full bg-purple-950/80 border-2 border-purple-300 text-purple-100 text-[10px] font-arcade"
                >
                  POD
                </button>
                <button
                  type="button"
                  onPointerDown={pressBomb}
                  className="w-14 h-14 rounded-full bg-amber-500/90 border-2 border-amber-100 text-slate-950 font-arcade text-[10px] font-bold flex flex-col items-center justify-center"
                >
                  <Flame className="w-4 h-4" />
                  BOMB
                </button>
              </div>
              <button
                type="button"
                onPointerDown={pressFire}
                onPointerUp={releaseFire}
                onPointerCancel={releaseFire}
                className="w-[4.75rem] h-[4.75rem] rounded-full bg-gradient-to-br from-sky-300 to-sky-600 border-2 border-white text-slate-950 font-arcade text-[10px] font-bold flex flex-col items-center justify-center shadow-lg"
              >
                <Zap className="w-5 h-5 fill-current" />
                FIRE
              </button>
            </div>
          </>
        )}

        {isPlaying && gamepadName && (
          <div className="absolute top-12 left-2 z-30 pointer-events-none px-2 py-1 rounded bg-slate-950/70 border border-sky-500/40 text-[9px] text-sky-300 font-mono-tech">
            {gamepadName}
          </div>
        )}
      </div>

      {isPlaying && hudState?.docked && SECTORS[hudState.stage] && (
        <div className="absolute inset-0 z-[70] overflow-y-auto bg-[#06090e]">
          <ShipLab
            saveData={saveData}
            onSaveUpdate={onSaveUpdate}
            onDeploy={launchFromLab}
            notice={`${hudState.sectorName} is clear. The harvest is in your stores. Change ships or buy upgrades, then launch ${SECTORS[hudState.stage].name}.`}
            deployLabel={`Launch ${SECTORS[hudState.stage].name}`}
            onExit={() => exitMusicRef.current()}
          />
        </div>
      )}
    </div>
  );
};
