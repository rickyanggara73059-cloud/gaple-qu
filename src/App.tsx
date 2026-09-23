import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './lib/supabase';
import {
  Tile,
  PlacedTile,
  Player,
  GameStatus,
  ChatMessage,
  StickerEvent,
  AntiCheatRecord,
} from './types/domino';
import {
  createGapleRoom,
  ensureAnonymousSession,
  findRoomByCode,
  joinGapleRoom,
  leaveGapleRoom,
  loadGapleRoom,
  subscribeToGapleRoom,
  type GaplePlayer,
  type GapleRoomSnapshot,
} from './services/roomService';
import {
  generateFullDominoDeck,
  dealTiles,
  getStartingPlayerIndex,
  getPlayableTiles,
  calculateHandPips,
  getRankTierFromMMR,
} from './utils/dominoLogic';
import { soundEngine } from './services/soundEffects';
import { antiCheat } from './services/antiCheat';
import { voiceChat } from './services/voiceChat';
import { DominoTile } from './components/DominoTile';
import { DominoBoard } from './components/DominoBoard';
import { PlayerSeat } from './components/PlayerSeat';
import { VoiceChatControls } from './components/VoiceChatControls';
import { ChatAndStickerModal } from './components/ChatAndStickerModal';
import { ThrowableOverlay } from './components/ThrowableOverlay';
import { LeaderboardModal } from './components/LeaderboardModal';
import { AntiCheatModal } from './components/AntiCheatModal';
import { TableLobbyModal } from './components/TableLobbyModal';
import { RoundResultModal } from './components/RoundResultModal';
import { ShareRoomModal } from './components/ShareRoomModal';
import { JoinRoomPromptModal } from './components/JoinRoomPromptModal';
import {
  MessageSquare,
  Smile,
  Trophy,
  ShieldCheck,
  Settings,
  Layers,
  SkipForward,
  Play,
  RotateCcw,
  Sparkles,
  Share2,
  Users,
  Copy,
  Check,
  UserPlus,
} from 'lucide-react';

const TURN_TIME_LIMIT = 15; // 15 seconds thinking time per turn

export default function App() {
  // Game Setup & Players (Up to 5 human players, ZERO bots)
  const [roomCode, setRoomCode] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomTargetScore, setRoomTargetScore] = useState(500);
  const [localSeatIndex, setLocalSeatIndex] = useState(0);
  const [players, setPlayers] = useState<(Player | null)[]>([null, null, null, null, null]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('WAITING');
  const [boardChain, setBoardChain] = useState<PlacedTile[]>([]);
  const [headValue, setHeadValue] = useState<number | null>(null);
  const [tailValue, setTailValue] = useState<number | null>(null);
  const [boneyard, setBoneyard] = useState<Tile[]>([]);
  const [currentTurnSeat, setCurrentTurnSeat] = useState<number>(0);
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(TURN_TIME_LIMIT);
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null);
  const [consecutivePasses, setConsecutivePasses] = useState<number>(0);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [winner, setWinner] = useState<Player | null>(null);
  const [allHandsCache, setAllHandsCache] = useState<{ [seat: number]: Tile[] }>({});

  // Modals
  const [isLobbyOpen, setIsLobbyOpen] = useState(true);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isJoinPromptOpen, setIsJoinPromptOpen] = useState(false);
  const [pendingJoinRoomCode, setPendingJoinRoomCode] = useState('');
  const [copiedLinkNotification, setCopiedLinkNotification] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isAntiCheatOpen, setIsAntiCheatOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [targetStickerSeat, setTargetStickerSeat] = useState<number | null>(null);

  // Chat, Stickers, Audio & Anti-Cheat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stickerEvents, setStickerEvents] = useState<StickerEvent[]>([]);
  const [antiCheatLogs, setAntiCheatLogs] = useState<AntiCheatRecord[]>(antiCheat.getLogs());
  const [activeChatBubbles, setActiveChatBubbles] = useState<{ [seat: number]: string }>({});

  // Seat screen coordinates for projectile animations
  const [seatCoords, setSeatCoords] = useState<{ [seat: number]: { x: number; y: number } }>({});
  const seatRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];

  // Broadcast Channel for Realtime Multi-User Peer Sync
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  function applyRoomSnapshot(snapshot: GapleRoomSnapshot) {
    setRoomId(snapshot.room.id);
    setRoomCode(snapshot.room.room_code);
    setRoomTargetScore(snapshot.room.target_score);

    const uiPlayers: (Player | null)[] = [null, null, null, null, null];

    for (const player of snapshot.players) {
      if (player.seat < 0 || player.seat > 4) continue;

      const isHost = player.user_id === snapshot.room.host_user_id;
      const mmr = Number(player.mmr ?? (isHost ? 1450 : 1200));

      uiPlayers[player.seat] = {
        id: player.id,
        name: player.player_name,
        avatar: player.avatar,
        seatIndex: player.seat,
        chips: Number(player.chips ?? (isHost ? 250000 : 200000)),
        mmr,
        rank: getRankTierFromMMR(mmr),
        hand: [],
        cardCount: 0,
        isBot: false,
        isTurn: false,
        isHost,
        isReady: true,
        isSpeaking: false,
        isMuted: !isHost,
        voiceLevel: 0,
        totalWins: Number(player.total_wins ?? 0),
        totalMatches: Number(player.total_matches ?? 0),
      };
    }

    setPlayers(uiPlayers);
    const local = snapshot.players.find((player) => player.id === snapshot.localPlayerId);
    setLocalSeatIndex(local?.seat ?? 0);
    window.localStorage.setItem('gaple_active_room_id', snapshot.room.id);
  }

  useEffect(() => {
    let cancelled = false;

    async function initializeRoom() {
      try {
        const session = await ensureAnonymousSession();
        if (cancelled) return;

        const roomParam = new URLSearchParams(window.location.search)
          .get('room')
          ?.trim()
          .toUpperCase();

        if (!roomParam) {
          setIsLobbyOpen(true);
          return;
        }

        const existing = await findRoomByCode(roomParam);

        if (cancelled) return;

        if (existing && existing.players.some((player) => player.user_id === session.user.id)) {
          applyRoomSnapshot(existing);
          setIsLobbyOpen(false);
          setIsJoinPromptOpen(false);
          return;
        }

        setRoomCode(roomParam);
        setPendingJoinRoomCode(roomParam);
        setIsJoinPromptOpen(true);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Gagal menyiapkan room.');
          setIsLobbyOpen(true);
        }
      }
    }

    void initializeRoom();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!roomId) return;

    let cancelled = false;

    async function refreshRoom() {
      try {
        const snapshot = await loadGapleRoom(roomId);
        if (!cancelled) applyRoomSnapshot(snapshot);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'Gagal memuat room.');
        }
      }
    }

    void refreshRoom();
    const unsubscribe = subscribeToGapleRoom(roomId, () => {
      void refreshRoom();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [roomId]);

  useEffect(() => {
    try {
      const channel = new BroadcastChannel('domino_gaple_room');
      broadcastRef.current = channel;

      channel.onmessage = (event) => {
        const { type, payload } = event.data ?? {};

        if (type === 'CHAT_MESSAGE' && payload) {
          setMessages((prev) => [...prev, payload]);
          triggerChatBubble(payload.senderSeat, payload.text);
        } else if (type === 'STICKER_EVENT' && payload) {
          setStickerEvents((prev) => [...prev, payload]);
        }
      };

      return () => {
        channel.close();
        broadcastRef.current = null;
      };
    } catch {
      broadcastRef.current = null;
    }
  }, []);

  // Update Seat Coordinates on resize
  const updateSeatPositions = useCallback(() => {
    const coords: { [seat: number]: { x: number; y: number } } = {};
    seatRefs.forEach((ref, idx) => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        coords[idx] = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }
    });
    setSeatCoords(coords);
  }, []);

  useEffect(() => {
    updateSeatPositions();
    window.addEventListener('resize', updateSeatPositions);
    return () => window.removeEventListener('resize', updateSeatPositions);
  }, [updateSeatPositions]);

  // Voice Chat subscription for local speaking visualizer
  useEffect(() => {
    const unsub = voiceChat.subscribe({
      onLevelChange: (level, isSpeaking) => {
        setPlayers((prev) =>
          prev.map((p) => (p && p.seatIndex === localSeatIndex ? { ...p, voiceLevel: level, isSpeaking } : p))
        );
      },
      onError: () => {},
    });
    return () => unsub();
  }, [localSeatIndex]);

  // Active players count (non-null)
  const activeHumanPlayers = players.filter((p): p is Player => p !== null);
  // ==========================================================
  // GAME START REALTIME CHANNEL
  // ==========================================================

  const gameChannelRef =
    useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isLocalHost = localSeatIndex === 0;

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`gaple-game-${roomId}`, {
      config: {
        broadcast: {
          self: false,
        },
      },
    });

    gameChannelRef.current = channel;

    channel.on(
      'broadcast',
      { event: 'game_state' },
      ({ payload }) => {
        if (isLocalHost) return;
        if (!payload || payload.roomId !== roomId) return;

        setPlayers(payload.players);
        setBoardChain(payload.boardChain);
        setHeadValue(payload.headValue);
        setTailValue(payload.tailValue);
        setBoneyard(payload.boneyard);
        setCurrentTurnSeat(payload.currentTurnSeat);
        setTurnTimeLeft(payload.turnTimeLeft);
        setGameStatus(payload.gameStatus);
        setConsecutivePasses(payload.consecutivePasses);
        setRoundNumber(payload.roundNumber);
        setWinner(payload.winner);
        setAllHandsCache(payload.allHandsCache);

        setSelectedTile(null);
        setIsLobbyOpen(false);
        setIsJoinPromptOpen(false);
        setIsShareModalOpen(false);
        setMessage('');
      }
    );

    channel.subscribe();

    return () => {
      if (gameChannelRef.current === channel) {
        gameChannelRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [roomId, isLocalHost]);


  /**
   * Start New Game / Shuffle Dominoes
   */
  const startNewRound = () => {
    if (!isLocalHost) return;
    if (activeHumanPlayers.length < 2) {
      setIsShareModalOpen(true);
      return;
    }

    setGameStatus('SHUFFLING');
    setSelectedTile(null);
    setBoardChain([]);
    setHeadValue(null);
    setTailValue(null);
    setConsecutivePasses(0);
    setWinner(null);
    setIsResultOpen(false);

    // Play Realistic Domino Shuffling Sound
    soundEngine.playShuffle();
    antiCheat.addLog('INTEGRITY_SHIELD', `Kocokan 28 kartu domino dimulai untuk ${activeHumanPlayers.length} pemain manusia...`, 'low');
    setAntiCheatLogs(antiCheat.getLogs());

    setTimeout(() => {
      const fullDeck = generateFullDominoDeck();
      const count = activeHumanPlayers.length;
      const { hands, boneyard: market } = dealTiles(fullDeck, count);

      // Verify tile conservation
      antiCheat.verifyTileConservation([], activeHumanPlayers, market);

      // Cache all hands for showdown
      const handsMap: { [seat: number]: Tile[] } = {};
      activeHumanPlayers.forEach((p, i) => {
        handsMap[p.seatIndex] = [...hands[i]];
      });
      setAllHandsCache(handsMap);

      // Determine starter
      const starterIdx = getStartingPlayerIndex(hands);
      const starterSeat = activeHumanPlayers[starterIdx].seatIndex;

      // Update active players with dealt hands
      const updatedPlayers = players.map((p) => {
        if (!p) return null;
        const playerHand = handsMap[p.seatIndex] || [];
        return {
          ...p,
          hand: playerHand,
          cardCount: playerHand.length,
          isTurn: p.seatIndex === starterSeat,
          lastAction: p.seatIndex === starterSeat ? 'Mulai Giliran' : undefined,
        };
      });

      setPlayers(updatedPlayers);
      setBoneyard(market);
      setCurrentTurnSeat(starterSeat);
      setTurnTimeLeft(TURN_TIME_LIMIT);
      setGameStatus('PLAYING');

      const starterName = updatedPlayers[starterSeat]?.name || 'Pemain';
      antiCheat.addLog(
        'MOVE_VALIDATED',
        `Kocokan selesai. Giliran pembuka diberikan kepada ${starterName}.`,
        'low'
      );
      setAntiCheatLogs(antiCheat.getLogs());

      // ======================================================
      // HOST BROADCAST
      // Guest tidak mengocok/deal ulang.
      // Guest menerima hasil persis dari Host.
      // ======================================================

      if (roomId && gameChannelRef.current && isLocalHost) {
        void gameChannelRef.current.send({
          type: 'broadcast',
          event: 'game_state',
          payload: {
            roomId,
            players: updatedPlayers,
            boardChain: [],
            headValue: null,
            tailValue: null,
            boneyard: market,
            currentTurnSeat: starterSeat,
            turnTimeLeft: TURN_TIME_LIMIT,
            gameStatus: 'PLAYING',
            consecutivePasses: 0,
            roundNumber,
            winner: null,
            allHandsCache: handsMap,
          },
        });
      }
    }, 1600);
  };

  /**
   * Turn Timer countdown effect (15s per player)
   */
  useEffect(() => {
    if (gameStatus !== 'PLAYING') return;

    const timer = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          handleTurnTimeout();
          return TURN_TIME_LIMIT;
        }

        // Ticking audio cues
        if (prev <= 5) {
          soundEngine.playTimerTick(true);
        } else if (prev % 3 === 0) {
          soundEngine.playTimerTick(false);
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus, currentTurnSeat, players, headValue, tailValue, boneyard]);

  /**
   * Next turn advancement (skips empty seats)
   */
  const advanceTurn = (fromSeat: number) => {
    let nextSeat = (fromSeat + 1) % 5;
    let attempts = 0;
    while (!players[nextSeat] && attempts < 5) {
      nextSeat = (nextSeat + 1) % 5;
      attempts++;
    }

    setCurrentTurnSeat(nextSeat);
    setTurnTimeLeft(TURN_TIME_LIMIT);
    setSelectedTile(null);
    setPlayers((prev) =>
      prev.map((p) =>
        p ? { ...p, isTurn: p.seatIndex === nextSeat } : null
      )
    );
  };

  /**
   * Execute Move on the Board
   */
  const executeMove = (seatIndex: number, tile: Tile, end: 'left' | 'right') => {
    const player = players[seatIndex];
    if (!player) return;

    const playerHand = allHandsCache[seatIndex] || [];

    // Anti-cheat verification
    const validation = antiCheat.validateMove({
      player: { ...player, hand: playerHand },
      tile,
      chosenEnd: end,
      headValue,
      tailValue,
      currentTurnSeat,
      turnStartedAt: Date.now() - (TURN_TIME_LIMIT - turnTimeLeft) * 1000,
      boardChain,
    });

    if (!validation.valid) {
      setAntiCheatLogs(antiCheat.getLogs());
      return;
    }

    const oriented = validation.orientedTile;
    const isDouble = oriented[0] === oriented[1];

    // Sound effect
    soundEngine.playTilePlace(isDouble);

    // Update board chain
    const newPlacedTile: PlacedTile = {
      id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tile: oriented,
      placedAtEnd: end,
      orientation: isDouble ? 'vertical' : 'horizontal',
      rotation: isDouble ? 90 : 0,
      playedBy: player.id,
      playerName: player.name,
      playedAt: Date.now(),
      chainIndex: boardChain.length,
    };

    let newChain: PlacedTile[];
    let newHead = headValue;
    let newTail = tailValue;

    if (boardChain.length === 0) {
      newChain = [newPlacedTile];
      newHead = oriented[0];
      newTail = oriented[1];
    } else if (end === 'left') {
      newChain = [newPlacedTile, ...boardChain];
      newHead = oriented[0];
    } else {
      newChain = [...boardChain, newPlacedTile];
      newTail = oriented[1];
    }

    setBoardChain(newChain);
    setHeadValue(newHead);
    setTailValue(newTail);
    setConsecutivePasses(0); // Reset consecutive passes

    // Remove tile from player's hand
    const remainingHand = playerHand.filter(
      (t, idx) =>
        idx !==
        playerHand.findIndex(
          (card) =>
            (card[0] === tile[0] && card[1] === tile[1]) ||
            (card[0] === tile[1] && card[1] === tile[0])
        )
    );

    setAllHandsCache((prev) => ({
      ...prev,
      [seatIndex]: remainingHand,
    }));

    // Update Player state
    setPlayers((prev) =>
      prev.map((p) =>
        p && p.seatIndex === seatIndex
          ? {
              ...p,
              hand: remainingHand,
              cardCount: remainingHand.length,
              lastAction: `Jalan [${tile[0]}|${tile[1]}]`,
            }
          : p
      )
    );

    setAntiCheatLogs(antiCheat.getLogs());

    // Check Win Condition (Hand Empty)
    if (remainingHand.length === 0) {
      handlePlayerWin(player, false);
      return;
    }

    advanceTurn(seatIndex);
  };

  /**
   * Draw Tile from Boneyard / Pasar
   */
  const drawFromBoneyard = (seatIndex: number) => {
    if (boneyard.length === 0) {
      passTurn(seatIndex);
      return;
    }

    soundEngine.playTileDraw();
    const drawnTile = boneyard[0];
    const remainingBoneyard = boneyard.slice(1);
    setBoneyard(remainingBoneyard);

    const playerHand = [...(allHandsCache[seatIndex] || []), drawnTile];

    setAllHandsCache((prev) => ({
      ...prev,
      [seatIndex]: playerHand,
    }));

    setPlayers((prev) =>
      prev.map((p) =>
        p && p.seatIndex === seatIndex
          ? {
              ...p,
              hand: playerHand,
              cardCount: playerHand.length,
              lastAction: 'Tarik Pasar',
            }
          : p
      )
    );

    const playerName = players[seatIndex]?.name || 'Pemain';
    antiCheat.addLog('MOVE_VALIDATED', `${playerName} menarik 1 kartu dari pasar.`, 'low');
    setAntiCheatLogs(antiCheat.getLogs());

    // Check if newly drawn card is playable
    const playable = getPlayableTiles([drawnTile], headValue, tailValue);
    if (playable.length === 0) {
      passTurn(seatIndex);
    }
  };

  /**
   * Pass Turn ("Lewat!")
   */
  const passTurn = (seatIndex: number) => {
    soundEngine.playPass();
    const pName = players[seatIndex]?.name || 'Pemain';

    setPlayers((prev) =>
      prev.map((p) =>
        p && p.seatIndex === seatIndex ? { ...p, lastAction: 'Lewat!' } : p
      )
    );

    const nextPassCount = consecutivePasses + 1;
    setConsecutivePasses(nextPassCount);

    antiCheat.addLog('MOVE_VALIDATED', `${pName} lewat (tidak ada kartu cocok).`, 'low');
    setAntiCheatLogs(antiCheat.getLogs());

    // If consecutive passes equal active player count -> GAPLE / BUNTU!
    if (nextPassCount >= activeHumanPlayers.length) {
      handleGapleBlock();
      return;
    }

    advanceTurn(seatIndex);
  };

  /**
   * Handle Turn Timeout
   */
  const handleTurnTimeout = () => {
    const seat = currentTurnSeat;
    const pHand = allHandsCache[seat] || [];
    const playable = getPlayableTiles(pHand, headValue, tailValue);

    if (playable.length > 0) {
      const best = playable[0];
      const end = best.canPlayLeft ? 'left' : 'right';
      executeMove(seat, best.tile, end);
    } else if (boneyard.length > 0) {
      drawFromBoneyard(seat);
    } else {
      passTurn(seat);
    }
  };

  /**
   * Handle Win (Normal Gol / Out of Cards)
   */
  const handlePlayerWin = (winningPlayer: Player, isGaple: boolean) => {
    soundEngine.playVictory();
    setGameStatus('ROUND_END');
    setWinner(winningPlayer);

    setPlayers((prev) =>
      prev.map((p) => {
        if (!p) return null;
        if (p.seatIndex === winningPlayer.seatIndex) {
          const newMMR = p.mmr + 25;
          return {
            ...p,
            chips: p.chips + 50000,
            mmr: newMMR,
            rank: getRankTierFromMMR(newMMR),
            totalWins: p.totalWins + 1,
            totalMatches: p.totalMatches + 1,
          };
        }
        return {
          ...p,
          totalMatches: p.totalMatches + 1,
        };
      })
    );

    antiCheat.addLog(
      'INTEGRITY_SHIELD',
      `Ronde selesai. ${winningPlayer.name} memenangkan pertandingan! Data rekapitulasi tersimpan.`,
      'low'
    );
    setAntiCheatLogs(antiCheat.getLogs());

    setIsResultOpen(true);
  };

  /**
   * Handle Gaple / Buntu (Deadlock: Lowest Pip Sum Wins)
   */
  const handleGapleBlock = () => {
    soundEngine.playGapleGong();
    setGameStatus('GAPLE_BLOCKED');

    let lowestPips = 9999;
    let gapleWinner = activeHumanPlayers[0];

    activeHumanPlayers.forEach((p) => {
      const pHand = allHandsCache[p.seatIndex] || [];
      const sum = calculateHandPips(pHand);
      if (sum < lowestPips) {
        lowestPips = sum;
        gapleWinner = p;
      }
    });

    handlePlayerWin(gapleWinner, true);
  };

  /**
   * Handle Local Player clicking a Domino Tile
   */
  const handleLocalTileClick = (tile: Tile) => {
    if (gameStatus !== 'PLAYING') return;
    if (currentTurnSeat !== localSeatIndex) return;

    soundEngine.playTilePlace(false);

    if (
      selectedTile &&
      ((selectedTile[0] === tile[0] && selectedTile[1] === tile[1]) ||
        (selectedTile[0] === tile[1] && selectedTile[1] === tile[0]))
    ) {
      setSelectedTile(null);
      return;
    }

    setSelectedTile(tile);

    // If board is empty, auto-play first tile
    if (boardChain.length === 0) {
      executeMove(localSeatIndex, tile, 'right');
      setSelectedTile(null);
      return;
    }

    // If tile can only play on one end, auto-play immediately
    const playableInfo = playableLocalTiles.find(
      (p) =>
        (p.tile[0] === tile[0] && p.tile[1] === tile[1]) ||
        (p.tile[0] === tile[1] && p.tile[1] === tile[0])
    );

    if (playableInfo) {
      if (playableInfo.canPlayLeft && !playableInfo.canPlayRight) {
        executeMove(localSeatIndex, tile, 'left');
        setSelectedTile(null);
      } else if (!playableInfo.canPlayLeft && playableInfo.canPlayRight) {
        executeMove(localSeatIndex, tile, 'right');
        setSelectedTile(null);
      }
    }
  };

  const handlePlayAtEnd = (end: 'left' | 'right') => {
    if (!selectedTile) return;
    executeMove(localSeatIndex, selectedTile, end);
    setSelectedTile(null);
  };

  const triggerChatBubble = (seatIndex: number, text: string) => {
    setActiveChatBubbles((prev) => ({ ...prev, [seatIndex]: text }));
    setTimeout(() => {
      setActiveChatBubbles((prev) => {
        const next = { ...prev };
        delete next[seatIndex];
        return next;
      });
    }, 4500);
  };

  const handleSendMessage = (text: string) => {
    const sender = players[localSeatIndex] || { name: 'Anda' };
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random()}`,
      senderId: 'player_local',
      senderName: sender.name,
      senderSeat: localSeatIndex,
      text,
      timestamp: Date.now(),
      isQuick: false,
    };

    setMessages((prev) => [...prev, newMsg]);
    triggerChatBubble(localSeatIndex, text);

    broadcastRef.current?.postMessage({
      type: 'CHAT_MESSAGE',
      payload: newMsg,
    });
  };

  const handleSendSticker = (targetSeat: number, stickerType: StickerEvent['stickerType']) => {
    const iconMap = {
      tomato: 'ðŸ…',
      egg: 'ðŸ¥š',
      beer: 'ðŸº',
      bomb: 'ðŸ’£',
      rose: 'ðŸŒ¹',
      coins: 'ðŸ’°',
      laugh: 'ðŸ˜‚',
      cry: 'ðŸ˜­',
      rage: 'ðŸ˜¡',
      cool: 'ðŸ˜Ž',
    };

    const newEvent: StickerEvent = {
      id: `stk_${Date.now()}_${Math.random()}`,
      fromSeat: localSeatIndex,
      toSeat: targetSeat,
      stickerType,
      icon: iconMap[stickerType] || 'ðŸŽ¯',
      label: stickerType,
      timestamp: Date.now(),
    };

    setStickerEvents((prev) => [...prev, newEvent]);

    broadcastRef.current?.postMessage({
      type: 'STICKER_EVENT',
      payload: newEvent,
    });
  };

  // Local player hand and playable calculation
  const localPlayer = players[localSeatIndex] || null;
  const localHand = allHandsCache[localSeatIndex] || localPlayer?.hand || [];
  const playableLocalTiles = getPlayableTiles(localHand, headValue, tailValue);
  const isMyTurn = currentTurnSeat === localSeatIndex && gameStatus === 'PLAYING';

  // Check if selected tile can go left or right
  const selectedPlayableInfo = selectedTile
    ? playableLocalTiles.find(
        (p) =>
          (p.tile[0] === selectedTile[0] && p.tile[1] === selectedTile[1]) ||
          (p.tile[0] === selectedTile[1] && p.tile[1] === selectedTile[0])
      )
    : null;

  const canPlaySelectedLeft = selectedPlayableInfo?.canPlayLeft ?? false;
  const canPlaySelectedRight = selectedPlayableInfo?.canPlayRight ?? false;

  return (
    <div className="relative w-screen h-screen bg-[#070b0e] text-slate-100 flex flex-col overflow-hidden select-none">
      {/* 1. TOP BAR NAVIGATION (RESPONSIVE) */}
      <header className="h-12 sm:h-14 px-2 sm:px-4 md:px-6 bg-slate-950/95 border-b border-slate-800/80 flex items-center justify-between z-30 shrink-0">
        {/* Zone 1: Wordmark & Room Code */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 shadow-[0_0_12px_rgba(245,158,11,0.5)] shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center font-cinzel font-bold text-amber-400 text-xs sm:text-sm">
                ðŸ€„
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-cinzel text-xs sm:text-base font-black tracking-wider text-amber-300 leading-tight">
                GAPLE-QU
              </span>
              <span className="font-cinzel text-[8px] sm:text-[9px] tracking-widest text-slate-400 leading-none hidden sm:block">
                DOMINO ONLINE
              </span>
            </div>
          </div>

          {/* Room Badge */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-0.5 sm:py-1 rounded-lg text-[10px] sm:text-xs">
            <span className="text-slate-400 hidden xs:inline">Room:</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(roomCode);
                setCopiedLinkNotification(true);
                setTimeout(() => setCopiedLinkNotification(false), 2000);
              }}
              className="text-amber-300 hover:text-amber-200 font-mono-numbers font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Salin kode room"
            >
              <span>{roomCode}</span>
              {copiedLinkNotification ? (
                <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
              ) : (
                <Copy className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-500" />
              )}
            </button>
          </div>
        </div>

        {/* Zone 2: Navigation Links / Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Share Room Button */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-md active:scale-95 shrink-0"
            title="Kirim link undangan room"
          >
            <Share2 className="w-3.5 h-3.5 fill-slate-950" />
            <span className="hidden sm:inline">Undang</span>
          </button>

          {/* Voice Chat Controls */}
          <VoiceChatControls />

          {/* Anti-Cheat Shield Badge */}
          <button
            onClick={() => setIsAntiCheatOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60 text-xs font-semibold transition-all cursor-pointer shadow-sm"
            title="Buka Sistem Anti-Cheat"
          >
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <span className="hidden md:inline ml-1">Anti-Cheat</span>
          </button>

          {/* Ranking & Leaderboard */}
          <button
            onClick={() => setIsLeaderboardOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 hover:border-amber-400/50 text-amber-300 text-xs font-semibold transition-all cursor-pointer"
            title="Lihat Peringkat & Leaderboard"
          >
            <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span className="hidden md:inline ml-1">Peringkat</span>
          </button>

          {/* Chat & Stickers Modal Trigger */}
          <button
            onClick={() => setIsChatOpen(true)}
            className="relative p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 hover:border-amber-400/50 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
            title="Buka Chat & Stiker"
          >
            <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            {messages.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-1 right-1" />
            )}
          </button>

          {/* Room Settings */}
          <button
            onClick={() => setIsLobbyOpen(true)}
            className="p-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title="Pengaturan Meja"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </header>

      {/* 2. REALISTIC DOMINO TABLE ARENA (COMPACT RESPONSIVE VIEWPORT) */}
      <main className="relative flex-1 flex flex-col items-center justify-between p-1 sm:p-3 md:p-6 overflow-hidden">
        {/* Table Felt Surface Container */}
        <div className="relative w-full h-full max-w-[1380px] rounded-[28px] sm:rounded-[50px] md:rounded-[90px] leather-border table-felt-pattern border-[8px] sm:border-[14px] md:border-[20px] border-[#251509] flex flex-col justify-between p-2 sm:p-4 md:p-6 overflow-hidden shadow-2xl">
          {/* Subtle Felt Texture Image Overlay */}
          <img
            src="/src/assets/images/domino_table_felt_1790137574026.jpg"
            alt="Table Felt"
            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30 pointer-events-none"
          />

          {/* Inner Brass Stitch Trim */}
          <div className="absolute inset-1 sm:inset-3 rounded-[20px] sm:rounded-[42px] md:rounded-[78px] border border-dashed border-[#d4af37]/25 pointer-events-none" />

          {/* TOP ROW: Seats 2 & 3 + Center Round Info */}
          <div className="relative z-20 flex items-center justify-between sm:justify-around w-full px-2 pt-0.5">
            {/* Seat 2 (Top Left) */}
            <div ref={seatRefs[2]} className="shrink-0">
              <PlayerSeat
                player={players[2]}
                seatIndex={2}
                isCurrentTurn={currentTurnSeat === 2 && gameStatus === 'PLAYING'}
                turnProgress={(turnTimeLeft / TURN_TIME_LIMIT) * 100}
                timeLeft={turnTimeLeft}
                isLocal={localSeatIndex === 2}
                onInvitePlayer={() => setIsShareModalOpen(true)}
                onSelectForSticker={(s) => {
                  setTargetStickerSeat(s);
                  setIsChatOpen(true);
                }}
                chatBubbleText={activeChatBubbles[2]}
              />
            </div>

            {/* Table Center Round Info Badge */}
            <div className="flex flex-col items-center justify-center bg-black/60 backdrop-blur-md border border-[#d4af37]/35 px-2.5 sm:px-4 py-1 rounded-xl sm:rounded-2xl shadow-xl mx-1 shrink-0">
              <span className="font-cinzel text-[10px] sm:text-xs font-bold text-amber-300">
                RONDE {roundNumber}
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono-numbers">
                {gameStatus === 'PLAYING'
                  ? `Giliran: ${players[currentTurnSeat]?.name || 'Pemain'}`
                  : gameStatus === 'SHUFFLING'
                  ? 'Mengocok Kartu...'
                  : `${activeHumanPlayers.length} Pemain Aktif`}
              </span>
            </div>

            {/* Seat 3 (Top Right) */}
            <div ref={seatRefs[3]} className="shrink-0">
              <PlayerSeat
                player={players[3]}
                seatIndex={3}
                isCurrentTurn={currentTurnSeat === 3 && gameStatus === 'PLAYING'}
                turnProgress={(turnTimeLeft / TURN_TIME_LIMIT) * 100}
                timeLeft={turnTimeLeft}
                isLocal={localSeatIndex === 3}
                onInvitePlayer={() => setIsShareModalOpen(true)}
                onSelectForSticker={(s) => {
                  setTargetStickerSeat(s);
                  setIsChatOpen(true);
                }}
                chatBubbleText={activeChatBubbles[3]}
              />
            </div>
          </div>

          {/* MIDDLE ROW: Seat 1 (Left), Domino Board Center, Seat 4 (Right) */}
          <div className="relative z-10 flex items-center justify-between w-full my-auto px-0.5 sm:px-2 gap-1 sm:gap-2">
            {/* Seat 1 (Left) */}
            <div ref={seatRefs[1]} className="shrink-0">
              <PlayerSeat
                player={players[1]}
                seatIndex={1}
                isCurrentTurn={currentTurnSeat === 1 && gameStatus === 'PLAYING'}
                turnProgress={(turnTimeLeft / TURN_TIME_LIMIT) * 100}
                timeLeft={turnTimeLeft}
                isLocal={localSeatIndex === 1}
                onInvitePlayer={() => setIsShareModalOpen(true)}
                onSelectForSticker={(s) => {
                  setTargetStickerSeat(s);
                  setIsChatOpen(true);
                }}
                chatBubbleText={activeChatBubbles[1]}
              />
            </div>

            {/* CENTER DOMINO TRAIN BOARD */}
            <div className="flex-1 max-w-[850px] flex items-center justify-center min-w-0">
              {gameStatus === 'WAITING' ? (
                <div className="flex flex-col items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-md border border-[#d4af37]/40 rounded-2xl sm:rounded-3xl text-center shadow-2xl max-w-full">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-cinzel text-xs sm:text-base md:text-lg font-bold text-amber-300">
                      Meja Teman (Tanpa Bot)
                    </h3>
                  </div>

                  <p className="text-[10px] sm:text-xs text-slate-300 mb-2 max-w-xs line-clamp-2">
                    Minimal 2 pemain manusia untuk mulai. Bagikan link ke teman untuk bergabung.
                  </p>

                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] sm:text-xs mb-3">
                    <Users className="w-3 h-3" />
                    <span>Terisi: {activeHumanPlayers.length} dari 5 Kursi</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={() => setIsShareModalOpen(true)}
                      className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 text-slate-950 font-bold text-[10px] sm:text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Share2 className="w-3.5 h-3.5 fill-slate-950" />
                      <span>Kirim Undangan</span>
                    </button>

                    {activeHumanPlayers.length >= 2 ? (
                      <button
                        disabled={!isLocalHost}
                        onClick={isLocalHost ? startNewRound : undefined}
                        className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] sm:text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Kocok & Mulai</span>
                      </button>
                    ) : (
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800">
                        <UserPlus className="w-3 h-3 text-amber-400 animate-pulse" />
                        <span>Menunggu teman...</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : gameStatus === 'SHUFFLING' ? (
                <div className="flex flex-col items-center justify-center p-4 sm:p-6 text-center animate-pulse">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full border-3 sm:border-4 border-amber-400 border-t-transparent animate-spin mb-2" />
                  <span className="font-cinzel text-xs sm:text-sm font-bold text-amber-300">
                    Mengocok 28 Kartu Domino...
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5 font-mono-numbers">
                    Mendistribusikan kartu ke {activeHumanPlayers.length} pemain
                  </span>
                </div>
              ) : (
                <DominoBoard
                  chain={boardChain}
                  headValue={headValue}
                  tailValue={tailValue}
                  onPlayAtEnd={handlePlayAtEnd}
                  canPlayLeft={canPlaySelectedLeft}
                  canPlayRight={canPlaySelectedRight}
                  isMyTurn={isMyTurn}
                  selectedTile={selectedTile}
                  boneyardCount={boneyard.length}
                />
              )}
            </div>

            {/* Seat 4 (Right) */}
            <div ref={seatRefs[4]} className="shrink-0">
              <PlayerSeat
                player={players[4]}
                seatIndex={4}
                isCurrentTurn={currentTurnSeat === 4 && gameStatus === 'PLAYING'}
                turnProgress={(turnTimeLeft / TURN_TIME_LIMIT) * 100}
                timeLeft={turnTimeLeft}
                isLocal={localSeatIndex === 4}
                onInvitePlayer={() => setIsShareModalOpen(true)}
                onSelectForSticker={(s) => {
                  setTargetStickerSeat(s);
                  setIsChatOpen(true);
                }}
                chatBubbleText={activeChatBubbles[4]}
              />
            </div>
          </div>

          {/* BOTTOM ROW: Seat 0 HUD + Hand Cards Rack + Action Controls */}
          <div className="relative z-20 flex flex-col w-full gap-1 sm:gap-2 pt-1">
            {/* Turn Announcement Banner on Mobile */}
            {isMyTurn && (
              <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-xs font-bold text-amber-300 bg-amber-950/80 border border-amber-500/40 rounded-lg py-0.5 px-2 animate-pulse mx-auto shadow-md">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Giliran Anda! Pilih kartu yang cocok</span>
              </div>
            )}

            <div className="flex items-end justify-between w-full gap-2">
              {/* Seat 0 HUD (Host / Local Player) */}
              <div ref={seatRefs[0]} className="shrink-0 mb-0.5">
                <PlayerSeat
                  player={players[0]}
                  seatIndex={0}
                  isCurrentTurn={currentTurnSeat === 0 && gameStatus === 'PLAYING'}
                  turnProgress={(turnTimeLeft / TURN_TIME_LIMIT) * 100}
                  timeLeft={turnTimeLeft}
                  isLocal={localSeatIndex === 0}
                  onInvitePlayer={() => setIsShareModalOpen(true)}
                  chatBubbleText={activeChatBubbles[0]}
                />
              </div>

              {/* Local Player Hand Cards Rack */}
              <div className="flex-1 flex flex-col items-center justify-center min-w-0 max-w-[650px] mx-auto">
                {/* Draw or Pass Button */}
                {isMyTurn && playableLocalTiles.length === 0 && (
                  <div className="mb-1 flex items-center justify-center">
                    {boneyard.length > 0 ? (
                      <button
                        onClick={() => drawFromBoneyard(localSeatIndex)}
                        className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-[10px] sm:text-xs rounded-lg shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
                      >
                        <Layers className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>Tarik Pasar ({boneyard.length})</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => passTurn(localSeatIndex)}
                        className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] sm:text-xs rounded-lg shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
                      >
                        <SkipForward className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        <span>Lewat (Pass)</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Wooden Rack Tray for Hand Cards */}
                <div className="relative w-full px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#3a200f] via-[#241308] to-[#120904] border border-[#6d411b] shadow-2xl flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
                  <div className="absolute inset-x-2 bottom-0.5 h-1 rounded-full bg-[#8c5324]/40" />

                  {localHand.length === 0 ? (
                    <div className="text-[10px] sm:text-xs text-slate-400 py-1.5 sm:py-2 text-center">
                      {gameStatus === 'PLAYING'
                        ? 'Kartu telah habis!'
                        : activeHumanPlayers.length < 2
                        ? 'Kirim link undangan untuk mengajak teman...'
                        : 'Klik "Kocok & Mulai"'}
                    </div>
                  ) : (
                    localHand.map((tile, idx) => {
                      const isPlayable =
                        isMyTurn &&
                        playableLocalTiles.some(
                          (p) =>
                            (p.tile[0] === tile[0] && p.tile[1] === tile[1]) ||
                            (p.tile[0] === tile[1] && p.tile[1] === tile[0])
                        );
                      const isSelected =
                        selectedTile !== null &&
                        ((selectedTile[0] === tile[0] && selectedTile[1] === tile[1]) ||
                          (selectedTile[0] === tile[1] && selectedTile[1] === tile[0]));

                      return (
                        <div key={`${tile[0]}-${tile[1]}-${idx}`} className="shrink-0">
                          {/* Desktop/Tablet tile size */}
                          <div className="hidden sm:block">
                            <DominoTile
                              tile={tile}
                              size="md"
                              orientation="vertical"
                              isPlayable={isPlayable}
                              isSelected={isSelected}
                              onClick={isPlayable ? () => handleLocalTileClick(tile) : undefined}
                            />
                          </div>
                          {/* Mobile tile size */}
                          <div className="block sm:hidden">
                            <DominoTile
                              tile={tile}
                              size="sm"
                              orientation="vertical"
                              isPlayable={isPlayable}
                              isSelected={isSelected}
                              onClick={isPlayable ? () => handleLocalTileClick(tile) : undefined}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quick Action Buttons (Sticker & Reset) */}
              <div className="flex flex-col items-center gap-1 shrink-0 mb-0.5">
                <button
                  onClick={() => {
                    const targetSeat = players.findIndex((p, idx) => p && idx !== localSeatIndex);
                    setTargetStickerSeat(targetSeat !== -1 ? targetSeat : 1);
                    setIsChatOpen(true);
                  }}
                  className="flex items-center justify-center p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-900/90 border border-amber-500/40 text-amber-300 text-xs font-semibold hover:bg-slate-800 transition-all cursor-pointer shadow-lg active:scale-95"
                  title="Kirim Stiker / Lempar Tomat"
                >
                  <Smile className="w-4 h-4" />
                </button>

                <button
                  disabled={!isLocalHost}
                        onClick={isLocalHost ? startNewRound : undefined}
                  className="p-2 rounded-xl bg-slate-900/90 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
                  title="Kocok Ulang / Mulai Baru"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 3. REAL-TIME THROWABLE FLYING OVERLAY */}
      <ThrowableOverlay events={stickerEvents} seatCoordinates={seatCoords} />

      {/* 4. MODALS & DRAWERS */}
      {/* Chat & Stickers Modal */}
      <ChatAndStickerModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        onSendSticker={handleSendSticker}
        selectedTargetSeat={targetStickerSeat}
        playerNames={players.reduce((acc, p) => (p ? { ...acc, [p.seatIndex]: p.name } : acc), {})}
        localSeatIndex={localSeatIndex}
      />

      {/* Leaderboard & Ranking Modal */}
      {localPlayer && (
        <LeaderboardModal
          isOpen={isLeaderboardOpen}
          onClose={() => setIsLeaderboardOpen(false)}
          currentPlayer={localPlayer}
        />
      )}

      {/* Anti-Cheat Shield Modal */}
      <AntiCheatModal
        isOpen={isAntiCheatOpen}
        onClose={() => setIsAntiCheatOpen(false)}
        records={antiCheatLogs}
      />

      {/* Table Lobby & Room Settings Modal */}
      <TableLobbyModal
        isOpen={isLobbyOpen}
        onClose={() => setIsLobbyOpen(false)}
        onStartGame={async (config) => {
          try {
            const snapshot =
              config.mode === 'create'
                ? await createGapleRoom({
                    roomCode: config.roomCode,
                    maxPlayers: config.playerCount,
                    targetScore: config.targetScore,
                    playerName: config.playerName,
                    avatar: config.avatar,
                  })
                : await joinGapleRoom({
                    roomCode: config.roomCode,
                    playerName: config.playerName,
                    avatar: config.avatar,
                  });

            applyRoomSnapshot(snapshot);
            setIsLobbyOpen(false);
            setIsJoinPromptOpen(false);

            const newUrl = `${window.location.pathname}?room=${encodeURIComponent(snapshot.room.room_code)}`;
            window.history.replaceState(null, '', newUrl);
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : 'Gagal membuat atau bergabung ke room.'
            );
          }
        }}
        currentConfig={{
          playerName: players[0]?.name || 'Pemain VIP',
          avatar: players[0]?.avatar || '',
          playerCount: 5,
          roomCode,
          targetScore: roomTargetScore,
        }}
      />

      {/* Share Room Link Modal */}
      <ShareRoomModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        roomCode={roomCode}
        hostName={players[0]?.name || 'Anda'}
        playerCount={5}
      />

      {/* Join Room Prompt Modal (Triggered by ?room= link) */}
      <JoinRoomPromptModal
        isOpen={isJoinPromptOpen}
        roomCode={pendingJoinRoomCode || roomCode}
        onJoin={async (guestName, guestAvatar) => {
          try {
            const snapshot = await joinGapleRoom({
              roomCode: pendingJoinRoomCode || roomCode,
              playerName: guestName,
              avatar: guestAvatar,
            });

            applyRoomSnapshot(snapshot);
            setIsJoinPromptOpen(false);
            setIsLobbyOpen(false);

            const newUrl = `${window.location.pathname}?room=${encodeURIComponent(snapshot.room.room_code)}`;
            window.history.replaceState(null, '', newUrl);
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : 'Gagal bergabung ke room.'
            );
          }
        }}
        onCancel={() => setIsJoinPromptOpen(false)}
      />

      {/* Victory / Round Result Showdown Modal */}
      <RoundResultModal
        isOpen={isResultOpen}
        winner={winner}
        isGapleBlocked={gameStatus === 'GAPLE_BLOCKED'}
        players={activeHumanPlayers}
        allHands={allHandsCache}
        onPlayNextRound={() => {
          setRoundNumber((r) => r + 1);
          startNewRound();
        }}
        localSeatIndex={localSeatIndex}
      />
    </div>
  );
}


