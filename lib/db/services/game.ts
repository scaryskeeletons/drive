// Game service - handles all game round operations
import { prisma } from "../client";
import { TransactionService } from "./transaction";
import { ActivityService } from "./activity";
import type { GameRound, GameType, GameStatus } from "@prisma/client";
import crypto from "crypto";

// Generate provably fair seeds
function generateServerSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

export interface CreateShootoutInput {
  userId: string;
  wagerAmount: number;
  isPvP: boolean;
  opponentId?: string;
}

export interface CreateCrashInput {
  userId: string;
  wagerAmount: number;
  autoCashout?: number;
}

export const GameService = {
  // ============================================
  // SHOOTOUT GAMES
  // ============================================

  // Create a new shootout game
  async createShootout(input: CreateShootoutInput): Promise<GameRound> {
    const { userId, wagerAmount, isPvP, opponentId } = input;
    const serverSeed = generateServerSeed();

    return prisma.$transaction(async (tx) => {
      // Create bet transaction (deducts balance)
      await TransactionService.create({
        userId,
        type: "GAME_BET",
        amount: wagerAmount,
      });

      // Generate share code for PvP
      const shareCode = isPvP
        ? crypto.randomBytes(4).toString("hex").toUpperCase()
        : null;

      // Create game round
      const gameRound = await tx.gameRound.create({
        data: {
          gameType: "SHOOTOUT",
          status: isPvP && !opponentId ? "WAITING" : "ACTIVE",
          userId,
          wagerAmount,
          serverSeed,
          serverSeedHash: hashSeed(serverSeed),
          expiresAt: isPvP ? new Date(Date.now() + 5 * 60 * 1000) : null, // 5 min expiry
          shootoutData: {
            create: {
              isPvP,
              opponentId,
              shareCode,
            },
          },
        },
        include: {
          shootoutData: true,
        },
      });

      return gameRound;
    });
  },

  // Join a PvP shootout game
  async joinShootout(
    gameRoundId: string,
    opponentId: string
  ): Promise<GameRound> {
    return prisma.$transaction(async (tx) => {
      const game = await tx.gameRound.findUnique({
        where: { id: gameRoundId },
        include: { shootoutData: true },
      });

      if (!game || game.gameType !== "SHOOTOUT") {
        throw new Error("Game not found");
      }

      if (game.status !== "WAITING") {
        throw new Error("Game is not waiting for opponent");
      }

      if (game.userId === opponentId) {
        throw new Error("Cannot join your own game");
      }

      // Create bet transaction for opponent
      await TransactionService.create({
        userId: opponentId,
        type: "GAME_BET",
        amount: game.wagerAmount,
        gameRoundId,
      });

      // Update game
      const updated = await tx.gameRound.update({
        where: { id: gameRoundId },
        data: {
          status: "ACTIVE",
          startedAt: new Date(),
          shootoutData: {
            update: {
              opponentId,
              opponentWager: game.wagerAmount,
            },
          },
        },
        include: { shootoutData: true },
      });

      return updated;
    });
  },

  // Resolve a shootout game
  async resolveShootout(
    gameRoundId: string,
    winnerId: string,
    spinResult: number
  ): Promise<GameRound> {
    return prisma.$transaction(async (tx) => {
      const game = await tx.gameRound.findUnique({
        where: { id: gameRoundId },
        include: { shootoutData: true, user: true },
      });

      if (!game || game.gameType !== "SHOOTOUT") {
        throw new Error("Game not found");
      }

      const { shootoutData } = game;
      const totalPot = game.wagerAmount * (shootoutData?.isPvP ? 2 : 1);
      const houseFee = totalPot * 0.02; // 2% house fee
      const payout = totalPot - houseFee;
      
      const playerWon = winnerId === game.userId;
      const winnerSide = playerWon ? "player" : "opponent";

      // Create win transaction for winner
      await TransactionService.create({
        userId: winnerId,
        type: "GAME_WIN",
        amount: payout,
        gameRoundId,
      });

      // Update game
      const updated = await tx.gameRound.update({
        where: { id: gameRoundId },
        data: {
          status: "COMPLETED",
          won: playerWon,
          payout: playerWon ? payout : 0,
          profit: playerWon ? payout - game.wagerAmount : -game.wagerAmount,
          endedAt: new Date(),
          shootoutData: {
            update: {
              winnerId,
              winnerSide,
              spinResult,
              shotFired: true,
            },
          },
        },
        include: { shootoutData: true, user: true },
      });

      // Update user stats
      await tx.userStats.update({
        where: { userId: game.userId },
        data: {
          totalGamesPlayed: { increment: 1 },
          totalGamesWon: { increment: playerWon ? 1 : 0 },
          totalGamesLost: { increment: playerWon ? 0 : 1 },
          totalWagered: { increment: game.wagerAmount },
          totalWon: { increment: playerWon ? payout : 0 },
          totalLost: { increment: playerWon ? 0 : game.wagerAmount },
          netProfit: { increment: playerWon ? payout - game.wagerAmount : -game.wagerAmount },
          biggestWin: playerWon ? { increment: 0 } : undefined, // Handle in application logic
        },
      });

      // Add to activity feed if big win
      if (playerWon && payout >= 1) {
        await ActivityService.addActivity({
          eventType: "big_win",
          username: game.user.username || game.user.walletAddress?.slice(0, 8),
          gameType: "SHOOTOUT",
          amount: payout,
        });
      }

      return updated;
    });
  },

  // ============================================
  // CRASH GAMES
  // ============================================

  // Create a new crash game
  async createCrash(input: CreateCrashInput): Promise<GameRound> {
    const { userId, wagerAmount, autoCashout } = input;
    const serverSeed = generateServerSeed();

    // Generate crash point (provably fair)
    const crashPoint = generateCrashPoint(serverSeed);

    return prisma.$transaction(async (tx) => {
      // Create bet transaction
      await TransactionService.create({
        userId,
        type: "GAME_BET",
        amount: wagerAmount,
      });

      // Create game round
      const gameRound = await tx.gameRound.create({
        data: {
          gameType: "CRASH",
          status: "ACTIVE",
          userId,
          wagerAmount,
          serverSeed,
          serverSeedHash: hashSeed(serverSeed),
          startedAt: new Date(),
          crashData: {
            create: {
              crashPoint,
              autoCashout,
            },
          },
        },
        include: {
          crashData: true,
        },
      });

      return gameRound;
    });
  },

  // Cash out from a crash game
  async cashoutCrash(
    gameRoundId: string,
    cashoutMultiplier: number
  ): Promise<GameRound> {
    return prisma.$transaction(async (tx) => {
      const game = await tx.gameRound.findUnique({
        where: { id: gameRoundId },
        include: { crashData: true, user: true },
      });

      if (!game || game.gameType !== "CRASH") {
        throw new Error("Game not found");
      }

      if (game.status !== "ACTIVE") {
        throw new Error("Game is not active");
      }

      const { crashData } = game;
      if (!crashData) {
        throw new Error("Crash data not found");
      }

      // Check if they can still cash out
      if (cashoutMultiplier > crashData.crashPoint) {
        throw new Error("Cannot cash out after crash");
      }

      const payout = game.wagerAmount * cashoutMultiplier;
      const profit = payout - game.wagerAmount;

      // Create win transaction
      await TransactionService.create({
        userId: game.userId,
        type: "GAME_WIN",
        amount: payout,
        gameRoundId,
      });

      // Update game
      const updated = await tx.gameRound.update({
        where: { id: gameRoundId },
        data: {
          status: "COMPLETED",
          won: true,
          payout,
          profit,
          endedAt: new Date(),
          crashData: {
            update: {
              cashedOutAt: cashoutMultiplier,
              rodeToEnd: false,
            },
          },
        },
        include: { crashData: true, user: true },
      });

      // Update user stats
      await tx.userStats.update({
        where: { userId: game.userId },
        data: {
          totalGamesPlayed: { increment: 1 },
          totalGamesWon: { increment: 1 },
          totalWagered: { increment: game.wagerAmount },
          totalWon: { increment: payout },
          netProfit: { increment: profit },
          highestMultiplier: {
            set: Math.max(cashoutMultiplier, 1), // Will be handled by raw query for max
          },
        },
      });

      // Add to activity feed if big multiplier
      if (cashoutMultiplier >= 5) {
        await ActivityService.addActivity({
          eventType: "big_win",
          username: game.user.username || game.user.walletAddress?.slice(0, 8),
          gameType: "CRASH",
          amount: payout,
          multiplier: cashoutMultiplier,
        });
      }

      return updated;
    });
  },

  // Crash the game (player didn't cash out in time)
  async crashGame(gameRoundId: string): Promise<GameRound> {
    return prisma.$transaction(async (tx) => {
      const game = await tx.gameRound.findUnique({
        where: { id: gameRoundId },
        include: { crashData: true },
      });

      if (!game || game.gameType !== "CRASH") {
        throw new Error("Game not found");
      }

      // Update game
      const updated = await tx.gameRound.update({
        where: { id: gameRoundId },
        data: {
          status: "COMPLETED",
          won: false,
          payout: 0,
          profit: -game.wagerAmount,
          endedAt: new Date(),
          crashData: {
            update: {
              rodeToEnd: true,
            },
          },
        },
        include: { crashData: true },
      });

      // Update user stats
      await tx.userStats.update({
        where: { userId: game.userId },
        data: {
          totalGamesPlayed: { increment: 1 },
          totalGamesLost: { increment: 1 },
          totalWagered: { increment: game.wagerAmount },
          totalLost: { increment: game.wagerAmount },
          netProfit: { decrement: game.wagerAmount },
        },
      });

      return updated;
    });
  },

  // ============================================
  // COMMON OPERATIONS
  // ============================================

  // Get game by ID
  async getById(id: string): Promise<GameRound | null> {
    return prisma.gameRound.findUnique({
      where: { id },
      include: {
        shootoutData: true,
        crashData: true,
        user: {
          select: {
            id: true,
            username: true,
            walletAddress: true,
            avatarSeed: true,
          },
        },
      },
    });
  },

  // Get active games for a user
  async getActiveGames(userId: string): Promise<GameRound[]> {
    return prisma.gameRound.findMany({
      where: {
        userId,
        status: { in: ["WAITING", "ACTIVE"] },
      },
      include: {
        shootoutData: true,
        crashData: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  // Get open PvP games to join
  async getOpenShootoutGames(excludeUserId?: string): Promise<GameRound[]> {
    return prisma.gameRound.findMany({
      where: {
        gameType: "SHOOTOUT",
        status: "WAITING",
        ...(excludeUserId && { userId: { not: excludeUserId } }),
        expiresAt: { gt: new Date() },
      },
      include: {
        shootoutData: true,
        user: {
          select: {
            id: true,
            username: true,
            walletAddress: true,
            avatarSeed: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  },

  // Get game by share code
  async getByShareCode(shareCode: string): Promise<GameRound | null> {
    const shootoutData = await prisma.shootoutRound.findUnique({
      where: { shareCode },
      include: {
        gameRound: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                walletAddress: true,
                avatarSeed: true,
              },
            },
          },
        },
      },
    });

    return shootoutData?.gameRound || null;
  },

  // Cancel a waiting game (refund)
  async cancelGame(gameRoundId: string): Promise<GameRound> {
    return prisma.$transaction(async (tx) => {
      const game = await tx.gameRound.findUnique({
        where: { id: gameRoundId },
      });

      if (!game) {
        throw new Error("Game not found");
      }

      if (game.status !== "WAITING") {
        throw new Error("Can only cancel waiting games");
      }

      // Refund the wager
      await TransactionService.create({
        userId: game.userId,
        type: "GAME_REFUND",
        amount: game.wagerAmount,
        gameRoundId,
      });

      return tx.gameRound.update({
        where: { id: gameRoundId },
        data: {
          status: "CANCELLED",
          endedAt: new Date(),
        },
      });
    });
  },

  // Get recent games (for activity feed)
  async getRecentGames(limit = 20): Promise<GameRound[]> {
    return prisma.gameRound.findMany({
      where: { status: "COMPLETED" },
      orderBy: { endedAt: "desc" },
      take: limit,
      include: {
        shootoutData: true,
        crashData: true,
        user: {
          select: {
            id: true,
            username: true,
            walletAddress: true,
            avatarSeed: true,
          },
        },
      },
    });
  },
};

// Helper function to generate crash point
function generateCrashPoint(serverSeed: string): number {
  // Provably fair crash point generation
  const hash = crypto.createHash("sha256").update(serverSeed).digest("hex");
  const h = parseInt(hash.slice(0, 8), 16);
  
  // House edge: 3%
  const e = 2 ** 32;
  const houseEdge = 0.03;
  
  if (h % 33 === 0) {
    // Instant crash (3% chance)
    return 1.0;
  }
  
  // Calculate crash point
  const crashPoint = Math.floor((100 * e - h) / (e - h)) / 100;
  return Math.max(1.0, crashPoint);
}

