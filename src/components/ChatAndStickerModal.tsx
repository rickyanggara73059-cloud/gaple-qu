import React, { useState } from 'react';
import { ChatMessage, StickerEvent } from '../types/domino';
import { Send, Smile, MessageSquare, X, Flame } from 'lucide-react';

interface ChatAndStickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string, isQuick?: boolean) => void;
  onSendSticker: (targetSeat: number, stickerType: StickerEvent['stickerType']) => void;
  selectedTargetSeat: number | null;
  playerNames: { [seat: number]: string };
  localSeatIndex: number;
}

export const STICKER_ITEMS: {
  type: StickerEvent['stickerType'];
  icon: string;
  name: string;
  isThrowable: boolean;
}[] = [
  { type: 'tomato', icon: '🍅', name: 'Lempar Tomat', isThrowable: true },
  { type: 'egg', icon: '🥚', name: 'Lempar Telur', isThrowable: true },
  { type: 'beer', icon: '🍺', name: 'Tos Bir', isThrowable: true },
  { type: 'bomb', icon: '💣', name: 'Ledakkan Bom', isThrowable: true },
  { type: 'rose', icon: '🌹', name: 'Kirim Mawar', isThrowable: true },
  { type: 'coins', icon: '💰', name: 'Hujan Koin', isThrowable: true },
  { type: 'laugh', icon: '😂', name: 'Tertawa', isThrowable: false },
  { type: 'rage', icon: '😡', name: 'Emosi/Kesal', isThrowable: false },
  { type: 'cool', icon: '😎', name: 'Santai Bos', isThrowable: false },
  { type: 'cry', icon: '😭', name: 'Menangis', isThrowable: false },
];

export const QUICK_CHAT_MESSAGES = [
  'Ayo jalan, jangan lama-lama! ⏳',
  'Aduh kena balak gua! 💥',
  'Santai bos, rezeki gak ketuker 😎',
  'Gaskeun sampai Gaple! 🔥',
  'Hoki banget lu bro! 🍀',
  'Lewat dulu ya kawan 😅',
  'GG! Permainan mantap! 🏆',
  'Hati-hati kartu mati tuh! ⚠️',
];

export const ChatAndStickerModal: React.FC<ChatAndStickerModalProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onSendSticker,
  selectedTargetSeat,
  playerNames,
  localSeatIndex,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'stickers'>('chat');
  const [inputText, setInputText] = useState('');
  const [targetSeat, setTargetSeat] = useState<number>(selectedTargetSeat ?? (localSeatIndex === 0 ? 1 : 0));

  if (!isOpen) return null;

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), false);
    setInputText('');
  };

  const handleQuickChat = (msg: string) => {
    onSendMessage(msg, true);
  };

  const handleStickerClick = (type: StickerEvent['stickerType']) => {
    onSendSticker(targetSeat, type);
    // Don't close immediately so user can spam or throw multiple
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[520px]">
        {/* Header with Tabs */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Obrolan Meja</span>
            </button>
            <button
              onClick={() => setActiveTab('stickers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'stickers'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smile className="w-3.5 h-3.5" />
              <span>Stiker & Lemparan</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab 1: Live Chat */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col justify-between overflow-hidden p-3 gap-2">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                  <MessageSquare className="w-8 h-8 opacity-30 mb-1" />
                  <span>Belum ada pesan. Mulai obrolan atau gunakan quick chat!</span>
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.senderSeat === localSeatIndex;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
                        <span className="font-semibold text-amber-300">{m.senderName}</span>
                        <span>·</span>
                        <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div
                        className={`px-3 py-1.5 rounded-2xl text-xs max-w-[85%] break-words ${
                          isMe
                            ? 'bg-amber-500 text-slate-950 font-medium rounded-br-none'
                            : 'bg-slate-800 text-white border border-slate-700 rounded-bl-none'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Chat Phrases Carousel */}
            <div className="border-t border-slate-800 pt-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1 block">
                Pesan Cepat:
              </span>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {QUICK_CHAT_MESSAGES.map((msg, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickChat(msg)}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 border border-slate-700 hover:border-amber-400/40 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSend} className="flex items-center gap-2 pt-1 border-t border-slate-800">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ketik pesan untuk semua pemain..."
                maxLength={100}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 bg-amber-500 disabled:opacity-40 text-slate-950 rounded-xl hover:bg-amber-400 transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Stickers & Throwables */}
        {activeTab === 'stickers' && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {/* Target Player Selector */}
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-semibold text-slate-300 block mb-1.5">
                Target Lemparan / Stiker:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[0, 1, 2, 3, 4].map((s) => {
                  if (s === localSeatIndex) return null;
                  const name = playerNames[s] || `Kursi ${s + 1}`;
                  const isSelected = targetSeat === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setTargetSeat(s)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer truncate ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-bold'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sticker Grid */}
            <div>
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1 mb-2">
                <Flame className="w-3.5 h-3.5" />
                <span>Pilih Stiker atau Benda Lemparan:</span>
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {STICKER_ITEMS.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => handleStickerClick(item.type)}
                    className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-amber-400 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md group"
                  >
                    <span className="text-3xl mb-1 group-hover:animate-bounce">{item.icon}</span>
                    <span className="text-[11px] font-medium text-slate-200">{item.name}</span>
                    <span className="text-[9px] text-amber-400/80">
                      {item.isThrowable ? 'Lempar ke target' : 'Ekspresi'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
