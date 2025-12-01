// User service - handles user CRUD and lookups
import { prisma } from "../client";
import type { User, UserStats } from "@prisma/client";

export type UserWithStats = User & {
  stats: UserStats | null;
  custodialWallet: { balance: number; publicKey: string } | null;
};

export const UserService = {
  // Find or create user by wallet address
  async findOrCreateByWallet(walletAddress: string): Promise<UserWithStats> {
    let user = await prisma.user.findUnique({
      where: { walletAddress },
      include: {
        stats: true,
        custodialWallet: {
          select: { balance: true, publicKey: true },
        },
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress,
          avatarSeed: walletAddress,
          stats: { create: {} },
        },
        include: {
          stats: true,
          custodialWallet: {
            select: { balance: true, publicKey: true },
          },
        },
      });
    }

    return user;
  },

  // Get user by ID with all relations
  async getById(id: string): Promise<UserWithStats | null> {
    return prisma.user.findUnique({
      where: { id },
      include: {
        stats: true,
        custodialWallet: {
          select: { balance: true, publicKey: true },
        },
      },
    });
  },

  // Get user by wallet
  async getByWallet(walletAddress: string): Promise<UserWithStats | null> {
    return prisma.user.findUnique({
      where: { walletAddress },
      include: {
        stats: true,
        custodialWallet: {
          select: { balance: true, publicKey: true },
        },
      },
    });
  },

  // Update username
  async updateUsername(userId: string, username: string): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: { username },
    });
  },

  // Update last active
  async updateLastActive(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });
  },

  // Get leaderboard
  async getLeaderboard(
    limit = 100,
    orderBy: "totalWon" | "netProfit" | "biggestWin" = "netProfit"
  ) {
    return prisma.userStats.findMany({
      where: {
        totalGamesPlayed: { gt: 0 },
      },
      orderBy: { [orderBy]: "desc" },
      take: limit,
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
    });
  },

  // Get user game history
  async getGameHistory(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      gameType?: "SHOOTOUT" | "CRASH";
    } = {}
  ) {
    const { limit = 50, offset = 0, gameType } = options;

    return prisma.gameRound.findMany({
      where: {
        userId,
        status: "COMPLETED",
        ...(gameType && { gameType }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        shootoutData: true,
        crashData: true,
      },
    });
  },
};
