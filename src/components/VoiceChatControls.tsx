import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Headphones } from 'lucide-react';
import { voiceChat } from '../services/voiceChat';
import { soundEngine } from '../services/soundEffects';

interface VoiceChatControlsProps {
  onMicStateChange?: (isOn: boolean) => void;
}

export const VoiceChatControls: React.FC<VoiceChatControlsProps> = ({ onMicStateChange }) => {
  const [isMicOn, setIsMicOn] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  useEffect(() => {
    const unsub = voiceChat.subscribe({
      onLevelChange: (level) => {
        setVoiceLevel(level);
      },
      onError: (err) => {
        console.error('Voice chat error:', err);
      },
    });

    void voiceChat.initialize();

    return () => {
      unsub();
      void voiceChat.destroy();
    };
  }, []);

  const handleToggleMic = async () => {
    const next = await voiceChat.toggleMicrophone();
    setIsMicOn(next);
    onMicStateChange?.(next);
  };

  const handleToggleDeafen = () => {
    const next = voiceChat.toggleDeafen();
    setIsDeafened(next);
  };

  const handleToggleSound = () => {
    const next = !isSoundMuted;
    setIsSoundMuted(next);
    soundEngine.setMuted(next);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    soundEngine.setVolume(val);
  };

  return (
    <div className="flex items-center gap-1 sm:gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl shadow-xl">
      {/* Microphone Toggle */}
      <button
        type="button"
        onClick={handleToggleMic}
        className={`flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1 rounded-lg sm:rounded-xl text-xs font-medium transition-all cursor-pointer ${
          isMicOn
            ? 'bg-emerald-600/90 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]'
            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
        }`}
        title={isMicOn ? 'Matikan Mikrofon (Mute)' : 'Nyalakan Obrolan Suara'}
      >
        {isMicOn ? (
          <>
            <Mic className="w-3.5 h-3.5 text-white animate-pulse" />
            <span className="hidden md:inline">Mic On</span>
          </>
        ) : (
          <>
            <MicOff className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden md:inline">Mic Off</span>
          </>
        )}
      </button>

      {/* Voice level visualizer bars */}
      {isMicOn && (
        <div className="hidden sm:flex items-end gap-0.5 h-4 px-1" title={`Level Suara: ${voiceLevel}%`}>
          <div
            className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
            style={{ height: `${Math.max(20, Math.min(100, voiceLevel * 1.2))}%` }}
          />
          <div
            className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
            style={{ height: `${Math.max(30, Math.min(100, voiceLevel * 1.5))}%` }}
          />
          <div
            className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
            style={{ height: `${Math.max(15, Math.min(100, voiceLevel * 0.9))}%` }}
          />
        </div>
      )}

      {/* Deafen / Speaker Toggle */}
      <button
        type="button"
        onClick={handleToggleDeafen}
        className={`p-1.5 rounded-lg sm:rounded-xl text-xs transition-colors cursor-pointer ${
          isDeafened
            ? 'bg-red-950/80 text-red-400 border border-red-500/30'
            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
        }`}
        title={isDeafened ? 'Suara Pemain Dibisukan' : 'Mendengarkan Suara'}
      >
        <Headphones className="w-3.5 h-3.5" />
      </button>

      {/* Game Sound SFX Toggle */}
      <div className="relative">
        <button
          type="button"
          onClick={handleToggleSound}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowVolumeSlider(!showVolumeSlider);
          }}
          className={`p-1.5 rounded-lg sm:rounded-xl text-xs transition-colors cursor-pointer ${
            isSoundMuted
              ? 'bg-red-950/80 text-red-400 border border-red-500/30'
              : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
          }`}
          title="SFX Suara Kocokan & Kartu"
        >
          {isSoundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* Volume popover */}
        {showVolumeSlider && (
          <div className="absolute bottom-9 right-0 bg-slate-900 border border-slate-700 p-2 rounded-xl shadow-2xl z-50 flex items-center gap-2 w-28 sm:w-32">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
        )}
      </div>
    </div>
  );
};


