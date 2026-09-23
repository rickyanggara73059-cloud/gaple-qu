import React from 'react';
import { Tile } from '../types/domino';

interface DominoTileProps {
  tile: Tile;
  isFaceDown?: boolean;
  isPlayable?: boolean;
  isSelected?: boolean;
  orientation?: 'vertical' | 'horizontal';
  size?: 'sm' | 'md' | 'lg';
  rotation?: number;
  onClick?: () => void;
  className?: string;
}

export const DominoTile: React.FC<DominoTileProps> = ({
  tile,
  isFaceDown = false,
  isPlayable = false,
  isSelected = false,
  orientation = 'vertical',
  size = 'md',
  rotation = 0,
  onClick,
  className = '',
}) => {
  const [val1, val2] = tile;
  const isDouble = val1 === val2 && !isFaceDown;

  // Sizes in pixels
  const dims = {
    sm: orientation === 'vertical' ? 'w-8 h-16' : 'w-16 h-8',
    md: orientation === 'vertical' ? 'w-11 h-22' : 'w-22 h-11',
    lg: orientation === 'vertical' ? 'w-14 h-28' : 'w-28 h-14',
  }[size];

  // Render individual pip (dot)
  const renderPip = (colored = false) => {
    const dotColor = colored ? 'bg-red-600 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]' : 'bg-slate-900 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]';
    const pipSize = size === 'sm' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2 h-2' : 'w-2.5 h-2.5';
    return <div className={`${pipSize} rounded-full ${dotColor} transition-transform`} />;
  };

  // 3x3 Grid of pips for standard domino values 0..6
  const renderHalf = (value: number) => {
    // 0: empty
    // 1: center
    // 2: top-right, bottom-left
    // 3: top-right, center, bottom-left
    // 4: 4 corners
    // 5: 4 corners + center
    // 6: 2 columns of 3
    const hasCenter = value === 1 || value === 3 || value === 5;
    const hasTopLeft = value === 4 || value === 5 || value === 6;
    const hasTopRight = value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
    const hasMidLeft = value === 6;
    const hasMidRight = value === 6;
    const hasBottomLeft = value === 2 || value === 3 || value === 4 || value === 5 || value === 6;
    const hasBottomRight = value === 4 || value === 5 || value === 6;

    // Use red for balak/doubles, or for specific pips like [1] or [4]
    const useRed = isDouble || value === 1 || value === 4;

    return (
      <div className="relative w-full h-full flex items-center justify-center p-1">
        <div className="grid grid-cols-3 grid-rows-3 w-full h-full items-center justify-items-center">
          {/* Row 1 */}
          <div className="flex items-center justify-center">{hasTopLeft && renderPip(useRed)}</div>
          <div className="flex items-center justify-center"></div>
          <div className="flex items-center justify-center">{hasTopRight && renderPip(useRed)}</div>

          {/* Row 2 */}
          <div className="flex items-center justify-center">{hasMidLeft && renderPip(useRed)}</div>
          <div className="flex items-center justify-center">{hasCenter && renderPip(useRed)}</div>
          <div className="flex items-center justify-center">{hasMidRight && renderPip(useRed)}</div>

          {/* Row 3 */}
          <div className="flex items-center justify-center">{hasBottomLeft && renderPip(useRed)}</div>
          <div className="flex items-center justify-center"></div>
          <div className="flex items-center justify-center">{hasBottomRight && renderPip(useRed)}</div>
        </div>
      </div>
    );
  };

  // Face down rendering (opponent cards or deck)
  if (isFaceDown) {
    return (
      <div
        style={{ transform: `rotate(${rotation}deg)` }}
        className={`relative ${dims} rounded-lg bg-gradient-to-br from-[#2a1708] via-[#1a0e05] to-[#0a0502] border border-[#784617]/50 domino-tile-shadow flex items-center justify-center overflow-hidden shrink-0 select-none ${className}`}
      >
        <div className="absolute inset-1 rounded border border-[#b8860b]/30 bg-[radial-gradient(#b8860b_1px,transparent_1px)] [background-size:6px_6px] opacity-40" />
        <div className="w-5 h-5 rounded-full border border-[#d4af37]/60 flex items-center justify-center z-10 bg-black/40">
          <div className="w-2 h-2 rounded-full bg-[#d4af37]/80" />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{ transform: `rotate(${rotation}deg)` }}
      className={`relative ${dims} rounded-lg transition-all duration-150 select-none shrink-0 
        bg-gradient-to-b from-[#fbf8f0] via-[#f5eedc] to-[#e6d8b8] 
        border border-[#c5b592] domino-tile-shadow
        ${orientation === 'vertical' ? 'flex flex-col' : 'flex flex-row'}
        ${isPlayable ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900 shadow-[0_0_16px_rgba(251,191,36,0.6)] cursor-pointer hover:-translate-y-2' : ''}
        ${isSelected ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 -translate-y-2 shadow-[0_0_20px_rgba(16,185,129,0.7)]' : ''}
        ${onClick && !isPlayable ? 'cursor-pointer hover:-translate-y-1' : ''}
        ${className}
      `}
    >
      {/* Top / Left Half */}
      <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        {renderHalf(val1)}
      </div>

      {/* Center Divider with Brass Spinner Pin */}
      <div
        className={`relative bg-[#8c7853] shrink-0 z-10 flex items-center justify-center
          ${orientation === 'vertical' ? 'w-[90%] h-[2px] mx-auto' : 'h-[90%] w-[2px] my-auto'}
        `}
      >
        {/* Brass Spin Pin (Mata Paku Kuningan di tengah kartu domino) */}
        <div className="absolute w-2 h-2 rounded-full bg-gradient-to-br from-[#ffe082] via-[#d4af37] to-[#8d6e1f] border border-[#594310] shadow-[0_1px_2px_rgba(0,0,0,0.7)] z-20 flex items-center justify-center">
          <div className="w-0.5 h-0.5 rounded-full bg-[#fff] opacity-80" />
        </div>
      </div>

      {/* Bottom / Right Half */}
      <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden">
        {renderHalf(val2)}
      </div>

      {/* Subtle ivory sheen highlight */}
      <div className="absolute inset-0 rounded-lg bg-gradient-to-tr from-transparent via-white/10 to-white/40 pointer-events-none" />
    </button>
  );
};
