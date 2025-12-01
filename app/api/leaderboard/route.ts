// Leaderboard API
import { NextRequest, NextResponse } from "next/server";
import { UserService } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderBy = searchParams.get("orderBy") as
    | "totalWon"
    | "netProfit"
    | "biggestWin"
    | null;
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  try {
    const leaderboard = await UserService.getLeaderboard(
      Math.min(limit, 100),
      orderBy || "netProfit"
    );

    type LeaderboardEntry = Awaited<ReturnType<typeof UserService.getLeaderboard>>[number];

    return NextResponse.json({
      leaderboard: leaderboard.map((entry: LeaderboardEntry, index: number) => ({
        rank: index + 1,
        userId: entry.userId,
        walletAddress: entry.user.walletAddress,
        totalGamesPlayed: entry.totalGamesPlayed,
        totalWon: entry.totalWon,
        netProfit: entry.netProfit,
        biggestWin: entry.biggestWin,
        highestMultiplier: entry.highestMultiplier,
      })),
    });
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    );
  }
}

