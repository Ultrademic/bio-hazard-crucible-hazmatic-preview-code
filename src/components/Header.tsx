import React from 'react';
import { Volume2, VolumeX, Monitor, Shield, Trophy, Calendar, Sparkles, RefreshCw, LayoutGrid } from 'lucide-react';
import { sound } from '../game/audioEngine';

interface HeaderProps {
  activeTab: 'arena' | 'lab' | 'daily' | 'leaderboard' | 'cloud';
  setActiveTab: (tab: 'arena' | 'lab' | 'daily' | 'leaderboard' | 'cloud') => void;
  credits: number;
  rank: number;
  rankTitle: string;
  isMuted: boolean;
  toggleMute: () => void;
  onLaunch: () => void;
  /** Back to the main menu screen. */
  onMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  credits,
  rank,
  rankTitle,
  isMuted,
  toggleMute,
  onLaunch,
  onMenu
}) => {
  const handleNav = (tab: 'arena' | 'lab' | 'daily' | 'leaderboard' | 'cloud') => {
    sound.playMenuBlip();
    setActiveTab(tab);
  };

  const links: Array<{ id: HeaderProps['activeTab']; label: string; active: string; hover: string }> = [
    { id: 'arena', label: 'Arena', active: 'text-sky-400 border-sky-400', hover: 'hover:text-sky-400' },
    { id: 'lab', label: 'Ship Lab', active: 'text-sky-400 border-sky-400', hover: 'hover:text-sky-400' },
    { id: 'daily', label: 'Daily', active: 'text-amber-400 border-amber-400', hover: 'hover:text-amber-400' },
    { id: 'leaderboard', label: 'Ranks', active: 'text-emerald-400 border-emerald-400', hover: 'hover:text-emerald-400' },
    { id: 'cloud', label: 'Cloud', active: 'text-purple-400 border-purple-400', hover: 'hover:text-purple-400' }
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#080d14] border-b border-slate-800/80" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-2.5">
      {/* Zone 1: Brand wordmark (single text element) */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={() => {
            sound.playMenuBlip();
            onMenu();
          }}
          aria-label="Main menu"
          className="min-h-11 sm:min-h-0 shrink-0 flex items-center gap-1.5 px-2 py-1.5 rounded border border-teal-700/60 bg-teal-950/40 text-teal-300 hover:border-teal-400 hover:text-teal-200 font-arcade text-[9px] sm:text-[10px] uppercase tracking-wider transition-colors"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Menu</span>
        </button>
      <div 
        onClick={() => {
          sound.playMenuBlip();
          onMenu();
        }}
        className="cursor-pointer flex items-center gap-2 min-w-0"
      >
        <div className="w-7 h-7 rounded bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-arcade text-xs shrink-0">
          BC
        </div>
        <span className="text-[10px] sm:text-sm md:text-lg font-bold tracking-wider text-slate-100 uppercase font-arcade truncate">
          <span className="sm:hidden">Crucible</span>
          <span className="hidden sm:inline">Bio-Hazard Crucible</span>
        </span>
      </div>
      </div>

      {/* Zone 2: 4-5 concise single-line nav links */}
      <nav className="hidden md:flex items-center gap-6 text-xs uppercase tracking-wider font-semibold font-arcade text-slate-400">
        {links.map((link) => (
          <button
            key={link.id}
            onClick={() => handleNav(link.id)}
            className={`${link.hover} transition-colors whitespace-nowrap shrink-0 ${
              activeTab === link.id ? `${link.active} border-b-2 pb-0.5` : ''
            }`}
          >
            {link.id === 'daily' ? 'Daily Challenge' : link.id === 'leaderboard' ? 'Leaderboard' : link.id === 'cloud' ? 'Cloud Sync' : link.label}
          </button>
        ))}
      </nav>

      {/* Zone 3: 1 primary action + audio/biomatter status */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Biomatter currency */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-950/50 border border-sky-700/50 text-sky-300 text-xs font-mono-tech">
          <span className="text-sky-100">RK {rank}</span>
          <span className="text-[10px] text-sky-300/80">{rankTitle}</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-700/50 text-emerald-300 text-xs font-mono-tech tabular-nums">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
          <span>{credits}</span>
          <span className="text-[10px] text-emerald-400/80">BIO</span>
        </div>

        {/* Audio Mute button */}
        <button
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 grid place-items-center p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>

        {/* Primary CTA */}
        <button
          onClick={onLaunch}
          className="min-h-11 sm:min-h-0 px-3 py-2 sm:py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-950 bg-sky-400 hover:bg-sky-300 rounded font-arcade transition-colors shadow-sm shadow-sky-500/30 whitespace-nowrap shrink-0"
        >
          <span className="sm:hidden">Play</span>
          <span className="hidden sm:inline">Quick Launch</span>
        </button>
      </div>
      </div>
      <nav className="md:hidden flex gap-4 overflow-x-auto px-3 pb-2 text-[10px] uppercase tracking-wider font-arcade text-slate-400">
        {links.map((link) => (
          <button
            key={link.id}
            onClick={() => handleNav(link.id)}
            className={`shrink-0 min-h-11 ${link.hover} ${activeTab === link.id ? link.active : ''}`}
          >
            {link.label}
          </button>
        ))}
      </nav>
    </header>
  );
};
