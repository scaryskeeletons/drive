/**
 * Crash Game Service
 * 
 * Handles game lifecycle:
 * 1. Create game (generate seeds, get crash point)
 * 2. Place bet (lock funds)
 * 3. Start game (begin multiplier growth)
 * 4. Cashout (player exits before crash)
 * 5. Crash (game ends, settle all bets)
 */

import { prisma } from "@/lib/db/client";
import { BalanceService } from "@/lib/db/services/balance";
import {
  createGameSession,
  calculateCrashPoint,
  hashSeed,
  GameSession,
} from "./provably-fair";
import {
  getMultiplierAtTime,
  getTimeForMultiplier,
  calculatePayout,
  CRASH_CONFIG,
} from "./crash-math";
import { broadcastGameUpdate, broadcastActivityUpdate } from "@/lib/sse/broadcaster";

// Active games in memory (for real-time state)
interface ActiveGame {
  id: string;
  session: GameSession;
  crashPoint: number;
  startTime: number | null;
  players: Map<string, PlayerBet>;
  status: "waiting" | "running" | "crashed";
}

interface PlayerBet {
  oderId: string;
  oderwager: number;
  odercashedOutAt: number | null;
  oderpayout: number | null;
}

// In-memory game store
const activeGames = new Map<string, ActiveGame>();

// Game constants
const BETTING_WINDOW_MS = 5000; // 5 seconds to place bets before start
const SYNC_INTERVAL_MS = 250; // Sync every 250ms

export const CrashGameService = {
  /**
   * Create a new crash game round
   */
  async createGame(): Promise<{
    gameId: string;
    serverSeedHash: string;
    startsAt: number;
  }> {
    const session = createGameSession();
    const crashPoint = calculateCrashPoint(
      session.serverSeed,
      session.clientSeed,
      session.nonce,
      CRASH_CONFIG.HOUSE_EDGE
    );

    // Create in database
    const gameRound = await prisma.gameRound.create({
      data: {
        gameType: "CRASH",
        status: "WAITING",
        userId: "system", // System-created game
        wagerAmount: 0,
        serverSeed: session.serverSeed,
        serverSeedHash: session.serverSeedHash,
        clientSeed: session.clientSeed,
        nonce: session.nonce,
        crashData: {
          create: {
            crashPoint,
          },
        },
      },
    });

    // Store in memory for real-time access
    const startsAt = Date.now() + BETTING_WINDOW_MS;
    activeGames.set(gameRound.id, {
      id: gameRound.id,
      session,
      crashPoint,
      startTime: null,
      players: new Map(),
      status: "waiting",
    });

    // Schedule game start
    setTimeout(() => {
      this.startGame(gameRound.id);
    }, BETTING_WINDOW_MS);

    return {
      gameId: gameRound.id,
      serverSeedHash: session.serverSeedHash,
      startsAt,
    };
  },

  /**
   * Place a bet on an active game
   */
  async placeBet(
    gameId: string,
    oderId: string,
    oderwager: number
  ): Promise<{ success: boolean; error?: string }> {
    const game = activeGames.get(gameId);
    
    if (!game) {
      return { success: false, error: "Game not found" };
    }

    if (game.status !== "waiting") {
      return { success: false, error: "Game already started" };
    }

    if (game.players.has(oderId)) {
      return { success: false, error: "Already placed bet on this game" };
    }

    // Lock funds using balance service
    const result = await BalanceService.placeBet(oderId, oderwager, gameId);
    if (!result.success) {
      return result;
    }

    // Add to active players
    game.players.set(oderId, {
      oderId,
      oderwager,
      odercashedOutAt: null,
      oderpayout: null,
    });

    // Create game round for this player
    await prisma.gameRound.create({
      data: {
        gameType: "CRASH",
        status: "ACTIVE",
        userId: oderId,
        wagerAmount: oderwager,
        serverSeedHash: game.session.serverSeedHash,
        clientSeed: game.session.clientSeed,
        nonce: game.session.nonce,
        crashData: {
          create: {
            crashPoint: game.crashPoint,
          },
        },
      },
    });

    return { success: true };
  },

  /**
   * Start the game (begin multiplier growth)
   */
  async startGame(gameId: string): Promise<void> {
    const game = activeGames.get(gameId);
    if (!game || game.status !== "waiting") return;

    game.status = "running";
    game.startTime = Date.now();

    // Update database
    await prisma.gameRound.updateMany({
      where: { serverSeedHash: game.session.serverSeedHash },
      data: { status: "ACTIVE", startedAt: new Date() },
    });

    // Broadcast game start
    broadcastGameUpdate({
      type: "crash_start",
      gameId,
      startTime: game.startTime,
      crashPoint: null, // Don't reveal yet!
    });

    // Schedule crash
    const crashTime = getTimeForMultiplier(game.crashPoint);
    setTimeout(() => {
      this.crashGame(gameId);
    }, crashTime);

    // Start sync broadcasts
    this.startSyncBroadcasts(gameId);
  },

  /**
   * Broadcast current multiplier to all clients
   */
  startSyncBroadcasts(gameId: string): void {
    const game = activeGames.get(gameId);
    if (!game || game.status !== "running") return;

    const interval = setInterval(() => {
      const game = activeGames.get(gameId);
      if (!game || game.status !== "running" || !game.startTime) {
        clearInterval(interval);
        return;
      }

      const elapsed = Date.now() - game.startTime;
      const multiplier = getMultiplierAtTime(elapsed);

      broadcastGameUpdate({
        type: "crash_tick",
        gameId,
        elapsed,
        multiplier,
        serverTime: Date.now(),
      });
    }, SYNC_INTERVAL_MS);
  },

  /**
   * Player cashes out
   */
  async cashout(
    gameId: string,
    oderId: string
  ): Promise<{
    success: boolean;
    multiplier?: number;
    payout?: number;
    error?: string;
  }> {
    const game = activeGames.get(gameId);
    
    if (!game) {
      return { success: false, error: "Game not found" };
    }

    if (game.status !== "running") {
      return { success: false, error: "Game not running" };
    }

    const player = game.players.get(oderId);
    if (!player) {
      return { success: false, error: "Not in this game" };
    }

    if (player.odercashedOutAt !== null) {
      return { success: false, error: "Already cashed out" };
    }

    // Calculate current multiplier
    const elapsed = Date.now() - (game.startTime || 0);
    const multiplier = getMultiplierAtTime(elapsed);

    // Check if already crashed (server authority)
    if (multiplier >= game.crashPoint) {
      return { success: false, error: "Game already crashed" };
    }

    // Calculate payout
    const payout = calculatePayout(player.oderwager, multiplier);

    // Update player state
    player.odercashedOutAt = multiplier;
    player.oderpayout = payout;

    // Credit winnings
    await BalanceService.creditWinnings(
      oderId,
      player.oderwager,
      payout,
      gameId
    );

    // Update database
    await prisma.crashRound.updateMany({
      where: {
        gameRound: {
          userId: oderId,
          serverSeedHash: game.session.serverSeedHash,
        },
      },
      data: {
        cashedOutAt: multiplier,
      },
    });

    await prisma.gameRound.updateMany({
      where: {
        userId: oderId,
        serverSeedHash: game.session.serverSeedHash,
      },
      data: {
        won: true,
        payout,
        profit: payout - player.oderwager,
        status: "COMPLETED",
        endedAt: new Date(),
      },
    });

    // Broadcast cashout
    broadcastGameUpdate({
      type: "crash_cashout",
      gameId,
      oderId,
      multiplier,
      payout,
    });

    return { success: true, multiplier, payout };
  },

  /**
   * Game crashes - settle all remaining bets
   */
  async crashGame(gameId: string): Promise<void> {
    const game = activeGames.get(gameId);
    if (!game || game.status !== "running") return;

    game.status = "crashed";
    const crashPoint = game.crashPoint;

    // Broadcast crash with revealed seed
    broadcastGameUpdate({
      type: "crash_end",
      gameId,
      crashPoint,
      serverSeed: game.session.serverSeed, // Reveal for verification
      serverSeedHash: game.session.serverSeedHash,
      clientSeed: game.session.clientSeed,
      nonce: game.session.nonce,
    });

    // Settle all players who didn't cash out
    for (const [oderId, player] of game.players) {
      if (player.odercashedOutAt === null) {
        // Player lost - they rode to crash
        await BalanceService.deductLoss(oderId, player.oderwager, gameId);

        await prisma.crashRound.updateMany({
          where: {
            gameRound: {
              userId: oderId,
              serverSeedHash: game.session.serverSeedHash,
            },
          },
          data: {
            rodeToEnd: true,
          },
        });

        await prisma.gameRound.updateMany({
          where: {
            userId: oderId,
            serverSeedHash: game.session.serverSeedHash,
          },
          data: {
            won: false,
            payout: 0,
            profit: -player.oderwager,
            status: "COMPLETED",
            endedAt: new Date(),
          },
        });
      }
    }

    // Update main game round
    await prisma.gameRound.updateMany({
      where: { id: gameId },
      data: {
        status: "COMPLETED",
        endedAt: new Date(),
      },
    });

    // Add to activity feed for big wins
    for (const [oderId, player] of game.players) {
      if (player.odercashedOutAt && player.odercashedOutAt >= 2.0) {
        broadcastActivityUpdate({
          type: "big_win",
          oderId,
          gameType: "CRASH",
          multiplier: player.odercashedOutAt,
          payout: player.oderpayout || 0,
        });
      }
    }

    // Clean up after a delay
    setTimeout(() => {
      activeGames.delete(gameId);
    }, 10000);

    // Start next game
    this.createGame();
  },

  /**
   * Get current game state
   */
  getCurrentGame(): {
    gameId: string;
    status: string;
    serverSeedHash: string;
    startTime: number | null;
    currentMultiplier: number;
    playerCount: number;
  } | null {
    // Find the most recent waiting or running game
    for (const [gameId, game] of activeGames) {
      if (game.status === "waiting" || game.status === "running") {
        const elapsed = game.startTime ? Date.now() - game.startTime : 0;
        return {
          gameId,
          status: game.status,
          serverSeedHash: game.session.serverSeedHash,
          startTime: game.startTime,
          currentMultiplier: game.status === "running" ? getMultiplierAtTime(elapsed) : 1.0,
          playerCount: game.players.size,
        };
      }
    }
    return null;
  },

  /**
   * Get game for verification (after it ends)
   */
  async getGameForVerification(gameId: string): Promise<{
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    crashPoint: number;
  } | null> {
    const gameRound = await prisma.gameRound.findUnique({
      where: { id: gameId },
      include: { crashData: true },
    });

    if (!gameRound || gameRound.status !== "COMPLETED") {
      return null;
    }

    return {
      serverSeed: gameRound.serverSeed || "",
      serverSeedHash: gameRound.serverSeedHash || "",
      clientSeed: gameRound.clientSeed || "",
      nonce: gameRound.nonce,
      crashPoint: gameRound.crashData?.crashPoint || 0,
    };
  },
};

