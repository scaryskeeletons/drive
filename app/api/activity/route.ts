// Activity feed API
import { NextRequest, NextResponse } from "next/server";
import { ActivityService, GameService } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  try {
    if (type === "big_wins") {
      const minAmount = parseFloat(searchParams.get("minAmount") || "1");
      const activity = await ActivityService.getBigWins(minAmount, limit);
      return NextResponse.json({ activity });
    }

    if (type === "recent_games") {
      const games = await GameService.getRecentGames(limit);
      return NextResponse.json({ games });
    }

    // Default: all recent activity
    const activity = await ActivityService.getRecentActivity(limit);
    return NextResponse.json({ activity });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}

