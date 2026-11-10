import React, { useEffect, useRef } from 'react';
import titleHero from '../assets/images/crucible_title_hero_1791943891412.jpg';
import { sound } from '../game/audioEngine';

/** Keys that should never count as "press start" (modifiers, browser shortcuts). */
const IGNORED_KEYS = new Set([
  'Shift', 'Control', 'Alt', 'Meta', 'OS', 'CapsLock', 'Tab', 'ContextMenu',
  'F1', 'F5', 'F11', 'F12'
]);

function anyPadButtonDown(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return false;
  try {
    return Array.from(navigator.getGamepads()).some(
      (pad) => !!pad && pad.connected && pad.buttons.some((b) => b.pressed || b.value > 0.5)
    );
  } catch {
    return false;
  }
}

interface TitleScreenProps {
  onContinue: () => void;
}

/**
 * Full-screen attract screen shown on load. Any key, click, tap, or gamepad button
 * continues to the main menu. The input is consumed here so it never reaches gameplay.
 */
export const TitleScreen: React.FC<TitleScreenProps> = ({ onContinue }) => {
  const doneRef = useRef(false);
  const continueRef = useRef(() => {});
  continueRef.current = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    // This press is the first user gesture, so it also unlocks audio.
    sound.playBgm('title');
    sound.playMenuBlip();
    onContinue();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || IGNORED_KEYS.has(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      continueRef.current();
    };
    window.addEventListener('keydown', onKey);

    // Gamepad: any button, but only after a frame with every button released,
    // so a button held while the page loads does not skip the title.
    let raf = 0;
    let armed = false;
    const tick = () => {
      const down = anyPadButtonDown();
      if (!down) armed = true;
      else if (armed) {
        continueRef.current();
        return;
      }
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
      role="button"
      tabIndex={0}
      aria-label="Press start to continue"
      // click fires after the pointer is released, so the tap cannot land on the menu underneath.
      onClick={() => continueRef.current()}
      className="fixed inset-0 z-[70] bg-black flex items-center justify-center select-none cursor-pointer outline-none"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)'
      }}
    >
      <div
        className="relative"
        style={{ width: 'min(100vw, calc(100vh * 1376 / 768))', aspectRatio: '1376 / 768' }}
      >
        <img
          src={titleHero}
          alt="Ultrademic Studios presents Bio-Hazard Crucible. Press start button."
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover pixel-art"
        />
        {/* Softly dims the baked-in PRESS START BUTTON line so it blinks. */}
        <div aria-hidden="true" className="title-press-blink absolute" />
      </div>

      <div
        className="absolute left-0 right-0 text-center font-arcade text-[9px] sm:text-[10px] tracking-widest text-slate-500"
        style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        TAP OR PRESS ANY BUTTON
      </div>
    </div>
  );
};
