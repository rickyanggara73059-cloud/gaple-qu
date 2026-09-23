export type Tile = [number, number];

export type EndChoice = 'left' | 'right';

export interface PlacedTile {
  id: string;
  tile: Tile;
  placedAtEnd: EndChoice;
  orientation: 'horizontal' | 'vertical';
  // rotation in degrees (e.g. 0, 90, 180, 270)
  rotation: number;
  playedBy: string;
  playerName: string;
  playedAt: number;
  // position in sequence from head to tail
  chainIndex: number;
}

export type RankTier = 
  | 'Perunggu (Bronze)'
  | 'Perak (Silver)'
  | 'Emas (Gold)'
  | 'Platinum'
  | 'Diamond'
  | 'Master Domino'
  | 'Dewa Gaple';

export interface Player {
  id: string;
  name: string;
  avatar: string;
  seatIndex: number; // 0 to 4
  chips: number;
  mmr: number;
  rank: RankTier;
  hand: Tile[]; // For local player; for opponents in anti-cheat mode, this is masked or tile count only
  cardCount: number;
  isBot: boolean;
  isTurn: boolean;
  isHost: boolean;
  isReady: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  voiceLevel: number; // 0 to 100 for visualizer
  lastAction?: string;
  totalWins: number;
  totalMatches: number;
}

export type GameStatus = 
  | 'WAITING'      // Waiting for players / ready
  | 'SHUFFLING'    // Shuffling animation & sound
  | 'PLAYING'      // Active round
  | 'ROUND_END'    // Round finished (someone emptied hand)
  | 'GAPLE_BLOCKED'; // "Gaple!" / Buntu (nobody can move, count pips)

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderSeat: number;
  text: string;
  timestamp: number;
  isQuick: boolean;
}

export interface StickerEvent {
  id: string;
  fromSeat: number;
  toSeat: number;
  stickerType: 'tomato' | 'egg' | 'beer' | 'bomb' | 'rose' | 'coins' | 'laugh' | 'cry' | 'rage' | 'cool';
  icon: string;
  label: string;
  timestamp: number;
}

export interface AntiCheatRecord {
  id: string;
  timestamp: number;
  eventType: 'HAND_MASK_VERIFIED' | 'MOVE_VALIDATED' | 'TIMING_VERIFIED' | 'INTEGRITY_SHIELD' | 'CHEATING_PREVENTED';
  detail: string;
  severity: 'low' | 'medium' | 'high';
  signature: string;
}

export interface GameSettings {
  turnTimeLimit: number; // e.g. 15 seconds
  soundVolume: number;
  voiceChatEnabled: boolean;
  antiCheatStrict: boolean;
  tableColor: 'emerald' | 'sapphire' | 'ruby' | 'mahogany';
}
