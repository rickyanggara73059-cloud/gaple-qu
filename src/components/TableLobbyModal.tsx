import React, { useState } from 'react';
import { Users, Sparkles, Dices, Play, RefreshCw, X, PlusCircle, LogIn, Share2, Copy, Check, UserCheck, ShieldCheck } from 'lucide-react';

interface TableLobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartGame: (config: {
    mode: 'create' | 'join';
    playerName: string;
    avatar: string;
    playerCount: number;
    roomCode: string;
    targetScore: number;
  }) => void | Promise<void>;
  currentConfig: {
    playerName: string;
    avatar: string;
    playerCount: number;
    roomCode: string;
    targetScore?: number;
  };
}

const TARGET_SCORES = [100, 250, 500, 1000, 2000, 5000];

function generateRoomCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const a = letters[Math.floor(Math.random() * letters.length)];
  const b = letters[Math.floor(Math.random() * letters.length)];
  const n = Math.floor(100 + Math.random() * 900);
  return `GAPLE-${a}${b}${n}`;
}

const AVATAR_OPTIONS = [
  { id: '1', name: 'VIP Master', url: '/src/assets/images/domino_vip_avatar_1790137590249.jpg' },
  { id: '2', name: 'Jawara Hendra', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=HendraVIP' },
  { id: '3', name: 'Ratu Siti', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=SitiVIP' },
  { id: '4', name: 'Bambang Balak', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=BambangGaple' },
  { id: '5', name: 'Rian Pro', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=RianPro' },
];

export const TableLobbyModal: React.FC<TableLobbyModalProps> = ({
  isOpen,
  onClose,
  onStartGame,
  currentConfig,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [playerName, setPlayerName] = useState(currentConfig.playerName || 'Pemain VIP');
  const [selectedAvatar, setSelectedAvatar] = useState(currentConfig.avatar || AVATAR_OPTIONS[0].url);
  const [playerCount, setPlayerCount] = useState<number>(currentConfig.playerCount || 5);
  const [roomCode, setRoomCode] = useState(currentConfig.roomCode || generateRoomCode());
  const [targetScore, setTargetScore] = useState<number>(currentConfig.targetScore || 500);
  const [inputJoinCode, setInputJoinCode] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const handleGenerateNewCode = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randLetters = letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)];
    const randNum = Math.floor(100 + Math.random() * 900);
    setRoomCode(`GAPLE-${randLetters}${randNum}`);
  };

  const handleCopyLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const joinUrl = `${origin}${pathname}?room=${encodeURIComponent(roomCode)}`;
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRoomCode = (tab === 'join' ? inputJoinCode : roomCode).trim().toUpperCase() || 'GAPLE-VIP-777';
    void onStartGame({
      mode: tab,
      playerName: playerName.trim() || 'Pemain VIP',
      avatar: selectedAvatar,
      playerCount,
      roomCode: finalRoomCode,
      targetScore,

    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Dices className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Buat Meja & Pengaturan Room
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher: Buat Meja Baru vs Masuk Meja yang Ada */}
        <div className="grid grid-cols-2 p-2 bg-slate-950/80 border-b border-slate-800 gap-2">
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              tab === 'create'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Buat Meja Baru</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('join')}
            className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              tab === 'join'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Gabung Meja Teman</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Real Human Only Guarantee Banner */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Meja 100% Manusia Asli:</strong> Tidak ada pemain bot AI. Hanya pemain yang mengklik link undangan yang dapat bergabung ke meja ini.
            </span>
          </div>

          {/* Player Name */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Nama Profil Anda
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              placeholder="Masukkan nama Anda..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-medium"
            />
          </div>

          {/* Avatar Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Pilih Avatar
            </label>
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
              {AVATAR_OPTIONS.map((av) => (
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

          {tab === 'create' ? (
            <>
              {/* Room PIN / Code Generator */}
              <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Kode Meja (Room PIN)
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateNewCode}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Buat Kode Baru</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={14}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-amber-300 font-mono-numbers font-bold tracking-wider uppercase focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="Salin Link Room"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-amber-400" />
                        <span>Salin Link</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Kirim link ini ke teman Anda agar mereka bisa langsung masuk dan menempati kursi meja.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Target Skor Match
                  </label>
                  <span className="text-xs text-amber-400 font-bold font-mono-numbers">
                    {targetScore} Poin
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {TARGET_SCORES.map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setTargetScore(score)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        targetScore === score
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              {/* Player Count in Room (Max 5 Players) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Kapasitas Maksimal Meja
                  </label>
                  <span className="text-xs text-amber-400 font-bold font-mono-numbers">
                    {playerCount} Pemain (Maksimal 5)
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 3, 4, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setPlayerCount(cnt)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        playerCount === cnt
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {cnt} Orang
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Join Room by Code */}
              <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Masukkan Kode Room Teman
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: GAPLE-VIP-777..."
                  value={inputJoinCode}
                  onChange={(e) => setInputJoinCode(e.target.value.toUpperCase())}
                  maxLength={16}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-amber-300 font-mono-numbers font-bold tracking-wider uppercase focus:outline-none focus:border-amber-400"
                />
                <p className="text-[11px] text-slate-400">
                  Minta kode meja atau klik link yang dikirimkan oleh pembuat room untuk langsung bergabung.
                </p>
              </div>
            </>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-sm rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.5)] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>
                {tab === 'create' ? 'Masuk ke Meja Anda' : 'Gabung ke Meja Teman'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
