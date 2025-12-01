import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ gameId: string }>;
}

// GET /api/games/[gameId] - Get specific game details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { gameId } = await params;

  const games: Record<string, object> = {
    shootout: {
      id: "shootout",
      name: "Shootout",
      description: "Fast-paced multiplayer elimination game",
      status: "live",
      minBet: 0.1,
      maxBet: 100,
      currentRound: {
        id: Math.floor(Math.random() * 10000),
        players: 8,
        pot: 24.5,
        status: "waiting",
        startsIn: 15,
      },
      stats: {
        totalGames: 12847,
        totalVolume: 2400000,
        biggestWin: 450.5,
      },
    },
    crash: {
      id: "crash",
      name: "Crash",
      description: "Watch the multiplier rise and cash out before it crashes",
      status: "live",
      minBet: 0.1,
      maxBet: 100,
      currentRound: {
        id: Math.floor(Math.random() * 10000),
        multiplier: 1.0,
        status: "waiting",
        startsIn: 5,
      },
      recentCrashes: [1.23, 3.45, 1.02, 8.91, 2.34, 1.15, 5.67, 1.89, 12.34, 1.45],
      stats: {
        totalGames: 24521,
        totalVolume: 4800000,
        biggestMultiplier: 1024.0,
      },
    },
  };

  const game = games[gameId];

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json({ game });
}

