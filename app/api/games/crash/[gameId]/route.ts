// Individual crash game operations
import { NextRequest, NextResponse } from "next/server";
import { GameService } from "@/lib/db";
import { broadcastGameUpdate, broadcastActivityUpdate } from "@/lib/sse/broadcaster";

interface RouteParams {
  params: Promise<{ gameId: string }>;
}

// Type for game with relations
interface GameWithRelations {
  id: string;
  userId: string;
  status: string;
  payout: number | null;
  crashData?: { crashPoint: number } | null;
  user?: { username: string | null } | null;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { gameId } = await params;

  try {
    const game = await GameService.getById(gameId);

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    return NextResponse.json({ game });
  } catch (error) {
    console.error("Error fetching game:", error);
    return NextResponse.json(
      { error: "Failed to fetch game" },
      { status: 500 }
    );
  }
}

// Game actions: cashout or crash
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { gameId } = await params;

  try {
    const body = await request.json();
    const { action, cashoutMultiplier } = body;

    if (action === "cashout") {
      if (cashoutMultiplier === undefined) {
        return NextResponse.json(
          { error: "Missing cashoutMultiplier" },
          { status: 400 }
        );
      }

      const game = await GameService.cashoutCrash(gameId, cashoutMultiplier);
      
      // Get full game data for broadcast
      const fullGame = await GameService.getById(gameId) as GameWithRelations | null;

      // Broadcast result
      broadcastGameUpdate({
        type: "crash_cashout",
        gameId,
        status: "completed",
        won: true,
        payout: game.payout,
        multiplier: cashoutMultiplier,
      });

      // Broadcast big win to activity
      if (cashoutMultiplier >= 5 && game.payout && fullGame) {
        broadcastActivityUpdate({
          type: "big_win",
          gameType: "CRASH",
          amount: game.payout,
          multiplier: cashoutMultiplier,
          username: fullGame.user?.username,
        });
      }

      return NextResponse.json({ game: fullGame });
    }

    if (action === "crash") {
      const game = await GameService.crashGame(gameId);
      
      // Get full game data for the broadcast
      const fullGame = await GameService.getById(gameId) as GameWithRelations | null;

      broadcastGameUpdate({
        type: "crash_end",
        gameId,
        status: "completed",
        won: false,
        crashPoint: fullGame?.crashData?.crashPoint,
      });

      return NextResponse.json({ game: fullGame });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing game action:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process action" },
      { status: 500 }
    );
  }
}
