import { Tile, PlacedTile, Player, AntiCheatRecord } from '../types/domino';

/**
 * Domino Shield™ Anti-Cheat Engine
 * Provides state validation, tile secrecy masking, timing tamper detection,
 * and 28-tile conservation law verification.
 */
class AntiCheatEngine {
  private auditLogs: AntiCheatRecord[] = [];
  private lastActionTimestamp: number = 0;
  private stateNonce: number = 1000;

  constructor() {
    this.addLog(
      'INTEGRITY_SHIELD',
      'Domino Shield™ Anti-Cheat diaktifkan. Algoritma Zero-Knowledge Hand Masking & Move Verifier aktif.',
      'low'
    );
  }

  public getLogs(): AntiCheatRecord[] {
    return [...this.auditLogs];
  }

  public addLog(
    eventType: AntiCheatRecord['eventType'],
    detail: string,
    severity: AntiCheatRecord['severity']
  ) {
    const id = `ac_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const signature = this.generateSignature(detail);
    this.auditLogs.unshift({
      id,
      timestamp: Date.now(),
      eventType,
      detail,
      severity,
      signature
    });
    // Keep last 40 logs
    if (this.auditLogs.length > 40) {
      this.auditLogs.pop();
    }
  }

  private generateSignature(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data.charCodeAt(i);
      hash |= 0;
    }
    return `SHIELD-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
  }

  /**
   * Verify if a move is physically and logically valid according to Domino Gaple rules
   */
  public validateMove(params: {
    player: Player;
    tile: Tile;
    chosenEnd: 'left' | 'right';
    headValue: number | null;
    tailValue: number | null;
    currentTurnSeat: number;
    turnStartedAt: number;
    boardChain: PlacedTile[];
  }): { valid: boolean; reason?: string; orientedTile: Tile } {
    const { player, tile, chosenEnd, headValue, tailValue, currentTurnSeat, turnStartedAt, boardChain } = params;

    // 1. Check player turn
    if (player.seatIndex !== currentTurnSeat) {
      this.addLog('CHEATING_PREVENTED', `Upaya jalan di luar giliran oleh ${player.name} dicegah.`, 'high');
      return { valid: false, reason: 'Bukan giliran Anda!', orientedTile: tile };
    }

    // 2. Check timing (Reaction speed anomaly / bot spam)
    const now = Date.now();
    const elapsed = now - turnStartedAt;
    if (elapsed < 80 && !player.isBot) {
      this.addLog('TIMING_VERIFIED', `Peringatan: Aksi terlalu cepat (<80ms) dari ${player.name}.`, 'medium');
    }

    // 3. Check if player actually holds this tile
    const hasTile = player.hand.some(t => 
      (t[0] === tile[0] && t[1] === tile[1]) || (t[0] === tile[1] && t[1] === tile[0])
    );
    if (!hasTile) {
      this.addLog('CHEATING_PREVENTED', `Percobaan manipulasi kartu ilegal: ${player.name} tidak memiliki kartu [${tile[0]}|${tile[1]}].`, 'high');
      return { valid: false, reason: 'Kartu tidak ada di tangan Anda!', orientedTile: tile };
    }

    // 4. If first tile on empty table
    if (boardChain.length === 0 || headValue === null || tailValue === null) {
      this.addLog('MOVE_VALIDATED', `Langkah pembuka divalidasi untuk ${player.name}: [${tile[0]}|${tile[1]}].`, 'low');
      return { valid: true, orientedTile: tile };
    }

    // 5. Check match with chosen end
    let oriented: Tile = [...tile];
    if (chosenEnd === 'left') {
      if (tile[1] === headValue) {
        oriented = [tile[0], tile[1]]; // connects [tile[0] | tile[1]] -> [headValue | ...]
      } else if (tile[0] === headValue) {
        oriented = [tile[1], tile[0]]; // flip tile to connect [tile[1] | tile[0]]
      } else {
        this.addLog('CHEATING_PREVENTED', `Langkah ditolak: Kartu [${tile[0]}|${tile[1]}] tidak cocok dengan ujung kiri (${headValue}).`, 'medium');
        return { valid: false, reason: `Kartu tidak cocok dengan angka ${headValue} di ujung kiri!`, orientedTile: tile };
      }
    } else { // right end
      if (tile[0] === tailValue) {
        oriented = [tile[0], tile[1]]; // connects [... | tailValue] -> [tile[0] | tile[1]]
      } else if (tile[1] === tailValue) {
        oriented = [tile[1], tile[0]]; // flip tile
      } else {
        this.addLog('CHEATING_PREVENTED', `Langkah ditolak: Kartu [${tile[0]}|${tile[1]}] tidak cocok dengan ujung kanan (${tailValue}).`, 'medium');
        return { valid: false, reason: `Kartu tidak cocok dengan angka ${tailValue} di ujung kanan!`, orientedTile: tile };
      }
    }

    this.addLog('MOVE_VALIDATED', `Langkah sah divalidasi untuk ${player.name}: [${oriented[0]}|${oriented[1]}] di sisi ${chosenEnd}.`, 'low');
    this.lastActionTimestamp = now;
    return { valid: true, orientedTile: oriented };
  }

  /**
   * Verify the 28 Domino Tile Conservation Law
   * Total unique tiles in play cannot exceed standard 28 double-six domino set.
   */
  public verifyTileConservation(chain: PlacedTile[], players: Player[], boneyard: Tile[]): boolean {
    const seen = new Set<string>();
    const allTiles: Tile[] = [
      ...chain.map(c => c.tile),
      ...boneyard,
      ...players.flatMap(p => p.hand)
    ];

    for (const t of allTiles) {
      const min = Math.min(t[0], t[1]);
      const max = Math.max(t[0], t[1]);
      const key = `${min}-${max}`;
      if (seen.has(key)) {
        this.addLog('CHEATING_PREVENTED', `Anomali: Duplikasi kartu terdeteksi pada [${min}|${max}]. State diisolasi.`, 'high');
        return false;
      }
      seen.add(key);
    }
    return true;
  }

  /**
   * Enforces Zero-Knowledge Hand Masking:
   * Masks opponents' card details for other clients so DevTools inspection cannot see opponents' cards.
   */
  public maskOpponentHands(players: Player[], localSeatIndex: number): Player[] {
    return players.map(p => {
      if (p.seatIndex === localSeatIndex) {
        return p; // Local player can see their own hand
      }
      // Mask hand array with empty dummy cards matching their cardCount
      return {
        ...p,
        hand: Array(p.cardCount || p.hand.length).fill([-1, -1] as Tile)
      };
    });
  }

  /**
   * Generates continuous state nonce to prevent replay attacks
   */
  public getNextNonce(): number {
    return ++this.stateNonce;
  }
}

export const antiCheat = new AntiCheatEngine();
