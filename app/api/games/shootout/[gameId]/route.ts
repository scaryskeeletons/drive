// Individual shootout game operations
import { NextRequest, NextResponse } from "next/server";
import { GameService } from "@/lib/db";
import { broadcastGameUpdate, broadcastActivity } from "@/lib/sse/broadcaster";

interface RouteParams {
  params: Promise<{ gameId: string }>;
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

// Join a game
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { gameId } = await params;

  try {
    const body = await request.json();
    const { action, userId, winnerId, spinResult } = body;

    if (action === "join") {
      if (!userId) {
        return NextResponse.json(
          { error: "Missing userId" },
          { status: 400 }
        );
      }

      const game = await GameService.joinShootout(gameId, userId);

      // Broadcast game started
      broadcastGameUpdate(gameId, game.userId, {
        status: "active",
        opponentId: userId,
      });

      return NextResponse.json({ game });
    }

    if (action === "resolve") {
      if (!winnerId || spinResult === undefined) {
        return NextResponse.json(
          { error: "Missing winnerId or spinResult" },
          { status: 400 }
        );
      }

      const game = await GameService.resolveShootout(
        gameId,
        winnerId,
        spinResult
      );

      // Broadcast result
      broadcastGameUpdate(gameId, game.userId, {
        status: "completed",
        winnerId,
        payout: game.payout,
      });

      return NextResponse.json({ game });
    }

    if (action === "cancel") {
      const game = await GameService.cancelGame(gameId);

      broadcastGameUpdate(gameId, game.userId, {
        status: "cancelled",
      });

      return NextResponse.json({ game });
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

