export interface InputState {
  x: number;          // -1 to 1, screen right is positive
  y: number;          // -1 to 1, screen down is positive
  shoot: boolean;     // Primary fire pressed or held
  shootJustPressed: boolean;
  special: boolean;   // Super weapon / bomb
  specialJustPressed: boolean;
  togglePod: boolean; // Cycle pod configuration
  pause: boolean;
  /** Rising edge of Start/Select. Title uses this so Escape does not launch a run. */
  start: boolean;
  /** Rising edge of face button 0 (A / Cross). Menus only. */
  confirm: boolean;
  /** Rising edge of face button 1 (B / Circle). Menus only. */
  cancel: boolean;
  menuUp: boolean;
  menuDown: boolean;
  menuLeft: boolean;
  menuRight: boolean;
  /** No D-pad, menu stick, or arrow key is held. */
  menuNeutral: boolean;
  aiming: boolean;
}

export interface GamepadButtonLike {
  pressed: boolean;
  value: number;
}

export interface StandardPadReading {
  x: number;
  y: number;
  shoot: boolean;
  special: boolean;
  togglePod: boolean;
  pause: boolean;
  confirm: boolean;
  cancel: boolean;
  aimX: number;
  aimY: number;
  aiming: boolean;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/** W3C Standard Gamepad: below this radius the stick is idle. */
export const GAMEPAD_DEADZONE = 0.18;
/** Analog triggers (buttons 6 and 7). Higher than the stick so a resting trigger does not fire. */
export const TRIGGER_THRESHOLD = 0.55;
/** Stick deflection that counts as a menu direction. */
export const MENU_STICK_THRESHOLD = 0.55;

/**
 * Standard Gamepad (https://w3c.github.io/gamepad/#remapping):
 * buttons: 0 A/Cross, 1 B/Circle, 2 X/Square, 3 Y/Triangle,
 * 4 LB, 5 RB, 6 LT, 7 RT, 8 Select, 9 Start, 12-15 D-pad up/down/left/right.
 * axes: 0 left stick right, 1 left stick down, 2 right stick right, 3 right stick down.
 * This game's canvas is y-down, so stick Y is used as-is.
 */
export function applyRadialDeadzone(x: number, y: number, deadzone = GAMEPAD_DEADZONE): { x: number; y: number } {
  const mag = Math.hypot(x, y);
  if (!Number.isFinite(mag) || mag < deadzone || mag === 0) return { x: 0, y: 0 };
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  return { x: (x / mag) * scaled, y: (y / mag) * scaled };
}

function buttonDown(buttons: ArrayLike<GamepadButtonLike>, index: number): boolean {
  const button = buttons[index];
  if (!button) return false;
  return button.pressed || button.value >= 0.5;
}

function triggerDown(buttons: ArrayLike<GamepadButtonLike>, index: number): boolean {
  return (buttons[index]?.value ?? 0) >= TRIGGER_THRESHOLD;
}

export function readStandardGamepad(
  axes: ArrayLike<number>,
  buttons: ArrayLike<GamepadButtonLike>
): StandardPadReading {
  const rawX = axes[0] ?? 0;
  const rawY = axes[1] ?? 0;
  const move = applyRadialDeadzone(rawX, rawY);
  const aim = applyRadialDeadzone(axes[2] ?? 0, axes[3] ?? 0);

  const dpadUp = buttonDown(buttons, 12);
  const dpadDown = buttonDown(buttons, 13);
  const dpadLeft = buttonDown(buttons, 14);
  const dpadRight = buttonDown(buttons, 15);

  let x = move.x;
  let y = move.y;
  if (dpadLeft !== dpadRight) x = dpadLeft ? -1 : 1;
  if (dpadUp !== dpadDown) y = dpadUp ? -1 : 1;

  const confirm = buttonDown(buttons, 0);
  const cancel = buttonDown(buttons, 1);

  return {
    x,
    y,
    shoot: confirm || triggerDown(buttons, 7),
    special: cancel || triggerDown(buttons, 6),
    togglePod: buttonDown(buttons, 2) || buttonDown(buttons, 3) || buttonDown(buttons, 5),
    pause: buttonDown(buttons, 8) || buttonDown(buttons, 9),
    confirm,
    cancel,
    aimX: aim.x,
    aimY: aim.y,
    aiming: aim.x !== 0 || aim.y !== 0,
    up: dpadUp || rawY < -MENU_STICK_THRESHOLD,
    down: dpadDown || rawY > MENU_STICK_THRESHOLD,
    left: dpadLeft || rawX < -MENU_STICK_THRESHOLD,
    right: dpadRight || rawX > MENU_STICK_THRESHOLD
  };
}

export function shortGamepadName(id: string): string {
  const cleaned = id
    .replace(/\s*\((?:standard gamepad|vendor:|xinput|hid).*$/i, '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const name = cleaned || 'Gamepad';
  return name.length > 36 ? `${name.slice(0, 35)}…` : name;
}

const EMPTY_PAD: StandardPadReading = {
  x: 0,
  y: 0,
  shoot: false,
  special: false,
  togglePod: false,
  pause: false,
  confirm: false,
  cancel: false,
  aimX: 0,
  aimY: 0,
  aiming: false,
  up: false,
  down: false,
  left: false,
  right: false
};

export class InputManager {
  private keys: Record<string, boolean> = {};

  // Touch virtual stick state
  public touchStick = {
    active: false,
    startX: 0,
    startY: 0,
    currX: 0,
    currY: 0,
    vecX: 0,
    vecY: 0
  };

  public touchShoot = false;
  public touchShootJustPressed = false;
  public touchSpecial = false;
  public touchSpecialJustPressed = false;
  public touchTogglePod = false;

  // Mouse aiming position in 640x360 virtual canvas space
  public mousePos: { x: number; y: number } | null = null;
  public hasMouseMoved = false;
  /** Right stick, unit-ish vector. Screen right is +x, screen down is +y. Null when the stick is idle. */
  public aimVector: { x: number; y: number } | null = null;

  public setMousePos(x: number, y: number) {
    this.mousePos = { x, y };
    this.hasMouseMoved = true;
  }

  public clearMousePos() {
    this.mousePos = null;
  }

  private connectedGamepadIndex: number | null = null;
  private missingPadFrames = 0;
  public activeGamepadName: string | null = null;
  public vibrationEnabled = true;
  /** Called at the end of every poll. Keep it cheap; it runs once per frame. */
  public onFrame: ((state: InputState) => void) | null = null;

  private held = {
    shoot: false,
    special: false,
    pod: false,
    pause: false,
    confirm: false,
    cancel: false,
    start: false
  };

  private menuNextAt = { up: 0, down: 0, left: 0, right: 0 };
  /** False until the first poll. A button already held then (e.g. A from the menu) is not a fresh press. */
  private primed = false;
  private lastPollAt = 0;

  private onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const typing = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (typing) return;
    this.keys[event.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys[event.code] = false;
  };

  private onBlur = () => {
    this.keys = {};
  };

  private onGamepadConnected = (event: GamepadEvent) => {
    this.connectedGamepadIndex = event.gamepad.index;
    this.activeGamepadName = shortGamepadName(event.gamepad.id || 'Gamepad');
    this.missingPadFrames = 0;
  };

  private onGamepadDisconnected = (event: GamepadEvent) => {
    if (this.connectedGamepadIndex === event.gamepad.index) {
      this.connectedGamepadIndex = null;
      this.activeGamepadName = null;
      this.aimVector = null;
    }
  };

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }

  public destroy() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    this.onFrame = null;
  }

  public vibrate(durationMs = 25) {
    if (!this.vibrationEnabled) return;

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(durationMs);
      } catch {
        // Ignored. Some browsers throw if vibration is blocked.
      }
    }

    const pad = this.currentPad();
    const haptics = pad as (Gamepad & {
      vibrationActuator?: { playEffect?: (type: string, params: Record<string, number>) => void };
      hapticActuators?: Array<{ playEffect?: (type: string, params: Record<string, number>) => void }>;
    }) | null;
    const actuator = haptics?.vibrationActuator ?? haptics?.hapticActuators?.[0];
    if (!actuator || typeof actuator.playEffect !== 'function') return;
    try {
      actuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: durationMs,
        weakMagnitude: 0.5,
        strongMagnitude: 0.35
      });
    } catch {
      // Ignored. Rumble is optional.
    }
  }

  private currentPad(): Gamepad | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
    let pads: Array<Gamepad | null> = [];
    try {
      pads = Array.from(navigator.getGamepads());
    } catch {
      return null;
    }
    const connected = pads.filter((pad): pad is Gamepad => !!pad && pad.connected);
    if (this.connectedGamepadIndex !== null) {
      const current = connected.find((pad) => pad.index === this.connectedGamepadIndex);
      if (current) {
        this.missingPadFrames = 0;
        this.activeGamepadName = shortGamepadName(current.id || 'Gamepad');
        return current;
      }
    }
    const next = connected.find((pad) => pad.mapping === 'standard') ?? connected[0] ?? null;
    if (next) {
      this.connectedGamepadIndex = next.index;
      this.activeGamepadName = shortGamepadName(next.id || 'Gamepad');
      this.missingPadFrames = 0;
      return next;
    }
    if (this.connectedGamepadIndex !== null) {
      this.missingPadFrames += 1;
      if (this.missingPadFrames > 20) {
        this.connectedGamepadIndex = null;
        this.activeGamepadName = null;
        this.aimVector = null;
      }
    }
    return null;
  }

  private menuEdge(active: boolean, key: keyof InputManager['menuNextAt'], now: number): boolean {
    if (!active) {
      this.menuNextAt[key] = 0;
      return false;
    }
    if (now < this.menuNextAt[key]) return false;
    const first = this.menuNextAt[key] === 0;
    this.menuNextAt[key] = now + (first ? 380 : 150);
    return true;
  }

  public poll(): InputState {
    const now = typeof performance !== 'undefined' ? performance.now() : this.lastPollAt + 16;
    this.lastPollAt = now;

    let x = 0;
    let y = 0;
    let shoot = false;
    let special = false;
    let togglePod = false;
    let pauseHeld = false;

    if (this.keys['ArrowLeft'] || this.keys['KeyA']) x -= 1;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) x += 1;
    if (this.keys['ArrowUp'] || this.keys['KeyW']) y -= 1;
    if (this.keys['ArrowDown'] || this.keys['KeyS']) y += 1;

    if (this.keys['Space'] || this.keys['KeyZ'] || this.keys['KeyJ']) shoot = true;
    if (this.keys['KeyX'] || this.keys['KeyK'] || this.keys['ShiftLeft'] || this.keys['ShiftRight']) special = true;
    if (this.keys['KeyC'] || this.keys['KeyL']) togglePod = true;
    if (this.keys['Escape'] || this.keys['KeyP']) pauseHeld = true;

    if (this.touchStick.active) {
      x += this.touchStick.vecX;
      y += this.touchStick.vecY;
    }
    if (this.touchShoot) shoot = true;
    if (this.touchSpecial) special = true;
    if (this.touchTogglePod) togglePod = true;

    const padDevice = this.currentPad();
    const pad = padDevice
      ? readStandardGamepad(padDevice.axes, padDevice.buttons)
      : EMPTY_PAD;

    x += pad.x;
    y += pad.y;
    if (pad.shoot) shoot = true;
    if (pad.special) special = true;
    if (pad.togglePod) togglePod = true;
    if (pad.pause) pauseHeld = true;

    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }

    this.aimVector = pad.aiming ? { x: pad.aimX, y: pad.aimY } : null;

    const keyUp = !!this.keys['ArrowUp'];
    const keyDown = !!this.keys['ArrowDown'];
    const keyLeft = !!this.keys['ArrowLeft'];
    const keyRight = !!this.keys['ArrowRight'];
    const menuUpHeld = pad.up || keyUp;
    const menuDownHeld = pad.down || keyDown;
    const menuLeftHeld = pad.left || keyLeft;
    const menuRightHeld = pad.right || keyRight;

    if (!this.primed) {
      this.primed = true;
      this.held.shoot = shoot;
      this.held.special = special;
      this.held.pod = togglePod;
      this.held.pause = pauseHeld;
      this.held.start = pad.pause;
      this.held.confirm = pad.confirm;
      this.held.cancel = pad.cancel;
    }

    const shootJustPressed = (shoot && !this.held.shoot) || this.touchShootJustPressed;
    const specialJustPressed = (special && !this.held.special) || this.touchSpecialJustPressed;
    const togglePodJustPressed = (togglePod && !this.held.pod) || this.touchTogglePod;
    const pause = pauseHeld && !this.held.pause;
    const start = pad.pause && !this.held.start;
    const confirm = pad.confirm && !this.held.confirm;
    const cancel = pad.cancel && !this.held.cancel;

    this.held.shoot = shoot;
    this.held.special = special;
    this.held.pod = togglePod;
    this.held.pause = pauseHeld;
    this.held.start = pad.pause;
    this.held.confirm = pad.confirm;
    this.held.cancel = pad.cancel;
    this.touchShootJustPressed = false;
    this.touchSpecialJustPressed = false;
    this.touchSpecial = false;
    this.touchTogglePod = false;

    const state: InputState = {
      x,
      y,
      shoot,
      shootJustPressed,
      special,
      specialJustPressed,
      togglePod: togglePodJustPressed,
      pause,
      start,
      confirm,
      cancel,
      menuUp: this.menuEdge(menuUpHeld, 'up', now),
      menuDown: this.menuEdge(menuDownHeld, 'down', now),
      menuLeft: this.menuEdge(menuLeftHeld, 'left', now),
      menuRight: this.menuEdge(menuRightHeld, 'right', now),
      menuNeutral: !menuUpHeld && !menuDownHeld && !menuLeftHeld && !menuRightHeld,
      aiming: pad.aiming
    };

    this.onFrame?.(state);
    return state;
  }
}
