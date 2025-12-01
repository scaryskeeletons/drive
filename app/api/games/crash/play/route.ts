// Crash game API routes
import { NextRequest, NextResponse } from "next/server";
import { CrashGameService } from "@/lib/game/crash-service";

// Get current game state
export async function GET() {
  try {
    const currentGame = CrashGameService.getCurrentGame();
    
    if (!currentGame) {
      // No active game, create one
      const newGame = await CrashGameService.createGame();
      return NextResponse.json({
        gameId: newGame.gameId,
        status: "waiting",
        serverSeedHash: newGame.serverSeedHash,
        startsAt: newGame.startsAt,
        currentMultiplier: 1.0,
        playerCount: 0,
      });
    }

    return NextResponse.json(currentGame);
  } catch (error) {
    console.error("Error getting crash game:", error);
    return NextResponse.json(
      { error: "Failed to get game state" },
      { status: 500 }
    );
  }
}

// Place bet or cashout
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, gameId, userId, wager } = body;

    switch (action) {
      case "bet": {
        if (!gameId || !userId || !wager) {
          return NextResponse.json(
            { error: "Missing required fields" },
            { status: 400 }
          );
        }

        const result = await CrashGameService.placeBet(gameId, userId, wager);
        
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true });
      }

      case "cashout": {
        if (!gameId || !userId) {
          return NextResponse.json(
            { error: "Missing required fields" },
            { status: 400 }
          );
        }

        const result = await CrashGameService.cashout(gameId, userId);
        
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          multiplier: result.multiplier,
          payout: result.payout,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in crash game action:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}

