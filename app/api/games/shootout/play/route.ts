// Shootout game API routes
import { NextRequest, NextResponse } from "next/server";
import { ShootoutService } from "@/lib/game/shootout-service";

// Get waiting games
export async function GET() {
  try {
    const waitingGames = ShootoutService.getWaitingGames();
    return NextResponse.json({ games: waitingGames });
  } catch (error) {
    console.error("Error getting shootout games:", error);
    return NextResponse.json(
      { error: "Failed to get games" },
      { status: 500 }
    );
  }
}

// Create, join, or cancel game
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, gameId, userId, walletAddress, wager, mode } = body;

    switch (action) {
      case "create": {
        if (!userId || !walletAddress || !wager) {
          return NextResponse.json(
            { error: "Missing required fields" },
            { status: 400 }
          );
        }

        const result = await ShootoutService.createGame(
          userId,
          walletAddress,
          wager,
          mode || "pvp"
        );
        
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true, gameId: result.gameId });
      }

      case "join": {
        if (!gameId || !userId || !walletAddress) {
          return NextResponse.json(
            { error: "Missing required fields" },
            { status: 400 }
          );
        }

        const result = await ShootoutService.joinGame(gameId, userId, walletAddress);
        
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true });
      }

      case "cancel": {
        if (!gameId || !userId) {
          return NextResponse.json(
            { error: "Missing required fields" },
            { status: 400 }
          );
        }

        const result = await ShootoutService.cancelGame(gameId, userId);
        
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Error in shootout game action:", error);
    return NextResponse.json(
      { error: "Failed to process action" },
      { status: 500 }
    );
  }
}

