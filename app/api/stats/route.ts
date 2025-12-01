// Platform stats API
import { NextRequest, NextResponse } from "next/server";
import { StatsService } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "current";
  const range = searchParams.get("range") as
    | "5m"
    | "15m"
    | "30m"
    | "1h"
    | "6h"
    | "24h"
    | null;

  try {
    if (type === "current") {
      const stats = await StatsService.getCurrentStats();
      return NextResponse.json({ stats });
    }

    if (type === "timeseries") {
      const timeRange = range || "1h";
      const [gameStats, playerStats] = await Promise.all([
        StatsService.getTimeSeriesStats(timeRange),
        StatsService.getPlayerCountTimeSeries(timeRange),
      ]);

      return NextResponse.json({
        games: gameStats,
        players: playerStats,
        range: timeRange,
      });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
