import React, { useEffect, useState } from 'react';
import { StickerEvent } from '../types/domino';
import { soundEngine } from '../services/soundEffects';

interface ThrowableOverlayProps {
  events: StickerEvent[];
  seatCoordinates: { [seat: number]: { x: number; y: number } };
}

interface ActiveAnimation {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  icon: string;
  type: string;
  phase: 'flying' | 'impact';
}

export const ThrowableOverlay: React.FC<ThrowableOverlayProps> = ({ events, seatCoordinates }) => {
  const [animations, setAnimations] = useState<ActiveAnimation[]>([]);

  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[events.length - 1];

    const fromCoord = seatCoordinates[latest.fromSeat] || { x: window.innerWidth / 2, y: window.innerHeight - 80 };
    const toCoord = seatCoordinates[latest.toSeat] || { x: window.innerWidth / 2, y: 100 };

    const animId = latest.id;
    const newAnim: ActiveAnimation = {
      id: animId,
      fromX: fromCoord.x,
      fromY: fromCoord.y,
      toX: toCoord.x,
      toY: toCoord.y,
      icon: latest.icon,
      type: latest.stickerType,
      phase: 'flying',
    };

    setAnimations((prev) => [...prev, newAnim]);

    // Flying duration: 550ms
    const timer1 = setTimeout(() => {
      soundEngine.playStickerSound(latest.stickerType);
      setAnimations((prev) =>
        prev.map((a) => (a.id === animId ? { ...a, phase: 'impact' } : a))
      );
    }, 550);

    // Impact duration: 900ms, then remove
    const timer2 = setTimeout(() => {
      setAnimations((prev) => prev.filter((a) => a.id !== animId));
    }, 1450);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [events, seatCoordinates]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {animations.map((anim) => {
        if (anim.phase === 'flying') {
          return (
            <div
              key={anim.id}
              className="absolute text-3xl transition-all duration-500 ease-out drop-shadow-lg"
              style={{
                left: anim.fromX,
                top: anim.fromY,
                transform: `translate(${anim.toX - anim.fromX}px, ${anim.toY - anim.fromY}px) scale(1.3) rotate(360deg)`,
              }}
            >
              {anim.icon}
            </div>
          );
        }

        // Impact phase
        return (
          <div
            key={anim.id}
            className="absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
            style={{ left: anim.toX, top: anim.toY }}
          >
            {anim.type === 'tomato' && (
              <div className="text-5xl animate-ping scale-150 drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]">
                💥🍅💦
              </div>
            )}
            {anim.type === 'egg' && (
              <div className="text-5xl animate-bounce drop-shadow-[0_0_20px_rgba(245,158,11,0.8)]">
                🍳✨
              </div>
            )}
            {anim.type === 'beer' && (
              <div className="text-5xl animate-pulse scale-125">
                🍻🥂🎉
              </div>
            )}
            {anim.type === 'bomb' && (
              <div className="text-6xl animate-ping scale-150 drop-shadow-[0_0_30px_rgba(239,68,68,1)]">
                💥🔥💨
              </div>
            )}
            {anim.type === 'rose' && (
              <div className="text-5xl animate-bounce scale-125">
                🌹💐💖
              </div>
            )}
            {anim.type === 'coins' && (
              <div className="text-5xl animate-bounce scale-125">
                💰✨🪙
              </div>
            )}
            {!['tomato', 'egg', 'beer', 'bomb', 'rose', 'coins'].includes(anim.type) && (
              <div className="text-5xl animate-bounce scale-150 drop-shadow-md">
                {anim.icon}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
