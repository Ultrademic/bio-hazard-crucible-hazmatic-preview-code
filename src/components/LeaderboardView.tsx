import React, { useEffect, useState } from 'react';
import { Trophy, Medal, Star, RefreshCw, Filter, Sparkles } from 'lucide-react';
import { LeaderboardItem } from '../game/types';

export const LeaderboardView: React.FC = () => {
  const [filterMode, setFilterMode] = useState<'all' | 'standard' | 'daily'>('all');
  const [entries, setEntries] = useState<LeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchScores = async () => {
    setIsLoading(true);
    try {
      const url = filterMode === 'all' ? '/api/leaderboard' : `/api/leaderboard?mode=${filterMode}`;
      const res = await fetch(url);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (e) {
      console.warn('Failed to fetch leaderboard:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, [filterMode]);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#090f18] border border-slate-800 rounded-lg p-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-arcade text-emerald-400">
            <Trophy className="w-4 h-4" />
            <span>GLOBAL COMMUNITY LEADERBOARD</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-arcade text-white mt-1">
            Avaron High Score Archive
          </h1>
          <p className="text-xs text-slate-400 font-mono-tech mt-1">
            Real-time rankings tracked across PC, mobile handheld devices, and arcade cabinets.
          </p>
        </div>

        {/* Filter Segmented Controls (Functional buttons as per frontend-design constitution) */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 text-xs font-arcade rounded transition-colors whitespace-nowrap shrink-0 ${
              filterMode === 'all'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Modes
          </button>
          <button
            onClick={() => setFilterMode('standard')}
            className={`px-3 py-1.5 text-xs font-arcade rounded transition-colors whitespace-nowrap shrink-0 ${
              filterMode === 'standard'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Arcade
          </button>
          <button
            onClick={() => setFilterMode('daily')}
            className={`px-3 py-1.5 text-xs font-arcade rounded transition-colors whitespace-nowrap shrink-0 ${
              filterMode === 'daily'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Daily Missions
          </button>
        </div>
      </div>

      {/* Main Leaderboard Table */}
      <div className="bg-[#080d15] border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-mono-tech text-slate-400">
            Showing top {entries.length} certified flight records
          </div>
          <button
            onClick={fetchScores}
            className="text-xs font-mono-tech text-slate-400 hover:text-slate-200 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Table</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono-tech text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                <th className="pb-3 pl-3">Rank</th>
                <th className="pb-3">Pilot Callsign</th>
                <th className="pb-3">Final Score</th>
                <th className="pb-3">Vessel</th>
                <th className="pb-3">Stage</th>
                <th className="pb-3">Platform</th>
                <th className="pb-3 pr-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {entries.map((entry, idx) => {
                const isGold = idx === 0;
                const isSilver = idx === 1;
                const isBronze = idx === 2;

                return (
                  <tr key={entry.id} className="hover:bg-slate-900/60 transition-colors">
                    <td className="py-3 pl-3">
                      <span className={`font-arcade text-xs font-bold ${
                        isGold ? 'text-amber-400' : isSilver ? 'text-slate-300' : isBronze ? 'text-amber-600' : 'text-slate-500'
                      }`}>
                        #{idx + 1}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="font-arcade text-xs font-bold text-white tracking-wider">
                        {entry.name}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="text-yellow-300 font-bold tabular-nums text-sm">
                        {entry.score.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 text-sky-400">
                      {entry.shipName}
                    </td>
                    <td className="py-3 text-slate-300">
                      Sector {entry.stage}
                    </td>
                    <td className="py-3 text-slate-400 text-[11px]">
                      {entry.platform}
                    </td>
                    <td className="py-3 pr-3 text-right text-slate-500 text-[11px]">
                      {entry.date}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
