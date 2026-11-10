import React, { useEffect, useState } from 'react';
import { Calendar, Flame, Zap, Award, Target, Play, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { DailyChallengeInfo, LeaderboardItem } from '../game/types';

interface DailyChallengeProps {
  onStartDaily: (modifier: { multiplier: number; id: string; name: string }) => void;
  /** Lets App start a daily run from Header Play if the player is on this tab. */
  onDailyReady?: (modifier: { multiplier: number; id: string; name: string }) => void;
}

export const DailyChallenge: React.FC<DailyChallengeProps> = ({ onStartDaily, onDailyReady }) => {
  const [challenge, setChallenge] = useState<DailyChallengeInfo | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDaily = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/daily-challenge');
      const data = await res.json();
      setChallenge(data);
      if (data?.modifier) {
        onDailyReady?.({
          id: data.modifier.id,
          name: data.modifier.name,
          multiplier: data.modifier.multiplier
        });
      }

      // Also fetch daily scores
      const lbRes = await fetch(`/api/leaderboard?mode=daily&date=${data.date}`);
      const lbData = await lbRes.json();
      setLeaderboard(lbData.entries || []);
    } catch (e) {
      console.warn('Failed to fetch daily challenge:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDaily();
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      {/* Top Banner */}
      <div className="bg-[#090f18] border border-amber-500/40 rounded-lg p-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-arcade text-amber-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>SYNCHRONIZED GLOBAL PROTOCOL</span>
              <span className="text-slate-500">·</span>
              <span className="font-mono-tech">{challenge?.date || 'TODAY'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-arcade text-white mt-1">
              {challenge?.title || 'Daily Sector Infiltration'}
            </h1>
            <p className="text-xs text-slate-400 font-mono-tech mt-1 max-w-xl">
              All pilots worldwide face the identical seeded enemy waves, environmental mutations, and boss encounters.
            </p>
          </div>

          <button
            onClick={() => {
              if (challenge) {
                onStartDaily({
                  id: challenge.modifier.id,
                  name: challenge.modifier.name,
                  multiplier: challenge.modifier.multiplier
                });
              }
            }}
            className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-arcade text-xs sm:text-sm font-bold uppercase rounded shadow-lg shadow-amber-500/30 flex items-center gap-2 transition-transform active:scale-95"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Deploy Daily Mission</span>
          </button>
        </div>

        {/* Active Modifier Box */}
        {challenge && (
          <div className="mt-5 p-4 bg-slate-900/80 border border-slate-800 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-arcade text-xs font-bold text-amber-300">{challenge.modifier.name}</span>
                  <span className="text-[10px] font-mono-tech bg-amber-950/80 text-amber-400 px-2 py-0.5 rounded border border-amber-800/60">
                    +{Math.round((challenge.modifier.multiplier - 1) * 100)}% SCORE MULTIPLIER
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono-tech mt-1 leading-relaxed">
                  {challenge.modifier.description}
                </p>
                <div className="text-[11px] text-sky-400 font-mono-tech mt-1.5 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  <span>Objective: {challenge.modifier.bonusGoal}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0 sm:border-l sm:border-slate-800 sm:pl-4">
              <div className="text-right">
                <div className="text-[10px] text-slate-400 font-mono-tech">Mission Reward</div>
                <div className="text-sm font-bold font-mono-tech text-emerald-400">+{challenge.rewards.biomatter} BIO</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Today's Daily Leaderboard */}
      <div className="bg-[#080d15] border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-arcade uppercase text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Today's Top Operatives</span>
          </h2>
          <button
            onClick={fetchDaily}
            className="text-xs font-mono-tech text-slate-400 hover:text-slate-200 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-mono-tech text-xs">
            No pilots have submitted scores for today's sector yet. Be the first to conquer it!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono-tech text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="pb-2 pl-2">Rank</th>
                  <th className="pb-2">Callsign</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Craft</th>
                  <th className="pb-2">Platform</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leaderboard.map((entry, idx) => (
                  <tr key={entry.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2.5 pl-2 font-arcade text-[10px] text-amber-400">
                      #{idx + 1}
                    </td>
                    <td className="py-2.5 font-bold text-white font-arcade text-[11px]">
                      {entry.name}
                    </td>
                    <td className="py-2.5 text-yellow-300 font-bold tabular-nums text-sm">
                      {entry.score.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-sky-400 font-mono-tech">
                      {entry.shipName}
                    </td>
                    <td className="py-2.5 text-slate-400 text-[11px]">
                      {entry.platform}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
