/**
 * Shootout Game Service
 *
 * PvP game where two players wager and one wins based on provably fair RNG
 */

import { prisma } from "@/lib/db/client";
import { BalanceService } from "@/lib/db/services/balance";
import {
  createGameSession,
  hashSeed,
  combineSeeds,
  GameSession,
} from "./provably-fair";
import {
  broadcastGameUpdate,
  broadcastActivityUpdate,
} from "@/lib/sse/broadcaster";

// Active games waiting for opponents
interface WaitingGame {
  id: string;
  creatorId: string;
  creatorWallet: string;
  wagerAmount: number;
  session: GameSession;
  createdAt: number;
  mode: "pvp" | "house";
}

interface ActiveGame {
  id: string;
  player1Id: string;
  player2Id: string | null; // null for house mode
  player1Wallet: string;
  player2Wallet: string | null;
  wagerAmount: number;
  session: GameSession;
  winnerId: string | null;
  status: "waiting" | "countdown" | "spinning" | "completed";
}

// In-memory stores
const waitingGames = new Map<string, WaitingGame>();
const activeGames = new Map<string, ActiveGame>();

// Constants
const COUNTDOWN_MS = 3000;
const SPIN_DURATION_MS = 2000;
const HOUSE_RTP = 0.9; // 90% RTP for house mode
const PVP_RTP = 0.975; // 97.5% RTP for PvP (2.5% rake)

export const ShootoutService = {
  /**
   * Create a new game (waiting for opponent)
   */
  async createGame(
    creatorId: string,
    creatorWallet: string,
    wagerAmount: number,
    mode: "pvp" | "house" = "pvp"
  ): Promise<{ success: boolean; gameId?: string; error?: string }> {
    // Lock creator's funds
    const tempGameId = `shootout_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const lockResult = await BalanceService.placeBet(
      creatorId,
      wagerAmount,
      tempGameId
    );

    if (!lockResult.success) {
      return { success: false, error: lockResult.error };
    }

    const session = createGameSession();

    // Create in database
    const gameRound = await prisma.gameRound.create({
      data: {
        gameType: "SHOOTOUT",
        status: "WAITING",
        userId: creatorId,
        wagerAmount,
        serverSeed: session.serverSeed,
        serverSeedHash: session.serverSeedHash,
        clientSeed: session.clientSeed,
        nonce: session.nonce,
        shootoutData: {
          create: {
            isPvP: mode === "pvp",
          },
        },
      },
    });

    if (mode === "house") {
      // House mode - start immediately
      return this.startHouseGame(
        gameRound.id,
        creatorId,
        creatorWallet,
        wagerAmount,
        session
      );
    }

    // PvP mode - wait for opponent
    waitingGames.set(gameRound.id, {
      id: gameRound.id,
      creatorId,
      creatorWallet,
      wagerAmount,
      session,
      createdAt: Date.now(),
      mode,
    });

    // Broadcast new game available
    broadcastGameUpdate({
      type: "shootout_new_game",
      gameId: gameRound.id,
      creatorWallet,
      wagerAmount,
    });

    return { success: true, gameId: gameRound.id };
  },

  /**
   * Join an existing game
   */
  async joinGame(
    gameId: string,
    joinerId: string,
    joinerWallet: string
  ): Promise<{ success: boolean; error?: string }> {
    const waitingGame = waitingGames.get(gameId);

    if (!waitingGame) {
      return { success: false, error: "Game not found or already started" };
    }

    if (waitingGame.creatorId === joinerId) {
      return { success: false, error: "Cannot join your own game" };
    }

    // Lock joiner's funds
    const lockResult = await BalanceService.placeBet(
      joinerId,
      waitingGame.wagerAmount,
      gameId
    );

    if (!lockResult.success) {
      return { success: false, error: lockResult.error };
    }

    // Move to active games
    waitingGames.delete(gameId);

    const activeGame: ActiveGame = {
      id: gameId,
      player1Id: waitingGame.creatorId,
      player2Id: joinerId,
      player1Wallet: waitingGame.creatorWallet,
      player2Wallet: joinerWallet,
      wagerAmount: waitingGame.wagerAmount,
      session: waitingGame.session,
      winnerId: null,
      status: "countdown",
    };

    activeGames.set(gameId, activeGame);

    // Update database
    await prisma.shootoutRound.update({
      where: { gameRoundId: gameId },
      data: { opponentId: joinerId },
    });

    await prisma.gameRound.update({
      where: { id: gameId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });

    // Broadcast game starting
    broadcastGameUpdate({
      type: "shootout_countdown",
      gameId,
      player1Wallet: waitingGame.creatorWallet,
      player2Wallet: joinerWallet,
      wagerAmount: waitingGame.wagerAmount,
    });

    // Start countdown then spin
    setTimeout(() => {
      this.startSpin(gameId);
    }, COUNTDOWN_MS);

    return { success: true };
  },

  /**
   * Start house mode game immediately
   */
  async startHouseGame(
    gameId: string,
    playerId: string,
    playerWallet: string,
    wagerAmount: number,
    session: GameSession
  ): Promise<{ success: boolean; gameId?: string; error?: string }> {
    const activeGame: ActiveGame = {
      id: gameId,
      player1Id: playerId,
      player2Id: null,
      player1Wallet: playerWallet,
      player2Wallet: null,
      wagerAmount,
      session,
      winnerId: null,
      status: "countdown",
    };

    activeGames.set(gameId, activeGame);

    await prisma.gameRound.update({
      where: { id: gameId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });

    // Broadcast game starting
    broadcastGameUpdate({
      type: "shootout_countdown",
      gameId,
      player1Wallet: playerWallet,
      player2Wallet: "HOUSE",
      wagerAmount,
      isHouse: true,
    });

    // Start spin after countdown
    setTimeout(() => {
      this.startSpin(gameId);
    }, COUNTDOWN_MS);

    return { success: true, gameId };
  },

  /**
   * Start the spin animation and determine winner
   */
  async startSpin(gameId: string): Promise<void> {
    const game = activeGames.get(gameId);
    if (!game || game.status !== "countdown") return;

    game.status = "spinning";

    // Determine winner using provably fair method
    const combinedHash = combineSeeds(
      game.session.serverSeed,
      game.session.clientSeed,
      game.session.nonce
    );

    // Use hash to determine winner
    const hashInt = parseInt(combinedHash.slice(0, 8), 16);
    const normalized = hashInt / 0xffffffff; // 0 to 1

    let player1Wins: boolean;

    if (game.player2Id === null) {
      // House mode: player wins with probability = HOUSE_RTP
      player1Wins = normalized < HOUSE_RTP;
    } else {
      // PvP mode: 50/50 (rake taken from pot)
      player1Wins = normalized < 0.5;
    }

    const winnerId = player1Wins ? game.player1Id : game.player2Id || "HOUSE";
    game.winnerId = winnerId;

    // Broadcast spin start
    broadcastGameUpdate({
      type: "shootout_spinning",
      gameId,
      duration: SPIN_DURATION_MS,
    });

    // After spin, settle the game
    setTimeout(() => {
      this.settleGame(gameId, player1Wins);
    }, SPIN_DURATION_MS);
  },

  /**
   * Settle the game and distribute winnings
   */
  async settleGame(gameId: string, player1Wins: boolean): Promise<void> {
    const game = activeGames.get(gameId);
    if (!game || game.status !== "spinning") return;

    game.status = "completed";

    const isHouseMode = game.player2Id === null;
    const rtp = isHouseMode ? HOUSE_RTP : PVP_RTP;

    // Calculate payout
    const totalPot = game.wagerAmount * 2;
    const rake = totalPot * (1 - rtp);
    const winnerPayout = totalPot - rake;

    const winnerId = player1Wins ? game.player1Id : game.player2Id;
    const loserId = player1Wins ? game.player2Id : game.player1Id;
    const winnerWallet = player1Wins ? game.player1Wallet : game.player2Wallet;

    // Credit winner
    if (winnerId) {
      await BalanceService.creditWinnings(
        winnerId,
        game.wagerAmount,
        winnerPayout,
        gameId
      );
    }

    // Deduct loser
    if (loserId) {
      await BalanceService.deductLoss(loserId, game.wagerAmount, gameId);
    } else if (!player1Wins) {
      // House won - deduct from player
      await BalanceService.deductLoss(game.player1Id, game.wagerAmount, gameId);
    }

    // Update database
    await prisma.shootoutRound.update({
      where: { gameRoundId: gameId },
      data: {
        winnerId: winnerId || undefined,
        winnerSide: player1Wins ? "player" : isHouseMode ? "house" : "opponent",
      },
    });

    await prisma.gameRound.update({
      where: { id: gameId },
      data: {
        won: player1Wins,
        payout: player1Wins ? winnerPayout : 0,
        profit: player1Wins
          ? winnerPayout - game.wagerAmount
          : -game.wagerAmount,
        status: "COMPLETED",
        endedAt: new Date(),
      },
    });

    // Broadcast result
    broadcastGameUpdate({
      type: "shootout_result",
      gameId,
      winnerId,
      winnerWallet,
      payout: winnerPayout,
      serverSeed: game.session.serverSeed,
      serverSeedHash: game.session.serverSeedHash,
      clientSeed: game.session.clientSeed,
      nonce: game.session.nonce,
    });

    // Add to activity if significant win
    if (winnerPayout >= 1) {
      broadcastActivityUpdate({
        type: "big_win",
        oderId: winnerId || "HOUSE",
        gameType: "SHOOTOUT",
        multiplier: 2.0,
        payout: winnerPayout,
      });
    }

    // Clean up
    setTimeout(() => {
      activeGames.delete(gameId);
    }, 10000);
  },

  /**
   * Cancel a waiting game
   */
  async cancelGame(
    gameId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const waitingGame = waitingGames.get(gameId);

    if (!waitingGame) {
      return { success: false, error: "Game not found or already started" };
    }

    if (waitingGame.creatorId !== userId) {
      return { success: false, error: "Not your game" };
    }

    // Refund creator
    await BalanceService.unlockFromGame(
      userId,
      waitingGame.wagerAmount,
      gameId
    );

    // Update database
    await prisma.gameRound.update({
      where: { id: gameId },
      data: { status: "CANCELLED" },
    });

    waitingGames.delete(gameId);

    broadcastGameUpdate({
      type: "shootout_cancelled",
      gameId,
    });

    return { success: true };
  },

  /**
   * Get waiting games list
   */
  getWaitingGames(): Array<{
    id: string;
    creatorWallet: string;
    wagerAmount: number;
    createdAt: number;
  }> {
    return Array.from(waitingGames.values()).map((g) => ({
      id: g.id,
      creatorWallet: g.creatorWallet,
      wagerAmount: g.wagerAmount,
      createdAt: g.createdAt,
    }));
  },

  /**
   * Get active game state
   */
  getGameState(gameId: string): ActiveGame | WaitingGame | null {
    return activeGames.get(gameId) || waitingGames.get(gameId) || null;
  },
};
