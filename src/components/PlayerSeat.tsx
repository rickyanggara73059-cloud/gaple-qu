import React from 'react';
import { Player } from '../types/domino';
import { Mic, MicOff, Award, Coins, UserPlus } from 'lucide-react';

interface PlayerSeatProps {
  player?: Player | null;
  seatIndex: number;
  isCurrentTurn: boolean;
  turnProgress: number; // 0 to 100%
  timeLeft: number; // in seconds
  isLocal: boolean;
  onSelectForSticker?: (seatIndex: number) => void;
  onInvitePlayer?: () => void;
  chatBubbleText?: string | null;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  seatIndex,
  isCurrentTurn,
  turnProgress,
  timeLeft,
  isLocal,
  onSelectForSticker,
  onInvitePlayer,
  chatBubbleText,
}) => {
  // If no player occupies this seat, render an empty seat slot waiting for invite link clicker
  if (!player) {
    return (
      <div className="relative flex flex-col items-center select-none group">
        <button
          type="button"
          onClick={onInvitePlayer}
          className="relative flex flex-col items-center justify-center w-11 h-11 sm:w-14 sm:h-14 md:w-18 md:h-18 rounded-full border-2 border-dashed border-amber-400/50 bg-black/50 hover:bg-black/70 hover:border-amber-400 text-amber-300 transition-all cursor-pointer shadow-lg active:scale-95 group-hover:scale-105"
          aria-label={`Kursi Kosong #${seatIndex + 1} - Klik untuk undang`}
        >
          <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 group-hover:text-amber-300 transition-colors animate-pulse" />
          <span className="text-[8px] sm:text-[9px] font-bold text-amber-300 uppercase tracking-tight">
            Undang
          </span>
        </button>

        <div className="mt-1 flex flex-col items-center bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-slate-700/60 min-w-[70px] sm:min-w-[85px] md:min-w-[96px] shadow-sm">
          <span className="text-[9px] sm:text-[10px] md:text-[11px] font-semibold text-slate-300">
            Kursi #{seatIndex + 1}
          </span>
          <span className="text-[8px] sm:text-[9px] text-amber-400/90 italic font-medium whitespace-nowrap">
            Menunggu...
          </span>
        </div>
      </div>
    );
  }

  // SVG circular timer radius responsive
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (turnProgress / 100) * circumference;

  // Timer color
  const timerStroke = timeLeft <= 4 ? '#ef4444' : timeLeft <= 8 ? '#f59e0b' : '#10b981';

  return (
    <div className="relative flex flex-col items-center select-none group">
      {/* Floating Chat Bubble */}
      {chatBubbleText && (
        <div className="absolute -top-9 z-30 max-w-[130px] sm:max-w-[160px] bg-slate-900/95 text-white text-[10px] sm:text-xs px-2.5 py-1 rounded-2xl rounded-bl-none border border-amber-400/40 shadow-lg animate-bounce pointer-events-none truncate">
          {chatBubbleText}
        </div>
      )}

      {/* Avatar with Turn Timer Ring & Voice Ripple */}
      <div className="relative flex items-center justify-center">
        {/* Voice Activity Glowing Rings when speaking */}
        {player.isSpeaking && (
          <div className="absolute -inset-1.5 rounded-full border-2 border-emerald-400 animate-ping opacity-60 pointer-events-none" />
        )}

        {/* Circular Turn Timer SVG */}
        {isCurrentTurn && (
          <svg className="absolute -inset-2 w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] -rotate-90 pointer-events-none z-10">
            <circle
              cx="30"
              cy="30"
              r={radius}
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="3.5"
              fill="transparent"
            />
            <circle
              cx="30"
              cy="30"
              r={radius}
              stroke={timerStroke}
              strokeWidth="3.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-300"
            />
          </svg>
        )}

        {/* Avatar Profile Image */}
        <button
          type="button"
          onClick={() => !isLocal && onSelectForSticker && onSelectForSticker(player.seatIndex)}
          className={`relative w-11 h-11 sm:w-13 sm:h-13 md:w-15 md:h-15 rounded-full overflow-hidden border-2 transition-transform cursor-pointer ${
            isCurrentTurn
              ? 'border-amber-400 shadow-[0_0_14px_rgba(245,158,11,0.8)] scale-105'
              : 'border-slate-700 hover:border-slate-500'
          }`}
          title={isLocal ? 'Anda' : `Klik ${player.name} untuk kirim stiker/interaksi`}
        >
          <img
            src={player.avatar}
            alt={player.name}
            className="w-full h-full object-cover"
          />
        </button>

        {/* Microphone Voice Status Icon */}
        <div className="absolute -bottom-0.5 -right-0.5 z-20 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center shadow">
          {player.isSpeaking ? (
            <Mic className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400 animate-pulse" />
          ) : player.isMuted ? (
            <MicOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500" />
          ) : (
            <Mic className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />
          )}
        </div>

        {/* Turn Countdown Seconds Badge */}
        {isCurrentTurn && (
          <div
            className={`absolute -top-2 z-20 text-[9px] sm:text-[10px] font-bold font-mono-numbers px-1.5 py-0.2 rounded-full shadow-lg ${
              timeLeft <= 4 ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-500 text-slate-950'
            }`}
          >
            {timeLeft}s
          </div>
        )}
      </div>

      {/* Player Info Box */}
      <div className="mt-1 flex flex-col items-center bg-black/80 backdrop-blur-md px-2 py-0.5 sm:py-1 rounded-xl border border-[#d4af37]/35 min-w-[72px] sm:min-w-[85px] md:min-w-[96px] shadow-lg">
        {/* Name and Host Icon */}
        <div className="flex items-center gap-1 max-w-[70px] sm:max-w-[85px]">
          <span className="text-[10px] sm:text-xs font-semibold text-white truncate">
            {player.name}
          </span>
          {player.isHost && (
            <span title="Host Meja">
              <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 shrink-0" />
            </span>
          )}
        </div>

        {/* Chips */}
        <div className="flex items-center gap-1 text-[9px] sm:text-[11px] font-mono-numbers text-amber-300">
          <Coins className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400 shrink-0" />
          <span>{player.chips >= 1000 ? `${(player.chips / 1000).toFixed(0)}k` : player.chips}</span>
        </div>

        {/* Rank & Card Count */}
        <div className="flex items-center justify-between w-full text-[8px] sm:text-[10px] text-slate-400 mt-0.5 border-t border-white/10 pt-0.5">
          <span className="truncate max-w-[40px] sm:max-w-[50px] text-emerald-300 font-medium">
            {player.rank.split(' ')[0]}
          </span>
          <span className="text-amber-200 font-mono-numbers font-bold">
            {player.cardCount}krt
          </span>
        </div>
      </div>

      {/* Last action badge */}
      {player.lastAction && (
        <div className="mt-0.5 text-[8px] sm:text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800/90 text-amber-200 border border-slate-700 animate-fade-in font-medium max-w-[85px] truncate">
          {player.lastAction}
        </div>
      )}
    </div>
  );
};
