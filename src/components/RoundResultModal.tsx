import React from 'react';
import { Player, Tile } from '../types/domino';
import { DominoTile } from './DominoTile';
import { Trophy, RefreshCw, Award, ArrowUpRight, Coins } from 'lucide-react';

interface RoundResultModalProps {
  isOpen: boolean;
  winner: Player | null;
  isGapleBlocked: boolean;
  players: Player[];
  allHands: { [seat: number]: Tile[] };
  onPlayNextRound: () => void;
  localSeatIndex: number;
}

export const RoundResultModal: React.FC<RoundResultModalProps> = ({
  isOpen,
  winner,
  isGapleBlocked,
  players,
  allHands,
  onPlayNextRound,
  localSeatIndex,
}) => {
  if (!isOpen || !winner) return null;

  const isLocalWinner = winner.seatIndex === localSeatIndex;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border-2 border-amber-500/50 w-full max-w-xl rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col">
        {/* Banner Header */}
        <div className="relative py-6 px-6 bg-gradient-to-b from-amber-600/30 via-slate-950 to-slate-950 border-b border-amber-500/30 flex flex-col items-center text-center">
          {/* Trophy Badge */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 border-2 border-amber-200 flex items-center justify-center shadow-[0_0_25px_rgba(251,191,36,0.8)] mb-2">
            <Trophy className="w-9 h-9 text-slate-950" />
          </div>

          <h2 className="font-cinzel text-xl md:text-2xl font-bold text-amber-300 tracking-wider">
            {isGapleBlocked ? 'GAPLE! (BUNTU)' : 'PEMENANG RONDE'}
          </h2>

          <p className="text-xs text-slate-300 mt-1 max-w-md">
            {isGapleBlocked
              ? 'Tidak ada pemain yang dapat melangkah. Pemenang ditentukan dari jumlah mata kartu terendah!'
              : `${winner.name} berhasil menghabiskan seluruh kartu di tangan!`}
          </p>

          {/* Winner Callout */}
          <div className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/40 px-4 py-1.5 rounded-full">
            <span className="text-xs font-semibold text-white">Juara:</span>
            <span className="text-sm font-bold text-amber-400">{winner.name}</span>
            <span className="text-xs font-mono-numbers text-emerald-400 font-bold flex items-center gap-0.5">
              <Coins className="w-3 h-3" /> +50.000
            </span>
            <span className="text-xs font-mono-numbers text-amber-300 font-bold">
              +25 MMR
            </span>
          </div>
        </div>

        {/* Players Showdown Table */}
        <div className="p-6 overflow-y-auto max-h-[45vh] space-y-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Buka Kartu & Rekap Skor Semua Pemain
          </span>

          <div className="divide-y divide-slate-800 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
            {players.map((p) => {
              const pHand = allHands[p.seatIndex] || p.hand || [];
              const pips = pHand.reduce((s, t) => s + (t[0] + t[1]), 0);
              const isW = p.seatIndex === winner.seatIndex;

              return (
                <div
                  key={p.id}
                  className={`p-3 flex items-center justify-between gap-2 ${
                    isW ? 'bg-amber-950/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border border-slate-700 shrink-0">
                      <img
                        src={p.avatar}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{p.name}</span>
                        {isW && (
                          <span className="text-[10px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded-full">
                            Pemenang
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {p.rank} · {p.isBot ? 'Bot' : 'Player'}
                      </span>
                    </div>
                  </div>

                  {/* Hand Cards Showdown */}
                  <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] no-scrollbar py-0.5">
                    {pHand.length === 0 ? (
                      <span className="text-xs text-emerald-400 font-bold">Kartu Habis! 🏆</span>
                    ) : (
                      pHand.map((t, i) => (
                        <DominoTile
                          key={i}
                          tile={t}
                          size="sm"
                          orientation="horizontal"
                          className="scale-90 origin-left shrink-0"
                        />
                      ))
                    )}
                  </div>

                  {/* Pip Count Badge */}
                  <div className="text-right shrink-0 min-w-[50px]">
                    <span className="text-[10px] text-slate-400 block">Sisa Mata</span>
                    <span
                      className={`text-sm font-mono-numbers font-bold ${
                        isW ? 'text-amber-400' : 'text-slate-300'
                      }`}
                    >
                      {pips} dot
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Next Round Button */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {isLocalWinner ? (
              <span className="text-emerald-400 font-semibold">Selamat! Anda memenangkan ronde ini! 🎉</span>
            ) : (
              <span>Ronde selesai. Ayo balas di ronde berikutnya!</span>
            )}
          </div>

          <button
            onClick={onPlayNextRound}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.5)] flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Kocok Kartu & Ronde Baru</span>
          </button>
        </div>
      </div>
    </div>
  );
};
