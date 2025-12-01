// Crash game API routes
import { NextRequest, NextResponse } from "next/server";
import { GameService } from "@/lib/db";
import { broadcastGameUpdate } from "@/lib/sse/broadcaster";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, wagerAmount, autoCashout } = body;

    if (!userId || !wagerAmount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const game = await GameService.createCrash({
      userId,
      wagerAmount,
      autoCashout,
    });

    // Broadcast game started
    broadcastGameUpdate(game.id, userId, {
      status: "active",
      gameType: "CRASH",
    });

    return NextResponse.json({ game });
  } catch (error) {
    console.error("Error creating crash game:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create game" },
      { status: 500 }
    );
  }
}

