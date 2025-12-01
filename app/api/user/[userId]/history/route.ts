// User game history API
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "7d";

    // Calculate date range
    let startDate: Date;
    const now = new Date();

    switch (range) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "all":
      default:
        startDate = new Date(0); // Beginning of time
        break;
    }

    // Fetch game rounds for user
    const games = await prisma.gameRound.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
        },
      },
      include: {
        crashData: true,
        shootoutData: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    // Transform data for response
    const transformedGames = games.map((game) => {
      let multiplier: number | null = null;

      if (game.gameType === "CRASH" && game.crashData) {
        multiplier = game.crashData.cashedOutAt || game.crashData.crashPoint;
      } else if (game.gameType === "SHOOTOUT" && game.shootoutData) {
        multiplier = game.won ? 2.0 : 0; // Shootout is 2x on win
      }

      return {
        id: game.id,
        gameType: game.gameType,
        wagerAmount: game.wagerAmount,
        won: game.won,
        payout: game.payout,
        profit: game.profit,
        multiplier,
        createdAt: game.createdAt.toISOString(),
        status: game.status,
      };
    });

    return NextResponse.json({ games: transformedGames });
  } catch (error) {
    console.error("Error fetching user history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}

