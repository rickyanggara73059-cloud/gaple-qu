import React, { useState } from 'react';
import { LogIn, ArrowRight, Dices, X, UserCheck } from 'lucide-react';

interface JoinRoomPromptModalProps {
  isOpen: boolean;
  roomCode: string;
  onJoin: (playerName: string, avatar: string) => void | Promise<void>;
  onCancel: () => void;
}

const GUEST_AVATARS = [
  { id: '1', name: 'Jawara Hendra', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=HendraVIP' },
  { id: '2', name: 'Ratu Siti', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=SitiVIP' },
  { id: '3', name: 'Bambang Balak', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=BambangGaple' },
  { id: '4', name: 'Rian Pro', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=RianPro' },
  { id: '5', name: 'Sultan Domino', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=SultanGaple' },
];

export const JoinRoomPromptModal: React.FC<JoinRoomPromptModalProps> = ({
  isOpen,
  roomCode,
  onJoin,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(GUEST_AVATARS[0].url);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoin(name.trim() || 'Teman VIP', selectedAvatar);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border-2 border-amber-500/40 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 bg-gradient-to-b from-amber-950/40 via-slate-950 to-slate-950 border-b border-slate-800 text-center relative">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/50 mx-auto flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            <Dices className="w-8 h-8 text-amber-400" />
          </div>

          <h2 className="font-cinzel text-lg font-bold text-amber-300">
            Undangan Bergabung ke Meja
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Anda menerima link undangan masuk ke meja Domino Gaple:
          </p>
          <div className="mt-2 inline-block px-4 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono-numbers font-black text-lg tracking-widest">
            {roomCode}
          </div>
          <p className="text-[11px] text-amber-400/90 mt-2 font-medium">
            🛡️ Meja 100% Manusia Asli (Tanpa Bot)
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Masukkan Nama Anda
            </label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Jawara Gaple..."
              maxLength={20}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Pilih Avatar Karakter
            </label>
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
              {GUEST_AVATARS.map((av) => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => setSelectedAvatar(av.url)}
                  className={`relative w-12 h-12 rounded-full overflow-hidden border-2 shrink-0 transition-transform cursor-pointer ${
                    selectedAvatar === av.url
                      ? 'border-amber-400 ring-2 ring-amber-400/40 scale-105 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                      : 'border-slate-700 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={av.url}
                    alt={av.name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.5)] transition-all cursor-pointer active:scale-95"
            >
              <span>Duduk di Meja</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
