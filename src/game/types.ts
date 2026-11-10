export type GameMode = 'standard' | 'daily' | 'boss_rush';

export interface ShipDef {
  id: string;
  name: string;
  alias: string;
  type: string;
  description: string;
  lore: string;
  speed: number;        // 1-5
  armor: number;        // 1-5
  firePower: number;    // 1-5
  chargeSpeed: number;  // 1-5
  color: string;
  accentColor: string;
  glowColor: string;
  unlockedByDefault: boolean;
  cost: number;
  podType: 'orbital' | 'trailing' | 'focus' | 'turret';
  specialWeapon: string;
}

export interface PlayerMutations {
  chitinArmor: number;     // Extra max HP / shield
  synapticReflex: number;  // Movement speed & dash cooldown
  podOverclock: number;    // Pod damage & bullet absorption radius
  plasmaPiercing: number;  // Shot damage & penetration chance
  sporeLeech: number;      // Biomatter drop rate
}

export interface UserSaveData {
  pilotName: string;
  credits: number;
  unlockedShips: string[];
  activeShipId: string;
  highScore: number;
  mutations: PlayerMutations;
  selectedPodMode: 'orbital' | 'forward' | 'trailing' | 'spread';
  settings: {
    crtFilter: boolean;
    bgmVolume: number;
    sfxVolume: number;
    muted: boolean;
    vibration: boolean;
    controlMode: 'touch' | 'keyboard' | 'gamepad';
    pixelScale: number;
  };
  dailyCompletedDates: string[];
  totalRuns: number;
  totalBossesDefeated: number;
  pilotXp: number;
  bestStage: number;
}

export interface DailyModifier {
  id: string;
  name: string;
  description: string;
  multiplier: number;
  bonusGoal: string;
}

export interface DailyChallengeInfo {
  date: string;
  seed: number;
  title: string;
  modifier: DailyModifier;
  targetScore: number;
  rewards: {
    biomatter: number;
    badge: string;
  };
}

export interface LeaderboardItem {
  id: string;
  name: string;
  score: number;
  shipId: string;
  shipName: string;
  stage: number;
  mode: GameMode;
  dailyDate?: string;
  date: string;
  platform: string;
}

// In-game entity structures
export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  isPlayer: boolean;
  color: string;
  glowColor?: string;
  pierce?: number;
  /** Enemy ids this shot has already damaged. Pierce hits each target once. */
  hitIds?: number[];
  type: 'plasma' | 'spore' | 'laser' | 'acid' | 'ring' | 'charged';
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  width: number;
  height: number;
  type: 'swarmer' | 'wasp' | 'crawler' | 'jelly' | 'dread_hornet' | 'nautilus_carrier' | 'centipede_segment' | 'hive_spitter' | 'boss_centipede' | 'boss_brood' | 'boss_hive' | 'moth';
  color: string;
  scoreValue: number;
  shootCooldown: number;
  shootInterval: number;
  patternParam: number;
  isBoss?: boolean;
  isLargeBug?: boolean;
  name?: string;
  chainId?: number;
  chainIndex?: number;
  homeY?: number;
  anchored?: boolean;
  /** Seconds of white hit-flash remaining. */
  flash?: number;
  /** Moth swarm steering state. */
  moth?: {
    phase: 'approach' | 'orbit' | 'dive' | 'flee';
    timer: number;
    life: number;
    orbitAngle: number;
    orbitRadius: number;
    orbitSpin: number;
    orbitTime: number;
    jitter: number;
  };
}

export interface BossSegment {
  x: number;
  y: number;
  angle: number;
  radius: number;
  hp: number;
  maxHp: number;
  phase: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  shape?: 'circle' | 'spark' | 'smoke' | 'slime';
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
}

export interface Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'biomatter' | 'pod_power' | 'shield_restore' | 'super_bomb';
  value: number;
  radius: number;
}

export const INITIAL_SHIPS: ShipDef[] = [
  {
    id: 'orestes',
    name: 'Orestes-01',
    alias: 'The Raptor Biocraft',
    type: 'Assault Bio-Fighter',
    description: 'The standard biomechanical strike craft. Excels in balanced mobility, sustained dual plasma fire, and an orbital plasma pod.',
    lore: 'Forged from reconstituted avian raptor DNA and cybernetic vascular frames, Orestes is the spearhead of the Avaron re-colonization fleet.',
    speed: 4,
    armor: 3,
    firePower: 3,
    chargeSpeed: 4,
    color: '#38bdf8',
    accentColor: '#0284c7',
    glowColor: 'rgba(56, 189, 248, 0.4)',
    unlockedByDefault: true,
    cost: 0,
    podType: 'orbital',
    specialWeapon: 'Hyper Pulse Cannon'
  },
  {
    id: 'electra',
    name: 'Electra-Gold',
    alias: 'The Dragonfly Stalker',
    type: 'High-Agility Interceptor',
    description: 'Blistering sub-light thrusters with wide quad-stinger spread shots and bio-electric homing pods.',
    lore: 'Synthesized with neuromuscular reflex genes from pre-extinction predatory insects. Unmatched sideways evasion in dense asteroid caverns.',
    speed: 5,
    armor: 2,
    firePower: 3,
    chargeSpeed: 5,
    color: '#4ade80',
    accentColor: '#166534',
    glowColor: 'rgba(74, 222, 128, 0.4)',
    unlockedByDefault: true,
    cost: 0,
    podType: 'focus',
    specialWeapon: 'Bio-Electric Spreader'
  },
  {
    id: 'hiob',
    name: 'Hiob-Carapace',
    alias: 'The Armored Scarab',
    type: 'Heavy Fortress Juggernaut',
    description: 'Reinforced multi-tier chitin armor capable of weathering punishing biological spores. Fires heavy seismic acid mortars.',
    lore: 'Harvested from deep subterranean chitin beasts. Massive curved horns and heavy shell plates deflect hostile organism projectiles.',
    speed: 2,
    armor: 5,
    firePower: 5,
    chargeSpeed: 2,
    color: '#e879f9',
    accentColor: '#86198f',
    glowColor: 'rgba(232, 121, 249, 0.45)',
    unlockedByDefault: true,
    cost: 0,
    podType: 'trailing',
    specialWeapon: 'Seismic Acid Mortar'
  },
  {
    id: 'pyron',
    name: 'Pyron-Crimson',
    alias: 'The Solar Manta',
    type: 'Incinerator Cruiser',
    description: 'Generates terrifying thermal wave barrages. Its charged pod releases a solar laser beam that immolates organic hives.',
    lore: 'Infused with thermal extremophile bacteria. Pyron undulates with majestic solar manta wings that burn contagions to ash.',
    speed: 3,
    armor: 4,
    firePower: 5,
    chargeSpeed: 4,
    color: '#d946ef',
    accentColor: '#7e22ce',
    glowColor: 'rgba(240, 171, 252, 0.5)',
    unlockedByDefault: true,
    cost: 0,
    podType: 'turret',
    specialWeapon: 'Solar Thermal Wave'
  }
];
