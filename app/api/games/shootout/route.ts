// Shootout game API routes
import { NextRequest, NextResponse } from "next/server";
import { GameService } from "@/lib/db";
import { broadcastActivityUpdate } from "@/lib/sse/broadcaster";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  try {
    // Get open games to join
    const openGames = await GameService.getOpenShootoutGames(
      userId || undefined
    );

    return NextResponse.json({ games: openGames });
  } catch (error) {
    console.error("Error fetching shootout games:", error);
    return NextResponse.json(
      { error: "Failed to fetch games" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, wagerAmount, isPvP = true, opponentId } = body;

    if (!userId || !wagerAmount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const game = await GameService.createShootout({
      userId,
      wagerAmount,
      isPvP,
      opponentId,
    });

    // Get full game data with relations
    const fullGame = await GameService.getById(game.id);

    // Broadcast if it's a waiting game
    if (game.status === "WAITING" && fullGame) {
      const shareCode = (fullGame as { shootoutData?: { shareCode?: string } })
        .shootoutData?.shareCode;
      if (shareCode) {
        broadcastActivityUpdate({
          type: "new_player",
          gameType: "SHOOTOUT",
          wager: wagerAmount,
          shareCode,
        });
      }
    }

    return NextResponse.json({ game: fullGame });
  } catch (error) {
    console.error("Error creating shootout game:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create game",
      },
      { status: 500 }
    );
  }
}
