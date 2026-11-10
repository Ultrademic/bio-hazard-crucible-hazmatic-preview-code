import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronRight, Crosshair, RefreshCw, Sparkles, Trophy } from 'lucide-react';
import titleHero from '../assets/images/crucible_title_hero_1791943891412.jpg';
import { sound } from '../game/audioEngine';
import { rankFromXp } from '../game/ranks';
import { SECTORS } from '../game/sectors';
import { UserSaveData } from '../game/types';

export type MenuTab = 'arena' | 'lab' | 'daily' | 'leaderboard' | 'cloud';

const ITEMS: Array<{ id: MenuTab; label: string; hint: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'arena', label: 'Arena', hint: 'Launch a run', color: 'text-sky-300', Icon: Crosshair },
  { id: 'lab', label: 'Ship Lab', hint: 'Mutate and swap bio-ships', color: 'text-teal-300', Icon: Sparkles },
  { id: 'daily', label: 'Daily Challenge', hint: "Today's modifier run", color: 'text-amber-300', Icon: Calendar },
  { id: 'leaderboard', label: 'Leaderboard', hint: 'Top pilots', color: 'text-emerald-300', Icon: Trophy },
  { id: 'cloud', label: 'Cloud Sync', hint: 'Back up your save', color: 'text-purple-300', Icon: RefreshCw }
];

interface PadSnapshot {
  up: boolean;
  down: boolean;
  confirm: boolean;
  back: boolean;
  any: boolean;
}

function readPad(): PadSnapshot {
  const none = { up: false, down: false, confirm: false, back: false, any: false };
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return none;
  let pads: Array<Gamepad | null> = [];
  try {
    pads = Array.from(navigator.getGamepads());
  } catch {
    return none;
  }
  const snap = { ...none };
  for (const pad of pads) {
    if (!pad || !pad.connected) continue;
    const btn = (i: number) => !!pad.buttons[i] && (pad.buttons[i].pressed || pad.buttons[i].value > 0.5);
    const stickY = pad.axes[1] ?? 0;
    snap.up = snap.up || btn(12) || stickY < -0.55;
    snap.down = snap.down || btn(13) || stickY > 0.55;
    snap.confirm = snap.confirm || btn(0) || btn(9);
    snap.back = snap.back || btn(1);
    snap.any = snap.any || pad.buttons.some((b) => b.pressed || b.value > 0.5) || Math.abs(stickY) > 0.55;
  }
  return snap;
}

interface MainMenuProps {
  saveData: UserSaveData;
  onSelect: (tab: MenuTab) => void;
  onBack: () => void;
}

/** Main menu between the title screen and the game views. Touch, keyboard, and gamepad. */
export const MainMenu: React.FC<MainMenuProps> = ({ saveData, onSelect, onBack }) => {
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const leavingRef = useRef(false);
  const standing = rankFromXp(saveData.pilotXp);

  const move = (dir: number) => {
    const next = (indexRef.current + dir + ITEMS.length) % ITEMS.length;
    indexRef.current = next;
    setIndex(next);
    sound.playMenuBlip();
  };

  const actionsRef = useRef({ choose: (_i: number) => {}, back: () => {} });
  actionsRef.current.choose = (i: number) => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    sound.playMenuBlip();
    onSelect(ITEMS[i].id);
  };
  actionsRef.current.back = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    onBack();
  };

  useEffect(() => {
    sound.playBgm('title');
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const k = event.key;
      if (k === 'ArrowUp' || k === 'w' || k === 'W') {
        event.preventDefault();
        move(-1);
      } else if (k === 'ArrowDown' || k === 's' || k === 'S') {
        event.preventDefault();
        move(1);
      } else if (k === 'Enter' || k === ' ') {
        event.preventDefault();
        // A held key from the title screen only sends repeats; wait for a fresh press.
        if (event.repeat) return;
        actionsRef.current.choose(indexRef.current);
      } else if (k === 'Escape' || k === 'Backspace') {
        event.preventDefault();
        if (!event.repeat) actionsRef.current.back();
      }
    };
    window.addEventListener('keydown', onKey);

    // Gamepad: D-pad or left stick moves, A or Start selects, B goes back to the title.
    let raf = 0;
    let armed = false;
    let prev: PadSnapshot = { up: false, down: false, confirm: false, back: false, any: false };
    let repeatAt = 0;
    const tick = (now: number) => {
      const pad = readPad();
      if (!armed) {
        // Ignore whatever was still held when the menu opened.
        if (!pad.any) armed = true;
      } else {
        const dir = pad.up !== pad.down ? (pad.down ? 1 : -1) : 0;
        if (dir !== 0) {
          const fresh = (dir < 0 && !prev.up) || (dir > 0 && !prev.down);
          if (fresh || now >= repeatAt) {
            move(dir);
            repeatAt = now + (fresh ? 380 : 150);
          }
        }
        if (pad.confirm && !prev.confirm) actionsRef.current.choose(indexRef.current);
        else if (pad.back && !prev.back) actionsRef.current.back();
      }
      prev = pad;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[70] bg-[#05080d] overflow-y-auto overscroll-contain select-none"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)'
      }}
    >
      {/* Dimmed title art as a backdrop */}
      <img
        src={titleHero}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="fixed inset-0 w-full h-full object-cover pixel-art opacity-25 pointer-events-none"
      />
      <div className="fixed inset-0 bg-gradient-to-b from-[#05080d]/70 via-[#05080d]/80 to-[#05080d] pointer-events-none" />

      <div className="relative min-h-full flex flex-col items-center justify-center gap-5 px-4 py-6">
        <h1 className="font-arcade text-sm sm:text-lg tracking-widest text-teal-300 drop-shadow-[0_0_8px_rgba(45,212,191,0.55)]">
          MAIN MENU
        </h1>

        <nav aria-label="Main menu" className="w-full max-w-sm flex flex-col gap-2.5">
          {ITEMS.map((item, i) => {
            const selected = i === index;
            const { Icon } = item;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => actionsRef.current.choose(i)}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse' && indexRef.current !== i) {
                    indexRef.current = i;
                    setIndex(i);
                  }
                }}
                aria-current={selected ? 'true' : undefined}
                className={`group w-full min-h-[52px] flex items-center gap-3 px-4 py-3 rounded border-2 text-left transition-colors ${
                  selected
                    ? 'bg-teal-950/70 border-teal-400 shadow-[0_0_14px_rgba(45,212,191,0.35)]'
                    : 'bg-slate-950/70 border-slate-800 hover:border-slate-600'
                }`}
              >
                <span className={`w-3 font-arcade text-[10px] text-teal-300 ${selected ? 'animate-pulse' : 'opacity-0'}`}>▶</span>
                <Icon className={`w-5 h-5 shrink-0 ${selected ? item.color : 'text-slate-500'}`} />
                <span className="flex-1 min-w-0">
                  <span className={`block font-arcade text-[11px] sm:text-xs tracking-wider uppercase ${selected ? 'text-white' : 'text-slate-300'}`}>
                    {item.label}
                  </span>
                  <span className="block mt-1 font-mono-tech text-[11px] text-slate-500 truncate">{item.hint}</span>
                </span>
                <ChevronRight className={`w-4 h-4 shrink-0 ${selected ? 'text-teal-300' : 'text-slate-700'}`} />
              </button>
            );
          })}
        </nav>

        {/* Pilot record, moved here from the old title banner */}
        <div className="w-full max-w-sm px-4 py-3 rounded border border-slate-800 bg-slate-950/70 font-mono-tech">
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="text-slate-400">RK {standing.rank} {standing.title}</span>
            <span className="text-slate-400">REACHED {saveData.bestStage}/{SECTORS.length}</span>
          </div>
          <div className="mt-1 text-sm text-emerald-400 tabular-nums">HI-SCORE: {saveData.highScore}</div>
          <div className="mt-1.5 h-1.5 bg-slate-800 rounded overflow-hidden">
            <div className="h-full bg-emerald-400" style={{ width: `${Math.round(standing.progress * 100)}%` }} />
          </div>
          {standing.nextTitle && (
            <div className="mt-1 text-[10px] text-slate-500">NEXT {standing.nextTitle}</div>
          )}
        </div>

        <p className="text-center font-mono-tech text-[10px] text-slate-600">
          Arrows / D-pad select · Enter / A confirm · Esc / B title
        </p>
      </div>
    </div>
  );
};
