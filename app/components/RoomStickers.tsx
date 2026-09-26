"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  roomId: string;
  playerId: string;
  playerName: string;
};

type StickerEvent = {
  id: string;
  playerId: string;
  playerName: string;
  sticker: string;
};

const STICKERS = [
  "😂",
  "🔥",
  "👏",
  "🎉",
  "😎",
  "😱",
  "❤️",
  "👍",
];

export default function RoomStickers({
  roomId,
  playerId,
  playerName,
}: Props) {
  const [burst, setBurst] = useState<StickerEvent | null>(null);
  const channelRef = useRef<ReturnType<
    typeof supabase.channel
  > | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    const channel = supabase
      .channel(`domino-stickers-${roomId}`)
      .on(
        "broadcast",
        { event: "sticker" },
        ({ payload }) => {
          const sticker = payload as StickerEvent;

          setBurst(sticker);

          if (timerRef.current) {
            clearTimeout(timerRef.current);
          }

          timerRef.current = setTimeout(() => {
            setBurst(null);
          }, 1500);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      channelRef.current = null;

      supabase.removeChannel(channel);
    };
  }, [roomId]);

  async function sendSticker(sticker: string) {
    const channel = channelRef.current;

    if (!channel) return;

    const payload: StickerEvent = {
      id: `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`,
      playerId,
      playerName,
      sticker,
    };

    setBurst(payload);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setBurst(null);
    }, 1500);

    await channel.send({
      type: "broadcast",
      event: "sticker",
      payload,
    });
  }

  return (
    <>
      {burst && (
        <div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-bounce text-8xl drop-shadow-[0_15px_35px_rgba(0,0,0,0.45)]">
              {burst.sticker}
            </div>

            <div className="mt-3 rounded-full border border-white/10 bg-[#061923]/90 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/70 backdrop-blur-xl">
              {burst.playerName}
            </div>
          </div>
        </div>
      )}

      <div className="mb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">
            Stickers
          </span>

          <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/15">
            LIVE
          </span>
        </div>

        <div className="grid grid-cols-8 gap-1.5">
          {STICKERS.map((sticker) => (
            <button
              key={sticker}
              type="button"
              onClick={() => void sendSticker(sticker)}
              className="rounded-xl border border-white/10 bg-white/[0.03] py-2 text-lg transition hover:-translate-y-0.5 hover:bg-white/[0.07] active:scale-95"
            >
              {sticker}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
