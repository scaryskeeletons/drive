// Stats service - platform-wide statistics and analytics
import { prisma } from "../client";

export const StatsService = {
  // Get current platform stats (cached, updated every minute)
  async getCurrentStats() {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Run all queries in parallel
    const [
      totalGames,
      games24h,
      games1h,
      volume24h,
      volume1h,
      totalPlayers,
      activePlayers,
      shootoutGames,
      crashGames,
    ] = await Promise.all([
      prisma.gameRound.count({ where: { status: "COMPLETED" } }),
      prisma.gameRound.count({
        where: { status: "COMPLETED", endedAt: { gte: oneDayAgo } },
      }),
      prisma.gameRound.count({
        where: { status: "COMPLETED", endedAt: { gte: oneHourAgo } },
      }),
      prisma.gameRound.aggregate({
        where: { status: "COMPLETED", endedAt: { gte: oneDayAgo } },
        _sum: { wagerAmount: true },
      }),
      prisma.gameRound.aggregate({
        where: { status: "COMPLETED", endedAt: { gte: oneHourAgo } },
        _sum: { wagerAmount: true },
      }),
      prisma.user.count(),
      prisma.user.count({
        where: { lastActiveAt: { gte: fiveMinutesAgo } },
      }),
      prisma.gameRound.count({
        where: { gameType: "SHOOTOUT", status: "COMPLETED" },
      }),
      prisma.gameRound.count({
        where: { gameType: "CRASH", status: "COMPLETED" },
      }),
    ]);

    const totalVolume = await prisma.gameRound.aggregate({
      where: { status: "COMPLETED" },
      _sum: { wagerAmount: true },
    });

    return {
      totalGames,
      games24h,
      games1h,
      totalVolume: totalVolume._sum.wagerAmount || 0,
      volume24h: volume24h._sum.wagerAmount || 0,
      volume1h: volume1h._sum.wagerAmount || 0,
      totalPlayers,
      activePlayers,
      shootoutGames,
      crashGames,
    };
  },

  // Get stats for charts (time series data)
  async getTimeSeriesStats(
    timeRange: "5m" | "15m" | "30m" | "1h" | "6h" | "24h",
    points = 20
  ) {
    const rangeMs = {
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "30m": 30 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
    }[timeRange];

    const now = Date.now();
    const intervalMs = rangeMs / points;
    const startTime = new Date(now - rangeMs);

    // Get all games in the time range
    const games = await prisma.gameRound.findMany({
      where: {
        status: "COMPLETED",
        endedAt: { gte: startTime },
      },
      select: {
        endedAt: true,
        wagerAmount: true,
        gameType: true,
      },
    });

    // Bucket the data
    const buckets: {
      timestamp: Date;
      games: number;
      volume: number;
      shootout: number;
      crash: number;
    }[] = [];

    for (let i = 0; i < points; i++) {
      const bucketStart = now - rangeMs + i * intervalMs;
      const bucketEnd = bucketStart + intervalMs;

      const bucketGames = games.filter((g) => {
        const time = g.endedAt?.getTime() || 0;
        return time >= bucketStart && time < bucketEnd;
      });

      buckets.push({
        timestamp: new Date(bucketEnd),
        games: bucketGames.length,
        volume: bucketGames.reduce((sum, g) => sum + g.wagerAmount, 0),
        shootout: bucketGames.filter((g) => g.gameType === "SHOOTOUT").length,
        crash: bucketGames.filter((g) => g.gameType === "CRASH").length,
      });
    }

    return buckets;
  },

  // Get player count over time
  async getPlayerCountTimeSeries(
    timeRange: "5m" | "15m" | "30m" | "1h" | "6h" | "24h",
    points = 20
  ) {
    const rangeMs = {
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "30m": 30 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
    }[timeRange];

    const now = Date.now();
    const intervalMs = rangeMs / points;
    const startTime = new Date(now - rangeMs);

    // Get all user activity in range
    const users = await prisma.user.findMany({
      where: { lastActiveAt: { gte: startTime } },
      select: { lastActiveAt: true },
    });

    // Bucket the data
    const buckets: { timestamp: Date; players: number }[] = [];

    for (let i = 0; i < points; i++) {
      const bucketStart = now - rangeMs + i * intervalMs;
      const bucketEnd = bucketStart + intervalMs;

      // Count users active in a 5-minute window around this point
      const windowStart = bucketEnd - 5 * 60 * 1000;
      const activePlayers = users.filter((u) => {
        const time = u.lastActiveAt.getTime();
        return time >= windowStart && time <= bucketEnd;
      }).length;

      buckets.push({
        timestamp: new Date(bucketEnd),
        players: activePlayers,
      });
    }

    return buckets;
  },

  // Create a snapshot (called periodically by cron)
  async createSnapshot() {
    const stats = await this.getCurrentStats();

    return prisma.platformSnapshot.create({
      data: {
        totalVolume: stats.totalVolume,
        volume24h: stats.volume24h,
        volume1h: stats.volume1h,
        totalGames: stats.totalGames,
        games24h: stats.games24h,
        games1h: stats.games1h,
        totalPlayers: stats.totalPlayers,
        activePlayers: stats.activePlayers,
        shootoutGames: stats.shootoutGames,
        crashGames: stats.crashGames,
      },
    });
  },

  // Get historical snapshots
  async getSnapshots(since: Date, limit = 100) {
    return prisma.platformSnapshot.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: "asc" },
      take: limit,
    });
  },
};

