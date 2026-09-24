import React, { useEffect, useMemo, useRef, useState } from 'react';
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

type LayoutItem = {
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
};

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
  const [boardWidth, setBoardWidth] = useState(375);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateWidth = () => {
      setBoardWidth(Math.max(280, el.clientWidth));
    };

    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);

    window.addEventListener('resize', updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  const isMobile = boardWidth < 640;

  const mobileCardsPerRow = boardWidth < 360 ? 6 : 7;
  const mobileHorizontalStep = 50;
  const mobileRowPitch = 54;
  const mobileStartX = boardWidth < 360 ? 24 : 28;
  const mobileStartY = 26;

  const chainLayout = useMemo<LayoutItem[]>(() => {
    if (!chain.length || !isMobile) {
      return [];
    }

    const result: LayoutItem[] = [];

    let index = 0;
    let row = 0;
    let direction: 1 | -1 = 1;

    while (index < chain.length) {
      const rowStartX = direction === 1
        ? mobileStartX
        : boardWidth - mobileStartX - 32;

      const rowY = mobileStartY + row * mobileRowPitch;

      /*
       * First row:
       *   all cards horizontal.
       *
       * Next rows:
       *   first card is vertical and acts as the 90° turn,
       *   following cards travel in the opposite direction.
       */
      const rowCapacity =
        row === 0
          ? mobileCardsPerRow
          : mobileCardsPerRow;

      const count = Math.min(
        rowCapacity,
        chain.length - index
      );

      if (row === 0) {
        for (let i = 0; i < count; i++) {
          const x =
            direction === 1
              ? rowStartX + i * mobileHorizontalStep
              : rowStartX - i * mobileHorizontalStep;

          const tile = chain[index + i];

          result.push({
            x,
            y: rowY,
            orientation:
              tile.tile[0] === tile.tile[1]
                ? 'vertical'
                : 'horizontal',
          });
        }

        index += count;
      } else {
        /*
         * First tile of each following row is the turning tile.
         */
        const turnTile = chain[index];

        const turnX = rowStartX;

        result.push({
          x: turnX,
          y: rowY,
          orientation: 'vertical',
        });

        index++;

        const horizontalCount = Math.min(
          count - 1,
          chain.length - index
        );

        for (
          let i = 0;
          i < horizontalCount;
          i++
        ) {
          const x =
            direction === 1
              ? turnX + 48 + i * mobileHorizontalStep
              : turnX - 48 - i * mobileHorizontalStep;

          const tile = chain[index + i];

          result.push({
            x,
            y: rowY,
            orientation:
              tile.tile[0] === tile.tile[1]
                ? 'vertical'
                : 'horizontal',
          });
        }

        index += horizontalCount;
      }

      row++;
      direction =
        direction === 1
          ? -1
          : 1;
    }

    return result;
  }, [
    boardWidth,
    chain,
    isMobile,
    mobileCardsPerRow,
  ]);

  const mobileRows = Math.max(
    1,
    Math.ceil(chain.length / mobileCardsPerRow)
  );

  const mobileBoardHeight = Math.max(
    180,
    mobileStartY +
      (mobileRows - 1) * mobileRowPitch +
      76
  );

  const getTileIsSelected = (tile: [number, number]) =>
    selectedTile !== null &&
    (
      (
        selectedTile[0] === tile[0] &&
        selectedTile[1] === tile[1]
      ) ||
      (
        selectedTile[0] === tile[1] &&
        selectedTile[1] === tile[0]
      )
    );

  return (
    <div
      ref={containerRef}
      className={`relative w-full flex flex-col items-center justify-between select-none ${
        isMobile
          ? 'min-h-[180px] overflow-visible'
          : 'h-[180px] sm:h-[220px] md:h-[270px] overflow-hidden'
      }`}
      style={
        isMobile && chain.length > 0
          ? { height: `${mobileBoardHeight}px` }
          : undefined
      }
    >
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

      {/* Top Indicators */}
      <div className="relative z-30 w-full px-2 sm:px-4 pt-0.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm border border-[#d4af37]/30 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs text-amber-200 shadow-md">
          <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
          <span>
            Pasar:{' '}
            <strong className="font-mono-numbers text-white">
              {boneyardCount}
            </strong>
          </span>
        </div>

        {chain.length > 0 && (
          <div className="flex items-center gap-1.5 bg-black/75 backdrop-blur-sm border border-amber-500/40 px-2.5 sm:px-3.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs text-amber-300 font-mono-numbers shadow-lg">
            <span className="text-amber-400 font-bold bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/50">
              [{headValue}]
            </span>
            <span className="text-slate-400 text-[9px] sm:text-[10px]">
              ({chain.length})
            </span>
            <span className="text-amber-400 font-bold bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/50">
              [{tailValue}]
            </span>
          </div>
        )}

        <div className="hidden sm:flex items-center gap-1.5 bg-emerald-950/70 backdrop-blur-sm border border-emerald-500/40 px-2 py-0.5 rounded-full text-[10px] text-emerald-300 shadow-md">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Anti-Cheat</span>
        </div>
      </div>

      {/* ======================================================
          MOBILE SERPENTINE BOARD
         ====================================================== */}
      {isMobile ? (
        <div
          className="relative z-20 w-full flex-1 overflow-visible"
        >
          {chain.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              {isMyTurn && selectedTile ? (
                <button
                  type="button"
                  onClick={() => onPlayAtEnd('left')}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-[0_0_24px_rgba(245,158,11,0.7)] animate-bounce cursor-pointer border border-amber-200"
                >
                  Pasang Pertama [{selectedTile[0]}|{selectedTile[1]}]
                </button>
              ) : (
                <div className="text-amber-200/90 text-[11px] font-medium flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>
                    {isMyTurn
                      ? 'Pilih kartu Anda untuk mulai'
                      : 'Menunggu giliran kartu pertama...'}
                  </span>
                </div>
              )}
            </div>
          )}

          {chain.length > 0 && (
            <div className="relative w-full h-full">
              {/* Mobile direction chooser */}
              {isMyTurn &&
                selectedTile &&
                (canPlayLeft || canPlayRight) && (
                  <div className="absolute left-1/2 bottom-3 z-[70] -translate-x-1/2 w-[calc(100%-24px)] max-w-[360px]">
                    <div className="flex items-center justify-center gap-2 rounded-2xl border border-amber-300/60 bg-black/85 p-2.5 shadow-[0_8px_30px_rgba(0,0,0,.65)] backdrop-blur-md">
                      {canPlayLeft && (
                        <button
                          type="button"
                          onClick={() => onPlayAtEnd('left')}
                          className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-2 text-[11px] font-black uppercase tracking-tight text-slate-950 shadow-[0_0_16px_rgba(245,158,11,.45)] cursor-pointer select-none touch-manipulation active:scale-[0.97]"
                        >
                          <ArrowLeft className="h-4 w-4 stroke-[3]" />
                          <span>KIRI [{headValue}]</span>
                        </button>
                      )}

                      {canPlayRight && (
                        <button
                          type="button"
                          onClick={() => onPlayAtEnd('right')}
                          className="flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-2 text-[11px] font-black uppercase tracking-tight text-slate-950 shadow-[0_0_16px_rgba(245,158,11,.45)] cursor-pointer select-none touch-manipulation active:scale-[0.97]"
                        >
                          <span>KANAN [{tailValue}]</span>
                          <ArrowRight className="h-4 w-4 stroke-[3]" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

              {/* Serpentine Cards */}
              {chain.map((pt, idx) => {
                const layout =
                  chainLayout[idx];

                if (!layout) {
                  return null;
                }

                const isDouble =
                  pt.tile[0] === pt.tile[1];

                return (
                  <div
                    key={pt.id || idx}
                    className="absolute flex items-center justify-center"
                    style={{
                      left: `${layout.x}px`,
                      top: `${layout.y}px`,
                      transform:
                        'translate(-50%, -50%)',
                      zIndex:
                        isDouble ? 30 : 20,
                    }}
                  >
                    <DominoTile
                      tile={pt.tile}
                      size="sm"
                      orientation={layout.orientation}
                      className={`pointer-events-none ${
                        isDouble
                          ? 'shadow-[0_3px_12px_rgba(0,0,0,.65)]'
                          : 'shadow-[0_2px_8px_rgba(0,0,0,.45)]'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ====================================================
           DESKTOP / TABLET - KEEP ORIGINAL LARGE HORIZONTAL
           ==================================================== */
        <div className="relative z-20 w-full min-w-0 flex-1 flex items-center justify-center overflow-hidden px-1 sm:px-4 md:px-8 py-2">
          <div className="flex w-max min-w-max shrink-0 items-center mx-auto px-3 sm:px-0 py-2">
            {chain.length > 0 &&
              isMyTurn &&
              selectedTile &&
              canPlayLeft && (
                <button
                  type="button"
                  onClick={() => onPlayAtEnd('left')}
                  className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-bold text-[10px] sm:text-xs rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.8)] animate-pulse hover:scale-105 active:scale-95 transition-all mr-2 sm:mr-3 shrink-0 cursor-pointer border border-amber-200"
                >
                  <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                  <span className="tracking-tight uppercase font-bold whitespace-nowrap">
                    Kiri [{headValue}]
                  </span>
                </button>
              )}

            {chain.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-3 sm:p-5 border-2 border-dashed border-[#d4af37]/40 rounded-2xl bg-black/40 backdrop-blur-sm text-center shadow-xl max-w-[280px] sm:max-w-none">
                {isMyTurn && selectedTile ? (
                  <button
                    type="button"
                    onClick={() => onPlayAtEnd('left')}
                    className="px-4 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs sm:text-sm rounded-xl shadow-[0_0_24px_rgba(245,158,11,0.7)] animate-bounce cursor-pointer border border-amber-200"
                  >
                    Pasang Pertama [{selectedTile[0]}|{selectedTile[1]}]
                  </button>
                ) : (
                  <div className="text-amber-200/90 text-[11px] sm:text-sm font-medium flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>
                      {isMyTurn
                        ? 'Pilih kartu Anda untuk mulai'
                        : 'Menunggu giliran kartu pertama...'}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center bg-black/35 backdrop-blur-[2px] p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border border-white/10 shadow-inner">
                {chain.map((pt, idx) => {
                  const isDouble =
                    pt.tile[0] === pt.tile[1];
                  const isLast =
                    idx === chain.length - 1;

                  return (
                    <div
                      key={pt.id || idx}
                      className="relative flex shrink-0 items-center"
                    >
                      <DominoTile
                        tile={pt.tile}
                        size="md"
                        orientation={
                          isDouble
                            ? 'vertical'
                            : 'horizontal'
                        }
                        className={`pointer-events-none ${
                          isDouble
                            ? 'mx-[1px] shadow-[0_4px_16px_rgba(0,0,0,.6)] z-10'
                            : 'mx-0 z-0'
                        }`}
                      />

                      {!isLast &&
                        !isDouble && (
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-1 sm:w-1.5 h-1 sm:h-1.5 rounded-full bg-amber-400/80 border border-slate-950 z-20 pointer-events-none" />
                        )}
                    </div>
                  );
                })}
              </div>
            )}

            {chain.length > 0 &&
              isMyTurn &&
              selectedTile &&
              canPlayRight && (
                <button
                  type="button"
                  onClick={() => onPlayAtEnd('right')}
                  className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 font-bold text-[10px] sm:text-xs rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.8)] animate-pulse hover:scale-105 active:scale-95 transition-all ml-2 sm:mr-3 shrink-0 cursor-pointer border border-amber-200"
                >
                  <span className="tracking-tight uppercase font-bold whitespace-nowrap">
                    Kanan [{tailValue}]
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                </button>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

