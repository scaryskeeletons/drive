// Activity service - live activity feed and events
import { prisma } from "../client";
import type { GameType } from "@prisma/client";

export interface AddActivityInput {
  eventType: string;
  username?: string | null;
  gameType?: GameType;
  amount?: number;
  multiplier?: number;
  data?: Record<string, unknown>;
}

export const ActivityService = {
  // Add a new activity event
  async addActivity(input: AddActivityInput) {
    return prisma.activityFeed.create({
      data: {
        eventType: input.eventType,
        username: input.username,
        gameType: input.gameType,
        amount: input.amount,
        multiplier: input.multiplier,
        data: input.data ? JSON.parse(JSON.stringify(input.data)) : undefined,
      },
    });
  },

  // Get recent activity
  async getRecentActivity(limit = 20) {
    return prisma.activityFeed.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  // Get activity by type
  async getActivityByType(eventType: string, limit = 20) {
    return prisma.activityFeed.findMany({
      where: { eventType },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  // Get big wins
  async getBigWins(minAmount = 1, limit = 20) {
    return prisma.activityFeed.findMany({
      where: {
        eventType: "big_win",
        amount: { gte: minAmount },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  // Clean up old activity (keep last 24 hours)
  async cleanupOldActivity() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return prisma.activityFeed.deleteMany({
      where: { createdAt: { lt: oneDayAgo } },
    });
  },
};

