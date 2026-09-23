import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  QrCode,
  Send,
  X,
  Sparkles,
  ExternalLink,
  Users
} from 'lucide-react';

interface ShareRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  hostName: string;
  playerCount: number;
}

export const ShareRoomModal: React.FC<ShareRoomModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  hostName,
  playerCount,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedCodeOnly, setCopiedCodeOnly] = useState(false);

  if (!isOpen) return null;

  // Build the shareable URL
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const joinUrl = `${origin}${pathname}?room=${encodeURIComponent(roomCode)}`;

  const inviteText = `🀄 *Undangan Main GAPLE-QU Online*\n\nRoom: *${roomCode}*\nHost: *${hostName}*\nKapasitas: ${playerCount} Pemain\n\nKlik tautan ini untuk langsung bergabung ke meja:\n👉 ${joinUrl}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = joinUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyCodeOnly = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCodeOnly(true);
      setTimeout(() => setCopiedCodeOnly(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleShareWhatsApp = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(inviteText)}`;
    window.open(waUrl, '_blank');
  };

  const handleShareTelegram = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(joinUrl)}&text=${encodeURIComponent(`🀄 Gabung ke meja Domino Gaple Room: ${roomCode} (Host: ${hostName})`)}`;
    window.open(tgUrl, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Meja Domino Gaple: ${roomCode}`,
          text: `Ayo gabung main Domino Gaple di Room ${roomCode}!`,
          url: joinUrl,
        });
      } catch {
        // User cancelled or not supported
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Bagikan Link Room Meja
              </h2>
              <p className="text-[11px] text-slate-400">
                Undang teman untuk bergabung ke meja Domino Gaple Anda
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Room PIN Highlight Box */}
          <div className="bg-gradient-to-r from-amber-950/30 via-slate-950 to-slate-950 border border-amber-500/40 rounded-2xl p-4 text-center">
            <span className="text-[11px] uppercase tracking-wider text-amber-300 font-bold block mb-1">
              Kode Meja / Room PIN
            </span>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-mono-numbers font-black tracking-widest text-amber-400">
                {roomCode}
              </span>
              <button
                onClick={handleCopyCodeOnly}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors border border-slate-700"
                title="Salin Kode Saja"
              >
                {copiedCodeOnly ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex items-center justify-center gap-3 text-xs text-slate-400 mt-2">
              <span>Host: <strong className="text-white">{hostName}</strong></span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <strong>Maks 5 Pemain</strong>
              </span>
            </div>
          </div>

          {/* Direct Link Box */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Tautan Langsung Bergabung (Direct Join Link)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={joinUrl}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 font-mono select-all focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Link</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Teman yang membuka link ini akan otomatis masuk ke meja Anda!
            </p>
          </div>

          {/* Social Share Buttons */}
          <div>
            <span className="text-xs font-semibold text-slate-300 block mb-2">
              Kirim Cepat Lewat
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={handleShareWhatsApp}
                className="py-2.5 px-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/80 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow"
              >
                <Send className="w-4 h-4 text-emerald-400" />
                <span>WhatsApp</span>
              </button>

              <button
                onClick={handleShareTelegram}
                className="py-2.5 px-3 rounded-xl bg-sky-950/80 border border-sky-500/40 text-sky-300 hover:bg-sky-900/80 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow"
              >
                <Send className="w-4 h-4 text-sky-400" />
                <span>Telegram</span>
              </button>
            </div>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleNativeShare}
                className="w-full mt-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-700"
              >
                <Share2 className="w-4 h-4 text-amber-400" />
                <span>Bagikan ke Aplikasi Lainnya...</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
