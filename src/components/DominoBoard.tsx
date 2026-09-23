import React, { useRef, useEffect } from 'react';
import { PlacedTile } from '../types/domino';
import { DominoTile } from './DominoTile';
import { ArrowLeft, ArrowRight, ShieldCheck, Layers } from 'lucide-react';

interface DominoBoardProps {
  chain: PlacedTile[];
  headValue: number | null;
  tailValue: number | null;
  onPlayAtEnd: (end: 'left' | 'right') => void;
  canPlayLeft: boolean;
  canPlayRight: boolean;
  isMyTurn: boolean;
  selectedTile: [number, number] | null;
  boneyardCount: number;
}

export const DominoBoard: React.FC<DominoBoardProps> = ({
  chain,
  headValue,
  tailValue,
  onPlayAtEnd,
  canPlayLeft,
  canPlayRight,
  isMyTurn,
  selectedTile,
  boneyardCount,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-center scroll on board updates
  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current;
      el.scrollTo({
        left: (el.scrollWidth - el.clientWidth) / 2,
        behavior: 'smooth',
      });
    }
  }, [chain.length]);

  return (
    <div className="relative w-full h-[180px] sm:h-[220px] md:h-[270px] flex flex-col items-center justify-between select-none overflow-hidden">
      {/* Luxury Table Centerpiece Watermark */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-15">
        <div className="w-36 h-36 sm:w-48 sm:h-48 md:w-64 md:h-64 rounded-full border-2 border-[#d4af37]/40 flex flex-col items-center justify-center p-3">
          <div className="w-full h-full rounded-full border border-dashed border-[#d4af37]/30 flex flex-col items-center justify-center">
            <span className="font-cinzel text-[10px] sm:text-xs md:text-sm tracking-[0.25em] text-[#d4af37] font-bold">
              GAPLE-QU
            </span>
            <div className="w-8 sm:w-12 h-[1px] bg-[#d4af37] my-1" />
            <span className="font-cinzel text-[8px] sm:text-[10px] tracking-[0.2em] text-[#d4af37]/80">
              DOMINO MEJA
            </span>
          </div>
        </div>
      </div>

      {/* Top Indicators Bar (Sisa Pasar, Train Status, Anti-Cheat) */}
      <div className="relative z-20 w-full px-2 sm:px-4 pt-0.5 flex items-center justify-between gap-1">
        {/* Sisa Pasar Indicator */}
        <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm border border-[#d4af37]/30 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs text-amber-200 shadow-md">
          <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
          <span>Pasar: <strong className="font-mono-numbers text-white">{boneyardCount}</strong></span>
        </div>

        {/* Train Sequence Header Indicator */}
        {chain.length > 0 && (
          <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-sm border border-amber-500/40 px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs text-amber-300 font-mono-numbers shadow-lg">
            <span className="text-amber-400 font-bold bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/50">
              [{headValue}]
            </span>
            <span className="text-slate-400 text-[9px] sm:text-[10px]">({chain.length})</span>
            <span className="text-amber-400 font-bold bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/50">
              [{tailValue}]
            </span>
          </div>
        )}

        {/* Anti-cheat real-time badge */}
        <div className="hidden sm:flex items-center gap-1.5 bg-emerald-950/70 backdrop-blur-sm border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] text-emerald-300 shadow-md">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Anti-Cheat</span>
        </div>
      </div>

      {/* Main Domino Train Track */}
      <div
        ref={containerRef}
        className="relative z-10 w-full flex-1 flex items-center px-2 sm:px-8 md:px-16 overflow-x-auto no-scrollbar scroll-smooth py-1"
      >
        <div className="flex items-center mx-auto min-w-max py-1">
          {/* Left End Drop Target Button */}
          {chain.length > 0 && isMyTurn && selectedTile && canPlayLeft && (
            <button
              onClick={() => onPlayAtEnd('left')}
              className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-bold text-[10px] sm:text-xs rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.8)] animate-pulse hover:scale-105 active:scale-95 transition-all mr-2 sm:mr-3 shrink-0 cursor-pointer border border-amber-200"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
              <span className="tracking-tight uppercase font-bold whitespace-nowrap">Kiri [{headValue}]</span>
            </button>
          )}

          {/* Empty Board Initial Prompt */}
          {chain.length === 0 && (
            <div className="flex flex-col items-center justify-center p-3 sm:p-5 border-2 border-dashed border-[#d4af37]/40 rounded-2xl bg-black/40 backdrop-blur-sm text-center shadow-xl max-w-[280px] sm:max-w-none">
              {isMyTurn && selectedTile ? (
                <button
                  onClick={() => onPlayAtEnd('left')}
                  className="px-4 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-[0_0_24px_rgba(245,158,11,0.7)] animate-bounce cursor-pointer border border-amber-200"
                >
                  Pasang Pertama [{selectedTile[0]}|{selectedTile[1]}]
                </button>
              ) : (
                <div className="text-amber-200/90 text-[11px] sm:text-sm font-medium flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>{isMyTurn ? 'Pilih kartu Anda untuk mulai' : 'Menunggu giliran kartu pertama...'}</span>
                </div>
              )}
            </div>
          )}

          {/* Rapat & Berurutan Domino Chain Container */}
          {chain.length > 0 && (
            <div className="flex items-center bg-black/35 backdrop-blur-[2px] p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border border-white/10 shadow-inner">
              {chain.map((pt, idx) => {
                const isDouble = pt.tile[0] === pt.tile[1];
                const isFirst = idx === 0;
                const isLast = idx === chain.length - 1;

                return (
                  <div
                    key={pt.id || idx}
                    className="relative flex items-center transition-all duration-200"
                  >
                    {/* Seamless Tight Joint: size adjusts on mobile */}
                    <div className="hidden sm:block">
                      <DominoTile
                        tile={pt.tile}
                        size="md"
                        orientation={isDouble ? 'vertical' : 'horizontal'}
                        className={`pointer-events-none ${
                          isDouble
                            ? 'mx-[1px] shadow-[0_4px_16px_rgba(0,0,0,0.6)] z-10'
                            : 'mx-0 z-0'
                        }`}
                      />
                    </div>
                    <div className="block sm:hidden">
                      <DominoTile
                        tile={pt.tile}
                        size="sm"
                        orientation={isDouble ? 'vertical' : 'horizontal'}
                        className={`pointer-events-none ${
                          isDouble
                            ? 'mx-[1px] shadow-[0_3px_10px_rgba(0,0,0,0.6)] z-10'
                            : 'mx-0 z-0'
                        }`}
                      />
                    </div>

                    {/* Sequential Connection Seam Dot */}
                    {!isLast && !isDouble && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-amber-400/80 border border-slate-950 z-20 pointer-events-none" />
                    )}

                    {/* HEAD INDICATOR PIN: Left open end */}
                    {isFirst && headValue !== null && (
                      <div className="absolute -top-6 sm:-top-7 left-1/2 -translate-x-1/2 flex flex-col items-center z-30 animate-bounce">
                        <div className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-mono-numbers font-black px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 shadow border border-amber-300 whitespace-nowrap">
                          <span>KIRI</span>
                          <span className="text-[10px] sm:text-xs bg-slate-950 text-amber-300 px-1 rounded font-black">{headValue}</span>
                        </div>
                        <div className="w-0 h-0 border-l-[3px] sm:border-l-[4px] border-l-transparent border-r-[3px] sm:border-r-[4px] border-r-transparent border-t-[4px] sm:border-t-[5px] border-t-amber-500 -mt-[1px]" />
                      </div>
                    )}

                    {/* TAIL INDICATOR PIN: Right open end */}
                    {isLast && tailValue !== null && (
                      <div className="absolute -top-6 sm:-top-7 left-1/2 -translate-x-1/2 flex flex-col items-center z-30 animate-bounce">
                        <div className="flex items-center gap-0.5 text-[9px] sm:text-[10px] font-mono-numbers font-black px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 shadow border border-amber-300 whitespace-nowrap">
                          <span>KANAN</span>
                          <span className="text-[10px] sm:text-xs bg-slate-950 text-amber-300 px-1 rounded font-black">{tailValue}</span>
                        </div>
                        <div className="w-0 h-0 border-l-[3px] sm:border-l-[4px] border-l-transparent border-r-[3px] sm:border-r-[4px] border-r-transparent border-t-[4px] sm:border-t-[5px] border-t-amber-500 -mt-[1px]" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Right End Drop Target Button */}
          {chain.length > 0 && isMyTurn && selectedTile && canPlayRight && (
            <button
              onClick={() => onPlayAtEnd('right')}
              className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-bold text-[10px] sm:text-xs rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.8)] animate-pulse hover:scale-105 active:scale-95 transition-all ml-2 sm:mr-3 shrink-0 cursor-pointer border border-amber-200"
            >
              <span className="tracking-tight uppercase font-bold whitespace-nowrap">Kanan [{tailValue}]</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Visual Helper */}
      {chain.length > 0 && isMyTurn && selectedTile && (
        <div className="relative z-20 pb-0.5 flex items-center gap-1.5 text-[10px] sm:text-xs font-semibold text-amber-300 bg-black/70 px-3 py-0.5 rounded-full border border-amber-500/40 shadow-md">
          <span>Cocok:</span>
          {canPlayLeft && (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-400/50 px-1.5 py-0.2 rounded font-mono-numbers">
              Kiri ({headValue})
            </span>
          )}
          {canPlayLeft && canPlayRight && <span className="text-slate-400">&</span>}
          {canPlayRight && (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-400/50 px-1.5 py-0.2 rounded font-mono-numbers">
              Kanan ({tailValue})
            </span>
          )}
        </div>
      )}
    </div>
  );
};
