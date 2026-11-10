/**
 * Authentic 16-Bit FM Synthesizer & Arcade Chiptune Sound Engine
 * Emulates Yamaha YM2612 / SN76489 Genesis sound chip architecture using Web Audio API.
 * Each sector and the ship lab use a studio track. Boss fights and the victory fanfare stay on FM.
 */

import titleThemeUrl from '../assets/music/Hazmatic - Title Theme.mp3';
import labThemeUrl from '../assets/music/Hazmatic - Genetic Mutation Lab Theme.mp3';
import stageOneUrl from '../assets/music/Hazmatic - Sector 1.mp3';
import stageTwoUrl from '../assets/music/Hazmatic - Toxic Swampland (Sector 2).mp3';
import stageThreeUrl from '../assets/music/Hazmatic - Deep Hive (Sector 3).mp3';
import stageFourUrl from '../assets/music/Hazmatic - Mutant Funk (Sector 4).mp3';
import stageFiveUrl from '../assets/music/Hazmatic - Overgrown Temple (Sector 5).mp3';

type BgmTrack = 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5' | 'boss' | 'title' | 'victory' | 'lab';

const FILE_TRACKS: Partial<Record<BgmTrack, string>> = {
  title: titleThemeUrl,
  lab: labThemeUrl,
  stage1: stageOneUrl,
  stage2: stageTwoUrl,
  stage3: stageThreeUrl,
  stage4: stageFourUrl,
  stage5: stageFiveUrl
};

const STAGE_TRACKS: BgmTrack[] = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5'];

export function stageTrack(stage: number): BgmTrack {
  const index = Math.max(0, Math.min(STAGE_TRACKS.length - 1, stage - 1));
  return STAGE_TRACKS[index];
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private music: HTMLAudioElement | null = null;
  private musicSource: MediaElementAudioSourceNode | null = null;
  private pendingFile: string | null = null;
  private gestureArmed = false;

  private isBgmPlaying = false;
  private currentTrackName: BgmTrack | null = null;
  private timerId: number | null = null;
  private currentStep = 0;
  private tempo = 132; // BPM

  private bgmVol = 0.7;
  private sfxVol = 0.8;
  private muted = false;
  private musicPaused = false;

  constructor() {
    // Lazy init audio context on first user gesture
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.bgmVol, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVol, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);
    } catch (e) {
      console.warn('Web Audio not supported or blocked:', e);
    }
  }

  public resume() {
    this.init();
    if (this.ctx && this.ctx.state !== 'running') {
      const ctx = this.ctx;
      ctx.resume().then(() => {
        if (ctx.state !== 'running') this.armUnlock();
      }).catch(() => this.armUnlock());
    }
    if (this.pendingFile && this.music && this.isBgmPlaying) {
      const pending = this.pendingFile;
      this.music.play().then(() => {
        if (this.pendingFile === pending) this.pendingFile = null;
      }).catch(() => this.armUnlock());
    }
  }

  public setVolumes(bgm: number, sfx: number) {
    this.bgmVol = Math.max(0, Math.min(1, bgm));
    this.sfxVol = Math.max(0, Math.min(1, sfx));
    if (this.ctx && this.bgmGain && this.sfxGain) {
      this.bgmGain.gain.setValueAtTime(this.bgmVol, this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(this.sfxVol, this.ctx.currentTime);
    }
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 1, this.ctx.currentTime);
    }
  }

  public getSettings() {
    return { bgmVolume: this.bgmVol, sfxVolume: this.sfxVol, muted: this.muted, musicPaused: this.musicPaused };
  }

  public isMusicPaused() {
    return this.musicPaused;
  }

  /** Freeze the current track without rewinding it. Sound effects keep playing. */
  public setMusicPaused(paused: boolean) {
    this.musicPaused = paused;
    if (!this.isBgmPlaying || !this.currentTrackName) return;

    if (paused) {
      if (this.timerId !== null) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      this.music?.pause();
      return;
    }

    this.resume();
    if (FILE_TRACKS[this.currentTrackName]) {
      this.music?.play().catch(() => this.armUnlock());
    } else {
      this.armSequencer(this.currentTrackName);
    }
  }

  public toggleMusicPaused() {
    this.setMusicPaused(!this.musicPaused);
    return this.musicPaused;
  }

  private armSequencer(trackName: BgmTrack) {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (trackName === 'boss') this.tempo = 148;
    else if (trackName === 'victory') this.tempo = 126;
    else this.tempo = 132;

    const stepIntervalMs = (60 / this.tempo / 4) * 1000;
    this.timerId = window.setInterval(() => {
      this.tickTrack(trackName);
      this.currentStep = (this.currentStep + 1) % 32;
    }, stepIntervalMs);
  }

  // --- FM Voice Synthesis Helpers ---
  // Plays an FM synthesized note: Modulator -> Carrier -> Gain -> Destination
  private playFmNote(
    freq: number,
    duration: number,
    modIndex: number = 4,
    modRatio: number = 2,
    envelope: { a: number; d: number; s: number; r: number } = { a: 0.01, d: 0.15, s: 0.3, r: 0.1 },
    gainDest: GainNode | null = this.bgmGain
  ) {
    if (!this.ctx || !gainDest || this.muted || freq <= 0) return;
    const now = this.ctx.currentTime;

    const carrier = this.ctx.createOscillator();
    const modulator = this.ctx.createOscillator();
    const modGain = this.ctx.createGain();
    const voiceGain = this.ctx.createGain();

    carrier.type = 'sawtooth';
    modulator.type = 'sine';

    carrier.frequency.setValueAtTime(freq, now);
    modulator.frequency.setValueAtTime(freq * modRatio, now);

    // Modulation index envelope
    modGain.gain.setValueAtTime(freq * modIndex, now);
    modGain.gain.exponentialRampToValueAtTime(Math.max(1, freq * 0.1), now + duration);

    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // Amplitude ADSR Envelope
    const a = envelope.a;
    const d = envelope.d;
    const s = envelope.s;
    const r = envelope.r;

    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.exponentialRampToValueAtTime(0.4, now + a);
    voiceGain.gain.exponentialRampToValueAtTime(0.4 * s, now + a + d);
    voiceGain.gain.setValueAtTime(0.4 * s, now + duration);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + r);

    carrier.connect(voiceGain);
    voiceGain.connect(gainDest);

    carrier.start(now);
    modulator.start(now);
    carrier.stop(now + duration + r);
    modulator.stop(now + duration + r);
  }

  // Plays deep FM Bass note (Punchy slap/metallic Mega Drive bass)
  private playFmBass(freq: number, duration: number, gainDest: GainNode | null = this.bgmGain) {
    if (!this.ctx || !gainDest || this.muted || freq <= 0) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    subOsc.type = 'triangle';

    osc.frequency.setValueAtTime(freq, now);
    subOsc.frequency.setValueAtTime(freq * 0.5, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(gainDest);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + duration);
    subOsc.stop(now + duration);
  }

  // Plays 16-bit percussion (Noise snare or hi-hat or kick)
  private playDrum(type: 'kick' | 'snare' | 'hihat' | 'cymbal', gainDest: GainNode | null = this.bgmGain) {
    if (!this.ctx || !gainDest || this.muted) return;
    const now = this.ctx.currentTime;

    if (type === 'kick') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.12);

      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(gainDest);
      osc.start(now);
      osc.stop(now + 0.16);
    } else {
      // Noise-based snare/hihat
      const bufferSize = Math.floor(this.ctx.sampleRate * (type === 'hihat' ? 0.04 : 0.14));
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = type === 'hihat' ? 'highpass' : 'bandpass';
      filter.frequency.value = type === 'hihat' ? 6000 : 1800;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(type === 'hihat' ? 0.15 : 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (type === 'hihat' ? 0.04 : 0.14));

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(gainDest);

      whiteNoise.start(now);
    }
  }

  // --- Dynamic Music Sequences ---
  public playBgm(trackName: BgmTrack) {
    this.resume();
    if (this.currentTrackName === trackName && this.isBgmPlaying) {
      if (this.musicPaused) this.setMusicPaused(false);
      return;
    }

    this.musicPaused = false;
    this.stopBgm();
    this.musicPaused = false;
    this.currentTrackName = trackName;
    this.isBgmPlaying = true;
    this.currentStep = 0;

    const fileUrl = FILE_TRACKS[trackName];
    if (fileUrl) {
      this.playFile(fileUrl);
      return;
    }

    this.armSequencer(trackName);
  }

  public stopBgm() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.music) {
      this.music.pause();
      this.music.currentTime = 0;
    }
    this.pendingFile = null;
    this.isBgmPlaying = false;
    this.currentTrackName = null;
    this.musicPaused = false;
  }

  private playFile(url: string) {
    if (!this.ctx || !this.bgmGain) return;

    if (!this.music) {
      this.music = new Audio();
      this.music.loop = true;
      this.music.preload = 'auto';
      this.music.volume = 0.9;
      this.musicSource = this.ctx.createMediaElementSource(this.music);
      this.musicSource.connect(this.bgmGain);
    }

    const resolved = new URL(url, window.location.href).href;
    if (this.music.src !== resolved) {
      this.music.src = url;
    }
    this.music.currentTime = 0;
    this.music.play().then(() => {
      this.pendingFile = null;
      if (this.ctx && this.ctx.state !== 'running') this.armUnlock();
    }).catch(() => {
      this.pendingFile = url;
      this.armUnlock();
    });
  }

  private armUnlock() {
    if (this.gestureArmed) return;
    this.gestureArmed = true;
    const unlock = () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      this.gestureArmed = false;
      this.resume();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  private tickTrack(track: string) {
    const s = this.currentStep;

    if (track === 'stage1' || track === 'stage2' || track === 'stage3' || track === 'stage4' || track === 'stage5') {
      // Stage 1: "Avaron Infiltration" (Key of D-minor / F-major)
      // Drums: Kick on 0, 8, 16, 24. Snare on 4, 12, 20, 28. Hi-hats on evens.
      if (s % 8 === 0) this.playDrum('kick');
      if (s % 8 === 4) this.playDrum('snare');
      if (s % 2 === 0) this.playDrum('hihat');

      // Rolling 16-bit FM Bassline (D2 = 73.42, F2 = 87.31, G2 = 98.0, A2 = 110.0, C3 = 130.81)
      const bassSeq = [
        73.4, 73.4, 146.8, 73.4,  87.3, 73.4, 98.0, 73.4,
        73.4, 73.4, 130.8, 73.4,  110.0, 98.0, 87.3, 65.4,
        73.4, 73.4, 146.8, 73.4,  87.3, 73.4, 98.0, 73.4,
        110.0, 110.0, 130.8, 146.8, 164.8, 146.8, 130.8, 98.0
      ];
      const bassFreq = bassSeq[s];
      if (bassFreq) this.playFmBass(bassFreq, 0.12);

      // Lead Melody (Moody Bio-Hazard arpeggios & hooks)
      const leadSeq = [
        293.7, 0, 349.2, 0, 440.0, 0, 523.3, 0,
        587.3, 0, 523.3, 440.0, 392.0, 0, 349.2, 0,
        293.7, 0, 392.0, 0, 440.0, 0, 587.3, 0,
        659.3, 587.3, 523.3, 0, 440.0, 392.0, 349.2, 0
      ];
      const leadFreq = leadSeq[s];
      if (leadFreq > 0) this.playFmNote(leadFreq, 0.22, 3.5, 2);

    } else if (track === 'boss') {
      // Boss: "Hell-Raiser Centipede" (Tense, frantic C-minor)
      if (s % 4 === 0) this.playDrum('kick');
      if (s % 8 === 4) this.playDrum('snare');
      this.playDrum('hihat');

      // Heavy Aggressive Bass triplets
      const bossBass = [
        65.4, 65.4, 77.8, 65.4,  65.4, 82.4, 65.4, 77.8,
        58.3, 58.3, 69.3, 58.3,  61.7, 58.3, 65.4, 58.3,
        65.4, 65.4, 77.8, 65.4,  65.4, 98.0, 87.3, 77.8,
        103.8, 98.0, 87.3, 77.8, 65.4, 65.4, 77.8, 87.3
      ];
      if (bossBass[s]) this.playFmBass(bossBass[s], 0.1);

      // Urgent FM Alarm Stabs
      const bossLead = [
        523.3, 523.3, 0, 523.3, 622.3, 0, 587.3, 0,
        466.2, 466.2, 0, 466.2, 523.3, 0, 392.0, 0,
        523.3, 523.3, 0, 659.3, 698.5, 0, 622.3, 0,
        784.0, 0, 739.9, 0, 698.5, 622.3, 587.3, 523.3
      ];
      if (bossLead[s]) this.playFmNote(bossLead[s], 0.18, 5.0, 3.5);

    } else if (track === 'title') {
      // Title: "Biosphere Awakening" (Hypnotic, smooth retro FM)
      if (s % 16 === 0) this.playDrum('kick');
      if (s % 16 === 8) this.playDrum('snare');
      if (s % 4 === 0) this.playDrum('hihat');

      const titleBass = [
        55.0, 0, 55.0, 0, 82.4, 0, 55.0, 0,
        65.4, 0, 65.4, 0, 98.0, 0, 65.4, 0,
        49.0, 0, 49.0, 0, 73.4, 0, 49.0, 0,
        55.0, 0, 82.4, 0, 110.0, 0, 82.4, 0
      ];
      if (titleBass[s]) this.playFmBass(titleBass[s], 0.25);

      const titleArp = [
        220, 261.6, 329.6, 440, 523.3, 440, 329.6, 261.6,
        261.6, 329.6, 392, 523.3, 659.3, 523.3, 392, 329.6,
        196, 246.9, 293.7, 392, 493.9, 392, 293.7, 246.9,
        220, 277.2, 329.6, 440, 554.4, 440, 329.6, 277.2
      ];
      if (titleArp[s]) this.playFmNote(titleArp[s], 0.15, 2.0, 1.5);

    } else if (track === 'victory') {
      // Victory Fanfare
      if (s % 8 === 0) this.playDrum('kick');
      if (s % 8 === 4) this.playDrum('snare');
      const vicBass = [65.4, 0, 87.3, 0, 98.0, 0, 130.8, 0];
      if (vicBass[s % 8]) this.playFmBass(vicBass[s % 8], 0.2);

      const vicLead = [
        261.6, 329.6, 392.0, 523.3, 659.3, 0, 784.0, 0,
        659.3, 0, 784.0, 0, 1046.5, 0, 0, 0
      ];
      if (vicLead[s % 16]) this.playFmNote(vicLead[s % 16], 0.28, 3.0, 2);
    }
  }

  // --- High-Impact & Satisfying 16-Bit Arcade Sound Effects ---

  /**
   * Distinctive ship-specific primary weapon fire sounds
   */
  public playShipFire(shipId: string, pitchShift = 1.0) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;
    const rndPitch = pitchShift * (1.0 + (Math.random() - 0.5) * 0.08);

    if (shipId === 'orestes') {
      // ORESTES (Raptor): Snappy dual FM plasma lasers with high-bite transient & low-mid body
      const carrier = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const sub = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      carrier.type = 'sawtooth';
      mod.type = 'sine';
      sub.type = 'triangle';

      const baseF = 1180 * rndPitch;
      carrier.frequency.setValueAtTime(baseF, now);
      carrier.frequency.exponentialRampToValueAtTime(160 * rndPitch, now + 0.08);

      mod.frequency.setValueAtTime(baseF * 1.5, now);
      modGain.gain.setValueAtTime(baseF * 2.2, now);
      modGain.gain.exponentialRampToValueAtTime(20, now + 0.08);

      sub.frequency.setValueAtTime(220 * rndPitch, now);
      sub.frequency.exponentialRampToValueAtTime(60 * rndPitch, now + 0.08);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);

      carrier.connect(gain);
      sub.connect(gain);
      gain.connect(this.sfxGain);

      carrier.start(now);
      mod.start(now);
      sub.start(now);
      carrier.stop(now + 0.09);
      mod.stop(now + 0.09);
      sub.stop(now + 0.09);

    } else if (shipId === 'electra') {
      // ELECTRA (Dragonfly): High-voltage electric stinger needles with sizzling buzz
      const carrier = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const gain = this.ctx.createGain();

      carrier.type = 'triangle';
      mod.type = 'sawtooth';

      const baseF = 2100 * rndPitch;
      carrier.frequency.setValueAtTime(baseF, now);
      carrier.frequency.exponentialRampToValueAtTime(380 * rndPitch, now + 0.06);

      mod.frequency.setValueAtTime(520, now);
      modGain.gain.setValueAtTime(800, now);
      modGain.gain.exponentialRampToValueAtTime(30, now + 0.06);

      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

      carrier.connect(gain);
      gain.connect(this.sfxGain);

      carrier.start(now);
      mod.start(now);
      carrier.stop(now + 0.07);
      mod.stop(now + 0.07);

    } else if (shipId === 'hiob') {
      // HIOB (Scarab): Heavy seismic bio-artillery mortar cannon with deep punchy sub-thump
      const osc = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      const noiseGain = this.ctx.createGain();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      sub.type = 'sine';

      osc.frequency.setValueAtTime(310 * rndPitch, now);
      osc.frequency.exponentialRampToValueAtTime(50 * rndPitch, now + 0.16);

      sub.frequency.setValueAtTime(140 * rndPitch, now);
      sub.frequency.exponentialRampToValueAtTime(32 * rndPitch, now + 0.18);

      // Noise pop transient
      const dur = 0.04;
      const bufferSize = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);

      noiseGain.gain.setValueAtTime(0.45, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      sub.connect(gain);
      gain.connect(this.sfxGain);

      noise.start(now);
      osc.start(now);
      sub.start(now);
      osc.stop(now + 0.19);
      sub.stop(now + 0.19);

    } else {
      // PYRON (Manta): Roaring solar thermal wave scorch with harmonic lowpass sweep
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';

      const baseF = 720 * rndPitch;
      osc1.frequency.setValueAtTime(baseF, now);
      osc1.frequency.exponentialRampToValueAtTime(140 * rndPitch, now + 0.12);

      osc2.frequency.setValueAtTime(baseF * 1.015, now); // Detune
      osc2.frequency.exponentialRampToValueAtTime(138 * rndPitch, now + 0.12);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.12);

      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.125);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.13);
      osc2.stop(now + 0.13);
    }
  }

  /**
   * Weapon pod assist shot (crystalline bio-laser chirp)
   */
  public playPodFire(pitchShift = 1.0) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const baseF = (1650 + Math.random() * 80) * pitchShift;
    osc.frequency.setValueAtTime(baseF, now);
    osc.frequency.exponentialRampToValueAtTime(540 * pitchShift, now + 0.05);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Incredibly tactile chitin/flesh impact sound when player shots hit alien biomorphs
   */
  public playChitinHit(isArmored = false, isLargeBug = false) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;
    const dur = isLargeBug ? 0.055 : isArmored ? 0.045 : 0.035;

    // Transient crack
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = isArmored ? 'bandpass' : isLargeBug ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(isArmored ? 2400 : isLargeBug ? 950 : 1600, now);
    filter.Q.value = isArmored ? 3.0 : 1.2;

    // Sub click body
    const osc = this.ctx.createOscillator();
    osc.type = isArmored ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isLargeBug ? 160 : isArmored ? 380 : 240, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isLargeBug ? 0.38 : isArmored ? 0.32 : 0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    osc.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    osc.start(now);
    osc.stop(now + dur);
  }

  /**
   * Resonant pod bullet absorption / energy shield deflection
   */
  public playPodAbsorb() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    sub.type = 'sine';

    // Harmonic bell ping with metallic ring
    osc1.frequency.setValueAtTime(1480, now);
    osc1.frequency.exponentialRampToValueAtTime(3200, now + 0.05);

    osc2.frequency.setValueAtTime(2600, now);
    osc2.frequency.exponentialRampToValueAtTime(5200, now + 0.05);

    sub.frequency.setValueAtTime(280, now);
    sub.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc1.connect(gain);
    osc2.connect(gain);
    sub.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    sub.start(now);
    osc1.stop(now + 0.12);
    osc2.stop(now + 0.12);
    sub.stop(now + 0.12);
  }

  /**
   * Pod mode cycle hydraulic bio-clamp switch
   */
  public playPodModeSwitch() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.09);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.095);
  }

  /**
   * Deep multi-layered crunching explosion for biomorphs & bug battle cruisers
   */
  public playEnemyExplode(isBoss = false, isLargeBug = false) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;
    const dur = isBoss ? 0.85 : isLargeBug ? 0.55 : 0.28;

    // 1. Noise Crunch Layer (Carapace fragmentation)
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.32));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isBoss ? 520 : isLargeBug ? 720 : 1250, now);
    filter.frequency.exponentialRampToValueAtTime(35, now + dur);

    // 2. Heavy Sub Punch
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(isBoss ? 120 : isLargeBug ? 160 : 210, now);
    subOsc.frequency.exponentialRampToValueAtTime(24, now + dur * 0.85);

    // 3. Fleshy Pop Body
    const midOsc = this.ctx.createOscillator();
    midOsc.type = 'sine';
    midOsc.frequency.setValueAtTime(isLargeBug ? 280 : 340, now);
    midOsc.frequency.exponentialRampToValueAtTime(50, now + 0.12);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isBoss ? 0.85 : isLargeBug ? 0.65 : 0.44, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    subOsc.connect(gain);
    midOsc.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    subOsc.start(now);
    midOsc.start(now);
    subOsc.stop(now + dur);
    midOsc.stop(now + 0.13);
  }

  /**
   * Bio-Reactor charging hum with rising frequency & granular pulse
   */
  public playChargeHum(level: number) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;
    const norm = Math.max(0, Math.min(1, level / 100));

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const freq = 140 + norm * 720;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freq + 20, now + 0.04);

    gain.gain.setValueAtTime(0.08 + norm * 0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Full charge alert cue (bright dual chime)
   */
  public playChargeReady() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';

    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.setValueAtTime(1320, now + 0.04);

    osc2.frequency.setValueAtTime(1760, now);
    osc2.frequency.setValueAtTime(2640, now + 0.04);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.17);
    osc2.stop(now + 0.17);
  }

  /**
   * Screen-clearing Charged Megabeam Detonation
   */
  public playChargeRelease() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'square';
    sub.type = 'sine';

    osc1.frequency.setValueAtTime(460, now);
    osc1.frequency.linearRampToValueAtTime(1800, now + 0.07);
    osc1.frequency.exponentialRampToValueAtTime(65, now + 0.5);

    osc2.frequency.setValueAtTime(230, now);
    osc2.frequency.linearRampToValueAtTime(900, now + 0.07);
    osc2.frequency.exponentialRampToValueAtTime(32, now + 0.5);

    sub.frequency.setValueAtTime(180, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.55);

    gain.gain.setValueAtTime(0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc1.connect(gain);
    osc2.connect(gain);
    sub.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    sub.start(now);
    osc1.stop(now + 0.56);
    osc2.stop(now + 0.56);
    sub.stop(now + 0.56);
  }

  /**
   * Super Bomb Full-Screen Seismic Shockwave
   */
  public playBombExplosion() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;
    const dur = 1.1;

    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.42));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(20, now + dur);

    const sub = this.ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(120, now);
    sub.frequency.exponentialRampToValueAtTime(16, now + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    sub.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    sub.start(now);
    sub.stop(now + dur);
  }

  /**
   * Sparkling crystalline pickups & power-ups
   */
  public playPickup(type: 'biomatter' | 'shield_restore' | 'super_bomb' | 'pod_power' = 'biomatter') {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    if (type === 'pod_power') {
      // Energetic high-tech pod power surge chime
      const notes = [440.0, 659.25, 880.0, 1318.5];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.035);
        gain.gain.setValueAtTime(0.28, now + idx * 0.035);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.18);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(now + idx * 0.035);
        osc.stop(now + idx * 0.035 + 0.19);
      });
    } else if (type === 'shield_restore') {
      // Healing major chord arpeggio (C5 -> E5 -> G5 -> C6)
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.04);
        gain.gain.setValueAtTime(0.26, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.22);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.23);
      });
    } else if (type === 'super_bomb') {
      // Powerful fanfare chord
      const notes = [587.33, 739.99, 880.0, 1174.66];
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.045);
        gain.gain.setValueAtTime(0.3, now + idx * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.25);
        osc.connect(gain);
        gain.connect(this.sfxGain!);
        osc.start(now + idx * 0.045);
        osc.stop(now + idx * 0.045 + 0.26);
      });
    } else {
      // Biomatter orb: Crisp dual crystalline chime (E6 -> B6)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(1318.5, now);
      osc1.frequency.setValueAtTime(1975.5, now + 0.04);
      osc2.frequency.setValueAtTime(2637.0, now + 0.04);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.sfxGain);

      osc1.start(now);
      osc2.start(now + 0.04);
      osc1.stop(now + 0.19);
      osc2.stop(now + 0.19);
    }
  }

  /**
   * Distinct squelchy organic enemy acid spit
   */
  public playEnemyAcidSpit() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.07);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Heavy bio-cannon spore launch sound
   */
  public playEnemySporeBlast() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    sub.type = 'sine';

    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.14);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    sub.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.15);
    sub.stop(now + 0.15);
  }

  /**
   * Player damaged / bio-hull puncture
   */
  public playPlayerHit() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    sub.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.32);
    sub.frequency.setValueAtTime(100, now);
    sub.frequency.exponentialRampToValueAtTime(20, now + 0.35);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    sub.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.36);
    sub.stop(now + 0.36);
  }

  /**
   * Legacy laser helper redirecting to orestes
   */
  public playLaser(pitchShift = 1.0) {
    this.playShipFire('orestes', pitchShift);
  }

  /**
   * Boss / Large Bug Bio-Anomaly klaxon
   */
  public playBossAlarm() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.linearRampToValueAtTime(740, now + 0.18);
    osc.frequency.linearRampToValueAtTime(360, now + 0.36);

    gain.gain.setValueAtTime(0.48, now);
    gain.gain.linearRampToValueAtTime(0.48, now + 0.32);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.43);
  }

  /**
   * Tactile 16-bit UI blip
   */
  public playMenuBlip() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1320, now + 0.025);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Bio-vessel docking clamp sound when equipping a ship in the lab
   */
  public playShipEquip() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sawtooth';

    osc1.frequency.setValueAtTime(220, now);
    osc1.frequency.exponentialRampToValueAtTime(440, now + 0.08);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.16);

    osc2.frequency.setValueAtTime(110, now);
    osc2.frequency.exponentialRampToValueAtTime(220, now + 0.12);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.23);
    osc2.stop(now + 0.23);
  }

  /**
   * Rewarding genetic upgrade sequencer sound
   */
  public playUpgradeSuccess() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.resume();
    const now = this.ctx.currentTime;

    // Ascending arpeggio (G4 -> C5 -> E5 -> G5)
    const notes = [392.0, 523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.28, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.2);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.21);
    });
  }
}

export const sound = new AudioEngine();
