import React from 'react';
import { AntiCheatRecord } from '../types/domino';
import { ShieldCheck, ShieldAlert, Cpu, Lock, CheckCircle2, X, RefreshCw } from 'lucide-react';

interface AntiCheatModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: AntiCheatRecord[];
}

export const AntiCheatModal: React.FC<AntiCheatModalProps> = ({
  isOpen,
  onClose,
  records,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Domino Shield™ Anti-Cheat System</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-500/40">
                  Aktif & Terproteksi
                </span>
              </h2>
              <span className="text-[11px] text-slate-400">
                Sistem pencegah kecurangan real-time & verifikasi integritas kartu
              </span>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Active Protection Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-white block">Enkripsi Kartu di Tangan</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Kartu lawan disembunyikan sepenuhnya dari memory DOM untuk mencegah pembacaan DevTools / bot xray.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
              <Cpu className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-white block">Validasi Aturan Meja</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Setiap langkah dicocokkan dengan angka kepala & ekor. Langkah palsu atau manipulasi kartu langsung ditolak.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-white block">Hukum 28 Kartu Domino</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Memastikan tidak ada duplikasi kartu [0|0] hingga [6|6] di seluruh pemain dan pasar.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-white block">Deteksi Bot & Speedhack</span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Memantau waktu reaksi dan urutan paket untuk mencegah skrip bot otomatis atau percepatan jam sistem.
                </p>
              </div>
            </div>
          </div>

          {/* Audit Logs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Log Verifikasi Real-Time
              </span>
              <span className="text-[10px] text-emerald-400 font-mono-numbers flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Monitoring
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-850 max-h-56 overflow-y-auto no-scrollbar font-mono-numbers text-[11px]">
              {records.length === 0 ? (
                <div className="p-4 text-center text-slate-500">
                  Belum ada log verifikasi langkah.
                </div>
              ) : (
                records.map((rec) => (
                  <div key={rec.id} className="p-2.5 flex items-start justify-between gap-3 hover:bg-slate-900/60">
                    <div className="flex items-start gap-2">
                      <span
                        className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                          rec.severity === 'high'
                            ? 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                            : rec.severity === 'medium'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                      />
                      <div>
                        <span className="text-slate-200 block">{rec.detail}</span>
                        <span className="text-[10px] text-slate-500">{rec.signature}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(rec.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Hash State: <strong className="text-emerald-400 font-mono-numbers">SHA-DOMINO-CLEAN</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
