import React from 'react';
import { Player, RankTier } from '../types/domino';
import { Trophy, Award, Flame, X, CheckCircle2 } from 'lucide-react';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlayer: Player;
}

interface LeaderboardEntry {
  rankPosition: number;
  name: string;
  avatar: string;
  mmr: number;
  tier: RankTier;
  winRate: number;
  winStreak: number;
}

const TOP_PLAYERS: LeaderboardEntry[] = [
  { rankPosition: 1, name: 'Bambang "Dewa Balak"', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bambang', mmr: 3420, tier: 'Dewa Gaple', winRate: 78.4, winStreak: 12 },
  { rankPosition: 2, name: 'Siti Ratu Gaple', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Siti', mmr: 3180, tier: 'Dewa Gaple', winRate: 74.2, winStreak: 7 },
  { rankPosition: 3, name: 'Kapten Hendra', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Hendra', mmr: 2890, tier: 'Master Domino', winRate: 69.8, winStreak: 5 },
  { rankPosition: 4, name: 'Joko Balak Enam', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Joko', mmr: 2650, tier: 'Master Domino', winRate: 66.5, winStreak: 4 },
  { rankPosition: 5, name: 'Rian Nusantara', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Rian', mmr: 2340, tier: 'Diamond', winRate: 62.1, winStreak: 3 },
  { rankPosition: 6, name: 'Doni Penakluk Pasar', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Doni', mmr: 2110, tier: 'Diamond', winRate: 59.4, winStreak: 2 },
  { rankPosition: 7, name: 'Mega Gaple Queen', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Mega', mmr: 1840, tier: 'Platinum', winRate: 55.0, winStreak: 1 },
];

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentPlayer,
}) => {
  if (!isOpen) return null;

  const winRate = currentPlayer.totalMatches > 0
    ? ((currentPlayer.totalWins / currentPlayer.totalMatches) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Sistem Peringkat & Leaderboard Domino
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Current Player Card */}
          <div className="bg-gradient-to-r from-amber-950/40 via-slate-850 to-slate-900 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-amber-400 shadow">
                <img
                  src={currentPlayer.avatar}
                  alt={currentPlayer.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">{currentPlayer.name}</span>
                  <span className="text-xs text-amber-300 font-semibold">({currentPlayer.rank})</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span>Rating MMR: <strong className="text-amber-400 font-mono-numbers">{currentPlayer.mmr}</strong></span>
                  <span>·</span>
                  <span>Menang: <strong className="text-white font-mono-numbers">{currentPlayer.totalWins}</strong>/{currentPlayer.totalMatches}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs text-slate-400 block">Win Rate</span>
              <span className="text-lg font-bold font-mono-numbers text-emerald-400">{winRate}%</span>
            </div>
          </div>

          {/* Tier Progression Hierarchy */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              Tingkatan Peringkat (Tiers)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-amber-400 font-bold block">Dewa Gaple</span>
                <span className="text-slate-400 text-[11px] font-mono-numbers">3000+ MMR</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-red-400 font-bold block">Master Domino</span>
                <span className="text-slate-400 text-[11px] font-mono-numbers">2400 - 2999</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-cyan-400 font-bold block">Diamond</span>
                <span className="text-slate-400 text-[11px] font-mono-numbers">1900 - 2399</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-emerald-400 font-bold block">Platinum</span>
                <span className="text-slate-400 text-[11px] font-mono-numbers">1500 - 1899</span>
              </div>
            </div>
          </div>

          {/* Top 7 Master Players */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span>Top 7 Jawara Domino Gaple Indonesia</span>
            </h3>
            <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-850 overflow-hidden">
              {TOP_PLAYERS.map((player) => (
                <div
                  key={player.rankPosition}
                  className="flex items-center justify-between p-3 hover:bg-slate-900 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 text-center font-mono-numbers font-bold text-sm ${
                        player.rankPosition === 1
                          ? 'text-amber-400'
                          : player.rankPosition === 2
                          ? 'text-slate-300'
                          : player.rankPosition === 3
                          ? 'text-amber-600'
                          : 'text-slate-500'
                      }`}
                    >
                      #{player.rankPosition}
                    </span>
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-slate-700">
                      <img
                        src={player.avatar}
                        alt={player.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">{player.name}</span>
                      <span className="text-[10px] text-amber-400/80 font-medium">{player.tier}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono-numbers text-right">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Streak</span>
                      <span className="text-orange-400 font-bold">{player.winStreak}x 🔥</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">MMR</span>
                      <span className="text-amber-400 font-bold">{player.mmr}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
