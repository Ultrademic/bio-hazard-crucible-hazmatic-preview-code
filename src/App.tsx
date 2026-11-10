import React, { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { ArcadeScreen } from './components/ArcadeScreen';
import { ShipLab } from './components/ShipLab';
import { DailyChallenge } from './components/DailyChallenge';
import { LeaderboardView } from './components/LeaderboardView';
import { CloudSyncView } from './components/CloudSyncView';
import { TitleScreen } from './components/TitleScreen';
import { MainMenu, MenuTab } from './components/MainMenu';
import { rankFromXp } from './game/ranks';
import { INITIAL_SHIPS, ShipDef, UserSaveData } from './game/types';
import { saveManager } from './game/saveManager';
import { sound } from './game/audioEngine';

type DailyModifierInfo = { multiplier: number; id: string; name: string };

function modifierFromChallenge(data: { modifier?: { multiplier: number; id: string; name: string } }): DailyModifierInfo | undefined {
  const modifier = data?.modifier;
  if (!modifier?.id || !modifier.name) return undefined;
  return { id: modifier.id, name: modifier.name, multiplier: modifier.multiplier };
}

export default function App() {
  const [saveData, setSaveData] = useState<UserSaveData>(() => saveManager.getData());
  const [activeTab, setActiveTab] = useState<'arena' | 'lab' | 'daily' | 'leaderboard' | 'cloud'>('arena');
  /** Boot flow: title screen, then the main menu, then the chosen view. */
  const [screen, setScreen] = useState<'title' | 'menu' | 'view'>('title');
  const [dailyModifier, setDailyModifier] = useState<DailyModifierInfo | undefined>(undefined);
  /** Last daily challenge fetched while the Daily tab was open, used if Header Play starts Daily before Deploy was pressed. */
  const [dailyPreview, setDailyPreview] = useState<DailyModifierInfo | undefined>(undefined);
  /** Incremented whenever Header, Ship Lab, or Daily Challenge should immediately start a run. */
  const [startRequest, setStartRequest] = useState(0);

  useEffect(() => {
    sound.setVolumes(saveData.settings.bgmVolume, saveData.settings.sfxVolume);
    sound.setMuted(saveData.settings.muted);
  }, [saveData.settings.bgmVolume, saveData.settings.sfxVolume, saveData.settings.muted]);

  const activeShip: ShipDef = INITIAL_SHIPS.find(s => s.id === saveData.activeShipId) || INITIAL_SHIPS[0];
  const standing = rankFromXp(saveData.pilotXp);

  const handleSaveUpdate = (updated: UserSaveData) => {
    setSaveData(updated);
    saveManager.saveLocal(updated);
  };

  const toggleMute = () => {
    const next = !saveData.settings.muted;
    sound.setMuted(next);
    handleSaveUpdate({
      ...saveData,
      settings: { ...saveData.settings, muted: next }
    });
  };

  const requestStart = (mode: 'standard' | 'daily', modifier?: DailyModifierInfo) => {
    setDailyModifier(mode === 'daily' ? modifier : undefined);
    setActiveTab('arena');
    setScreen('view');
    setStartRequest((n) => n + 1);
  };

  const handleLaunchDaily = (modifier: DailyModifierInfo) => {
    setDailyPreview(modifier);
    requestStart('daily', modifier);
  };

  const handleHangarDeploy = () => {
    requestStart('standard');
  };

  const handleQuickLaunch = () => {
    const useDaily = !!dailyModifier || activeTab === 'daily';
    if (!useDaily) {
      requestStart('standard');
      return;
    }
    const modifier = dailyModifier || dailyPreview;
    if (modifier) {
      requestStart('daily', modifier);
      return;
    }
    void (async () => {
      try {
        const res = await fetch('/api/daily-challenge');
        const data = await res.json();
        const next = modifierFromChallenge(data);
        if (!next) return;
        setDailyPreview(next);
        requestStart('daily', next);
      } catch (e) {
        console.warn('Failed to load daily challenge for launch:', e);
      }
    })();
  };

  const handleMenuSelect = (tab: MenuTab) => {
    if (tab === 'arena') setDailyModifier(undefined);
    setActiveTab(tab);
    setScreen('view');
  };

  if (screen === 'title') {
    return <TitleScreen onContinue={() => setScreen('menu')} />;
  }

  if (screen === 'menu') {
    return (
      <MainMenu
        saveData={saveData}
        onSelect={handleMenuSelect}
        onBack={() => setScreen('title')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#06090e] text-slate-200 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* 3-Zone Navigation Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        credits={saveData.credits}
        rank={standing.rank}
        rankTitle={standing.title}
        isMuted={saveData.settings.muted}
        toggleMute={toggleMute}
        onLaunch={handleQuickLaunch}
        onMenu={() => setScreen('menu')}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-start w-full">
        {activeTab === 'arena' && (
          <ArcadeScreen
            saveData={saveData}
            onSaveUpdate={handleSaveUpdate}
            activeShip={activeShip}
            onOpenShipLab={() => setActiveTab('lab')}
            gameMode={dailyModifier ? 'daily' : 'standard'}
            dailyModifier={dailyModifier}
            startRequest={startRequest}
          />
        )}

        {activeTab === 'lab' && (
          <ShipLab
            saveData={saveData}
            onSaveUpdate={handleSaveUpdate}
            onDeploy={handleHangarDeploy}
          />
        )}

        {activeTab === 'daily' && (
          <DailyChallenge
            onStartDaily={handleLaunchDaily}
            onDailyReady={setDailyPreview}
          />
        )}

        {activeTab === 'leaderboard' && (
          <LeaderboardView />
        )}

        {activeTab === 'cloud' && (
          <CloudSyncView
            saveData={saveData}
            onSaveUpdate={handleSaveUpdate}
          />
        )}
      </main>

      {/* Clean Unboxed Footer */}
      <footer className="w-full border-t border-slate-900 bg-[#05070a] px-4 sm:px-6 py-3 sm:py-4 mt-4 sm:mt-8" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-mono-tech">
          <div>
            Bio-Hazard Crucible · Ultrademic Studios
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <span>Dynamic FM Synthesizer</span>
            <span aria-hidden="true">·</span>
            <span>Handheld & Gamepad Certified</span>
            <span aria-hidden="true">·</span>
            <span>Crucible Sector Archives</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
