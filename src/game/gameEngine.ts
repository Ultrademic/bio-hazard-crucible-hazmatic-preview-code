import { sound, stageTrack } from './audioEngine';
import { renderBiome } from './biomeArt';
import { drawEnemySprite } from './enemySprites';
import { drawBioShip } from './shipSprites';
import { InputManager, InputState } from './inputManager';
import { RANK_DAMAGE_STEP } from './ranks';
import { SECTORS, SectorDef, WaveBeat } from './sectors';
import { Bullet, Enemy, FloatingText, GameMode, Particle, Pickup, PlayerMutations, ShipDef } from './types';

export interface GameEngineState {
  score: number;
  lives: number;
  health: number;
  maxHealth: number;
  biomatter: number;
  /** Biomatter gathered this run, including deposits already spent in the lab. */
  biomatterEarned: number;
  /** Cleared a sector that is not the last. The run is parked in the ship lab. */
  docked: boolean;
  combo: number;
  comboTimer: number;
  charge: number;        // 0 to 100
  isCharging: boolean;
  bombs: number;
  stage: number;
  wave: number;
  gameTime: number;
  bossHp: number;
  bossMaxHp: number;
  isBossActive: boolean;
  bossName: string;
  bossPhase: number;
  isGameOver: boolean;
  isVictory: boolean;
  isPaused: boolean;
  podMode: 'orbital' | 'forward' | 'trailing' | 'spread';
  sectorName: string;
  stageBanner: string;
  bannerTone: 'sector' | 'alert';
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private input: InputManager;
  private animId: number | null = null;
  private lastTime = 0;

  // Viewport virtual dimensions (16:9 arcade ratio)
  public readonly width = 640;
  public readonly height = 360;

  // Selected Ship & Stats
  public ship: ShipDef;
  public mutations: PlayerMutations;
  public mode: GameMode;
  public dailyModifier?: { multiplier: number; id: string; name: string };

  // Player State
  public px = 100;
  public py = 180;
  public pvx = 0;
  public pvy = 0;
  public invincibleTimer = 2.0; // Seconds
  public shootCooldown = 0;
  public chargeLevel = 0;
  public isCharging = false;
  public podAngle = 0;
  public podMode: 'orbital' | 'forward' | 'trailing' | 'spread' = 'orbital';
  public podX = 100;
  public podY = 180;
  public podRadius = 14;

  // HUD and Progress
  public state: GameEngineState;
  public onStateUpdate?: (state: GameEngineState) => void;

  // Entities
  private bullets: Bullet[] = [];
  private enemies: Enemy[] = [];
  private particles: Particle[] = [];
  private pickups: Pickup[] = [];
  private floatingTexts: FloatingText[] = [];

  // Parallax Background Offsets
  private bgStarsOffset = 0;
  private bgHillsOffset = 0;
  private bgCavernOffset = 0;
  private bgForegroundOffset = 0;

  // Spawn Timing
  private bossSpawned = false;
  private waveCursor = 0;
  private nextEnemyId = 1;
  private nextChainId = 1;
  private centipedeTrails = new Map<number, Array<{ x: number; y: number }>>();
  private cycadShed = false;
  private cycadEnraged = false;
  private broodEnraged = false;
  private hiveNest = false;
  /** stageClock time of the next ambient moth swarm. */
  private nextMothAt = 0;
  /** One moth burst in the lull between the last wave and the boss. */
  private mothLullDone = false;
  private chargeReadyPlayed = false;
  private chargeHumTimer = 0;
  private stageClock = 0;
  private bannerTimer = 0;
  private bannerKind: 'clear' | 'intro' | null = null;
  private pendingSectorClear = false;
  private broodCalled = false;
  private hiveCalled = false;
  private shakeX = 0;
  private shakeY = 0;
  private hitStop = 0;
  private alertTimer = 0;
  private alertText = '';
  private alertThenBossMusic = false;
  private shockwaves: Array<{
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    life: number;
    maxLife: number;
    color: string;
  }> = [];
  private rankDamage = 1;
  private enemyHpScale = 1;
  private scrollScale = 1;
  private bulletScale = 1;

  constructor(
    canvas: HTMLCanvasElement,
    input: InputManager,
    ship: ShipDef,
    mutations: PlayerMutations,
    mode: GameMode = 'standard',
    dailyModifier?: { multiplier: number; id: string; name: string },
    pilotRank = 1,
    podMode: 'orbital' | 'forward' | 'trailing' | 'spread' = 'orbital'
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.ctx.imageSmoothingEnabled = false;
    this.input = input;
    this.ship = ship;
    this.mutations = mutations;
    this.mode = mode;
    this.dailyModifier = dailyModifier;
    this.podMode = podMode;
    this.rankDamage = 1 + Math.max(0, pilotRank - 1) * RANK_DAMAGE_STEP;
    this.enemyHpScale = dailyModifier?.id === 'armored_colossus' ? 1.5 : 1;
    this.scrollScale = dailyModifier?.id === 'speed_reflex' ? 1.2 : 1;
    this.bulletScale = this.scrollScale;

    const baseHealth = this.hullMax();
    this.state = {
      score: 0,
      lives: 3,
      health: baseHealth,
      maxHealth: baseHealth,
      biomatter: 0,
      biomatterEarned: 0,
      docked: false,
      combo: 1.0,
      comboTimer: 0,
      charge: 0,
      isCharging: false,
      bombs: 2,
      stage: 1,
      wave: 1,
      gameTime: 0,
      bossHp: 0,
      bossMaxHp: 0,
      isBossActive: false,
      bossName: '',
      bossPhase: 0,
      isGameOver: false,
      isVictory: false,
      isPaused: false,
      podMode,
      sectorName: SECTORS[0].name,
      stageBanner: '',
      bannerTone: 'sector'
    };
    this.resetMothSchedule();
  }

  public start() {
    this.lastTime = performance.now();
    this.bannerKind = 'intro';
    this.bannerTimer = 1.6;
    this.state.stageBanner = `SECTOR 1 — ${SECTORS[0].name}`;
    this.state.bannerTone = 'sector';
    sound.playBgm(stageTrack(1));
    this.loop = this.loop.bind(this);
    this.animId = requestAnimationFrame(this.loop);
  }

  public stop() {
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    sound.stopBgm();
  }

  public setPaused(paused: boolean) {
    if (this.state.docked) return;
    this.state.isPaused = paused;
    if (this.onStateUpdate) this.onStateUpdate({ ...this.state });
  }

  /** Move the unspent pocket into the lab wallet. The run total stays on biomatterEarned. */
  public releaseBiomatter(): number {
    const pocket = this.state.biomatter;
    this.state.biomatter = 0;
    return pocket;
  }

  /**
   * Leave the between-sector lab and start the next crucible in this same run.
   * Returns the stage that is about to begin.
   */
  public continueFromLab(ship: ShipDef, mutations: PlayerMutations): number {
    if (!this.state.docked || this.state.stage >= SECTORS.length) return this.state.stage;

    this.ship = ship;
    this.mutations = mutations;
    const oldMax = this.state.maxHealth;
    const nextMax = this.hullMax(mutations);
    this.state.maxHealth = nextMax;
    this.state.health = Math.min(nextMax, this.state.health + Math.max(0, nextMax - oldMax));

    this.state.stage += 1;
    this.stageClock = 0;
    this.waveCursor = 0;
    this.bossSpawned = false;
    this.broodCalled = false;
    this.hiveCalled = false;
    this.cycadShed = false;
    this.cycadEnraged = false;
    this.broodEnraged = false;
    this.hiveNest = false;
    this.resetMothSchedule();
    this.centipedeTrails.clear();

    const sector = this.sector();
    this.state.sectorName = sector.name;
    this.state.wave = this.state.stage;
    this.state.stageBanner = `SECTOR ${this.state.stage} — ${sector.name}`;
    this.state.bannerTone = 'sector';
    this.bannerKind = 'intro';
    this.bannerTimer = 1.8;
    this.invincibleTimer = Math.max(this.invincibleTimer, 2);
    const heal = Math.floor(this.state.maxHealth * 0.4);
    this.state.health = Math.min(this.state.maxHealth, this.state.health + heal);
    this.addFloatingText(this.px, this.py - 28, 'HULL STABILIZED', '#38bdf8');

    this.state.docked = false;
    this.state.isPaused = false;
    if (this.onStateUpdate) this.onStateUpdate({ ...this.state });
    return this.state.stage;
  }

  private hullMax(mutations: PlayerMutations = this.mutations): number {
    let base = 100 + mutations.chitinArmor * 25;
    if (this.dailyModifier?.id === 'pod_overcharge') base = Math.floor(base * 0.75);
    return base;
  }

  private gainBiomatter(amount: number) {
    const gained = Math.max(0, Math.floor(amount));
    this.state.biomatter += gained;
    this.state.biomatterEarned += gained;
  }

  public triggerSuperBomb() {
    if (this.state.bombs <= 0 || this.state.isGameOver) return;
    this.state.bombs--;
    this.kickShake(16, -Math.PI / 2);
    this.hitStop = Math.max(this.hitStop, 0.05);
    this.input.vibrate(100);
    sound.playBombExplosion();
    this.addShockwave(this.px, this.py, 16, 300, '#7dd3fc');
    this.addShockwave(this.px, this.py, 8, 180, '#ffffff');

    // Destroy all enemy bullets and clear small enemies
    this.bullets = this.bullets.filter(b => b.isPlayer);
    for (const enemy of this.enemies) {
      const dmg = enemy.isBoss ? 250 : 800;
      enemy.hp -= dmg;
      enemy.flash = Math.max(enemy.flash ?? 0, 0.16);
      if (enemy.isBoss) this.state.bossHp = Math.max(0, enemy.hp);
      this.createSlimeExplosion(enemy.x, enemy.y, enemy.color, 16);
      this.addFloatingText(enemy.x, enemy.y, `-${dmg}`, '#f43f5e');
    }

    // Spawn massive shockwave particles
    for (let i = 0; i < 40; i++) {
      const angle = (Math.PI * 2 * i) / 40;
      const speed = 90 + Math.random() * 150;
      this.particles.push({
        x: this.px,
        y: this.py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45,
        maxLife: 0.45,
        color: '#38bdf8',
        size: 2.5 + Math.random() * 2,
        shape: 'spark'
      });
    }

    if (this.onStateUpdate) this.onStateUpdate({ ...this.state });
  }

  private loop(now: number) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    const ended = this.state.isGameOver || this.state.isVictory;
    const wasPaused = this.state.isPaused;
    const inp = this.input.poll();

    if (inp.pause && !ended && !this.state.docked) {
      this.setPaused(!this.state.isPaused);
    }

    // Skip the frame pause flips so a resume button does not also fire a bomb.
    if (!wasPaused && !this.state.isPaused && !ended) {
      this.update(dt, inp);
    }
    this.render();

    this.animId = requestAnimationFrame(this.loop);
  }

  private update(dt: number, inp: InputState) {
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      this.decayShake(dt);
      this.updateParticles(dt);
      this.updateShockwaves(dt);
      this.updateFloatingTexts(dt);
      if (this.onStateUpdate) this.onStateUpdate({ ...this.state });
      return;
    }

    if (this.alertTimer > 0) {
      this.alertTimer -= dt;
      this.decayShake(dt);
      if (this.alertTimer <= 0) this.finishAlert();
      if (this.onStateUpdate) this.onStateUpdate({ ...this.state });
      return;
    }

    this.state.gameTime += dt;

    if (inp.specialJustPressed) {
      this.triggerSuperBomb();
    }

    if (inp.togglePod) {
      this.cyclePodMode();
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.finishBanner();
    }
    if (this.state.isVictory) {
      if (this.onStateUpdate) this.onStateUpdate({ ...this.state });
      return;
    }
    const briefing = this.bannerTimer > 0;

    // 1. Player Movement & Physics
    const speedMult = 1 + this.mutations.synapticReflex * 0.15;
    const baseSpeed = (160 + this.ship.speed * 28) * speedMult;
    this.pvx = inp.x * baseSpeed;
    this.pvy = inp.y * baseSpeed;

    this.px = Math.max(24, Math.min(this.width - 40, this.px + this.pvx * dt));
    this.py = Math.max(24, Math.min(this.height - 24, this.py + this.pvy * dt));

    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt;
    }

    // 2. Pod Positioning & Rotation
    this.updatePod(dt);

    // 3. Firing & Charging
    if (!briefing) {
      this.handleShooting(dt, inp.shoot);
    }

    // 4. Update Spawning and Boss Logic
    if (!briefing) {
      this.updateSpawning(dt);
    }

    // 5. Update Entities
    this.updateBullets(dt);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateShockwaves(dt);
    this.updateFloatingTexts(dt);

    // 6. Combo Decay
    if (this.state.comboTimer > 0) {
      this.state.comboTimer -= dt;
      if (this.state.comboTimer <= 0) {
        this.state.combo = 1.0;
      }
    }

    // 7. Parallax Background Scrolling
    const scrollBase = 60 * dt * this.scrollScale;
    this.bgStarsOffset = (this.bgStarsOffset + scrollBase * 0.3) % this.width;
    this.bgHillsOffset = (this.bgHillsOffset + scrollBase * 0.8) % this.width;
    this.bgCavernOffset = (this.bgCavernOffset + scrollBase * 1.6) % this.width;
    this.bgForegroundOffset = (this.bgForegroundOffset + scrollBase * 2.4) % this.width;

    this.decayShake(dt);

    if (this.onStateUpdate) {
      this.onStateUpdate({ ...this.state });
    }
  }

  private cyclePodMode() {
    const modes: Array<'orbital' | 'forward' | 'trailing' | 'spread'> = ['orbital', 'forward', 'trailing', 'spread'];
    const idx = modes.indexOf(this.podMode);
    this.podMode = modes[(idx + 1) % modes.length];
    this.state.podMode = this.podMode;
    sound.playPodModeSwitch();
    this.addFloatingText(this.px, this.py - 24, `POD: ${this.podMode.toUpperCase()}`, '#38bdf8');
  }

  private steerPod(dt: number, targetAngle: number) {
    let diff = targetAngle - this.podAngle;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.podAngle += diff * Math.min(1, dt * 16);
  }

  private updatePod(dt: number) {
    const stick = this.input.aimVector;
    const mouse = stick ? null : this.input.mousePos;
    const aimAt = (originX: number, originY: number) => {
      if (stick) {
        // Right stick uses the canvas frame: +x right, +y down.
        this.steerPod(dt, Math.atan2(stick.y, stick.x));
        return;
      }
      if (!mouse) return;
      this.steerPod(dt, Math.atan2(mouse.y - originY, mouse.x - originX));
    };

    if (this.podMode === 'forward') {
      this.podX = this.px + 40;
      this.podY = this.py + Math.sin(this.state.gameTime * 6) * 4;
      aimAt(this.podX, this.podY);
      return;
    }

    if (this.podMode === 'trailing') {
      this.podX = this.px - 36;
      this.podY = this.py + Math.sin(this.state.gameTime * 4) * 6;
      aimAt(this.px, this.py);
      return;
    }

    if (this.podMode === 'spread') {
      this.podAngle += dt * 5.2;
      const radius = 56;
      this.podX = this.px + Math.cos(this.podAngle) * radius;
      this.podY = this.py + Math.sin(this.podAngle) * radius;
      return;
    }

    if (stick || mouse) {
      aimAt(this.px, this.py);
    } else {
      this.podAngle += dt * 3.5;
    }

    const radius = 42;
    this.podX = this.px + Math.cos(this.podAngle) * radius;
    this.podY = this.py + Math.sin(this.podAngle) * radius;
  }

  private handleShooting(dt: number, shootHeld: boolean) {
    if (this.shootCooldown > 0) {
      this.shootCooldown -= dt;
    }

    // Charging mechanism
    if (shootHeld) {
      this.isCharging = true;
      const overcharge = this.dailyModifier?.id === 'pod_overcharge' ? 2 : 1;
      const chargeSpeed = (28 + this.ship.chargeSpeed * 8) * (1 + this.mutations.podOverclock * 0.1) * overcharge;
      this.chargeLevel = Math.min(100, this.chargeLevel + chargeSpeed * dt);
      this.state.charge = Math.floor(this.chargeLevel);
      this.state.isCharging = true;

      // Escalating bio-reactor charge sound
      this.chargeHumTimer += dt;
      if (this.chargeHumTimer >= 0.08) {
        this.chargeHumTimer = 0;
        sound.playChargeHum(this.chargeLevel);
      }

      // Crisp full-charge audio notification
      if (this.chargeLevel >= 85 && !this.chargeReadyPlayed) {
        sound.playChargeReady();
        this.chargeReadyPlayed = true;
      }

      // Regular rapid fire while holding
      if (this.shootCooldown <= 0) {
        this.firePrimaryBullet();
        const baseInterval = 0.18 - this.ship.firePower * 0.015;
        this.shootCooldown = Math.max(0.08, baseInterval);
      }
    } else {
      // Released fire button
      if (this.isCharging) {
        if (this.chargeLevel >= 85) {
          this.fireChargedBlast();
        }
        this.chargeLevel = 0;
        this.isCharging = false;
        this.state.charge = 0;
        this.state.isCharging = false;
        this.chargeReadyPlayed = false;
      }
    }
  }

  private firePrimaryBullet() {
    const pDmg = (12 + this.mutations.plasmaPiercing * 4) * this.rankDamage;
    sound.playShipFire(this.ship.id);

    if (this.ship.id === 'orestes') {
      // Twin pulse lasers
      this.bullets.push({
        x: this.px + 16,
        y: this.py - 6,
        vx: 600,
        vy: 0,
        radius: 4,
        damage: pDmg,
        isPlayer: true,
        color: '#38bdf8',
        type: 'plasma'
      });
      this.bullets.push({
        x: this.px + 16,
        y: this.py + 6,
        vx: 600,
        vy: 0,
        radius: 4,
        damage: pDmg,
        isPlayer: true,
        color: '#38bdf8',
        type: 'plasma'
      });
    } else if (this.ship.id === 'electra') {
      // Triple stinger spread
      this.bullets.push({
        x: this.px + 16,
        y: this.py,
        vx: 620,
        vy: 0,
        radius: 3.5,
        damage: pDmg * 0.8,
        isPlayer: true,
        color: '#4ade80',
        type: 'spore'
      });
      this.bullets.push({
        x: this.px + 12,
        y: this.py - 8,
        vx: 590,
        vy: -110,
        radius: 3.5,
        damage: pDmg * 0.8,
        isPlayer: true,
        color: '#4ade80',
        type: 'spore'
      });
      this.bullets.push({
        x: this.px + 12,
        y: this.py + 8,
        vx: 590,
        vy: 110,
        radius: 3.5,
        damage: pDmg * 0.8,
        isPlayer: true,
        color: '#4ade80',
        type: 'spore'
      });
    } else if (this.ship.id === 'hiob') {
      // Heavy seismic acid mortar
      this.bullets.push({
        x: this.px + 18,
        y: this.py,
        vx: 520,
        vy: 0,
        radius: 6,
        damage: pDmg * 1.5,
        isPlayer: true,
        color: '#e879f9',
        pierce: 1,
        type: 'acid'
      });
    } else if (this.ship.id === 'pyron') {
      // Thermal wave blasters
      this.bullets.push({
        x: this.px + 16,
        y: this.py - 4,
        vx: 580,
        vy: -40,
        radius: 5,
        damage: pDmg * 1.2,
        isPlayer: true,
        color: '#f0abfc',
        type: 'plasma'
      });
      this.bullets.push({
        x: this.px + 16,
        y: this.py + 4,
        vx: 580,
        vy: 40,
        radius: 5,
        damage: pDmg * 1.2,
        isPlayer: true,
        color: '#f0abfc',
        type: 'plasma'
      });
    }

    const aimAngle = (this.input.aimVector || this.input.mousePos || this.podMode === 'spread') ? this.podAngle : 0;
    const podDmg = (12 + this.mutations.podOverclock * 5) * this.rankDamage;
    const podFireSpeed = this.podMode === 'forward' ? 720 : 660;
    const spreads = this.podMode === 'spread' ? [-0.32, 0, 0.32] : [0];
    for (const offset of spreads) {
      const angle = aimAngle + offset;
      this.bullets.push({
        x: this.podX + Math.cos(angle) * 8,
        y: this.podY + Math.sin(angle) * 8,
        vx: Math.cos(angle) * podFireSpeed,
        vy: Math.sin(angle) * podFireSpeed,
        radius: this.podMode === 'forward' ? 4.5 : 3.5,
        damage: podDmg * (this.podMode === 'forward' ? 1.3 : 1),
        isPlayer: true,
        color: '#a855f7',
        type: 'laser'
      });
    }
    sound.playPodFire();
  }

  private fireChargedBlast() {
    sound.playChargeRelease();
    this.input.vibrate(60);
    this.kickShake(8, Math.PI);

    const chargeDmg = (90 + this.mutations.podOverclock * 25 + this.mutations.plasmaPiercing * 15) * this.rankDamage;
    const aimAngle = (this.input.aimVector || this.input.mousePos) ? this.podAngle : 0;

    // Launch heavy piercing mega beam along aimed pod vector
    this.bullets.push({
      x: this.podX + Math.cos(aimAngle) * 16,
      y: this.podY + Math.sin(aimAngle) * 16,
      vx: Math.cos(aimAngle) * 780,
      vy: Math.sin(aimAngle) * 780,
      radius: 16,
      damage: chargeDmg,
      isPlayer: true,
      color: '#38bdf8',
      pierce: 99,
      type: 'charged'
    });

    // Secondary radial spores spread relative to aim angle
    for (let i = -2; i <= 2; i++) {
      const spreadAngle = aimAngle + i * 0.16;
      this.bullets.push({
        x: this.podX,
        y: this.podY,
        vx: Math.cos(spreadAngle) * 650,
        vy: Math.sin(spreadAngle) * 650,
        radius: 6,
        damage: chargeDmg * 0.4,
        isPlayer: true,
        color: '#c084fc',
        pierce: 2,
        type: 'spore'
      });
    }

    this.addFloatingText(this.podX, this.podY - 20, 'BIO-CHARGED!', '#38bdf8');
  }

  private sector(): SectorDef {
    const index = Math.max(0, Math.min(SECTORS.length - 1, this.state.stage - 1));
    return SECTORS[index];
  }

  private scaleHp(hp: number): number {
    const stageScale = 1 + (this.state.stage - 1) * 0.28;
    return Math.max(1, Math.round(hp * stageScale * this.enemyHpScale));
  }

  private spawnHostile(bullet: Bullet) {
    bullet.vx *= this.bulletScale;
    bullet.vy *= this.bulletScale;
    this.bullets.push(bullet);
  }

  private kickShake(mag: number, angle: number) {
    this.shakeX += Math.cos(angle) * mag;
    this.shakeY += Math.sin(angle) * mag;
  }

  private decayShake(dt: number) {
    const decay = Math.exp(-dt * 16);
    this.shakeX *= decay;
    this.shakeY *= decay;
    if (Math.abs(this.shakeX) < 0.05) this.shakeX = 0;
    if (Math.abs(this.shakeY) < 0.05) this.shakeY = 0;
  }

  private addShockwave(x: number, y: number, radius: number, maxRadius: number, color: string) {
    this.shockwaves.push({
      x,
      y,
      radius,
      maxRadius,
      life: 0.5,
      maxLife: 0.5,
      color
    });
  }

  private updateShockwaves(dt: number) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const wave = this.shockwaves[i];
      wave.life -= dt;
      wave.radius += (wave.maxRadius - wave.radius) * Math.min(1, dt * 7);
      if (wave.life <= 0) this.shockwaves.splice(i, 1);
    }
  }

  private raiseAlert(text: string, seconds: number, thenBossMusic = false) {
    if (this.bannerTimer > 0) return;
    this.alertText = text;
    this.alertTimer = seconds;
    this.alertThenBossMusic = this.alertThenBossMusic || thenBossMusic;
    this.state.stageBanner = text;
    this.state.bannerTone = 'alert';
  }

  private finishAlert() {
    if (this.alertText && this.state.stageBanner === this.alertText) {
      this.state.stageBanner = '';
      this.state.bannerTone = 'sector';
    }
    this.alertText = '';
    const playBoss = this.alertThenBossMusic;
    this.alertThenBossMusic = false;
    if (playBoss) sound.playBgm('boss');
  }

  private finishBanner() {
    if (this.bannerKind === 'clear') {
      this.bannerKind = null;
      this.state.stageBanner = '';
      this.handleVictory();
      return;
    }

    this.bannerKind = null;
    this.state.stageBanner = '';
  }

  private beginSectorClear() {
    this.enemies = [];
    this.bullets = [];
    this.state.isBossActive = false;
    this.state.bossHp = 0;
    this.state.bossPhase = 0;
    this.alertTimer = 0;
    this.alertText = '';
    this.alertThenBossMusic = false;
    this.kickShake(8, -Math.PI / 2);
    this.state.score += 4000 * this.state.stage;
    this.gainBiomatter(50);
    this.addFloatingText(this.width / 2 - 20, this.height / 2, 'SECTOR CLEAR', '#22c55e');

    const lastSector = this.state.stage >= SECTORS.length;
    if (lastSector) {
      this.bannerKind = 'clear';
      this.bannerTimer = 2.3;
      this.state.stageBanner = `SECTOR ${this.state.stage} CLEARED`;
      this.state.bannerTone = 'sector';
      this.invincibleTimer = 2.6;
      return;
    }

    for (const pickup of this.pickups) {
      if (pickup.type === 'biomatter') this.gainBiomatter(pickup.value);
      else if (pickup.type === 'shield_restore') {
        this.state.health = Math.min(this.state.maxHealth, this.state.health + 35);
      } else if (pickup.type === 'super_bomb') {
        this.state.bombs = Math.min(5, this.state.bombs + 1);
      }
    }
    this.pickups = [];
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.shakeX = 0;
    this.shakeY = 0;
    this.bannerKind = null;
    this.bannerTimer = 0;
    this.state.stageBanner = '';
    this.state.docked = true;
    this.state.isPaused = true;
    sound.stopBgm();
  }

  // Spawning logic
  private updateSpawning(dt: number) {
    if (this.bossSpawned || this.bannerTimer > 0) return;

    const pace = this.dailyModifier?.id === 'acid_swarm' ? 1.28 : 1;
    this.stageClock += dt * pace;

    const sector = this.sector();
    const script = sector.script;
    while (this.waveCursor < script.length && this.stageClock >= script[this.waveCursor].at) {
      this.playBeat(script[this.waveCursor]);
      this.waveCursor++;
    }

    const lastAt = script.length > 0 ? script[script.length - 1].at : 0;
    this.updateMothSwarms(script.length > 0 && this.waveCursor >= script.length, lastAt, sector.breath);
    const scriptDone = this.waveCursor >= script.length && this.stageClock >= lastAt + sector.breath;
    if (scriptDone || this.stageClock >= sector.timeLimit) {
      this.spawnBoss();
    }
  }

  private laneY(lane: number | undefined, fallback = 0.5): number {
    const t = Math.max(0, Math.min(1, lane ?? fallback));
    return 52 + t * (this.height - 104);
  }

  private playBeat(beat: WaveBeat) {
    const y = this.laneY(beat.lane);
    switch (beat.kind) {
      case 'swarm':
        this.spawnSwarm(y);
        break;
      case 'wasp':
        this.spawnWasp(y);
        break;
      case 'crawler':
        this.spawnCrawler((beat.lane ?? 0.5) < 0.5);
        break;
      case 'crawler_pair':
        this.spawnCrawler(true);
        this.spawnCrawler(false);
        break;
      case 'jelly':
        this.spawnJelly(y);
        break;
      case 'hornet':
        this.spawnHornet(y);
        break;
      case 'nautilus':
        this.spawnNautilus(y);
        break;
      case 'centipede':
        this.spawnCentipede(y);
        break;
      case 'spitter':
        this.spawnSpitter(y);
        break;
      case 'pincer':
        this.spawnWasp(y);
        this.spawnSwarm(this.laneY((beat.lane ?? 0.5) + 0.22));
        break;
      case 'moths':
        this.spawnMothSwarm(y);
        break;
    }
  }

  // Moth swarms: quick pressure bursts at the sector opening, in the lull before
  // the boss, and every so often mid-sector. They scale gently with the sector.
  private resetMothSchedule() {
    // First burst right after the briefing, then roughly every 18-32 seconds.
    this.nextMothAt = 2.6;
    this.mothLullDone = false;
  }

  private mothInterval(): number {
    const stage = this.state.stage;
    const base = Math.max(17, 30 - (stage - 1) * 3);
    return base + Math.random() * 6;
  }

  private updateMothSwarms(scriptDone: boolean, lastAt: number, breath: number) {
    if (!scriptDone && this.stageClock >= this.nextMothAt) {
      this.spawnMothSwarm(this.laneY(0.15 + Math.random() * 0.7));
      this.nextMothAt = this.stageClock + this.mothInterval();
    }
    // Between the last wave and the boss: one parting swarm.
    if (scriptDone && !this.mothLullDone && this.stageClock >= lastAt + Math.min(2, breath * 0.35)) {
      this.mothLullDone = true;
      this.spawnMothSwarm(this.laneY(0.2 + Math.random() * 0.6));
    }
  }

  private spawnMothSwarm(y: number) {
    const stage = this.state.stage;
    // S1: 12-14 moths, +2 per sector, capped at 20 (S5).
    const count = Math.min(20, 12 + (stage - 1) * 2 + Math.floor(Math.random() * 3));
    const speed = 290 + (stage - 1) * 18;
    this.addFloatingText(this.width - 96, Math.max(28, Math.min(this.height - 28, y - 30)), 'MOTH SWARM', '#e9d5ff');
    for (let i = 0; i < count; i++) {
      // Loose cloud: staggered depth so they arrive as a flutter, not a wall.
      const dx = i * 8 + Math.random() * 14;
      const dy = (Math.random() - 0.5) * 90;
      this.enemies.push({
        id: this.nextEnemyId++,
        x: this.width + 20 + dx,
        y: Math.max(30, Math.min(this.height - 30, y + dy)),
        vx: -(speed + Math.random() * 40),
        vy: (Math.random() - 0.5) * 60,
        hp: 1,
        maxHp: 1,
        width: 16,
        height: 14,
        type: 'moth',
        color: '#e7e5e4',
        scoreValue: 80,
        shootCooldown: 999,
        shootInterval: 999,
        patternParam: Math.random() * Math.PI * 2,
        moth: {
          phase: 'approach',
          timer: 0,
          life: 0,
          orbitAngle: Math.random() * Math.PI * 2,
          orbitRadius: 32 + Math.random() * 20,
          orbitSpin: (Math.random() < 0.5 ? -1 : 1) * (2.6 + Math.random() * 1.6),
          orbitTime: Math.max(1.1, 2.4 - (stage - 1) * 0.15) + Math.random() * 0.9,
          jitter: Math.random() * Math.PI * 2
        }
      });
    }
  }

  /**
   * Moths steer at the pod's light. They arrive, mill around it in a wobbling ring
   * (which is where they threaten the ship), then dive into the light and burn.
   * Turn rate and top speed are capped so they can be shot or dodged.
   */
  private updateMoth(e: Enemy, dt: number) {
    const stage = this.state.stage;
    const m = e.moth ?? (e.moth = {
      phase: 'approach', timer: 0, life: 0, orbitAngle: 0, orbitRadius: 40,
      orbitSpin: 3, orbitTime: 1.8, jitter: 0
    });
    m.timer += dt;
    m.life += dt;
    const t = e.patternParam;
    const toPod = Math.hypot(this.podX - e.x, this.podY - e.y);

    if (m.phase === 'approach' && (toPod < m.orbitRadius + 34 || m.timer > 3.2)) {
      m.phase = 'orbit';
      m.timer = 0;
    } else if (m.phase === 'orbit' && m.timer > m.orbitTime) {
      m.phase = 'dive';
      m.timer = 0;
    } else if (m.phase === 'dive' && m.timer > 1.1) {
      m.phase = 'flee';
      m.timer = 0;
    }
    if (m.life > 9 && m.phase !== 'flee') {
      m.phase = 'flee';
      m.timer = 0;
    }

    let tx: number;
    let ty: number;
    if (m.phase === 'dive') {
      tx = this.podX;
      ty = this.podY;
    } else if (m.phase === 'flee') {
      tx = -200;
      ty = e.y + Math.sin(t * 3 + m.jitter) * 60;
    } else {
      const angle = m.orbitAngle + t * m.orbitSpin;
      const radius = m.orbitRadius + Math.sin(t * 3.1 + m.jitter) * 8;
      tx = this.podX + Math.cos(angle) * radius;
      ty = this.podY + Math.sin(angle) * radius * 0.85;
    }
    // Per-moth jitter so the cloud mills around instead of stacking.
    tx += Math.sin(t * 11 + m.jitter) * 7;
    ty += Math.cos(t * 13 + m.jitter * 1.7) * 7;

    const maxSpeed = (m.phase === 'dive' ? 1.2 : 1) * (245 + (stage - 1) * 15);
    const accel = 620 + (stage - 1) * 45;
    const dx = tx - e.x;
    const dy = ty - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const want = m.phase === 'flee' ? maxSpeed : Math.min(maxSpeed, 50 + dist * 5);
    let steerX = (dx / dist) * want - e.vx;
    let steerY = (dy / dist) * want - e.vy;
    const steer = Math.hypot(steerX, steerY);
    const maxSteer = accel * dt;
    if (steer > maxSteer) {
      steerX = (steerX / steer) * maxSteer;
      steerY = (steerY / steer) * maxSteer;
    }
    e.vx += steerX;
    e.vy += steerY;
    // Entry speed bleeds off toward the cruising cap.
    const speed = Math.hypot(e.vx, e.vy);
    if (speed > maxSpeed) {
      const k = Math.max(maxSpeed / speed, Math.exp(-dt * 3));
      e.vx *= k;
      e.vy *= k;
    }

    // While milling around, the glare pushes them back so they circle the light
    // (and the ship) instead of instantly flying into it.
    if (m.phase === 'approach' || m.phase === 'orbit') {
      const rx = e.x - this.podX;
      const ry = e.y - this.podY;
      const rd = Math.hypot(rx, ry) || 1;
      if (rd < 30) {
        const push = (30 - rd) * 40 * dt;
        e.vx += (rx / rd) * push;
        e.vy += (ry / rd) * push;
      }
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.y = Math.max(12, Math.min(this.height - 12, e.y));
  }

  /** Moths only burn up once they commit to diving into the light. */
  private mothBurns(e: Enemy): boolean {
    const phase = e.moth?.phase;
    if (phase !== 'dive' && phase !== 'flee') return false;
    return Math.hypot(e.x - this.podX, e.y - this.podY) <= this.podRadius + 4;
  }

  private spawnSwarm(y: number) {
    const slots = [
      { dx: 0, dy: -24 },
      { dx: 34, dy: -8 },
      { dx: 68, dy: 10 },
      { dx: 16, dy: 22 },
      { dx: 50, dy: -28 },
      { dx: 86, dy: 18 }
    ];
    for (let i = 0; i < slots.length; i++) {
      const hp = this.scaleHp(25);
      const slot = slots[i];
      this.enemies.push({
        id: this.nextEnemyId++,
        x: this.width + 28 + slot.dx,
        y: Math.max(40, Math.min(this.height - 40, y + slot.dy)),
        vx: -130,
        vy: 0,
        hp,
        maxHp: hp,
        width: 24,
        height: 20,
        type: 'swarmer',
        color: '#38bdf8',
        scoreValue: 200,
        shootCooldown: 0.55 + i * 0.18,
        shootInterval: 2.2,
        patternParam: i * 0.5
      });
    }
  }

  private spawnWasp(y: number) {
    this.addWasp(y, 0);
    const wing = y < this.height / 2 ? y + 58 : y - 58;
    this.addWasp(Math.max(48, Math.min(this.height - 48, wing)), 42);
  }

  private addWasp(y: number, delayX: number) {
    const hp = this.scaleHp(35);
    this.enemies.push({
      id: this.nextEnemyId++,
      x: this.width + 30 + delayX,
      y,
      vx: -220,
      vy: 0,
      hp,
      maxHp: hp,
      width: 28,
      height: 22,
      type: 'wasp',
      color: '#f59e0b',
      scoreValue: 350,
      shootCooldown: 0.6 + delayX * 0.01,
      shootInterval: 1.8,
      patternParam: delayX
    });
  }

  private spawnCrawler(ceiling: boolean) {
    const hp = this.scaleHp(60);
    this.enemies.push({
      id: this.nextEnemyId++,
      x: this.width + 30,
      y: ceiling ? 32 : this.height - 32,
      vx: -90,
      vy: 0,
      hp,
      maxHp: hp,
      width: 32,
      height: 26,
      type: 'crawler',
      color: '#10b981',
      scoreValue: 500,
      shootCooldown: 0.5,
      shootInterval: 2.0,
      patternParam: 0
    });
  }

  private spawnJelly(y: number) {
    this.addJelly(y, 0, 0);
    const partner = y < this.height / 2 ? y + 64 : y - 64;
    this.addJelly(Math.max(56, Math.min(this.height - 56, partner)), 36, 1.1);
  }

  private addJelly(y: number, delayX: number, phase: number) {
    const hp = this.scaleHp(45);
    this.enemies.push({
      id: this.nextEnemyId++,
      x: this.width + 40 + delayX,
      y,
      vx: -70,
      vy: 0,
      hp,
      maxHp: hp,
      width: 30,
      height: 30,
      type: 'jelly',
      color: '#a855f7',
      scoreValue: 400,
      shootCooldown: 1.1 + phase,
      shootInterval: 2.5,
      patternParam: phase
    });
  }

  private spawnHornet(y: number, banner = 'WARNING: DREAD-HORNET DETECTED') {
    const hp = this.scaleHp(320);
    const lane = Math.max(70, Math.min(this.height - 70, y));
    sound.playBossAlarm();
    this.kickShake(6, Math.PI);
    this.raiseAlert(banner, 0.42);
    this.enemies.push({
      id: this.nextEnemyId++,
      x: this.width + 60,
      y: lane,
      vx: -55,
      vy: 0,
      hp,
      maxHp: hp,
      width: 76,
      height: 50,
      type: 'dread_hornet',
      color: '#f59e0b',
      scoreValue: 1800,
      shootCooldown: 0.8,
      shootInterval: 1.6,
      patternParam: 0,
      isLargeBug: true,
      name: 'DREAD-HORNET CRUISER'
    });
  }

  private spawnNautilus(y: number) {
    const hp = this.scaleHp(450);
    const lane = Math.max(70, Math.min(this.height - 70, y));
    sound.playBossAlarm();
    this.kickShake(6, Math.PI);
    this.raiseAlert('WARNING: NAUTILUS LEVIATHAN', 0.42);
    this.enemies.push({
      id: this.nextEnemyId++,
      x: this.width + 70,
      y: lane,
      vx: -45,
      vy: 0,
      hp,
      maxHp: hp,
      width: 84,
      height: 54,
      type: 'nautilus_carrier',
      color: '#10b981',
      scoreValue: 2500,
      shootCooldown: 1.0,
      shootInterval: 2.0,
      patternParam: 0,
      isLargeBug: true,
      name: 'NAUTILUS LEVIATHAN'
    });
  }

  private spawnCentipede(y: number, originX = this.width + 28) {
    const chainId = this.nextChainId++;
    const spacing = 20;
    const lane = Math.max(48, Math.min(this.height - 48, y));
    for (let i = 0; i < 8; i++) {
      const head = i === 0;
      const hp = this.scaleHp(head ? 46 : 26);
      this.enemies.push({
        id: this.nextEnemyId++,
        x: originX + i * spacing,
        y: lane,
        vx: -76,
        vy: 0,
        hp,
        maxHp: hp,
        width: head ? 26 : 20,
        height: head ? 22 : 16,
        type: 'centipede_segment',
        color: head ? '#84cc16' : '#4d7c0f',
        scoreValue: head ? 420 : 160,
        shootCooldown: head ? 0.7 : 8,
        shootInterval: head ? 1.25 : 8,
        patternParam: 0,
        chainId,
        chainIndex: i,
        homeY: lane
      });
    }
  }

  private spawnSpitter(y: number) {
    // Tanky so its wings get some screen time (was 90).
    const hp = this.scaleHp(320);
    const lane = Math.max(48, Math.min(this.height - 48, y));
    this.enemies.push({
      id: this.nextEnemyId++,
      x: this.width + 36,
      y: lane,
      vx: -90,
      vy: 0,
      hp,
      maxHp: hp,
      width: 36,
      height: 32,
      type: 'hive_spitter',
      color: '#f59e0b',
      scoreValue: 700,
      shootCooldown: 0.9,
      shootInterval: 1.45,
      patternParam: 0,
      homeY: lane,
      anchored: false,
      name: 'HIVE SPITTER'
    });
  }

  private spawnBoss() {
    this.bossSpawned = true;
    sound.playBossAlarm();
    this.kickShake(8, Math.PI);

    const sector = this.sector();
    const bossMaxHp = Math.round(sector.bossHp * this.enemyHpScale);
    this.state.isBossActive = true;
    this.state.bossHp = bossMaxHp;
    this.state.bossMaxHp = bossMaxHp;
    this.state.bossName = sector.bossName;
    this.state.bossPhase = 1;

    const interval = sector.bossType === 'boss_hive' ? 1.15 : sector.bossType === 'boss_brood' ? 1.25 : 1.4;
    this.enemies.push({
      id: 900000 + this.state.stage,
      x: this.width + 90,
      y: this.height / 2,
      vx: -60,
      vy: 0,
      hp: bossMaxHp,
      maxHp: bossMaxHp,
      width: sector.bossWidth,
      height: sector.bossHeight,
      type: sector.bossType,
      color: sector.bossColor,
      scoreValue: 8000 + this.state.stage * 4000,
      shootCooldown: 1.5,
      shootInterval: interval,
      patternParam: 0,
      isBoss: true,
      name: sector.bossName
    });

    this.raiseAlert(`BIO-ANOMALY — ${sector.bossName}`, 0.62, true);
  }

  private summonBrood(x: number, y: number) {
    this.addFloatingText(x - 30, y - 36, 'BROOD RELEASED', '#e879f9');
    for (let i = 0; i < 3; i++) {
      const hp = this.scaleHp(22);
      this.enemies.push({
        id: Date.now() + i,
        x: x - 16,
        y: y - 36 + i * 32,
        vx: -150,
        vy: 0,
        hp,
        maxHp: hp,
        width: 24,
        height: 20,
        type: 'swarmer',
        color: '#e879f9',
        scoreValue: 220,
        shootCooldown: 0.5,
        shootInterval: 1.7,
        patternParam: i
      });
    }
  }

  private summonHornet(y: number) {
    this.spawnHornet(y, 'HIVE CALLS A HORNET');
  }

  private noteBossPhase(e: Enemy, mid: number, low: number): number {
    const ratio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
    const phase = ratio <= low ? 3 : ratio <= mid ? 2 : 1;
    if (e.isBoss && phase > this.state.bossPhase && this.state.bossPhase > 0) {
      e.flash = 0.24;
      this.kickShake(10, Math.atan2(this.py - e.y, this.px - e.x));
      this.addShockwave(e.x, e.y, e.width * 0.35, e.width * 1.15, phase >= 3 ? '#fef08a' : e.color);
      this.addFloatingText(e.x - 18, e.y - e.height / 2 - 6, `PHASE ${phase}`, '#fde68a');
      sound.playBossAlarm();
    }
    if (e.isBoss) this.state.bossPhase = phase;
    return phase;
  }

  private recordTrail(chainId: number, x: number, y: number) {
    let trail = this.centipedeTrails.get(chainId);
    if (!trail) {
      trail = [];
      this.centipedeTrails.set(chainId, trail);
    }
    trail.push({ x, y });
    if (trail.length > 480) trail.splice(0, trail.length - 480);
  }

  private trailPoint(chainId: number, distance: number): { x: number; y: number } | null {
    const trail = this.centipedeTrails.get(chainId);
    if (!trail || trail.length < 2) return null;
    let remain = distance;
    for (let i = trail.length - 1; i > 0; i--) {
      const a = trail[i];
      const b = trail[i - 1];
      const step = Math.hypot(a.x - b.x, a.y - b.y);
      if (step >= remain && step > 0) {
        const t = remain / step;
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      }
      remain -= step;
    }
    return null;
  }

  private severCentipede(enemy: Enemy) {
    if (enemy.type !== 'centipede_segment' || enemy.chainId == null) return;
    if ((enemy.chainIndex ?? 0) !== 0) return;

    const siblings = this.enemies
      .filter(other => other !== enemy && other.chainId === enemy.chainId && (other.chainIndex ?? 0) > 0)
      .sort((a, b) => (a.chainIndex ?? 0) - (b.chainIndex ?? 0));

    if (siblings.length === 0) {
      this.centipedeTrails.delete(enemy.chainId);
      return;
    }

    const heir = siblings[0];
    siblings.forEach((seg, i) => {
      seg.chainIndex = i;
      seg.x = heir.x + i * 20;
      seg.y = heir.y;
      seg.homeY = heir.y;
    });
    heir.shootInterval = 1.25;
    heir.shootCooldown = Math.min(heir.shootCooldown, 0.4);
    heir.color = '#84cc16';
    heir.scoreValue = Math.max(heir.scoreValue, 420);
    heir.width = 26;
    heir.height = 22;
    this.centipedeTrails.set(enemy.chainId, [{ x: heir.x, y: heir.y }]);
  }

  private dropChainTrail(chainId: number | undefined) {
    if (chainId == null) return;
    if (!this.enemies.some(other => other.chainId === chainId)) {
      this.centipedeTrails.delete(chainId);
    }
  }

  private updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Off-screen check
      if (b.x < -40 || b.x > this.width + 40 || b.y < -40 || b.y > this.height + 40) {
        this.bullets.splice(i, 1);
        continue;
      }

      // 1. Pod Absorption Check (Only enemy bullets!)
      if (!b.isPlayer) {
        const podDist = Math.hypot(b.x - this.podX, b.y - this.podY);
        const absorbRadius = this.podRadius + 6 + this.mutations.podOverclock * 3
          + (this.podMode === 'forward' ? 14 : this.podMode === 'trailing' ? 8 : 0);
        if (podDist <= absorbRadius) {
          sound.playPodAbsorb();
          const absorbCharge = this.dailyModifier?.id === 'pod_overcharge' ? 12 : 6;
          this.chargeLevel = Math.min(100, this.chargeLevel + absorbCharge);
          this.state.charge = Math.floor(this.chargeLevel);
          this.state.score += this.dailyModifier?.id === 'acid_swarm' ? 60 : 50;

          // Absorb spark
          this.particles.push({
            x: b.x,
            y: b.y,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            life: 0.25,
            maxLife: 0.25,
            color: '#38bdf8',
            size: 4,
            shape: 'spark'
          });

          this.bullets.splice(i, 1);
          continue;
        }

        // 2. Player Hit Check
        if (this.invincibleTimer <= 0) {
          const pDist = Math.hypot(b.x - this.px, b.y - this.py);
          if (pDist <= 15) {
            this.handlePlayerHit(b.damage, b.x, b.y);
            this.bullets.splice(i, 1);
            continue;
          }
        }
      }

      // 3. Player Bullets hitting Enemies
      if (b.isPlayer) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const enemy = this.enemies[j];
          if (b.hitIds?.includes(enemy.id)) continue;
          const ex = enemy.x;
          const ey = enemy.y;
          const halfW = enemy.width / 2;
          const halfH = enemy.height / 2;

          if (b.x >= ex - halfW && b.x <= ex + halfW && b.y >= ey - halfH && b.y <= ey + halfH) {
            // Hit enemy!
            if (!b.hitIds) b.hitIds = [];
            b.hitIds.push(enemy.id);
            enemy.hp -= b.damage;
            enemy.flash = 0.09;
            sound.playChitinHit(enemy.isBoss || enemy.isLargeBug, enemy.isLargeBug);

            // Sparks
            this.createSlimeExplosion(b.x, b.y, enemy.color, 4);

            if (enemy.isBoss) {
              this.state.bossHp = Math.max(0, enemy.hp);
            }

            // Check if enemy died from this hit
            const isDead = enemy.hp <= 0;
            if (isDead) {
              this.handleEnemyKilled(enemy, j);
            }

            // If bullet doesn't pierce, consume it
            if (!b.pierce || b.pierce <= 1) {
              this.bullets.splice(i, 1);
              break;
            } else {
              b.pierce--;
            }

            if (isDead) {
              break;
            }
          }
        }
      }
    }
  }

  private updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.flash) e.flash = Math.max(0, e.flash - dt);

      // Failsafe: eliminate any enemy whose HP is zero or negative
      if (e.hp <= 0) {
        this.handleEnemyKilled(e, i);
        continue;
      }

      e.patternParam += dt;

      // Enemy AI Movements
      if (e.type === 'swarmer') {
        e.x += e.vx * dt;
        e.y += Math.sin(e.patternParam * 3.5) * 90 * dt;
      } else if (e.type === 'wasp') {
        e.x += e.vx * dt;
        // Dive toward player
        if (e.x > this.px + 50) {
          const targetY = this.py;
          e.y += (targetY - e.y) * 2.0 * dt;
        }
      } else if (e.type === 'crawler') {
        e.x += e.vx * dt;
      } else if (e.type === 'jelly') {
        e.x += e.vx * dt;
        e.y += Math.sin(e.patternParam * 1.5) * 40 * dt;
      } else if (e.type === 'moth') {
        this.updateMoth(e, dt);
        // Fly into the flame and burn up.
        if (this.mothBurns(e)) {
          e.hp = 0;
          this.addShockwave(e.x, e.y, 2, 16, '#e9d5ff');
          this.handleEnemyKilled(e, i);
          continue;
        }
      } else if (e.type === 'dread_hornet') {
        // Giant Dread-Hornet Cruiser: slow forward weave with wing-flutter turbulence
        e.x += e.vx * dt;
        e.y += Math.sin(e.patternParam * 2.2) * 55 * dt;
      } else if (e.type === 'nautilus_carrier') {
        // Giant Nautilus Leviathan Carrier: armored forward surge
        e.x += e.vx * dt;
        e.y += Math.sin(e.patternParam * 1.3) * 35 * dt;
      } else if (e.type === 'centipede_segment') {
        const index = e.chainIndex ?? 0;
        if (index === 0) {
          e.x += e.vx * dt;
          const home = e.homeY ?? e.y;
          e.y = Math.max(26, Math.min(this.height - 26, home + Math.sin(e.patternParam * 2.5) * 34));
          if (e.chainId != null) this.recordTrail(e.chainId, e.x, e.y);
        } else if (e.chainId != null) {
          const sample = this.trailPoint(e.chainId, index * 20);
          if (sample) {
            const k = Math.min(1, dt * 16);
            e.x += (sample.x - e.x) * k;
            e.y += (sample.y - e.y) * k;
          } else {
            e.x += e.vx * dt;
            const home = e.homeY ?? e.y;
            e.y = home + Math.sin(e.patternParam * 2.5) * 34;
          }
        } else {
          e.x += e.vx * dt;
        }
      } else if (e.type === 'hive_spitter') {
        if (e.vx < 0 && e.x > this.width - 76) {
          e.x += e.vx * dt;
          if (e.x <= this.width - 76) {
            e.x = this.width - 76;
            e.vx = 0;
            e.anchored = true;
          }
        } else if (e.anchored) {
          const home = e.homeY ?? e.y;
          e.y = home + Math.sin(e.patternParam * 1.5) * 14;
          if (e.patternParam > 13) {
            e.anchored = false;
            e.vx = -80;
          }
        } else {
          e.x += e.vx * dt;
        }
      } else if (e.type === 'boss_centipede') {
        const phase = this.noteBossPhase(e, 0.66, 0.33);
        e.shootInterval = phase === 3 ? 0.95 : phase === 2 ? 1.15 : 1.4;
        if (e.x > this.width - 120) {
          e.x += e.vx * dt;
        } else {
          const freq = phase === 3 ? 3.8 : phase === 2 ? 3.0 : 2.2;
          const amp = phase === 3 ? 132 : phase === 2 ? 122 : 110;
          e.y = this.height / 2 + Math.sin(e.patternParam * freq) * amp;
          e.x = (this.width - 130) + Math.cos(e.patternParam * (1.4 + phase * 0.25)) * (40 + phase * 8);
        }
        if (phase >= 2 && !this.cycadShed) {
          this.cycadShed = true;
          this.addFloatingText(e.x - 20, e.y - 46, 'CARAPACE SHED', '#86efac');
          this.spawnCentipede(Math.max(64, Math.min(this.height - 64, e.y - 20)), e.x - 36);
        }
        if (phase >= 3 && !this.cycadEnraged) {
          this.cycadEnraged = true;
          this.addFloatingText(e.x - 10, e.y - 46, 'SPINE VOLLEY', '#facc15');
        }
      } else if (e.type === 'boss_brood') {
        const phase = this.noteBossPhase(e, 0.55, 0.3);
        e.shootInterval = phase === 3 ? 0.92 : phase === 2 ? 1.08 : 1.25;
        if (e.x > this.width - 140) {
          e.x += e.vx * dt;
        } else {
          const freq = phase === 3 ? 2.15 : phase === 2 ? 1.7 : 1.35;
          e.y = this.height / 2 + Math.sin(e.patternParam * freq) * (118 + phase * 6);
          e.x = (this.width - 150) + Math.cos(e.patternParam * (0.9 + phase * 0.15)) * (26 + phase * 6);
        }
        if (phase >= 2 && !this.broodCalled) {
          this.broodCalled = true;
          this.summonBrood(e.x, e.y);
        }
        if (phase >= 3 && !this.broodEnraged) {
          this.broodEnraged = true;
          this.addFloatingText(e.x - 16, e.y - 48, 'SECOND BROOD', '#f0abfc');
          this.summonBrood(e.x, e.y + 16);
        }
      } else if (e.type === 'boss_hive') {
        const phase = this.noteBossPhase(e, 0.58, 0.35);
        e.shootInterval = phase === 3 ? 0.82 : phase === 2 ? 1.0 : 1.15;
        const hoverFor = phase === 3 ? 2.6 : phase === 2 ? 3.4 : 4.6;
        const cycle = e.patternParam % (hoverFor + 2.5);
        if (cycle < hoverFor) {
          if (e.x > this.width - 150) {
            e.x += e.vx * dt;
          } else {
            const hoverY = this.height / 2 + Math.sin(e.patternParam * (1.1 + phase * 0.25)) * (100 + phase * 8);
            e.y += (hoverY - e.y) * 2 * dt;
            e.x += ((this.width - 155) - e.x) * 2 * dt;
          }
        } else {
          const dive = phase === 3 ? 2.4 : 1.5;
          e.x += (this.px + 96 - e.x) * dive * dt;
          e.y += (this.py - e.y) * (phase === 3 ? 2.4 : 1.8) * dt;
          e.x = Math.max(190, Math.min(this.width - 36, e.x));
        }
        if (phase >= 2 && !this.hiveCalled) {
          this.hiveCalled = true;
          this.summonHornet(e.y);
        }
        if (phase >= 3 && !this.hiveNest) {
          this.hiveNest = true;
          this.addFloatingText(e.x - 10, e.y - 50, 'NEST OPENS', '#fbbf24');
          this.spawnSpitter(e.y > this.height / 2 ? 78 : this.height - 78);
        }
      }

      // Enemy Shooting logic
      e.shootCooldown -= dt;
      if (e.shootCooldown <= 0 && e.x < this.width + 10) {
        e.shootCooldown = e.shootInterval;
        this.fireEnemyBullet(e);
      }

      // Check collision with player
      if (this.invincibleTimer <= 0) {
        const dist = Math.hypot(e.x - this.px, e.y - this.py);
        if (dist <= (e.width / 2 + 12)) {
          this.handlePlayerHit(e.isBoss ? 45 : e.isLargeBug ? 50 : e.type === 'moth' ? 12 + this.state.stage * 2 : 35, e.x, e.y);
          if (!e.isBoss) {
            e.hp -= 50;
            if (e.hp <= 0) {
              this.handleEnemyKilled(e, i);
              continue;
            }
          }
        }
      }

      // Despawn off-screen left
      if (e.x < -100 && !e.isBoss) {
        this.severCentipede(e);
        const chainId = e.chainId;
        this.enemies.splice(i, 1);
        this.dropChainTrail(chainId);
        continue;
      }
      if (this.pendingSectorClear) break;
    }

    if (this.pendingSectorClear) {
      this.pendingSectorClear = false;
      this.beginSectorClear();
    }
  }

  private fireEnemyBullet(e: Enemy) {
    if (e.type === 'swarmer') {
      sound.playEnemyAcidSpit();
      this.spawnHostile({
        x: e.x - 10,
        y: e.y,
        vx: -240,
        vy: 0,
        radius: 4,
        damage: 15,
        isPlayer: false,
        color: '#f97316',
        type: 'acid'
      });
    } else if (e.type === 'wasp') {
      // Aim at player
      sound.playEnemyAcidSpit();
      const angle = Math.atan2(this.py - e.y, this.px - e.x);
      this.spawnHostile({
        x: e.x - 12,
        y: e.y,
        vx: Math.cos(angle) * 280,
        vy: Math.sin(angle) * 280,
        radius: 4,
        damage: 20,
        isPlayer: false,
        color: '#ef4444',
        type: 'spore'
      });
    } else if (e.type === 'crawler') {
      // Arc shot toward player
      sound.playEnemyAcidSpit();
      this.spawnHostile({
        x: e.x,
        y: e.y,
        vx: -220,
        vy: (e.y < this.height / 2 ? 140 : -140),
        radius: 5,
        damage: 22,
        isPlayer: false,
        color: '#22c55e',
        type: 'acid'
      });
    } else if (e.type === 'jelly') {
      // 4-way spore ring
      sound.playEnemySporeBlast();
      for (let k = 0; k < 4; k++) {
        const a = (Math.PI * 2 * k) / 4;
        this.spawnHostile({
          x: e.x,
          y: e.y,
          vx: Math.cos(a) * 160,
          vy: Math.sin(a) * 160,
          radius: 4,
          damage: 15,
          isPlayer: false,
          color: '#a855f7',
          type: 'spore'
        });
      }
    } else if (e.type === 'dread_hornet') {
      // Dread-Hornet Cruiser: Twin burning spore blasters
      sound.playEnemySporeBlast();
      for (let k = -1; k <= 1; k += 2) {
        const angle = Math.atan2(this.py - (e.y + k * 14), this.px - (e.x - 20));
        this.spawnHostile({
          x: e.x - 28,
          y: e.y + k * 14,
          vx: Math.cos(angle) * 270,
          vy: Math.sin(angle) * 270,
          radius: 5.5,
          damage: 24,
          isPlayer: false,
          color: '#f59e0b',
          type: 'acid'
        });
      }
    } else if (e.type === 'nautilus_carrier') {
      // Nautilus Leviathan Bug Carrier: 6-way spiral venom burst
      sound.playEnemySporeBlast();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI * 2 * k) / 6 + e.patternParam * 2.2;
        this.spawnHostile({
          x: e.x - 24,
          y: e.y,
          vx: Math.cos(a) * 190,
          vy: Math.sin(a) * 190,
          radius: 5,
          damage: 22,
          isPlayer: false,
          color: '#10b981',
          type: 'spore'
        });
      }
    } else if (e.type === 'centipede_segment') {
      if ((e.chainIndex ?? 0) !== 0) return;
      sound.playEnemyAcidSpit();
      const aim = Math.atan2(this.py - e.y, this.px - e.x);
      for (const offset of [-0.14, 0.14]) {
        const angle = aim + offset;
        this.spawnHostile({
          x: e.x - 12,
          y: e.y,
          vx: Math.cos(angle) * 250,
          vy: Math.sin(angle) * 250,
          radius: 4,
          damage: 16,
          isPlayer: false,
          color: '#a3e635',
          type: 'acid'
        });
      }
    } else if (e.type === 'hive_spitter') {
      sound.playEnemyAcidSpit();
      const aim = Math.atan2(this.py - e.y, this.px - e.x);
      for (let k = -1; k <= 1; k++) {
        const angle = aim + k * 0.14;
        this.spawnHostile({
          x: e.x - 18,
          y: e.y,
          vx: Math.cos(angle) * 230,
          vy: Math.sin(angle) * 230,
          radius: 4.5,
          damage: 18,
          isPlayer: false,
          color: '#fbbf24',
          type: 'spore'
        });
      }
    } else if (e.type === 'boss_centipede') {
      sound.playEnemySporeBlast();
      const phase = this.noteBossPhase(e, 0.66, 0.33);
      const count = phase === 3 ? 7 : phase === 2 ? 6 : 5;
      const step = phase === 3 ? 0.18 : 0.22;
      const speed = 300 + phase * 18;
      for (let k = 0; k < count; k++) {
        const spread = (k - (count - 1) / 2) * step;
        const angle = Math.PI + spread;
        this.spawnHostile({
          x: e.x - 30,
          y: e.y + (k % 2 === 0 ? -15 : 15),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 5.5,
          damage: 25,
          isPlayer: false,
          color: phase === 3 ? '#bef264' : '#22c55e',
          type: 'acid'
        });
      }
      if (phase >= 3) {
        const aim = Math.atan2(this.py - e.y, this.px - e.x);
        this.spawnHostile({
          x: e.x - 40,
          y: e.y,
          vx: Math.cos(aim) * 360,
          vy: Math.sin(aim) * 360,
          radius: 6.5,
          damage: 28,
          isPlayer: false,
          color: '#fef08a',
          type: 'spore'
        });
      }
    } else if (e.type === 'boss_brood') {
      sound.playEnemySporeBlast();
      const phase = this.noteBossPhase(e, 0.55, 0.3);
      const aimed = Math.atan2(this.py - e.y, this.px - e.x);
      const petals = phase === 3 ? 5 : 3;
      for (let k = 0; k < petals; k++) {
        const angle = aimed + (k - (petals - 1) / 2) * (phase === 3 ? 0.16 : 0.2);
        this.spawnHostile({
          x: e.x - 36,
          y: e.y,
          vx: Math.cos(angle) * (290 + phase * 20),
          vy: Math.sin(angle) * (290 + phase * 20),
          radius: 5,
          damage: 22,
          isPlayer: false,
          color: '#e879f9',
          type: 'spore'
        });
      }
      const ring = phase >= 2 || Math.floor(e.patternParam / Math.max(0.2, e.shootInterval)) % 2 === 0;
      if (ring) {
        const ringCount = phase === 3 ? 10 : 8;
        const ringSpeed = phase === 3 ? 165 : 145;
        for (let k = 0; k < ringCount; k++) {
          const angle = (Math.PI * 2 * k) / ringCount + e.patternParam;
          this.spawnHostile({
            x: e.x,
            y: e.y,
            vx: Math.cos(angle) * ringSpeed,
            vy: Math.sin(angle) * ringSpeed,
            radius: 4,
            damage: 16,
            isPlayer: false,
            color: '#f0abfc',
            type: 'spore'
          });
        }
      }
    } else if (e.type === 'boss_hive') {
      sound.playEnemySporeBlast();
      const phase = this.noteBossPhase(e, 0.58, 0.35);
      const count = phase === 3 ? 11 : phase === 2 ? 9 : 7;
      const speed = phase === 3 ? 230 : phase === 2 ? 195 : 170;
      for (let k = 0; k < count; k++) {
        const angle = e.patternParam * (1.6 + phase * 0.3) + (Math.PI * 2 * k) / count;
        this.spawnHostile({
          x: e.x - 18,
          y: e.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 5,
          damage: 20,
          isPlayer: false,
          color: '#f59e0b',
          type: 'acid'
        });
      }
      const aim = Math.atan2(this.py - e.y, this.px - e.x);
      this.spawnHostile({
        x: e.x - 40,
        y: e.y,
        vx: Math.cos(aim) * (320 + phase * 20),
        vy: Math.sin(aim) * (320 + phase * 20),
        radius: 6.5,
        damage: 28,
        isPlayer: false,
        color: '#fef08a',
        type: 'spore'
      });
    }
  }

  private handleEnemyKilled(enemy: Enemy, index: number) {
    this.severCentipede(enemy);
    this.enemies.splice(index, 1);
    this.dropChainTrail(enemy.chainId);
    sound.playEnemyExplode(enemy.isBoss, enemy.isLargeBug);
    this.input.vibrate(enemy.isBoss ? 80 : enemy.isLargeBug ? 50 : 30);

    // Multi-stage chain detonations for large bug cruisers
    if (enemy.isBoss) {
      this.hitStop = Math.max(this.hitStop, 0.06);
      this.kickShake(16, Math.atan2(this.py - enemy.y, this.px - enemy.x));
      this.addShockwave(enemy.x, enemy.y, 18, 220, '#fef08a');
    }

    if (enemy.isLargeBug) {
      this.kickShake(12, Math.PI);
      for (let k = 1; k <= 3; k++) {
        setTimeout(() => {
          sound.playEnemyExplode(false, false);
          this.createSlimeExplosion(
            enemy.x + (Math.random() - 0.5) * 45,
            enemy.y + (Math.random() - 0.5) * 35,
            enemy.color,
            16
          );
        }, k * 110);
      }
    }

    // Score & Combo
    this.state.combo = Math.min(4.0, this.state.combo + 0.1);
    this.state.comboTimer = 2.5;

    const modMultiplier = this.dailyModifier?.multiplier || 1.0;
    const gainedScore = Math.floor(enemy.scoreValue * this.state.combo * modMultiplier);
    this.state.score += gainedScore;

    this.addFloatingText(enemy.x, enemy.y - 12, `+${gainedScore}`, '#facc15');
    this.createSlimeExplosion(enemy.x, enemy.y, enemy.color, enemy.isBoss ? 45 : 14);

    if (!enemy.isBoss && this.dailyModifier?.id === 'armored_colossus') {
      for (const other of this.enemies) {
        if (other.isBoss) continue;
        if (Math.hypot(other.x - enemy.x, other.y - enemy.y) < 58) {
          other.hp -= 16;
        }
      }
    }

    if (!enemy.isBoss && this.dailyModifier?.id === 'acid_swarm') {
      for (let k = 0; k < 6; k++) {
        const angle = (Math.PI * 2 * k) / 6;
        this.spawnHostile({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle) * 90,
          vy: Math.sin(angle) * 90,
          radius: 3.5,
          damage: 12,
          isPlayer: false,
          color: '#84cc16',
          type: 'acid'
        });
      }
    }

    // Spawn Pickups
    const dropChance = (0.4 + this.mutations.sporeLeech * 0.12) * (enemy.type === 'moth' ? 0.3 : 1);
    if (enemy.isBoss || Math.random() < dropChance) {
      this.pickups.push({
        x: enemy.x,
        y: enemy.y,
        vx: -60,
        vy: (Math.random() - 0.5) * 40,
        type: enemy.isBoss ? 'super_bomb' : (Math.random() > 0.3 ? 'biomatter' : 'shield_restore'),
        value: enemy.isBoss ? 1 : (Math.random() > 0.5 ? 25 : 10),
        radius: 7
      });
    }

    if (enemy.isBoss && !this.enemies.some((other) => other.isBoss && other.hp > 0)) {
      this.pendingSectorClear = true;
    }
  }

  private handlePlayerHit(dmg: number, fromX = this.px - 36, fromY = this.py) {
    sound.playPlayerHit();
    this.input.vibrate(60);
    this.kickShake(12, Math.atan2(this.py - fromY, this.px - fromX));

    this.state.health -= dmg;
    this.invincibleTimer = 1.6;
    this.state.combo = 1.0;

    this.addFloatingText(this.px, this.py - 20, `-${dmg}`, '#ef4444');
    this.createSlimeExplosion(this.px, this.py, '#38bdf8', 12);

    if (this.state.health <= 0) {
      this.state.lives--;
      if (this.state.lives > 0) {
        this.state.health = this.state.maxHealth;
        this.invincibleTimer = 3.0;
        this.addFloatingText(this.px, this.py, 'REGENERATING BIO-HULL', '#38bdf8');
      } else {
        this.handleGameOver();
      }
    }
  }

  private handleGameOver() {
    this.state.isGameOver = true;
    sound.stopBgm();
    sound.playEnemyExplode(true);
    if (this.onStateUpdate) this.onStateUpdate({ ...this.state });
  }

  private handleVictory() {
    this.state.isVictory = true;
    this.bannerKind = null;
    this.bannerTimer = 0;
    this.state.stageBanner = '';
    sound.stopBgm();
    sound.playBgm('victory');
    this.state.score += 15000;
    this.gainBiomatter(120);
    this.addFloatingText(this.width / 2 - 40, this.height / 2, 'CRUCIBLE SECURED', '#22c55e');
    if (this.onStateUpdate) this.onStateUpdate({ ...this.state });
  }

  private updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Magnetize toward player
      const dist = Math.hypot(this.px - p.x, this.py - p.y);
      if (dist < 110) {
        p.vx += ((this.px - p.x) / dist) * 280 * dt;
        p.vy += ((this.py - p.y) / dist) * 280 * dt;
      }

      // Collect
      if (dist <= 22) {
        sound.playPickup(p.type);
        if (p.type === 'biomatter') {
          this.gainBiomatter(p.value);
          this.addFloatingText(p.x, p.y, `+${p.value} BIOMATTER`, '#10b981');
        } else if (p.type === 'shield_restore') {
          this.state.health = Math.min(this.state.maxHealth, this.state.health + 35);
          this.addFloatingText(p.x, p.y, '+SHIELD', '#38bdf8');
        } else if (p.type === 'super_bomb') {
          this.state.bombs = Math.min(5, this.state.bombs + 1);
          this.addFloatingText(p.x, p.y, '+SUPER BOMB', '#f59e0b');
        }
        this.pickups.splice(i, 1);
        continue;
      }

      if (p.x < -20) {
        this.pickups.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.life -= dt;
      if (part.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  private updateFloatingTexts(dt: number) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private addFloatingText(x: number, y: number, text: string, color: string) {
    this.floatingTexts.push({
      id: Math.random(),
      x,
      y,
      text,
      color,
      life: 0.9,
      vy: -40
    });
  }

  private createSlimeExplosion(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 140;
      const roll = Math.random();
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65,
        color,
        size: 2 + Math.random() * 4,
        shape: roll > 0.75 ? 'smoke' : roll > 0.4 ? 'slime' : 'circle'
      });
    }
    const sparks = Math.max(2, Math.floor(count / 4));
    for (let i = 0; i < sparks; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.16 + Math.random() * 0.12,
        maxLife: 0.28,
        color: '#f8fafc',
        size: 1.6,
        shape: 'spark'
      });
    }
  }

  // --- Rendering Pipeline ---
  private render() {
    const ctx = this.ctx;
    ctx.save();

    if (this.shakeX !== 0 || this.shakeY !== 0) {
      ctx.translate(this.shakeX, this.shakeY);
    }

    // 1. Clear & Background Parallax
    this.renderParallax(ctx);

    // 2. Render Pickups
    for (const p of this.pickups) {
      this.renderPickup(ctx, p);
    }

    // 3. Render Enemies
    for (const e of this.enemies) {
      this.renderEnemy(ctx, e);
    }

    // 4. Render Bullets
    for (const b of this.bullets) {
      this.renderBullet(ctx, b);
    }

    // 5. Render Player & Weapon Pod
    this.renderPlayer(ctx);
    this.renderPod(ctx);

    // 6. Render Particles
    for (const part of this.particles) {
      const alpha = Math.max(0, part.life / part.maxLife);
      ctx.globalAlpha = alpha;
      if (part.shape === 'spark') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = part.color;
        ctx.lineWidth = Math.max(1, part.size * 0.45);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(part.x, part.y);
        ctx.lineTo(part.x - part.vx * 0.045, part.y - part.vy * 0.045);
        ctx.stroke();
        ctx.restore();
      } else if (part.shape === 'slime') {
        ctx.fillStyle = part.color;
        ctx.beginPath();
        ctx.ellipse(
          part.x,
          part.y,
          part.size * 1.35,
          Math.max(1, part.size * 0.65),
          Math.atan2(part.vy, part.vx),
          0,
          Math.PI * 2
        );
        ctx.fill();
      } else if (part.shape === 'smoke') {
        ctx.fillStyle = part.color;
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.size * (1.6 - alpha * 0.4), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = part.color;
        ctx.beginPath();
        ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;

    for (const wave of this.shockwaves) {
      const alpha = Math.max(0, wave.life / wave.maxLife);
      ctx.globalAlpha = alpha * 0.28;
      ctx.fillStyle = wave.color;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
      ctx.arc(wave.x, wave.y, Math.max(1, wave.radius - 6), 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = wave.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 7. Render Floating Combat Text
    ctx.font = '10px "Press Start 2P", monospace';
    for (const ft of this.floatingTexts) {
      ctx.fillStyle = ft.color;
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x - 10, ft.y);
      ctx.shadowBlur = 0;
    }

    // 8. Aim reticle: right stick, or the mouse when the stick is idle.
    const stickAim = this.input.aimVector;
    const mouseAim = this.input.mousePos;
    if (stickAim || mouseAim) {
      const mx = stickAim ? this.px + stickAim.x * 78 : mouseAim!.x;
      const my = stickAim ? this.py + stickAim.y * 78 : mouseAim!.y;
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my, 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(mx - 12, my);
      ctx.lineTo(mx - 4, my);
      ctx.moveTo(mx + 4, my);
      ctx.lineTo(mx + 12, my);
      ctx.moveTo(mx, my - 12);
      ctx.lineTo(mx, my - 4);
      ctx.moveTo(mx, my + 4);
      ctx.lineTo(mx, my + 12);
      ctx.stroke();
    }

    ctx.restore();

    if (!this.state.isGameOver && !this.state.isVictory && this.state.maxHealth > 0) {
      const ratio = this.state.health / this.state.maxHealth;
      if (ratio <= 0.25) {
        const pulse = 0.22 + (Math.sin(Date.now() * 0.01) * 0.5 + 0.5) * 0.16;
        const vignette = ctx.createRadialGradient(
          this.width / 2,
          this.height / 2,
          this.height * 0.2,
          this.width / 2,
          this.height / 2,
          this.height * 0.78
        );
        vignette.addColorStop(0, 'rgba(127, 29, 29, 0)');
        vignette.addColorStop(1, `rgba(127, 29, 29, ${pulse.toFixed(3)})`);
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, this.width, this.height);
      }
    }
  }

  private renderParallax(ctx: CanvasRenderingContext2D) {
    renderBiome(ctx, {
      width: this.width,
      height: this.height,
      stage: this.state.stage,
      stars: this.bgStarsOffset,
      hills: this.bgHillsOffset,
      cavern: this.bgCavernOffset,
      foreground: this.bgForegroundOffset,
      time: this.state.gameTime
    });
  }


  private renderPlayer(ctx: CanvasRenderingContext2D) {
    const ghost = this.invincibleTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0;

    ctx.save();
    ctx.translate(this.px, this.py);

    if (this.invincibleTimer > 0) {
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 18 + Math.sin(Date.now() * 0.012) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.chargeLevel >= 85) {
      ctx.globalAlpha = 0.55 + Math.sin(Date.now() * 0.02) * 0.45;
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Charge aura
    if (this.isCharging && this.chargeLevel > 20) {
      ctx.strokeStyle = this.ship.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22 + (this.chargeLevel / 100) * 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (!ghost) {
      const rear = this.ship.id === 'electra' ? -18 : this.ship.id === 'pyron' ? -14 : this.ship.id === 'hiob' ? -24 : -32;
      const flick = 5 + (Math.sin(Date.now() * 0.045) * 0.5 + 0.5) * 8;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = this.ship.color;
      ctx.fillRect(rear - flick, -2, flick, 4);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rear - flick * 0.45, -1, Math.max(2, flick * 0.45), 2);
      ctx.restore();
    }

    if (ghost) ctx.globalAlpha = 0.28;
    drawBioShip(ctx, this.ship.id, Date.now() * 0.006);

    ctx.restore();
  }

  private renderPod(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.podX, this.podY);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45;
    const halo = ctx.createRadialGradient(0, 0, this.podRadius * 0.4, 0, 0, this.podRadius * 2.1);
    halo.addColorStop(0, '#e9d5ff');
    halo.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, this.podRadius * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Glowing organic plasma orb
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, this.podRadius);
    grad.addColorStop(0, '#f0abfc');
    grad.addColorStop(0.5, '#a855f7');
    grad.addColorStop(1, 'rgba(126, 34, 206, 0.2)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, this.podRadius, 0, Math.PI * 2);
    ctx.fill();

    // Revolving nucleus
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(Math.cos(this.podAngle * 3) * 4, Math.sin(this.podAngle * 3) * 4, 3, 0, Math.PI * 2);
    ctx.fill();

    // Connecting bio-tether to player ship
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(this.px - this.podX, this.py - this.podY);
    ctx.stroke();

    ctx.restore();
  }

  private renderEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if ((e.flash ?? 0) > 0) ctx.filter = 'brightness(3) saturate(0.2)';

    drawEnemySprite(ctx, e, e.type === 'crawler' && e.y < this.height / 2);


    ctx.filter = 'none';
    if (e.isBoss && this.state.bossPhase >= 2) {
      const spin = e.patternParam * (this.state.bossPhase >= 3 ? 4.2 : 2.1);
      ctx.strokeStyle = this.state.bossPhase >= 3 ? '#fef08a' : e.color;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.width * 0.55, spin, spin + Math.PI * 1.15);
      ctx.stroke();
      if (this.state.bossPhase >= 3) {
        ctx.beginPath();
        ctx.arc(0, 0, e.width * 0.74, -spin, -spin + Math.PI);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Overhead mini health bar for giant living bug cruisers
    if (e.isLargeBug && e.hp < e.maxHp) {
      const barW = 44;
      const barH = 3.5;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(-barW / 2, -e.height / 2 - 9, barW, barH);
      ctx.fillStyle = e.hp > e.maxHp * 0.4 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(-barW / 2, -e.height / 2 - 9, Math.max(0, barW * (e.hp / e.maxHp)), barH);
    }

    ctx.restore();
  }

  private renderBullet(ctx: CanvasRenderingContext2D, b: Bullet) {
    const speed = Math.hypot(b.vx, b.vy) || 1;
    const nx = b.vx / speed;
    const ny = b.vy / speed;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = b.isPlayer ? 0.4 : 0.28;
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.type === 'charged' ? b.radius * 2.6 : b.radius * (b.isPlayer ? 2.2 : 1.7), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (b.type === 'charged') {
      const len = 42;
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = b.radius * 0.85;
      ctx.beginPath();
      ctx.moveTo(b.x - nx * len, b.y - ny * len);
      ctx.lineTo(b.x + nx * 10, b.y + ny * 10);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - nx * len * 0.62, b.y - ny * len * 0.62);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.isPlayer) {
      const tail = 10 + b.radius;
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(2, b.radius * 0.7);
      ctx.beginPath();
      ctx.moveTo(b.x - nx * tail, b.y - ny * tail);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(1.4, b.radius * 0.4), 0, Math.PI * 2);
      ctx.fill();
    } else {
      const tail = 8;
      ctx.strokeStyle = 'rgba(2, 6, 12, 0.92)';
      ctx.lineWidth = b.radius * 2.3;
      ctx.beginPath();
      ctx.moveTo(b.x - nx * tail, b.y - ny * tail);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = b.color;
      ctx.lineWidth = Math.max(1.5, b.radius * 0.95);
      ctx.beginPath();
      ctx.moveTo(b.x - nx * tail, b.y - ny * tail);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#0b0f14';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius + 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x - nx, b.y - ny, Math.max(1, b.radius * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderPickup(ctx: CanvasRenderingContext2D, p: Pickup) {
    ctx.save();
    ctx.translate(p.x, p.y + Math.sin(this.state.gameTime * 5 + p.x * 0.05) * 1.5);

    const haloColor = p.type === 'shield_restore' ? '#7dd3fc' : p.type === 'super_bomb' ? '#fdba74' : '#6ee7b7';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55;
    const halo = ctx.createRadialGradient(0, 0, 1, 0, 0, p.radius * 2.4);
    halo.addColorStop(0, haloColor);
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const gem = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), w, h);
    };

    if (p.type === 'biomatter') {
      gem(-1, -6, 2, 2, '#022c22');
      gem(-3, -4, 6, 2, '#064e3b');
      gem(-5, -2, 10, 2, '#059669');
      gem(-5, 0, 10, 2, '#10b981');
      gem(-3, 2, 6, 2, '#6ee7b7');
      gem(-1, 4, 2, 2, '#d1fae5');
      gem(-1, -1, 2, 2, '#ffffff');
    } else if (p.type === 'shield_restore') {
      gem(-7, -7, 14, 14, '#082f49');
      gem(-6, -6, 12, 12, '#0369a1');
      gem(-2, -5, 4, 10, '#e0f2fe');
      gem(-5, -2, 10, 4, '#e0f2fe');
      gem(-1, -3, 2, 6, '#ffffff');
    } else if (p.type === 'super_bomb') {
      gem(-5, -6, 10, 2, '#7c2d12');
      gem(-6, -4, 12, 8, '#ea580c');
      gem(-5, 4, 10, 2, '#9a3412');
      gem(-2, -2, 4, 4, '#ef4444');
      gem(-1, -5, 2, 2, '#fff7ed');
    }

    ctx.restore();
  }
}
