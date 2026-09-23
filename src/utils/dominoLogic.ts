import { Tile, PlacedTile, Player, RankTier } from '../types/domino';

/**
 * Generate standard Double-Six 28 Domino Tiles Set
 */
export function generateFullDominoDeck(): Tile[] {
  const deck: Tile[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      deck.push([i, j]);
    }
  }
  return deck;
}

/**
 * Fisher-Yates shuffle
 */
export function shuffleDeck(deck: Tile[]): Tile[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Deal tiles for up to 5 players
 * For 5 players: 5 tiles each (25 total), 3 in boneyard (pasar)
 * For 4 players: 6 tiles each (24 total), 4 in boneyard
 * For 2-3 players: 7 tiles each
 */
export function dealTiles(deck: Tile[], playerCount: number): { hands: Tile[][]; boneyard: Tile[] } {
  const shuffled = shuffleDeck(deck);
  const hands: Tile[][] = Array.from({ length: playerCount }, () => []);
  const tilesPerPlayer = playerCount === 5 ? 5 : playerCount === 4 ? 6 : 7;

  let cardIdx = 0;
  for (let r = 0; r < tilesPerPlayer; r++) {
    for (let p = 0; p < playerCount; p++) {
      if (cardIdx < shuffled.length) {
        hands[p].push(shuffled[cardIdx++]);
      }
    }
  }

  const boneyard = shuffled.slice(cardIdx);
  return { hands, boneyard };
}

/**
 * Determine which player starts the game
 * Checks highest balak (double [6|6] down to [0|0]).
 * If no balak, highest pip sum.
 */
export function getStartingPlayerIndex(hands: Tile[][]): number {
  // Check doubles from [6|6] down to [0|0]
  for (let d = 6; d >= 0; d--) {
    for (let p = 0; p < hands.length; p++) {
      if (hands[p].some(t => t[0] === d && t[1] === d)) {
        return p;
      }
    }
  }

  // Fallback: highest single card pip sum
  let maxPips = -1;
  let starter = 0;
  for (let p = 0; p < hands.length; p++) {
    for (const t of hands[p]) {
      const sum = t[0] + t[1];
      if (sum > maxPips) {
        maxPips = sum;
        starter = p;
      }
    }
  }
  return starter;
}

/**
 * Get all playable cards from a hand given current head and tail
 */
export function getPlayableTiles(hand: Tile[], head: number | null, tail: number | null): {
  tile: Tile;
  index: number;
  canPlayLeft: boolean;
  canPlayRight: boolean;
}[] {
  if (head === null || tail === null) {
    // Board is empty: any tile can be played
    return hand.map((tile, index) => ({
      tile,
      index,
      canPlayLeft: true,
      canPlayRight: true,
    }));
  }

  return hand
    .map((tile, index) => {
      const canPlayLeft = tile[0] === head || tile[1] === head;
      const canPlayRight = tile[0] === tail || tile[1] === tail;
      return {
        tile,
        index,
        canPlayLeft,
        canPlayRight,
      };
    })
    .filter(item => item.canPlayLeft || item.canPlayRight);
}

/**
 * Calculate total pip sum of a player's hand
 */
export function calculateHandPips(hand: Tile[]): number {
  return hand.reduce((sum, tile) => sum + (tile[0] + tile[1]), 0);
}

/**
 * Calculate Rank Tier from MMR
 */
export function getRankTierFromMMR(mmr: number): RankTier {
  if (mmr >= 3000) return 'Dewa Gaple';
  if (mmr >= 2400) return 'Master Domino';
  if (mmr >= 1900) return 'Diamond';
  if (mmr >= 1500) return 'Platinum';
  if (mmr >= 1200) return 'Emas (Gold)';
  if (mmr >= 900) return 'Perak (Silver)';
  return 'Perunggu (Bronze)';
}

/**
 * AI Bot Move Selector
 * Picks strategic move for bot (prioritizes balak or highest pip tile to lower hand count)
 */
export function selectBestBotMove(
  hand: Tile[],
  head: number | null,
  tail: number | null
): { tile: Tile; end: 'left' | 'right' } | null {
  const playable = getPlayableTiles(hand, head, tail);
  if (playable.length === 0) return null;

  // Prefer playing doubles (balak) first to not get stuck with heavy balak
  const doubleMove = playable.find(p => p.tile[0] === p.tile[1]);
  if (doubleMove) {
    const end: 'left' | 'right' = doubleMove.canPlayRight ? 'right' : 'left';
    return { tile: doubleMove.tile, end };
  }

  // Otherwise pick highest pip card to discard heavy cards
  playable.sort((a, b) => (b.tile[0] + b.tile[1]) - (a.tile[0] + a.tile[1]));
  const best = playable[0];
  const end: 'left' | 'right' = best.canPlayLeft && best.canPlayRight 
    ? (Math.random() > 0.5 ? 'left' : 'right') 
    : best.canPlayLeft ? 'left' : 'right';

  return { tile: best.tile, end };
}
