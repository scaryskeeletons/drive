// Crash game verification API
import { NextRequest, NextResponse } from "next/server";
import { CrashGameService } from "@/lib/game/crash-service";
import { verifyGame, CLIENT_VERIFICATION_CODE } from "@/lib/game/provably-fair";

// Get verification data for a game
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");

  if (!gameId) {
    return NextResponse.json({ error: "Missing gameId" }, { status: 400 });
  }

  try {
    const gameData = await CrashGameService.getGameForVerification(gameId);

    if (!gameData) {
      return NextResponse.json(
        { error: "Game not found or not completed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...gameData,
      verificationCode: CLIENT_VERIFICATION_CODE,
    });
  } catch (error) {
    console.error("Error getting verification data:", error);
    return NextResponse.json(
      { error: "Failed to get verification data" },
      { status: 500 }
    );
  }
}

// Verify a game result
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverSeed, serverSeedHash, clientSeed, nonce, crashPoint } = body;

    if (
      !serverSeed ||
      !serverSeedHash ||
      !clientSeed ||
      nonce === undefined ||
      !crashPoint
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const result = verifyGame(
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      crashPoint
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error verifying game:", error);
    return NextResponse.json(
      { error: "Failed to verify game" },
      { status: 500 }
    );
  }
}
