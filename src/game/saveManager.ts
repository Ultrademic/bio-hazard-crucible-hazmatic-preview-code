import { UserSaveData } from './types';

const STORAGE_KEY = 'biohazard_crucible_save_v2';

export const DEFAULT_SAVE_DATA: UserSaveData = {
  pilotName: 'RAVEN-01',
  credits: 250,
  unlockedShips: ['orestes', 'electra', 'hiob', 'pyron'],
  activeShipId: 'orestes',
  highScore: 24500,
  mutations: {
    chitinArmor: 0,
    synapticReflex: 0,
    podOverclock: 0,
    plasmaPiercing: 0,
    sporeLeech: 0
  },
  selectedPodMode: 'orbital',
  settings: {
    crtFilter: true,
    bgmVolume: 0.7,
    sfxVolume: 0.8,
    muted: false,
    vibration: true,
    controlMode: 'touch',
    pixelScale: 2
  },
  dailyCompletedDates: [],
  totalRuns: 0,
  totalBossesDefeated: 0,
  pilotXp: 0,
  bestStage: 1
};

export class SaveManager {
  private currentData: UserSaveData;

  constructor() {
    this.currentData = this.loadLocal();
  }

  public getData(): UserSaveData {
    return { ...this.currentData };
  }

  public update(updater: (prev: UserSaveData) => UserSaveData): UserSaveData {
    this.currentData = updater(this.currentData);
    this.saveLocal(this.currentData);
    return this.currentData;
  }

  private loadLocal(): UserSaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SAVE_DATA };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SAVE_DATA,
        ...parsed,
        mutations: {
          ...DEFAULT_SAVE_DATA.mutations,
          ...(parsed.mutations || {})
        },
        settings: {
          ...DEFAULT_SAVE_DATA.settings,
          ...(parsed.settings || {})
        }
      };
    } catch (e) {
      console.warn('Failed to parse local save, using default:', e);
      return { ...DEFAULT_SAVE_DATA };
    }
  }

  public saveLocal(data: UserSaveData) {
    try {
      this.currentData = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  // Cloud Sync API
  public async uploadToCloud(existingCode?: string): Promise<{ success: boolean; code?: string; error?: string }> {
    try {
      const res = await fetch('/api/cloud-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: existingCode || undefined,
          data: this.currentData
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to upload save');
      return { success: true, code: json.code };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error syncing save' };
    }
  }

  public async restoreFromCloud(code: string): Promise<{ success: boolean; data?: UserSaveData; error?: string }> {
    try {
      const cleanCode = code.trim().toUpperCase();
      const res = await fetch(`/api/cloud-save/${cleanCode}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Cloud save not found');

      const restored: UserSaveData = {
        ...DEFAULT_SAVE_DATA,
        ...json.data,
        mutations: {
          ...DEFAULT_SAVE_DATA.mutations,
          ...(json.data?.mutations || {})
        },
        settings: {
          ...DEFAULT_SAVE_DATA.settings,
          ...(json.data?.settings || {})
        }
      };

      this.saveLocal(restored);
      return { success: true, data: restored };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error restoring from cloud' };
    }
  }

  public exportJson(): string {
    return JSON.stringify(this.currentData, null, 2);
  }

  public importJson(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') return false;
      const validData: UserSaveData = {
        ...DEFAULT_SAVE_DATA,
        ...parsed
      };
      this.saveLocal(validData);
      return true;
    } catch {
      return false;
    }
  }
}

export const saveManager = new SaveManager();
