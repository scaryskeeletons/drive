import { NextResponse } from "next/server";

// GET /api/games - List all games
export async function GET() {
  const games = [
    {
      id: "shootout",
      name: "Shootout",
      description: "Fast-paced multiplayer elimination game",
      status: "live",
      minBet: 0.1,
      maxBet: 100,
      players: 127,
    },
    {
      id: "crash",
      name: "Crash",
      description: "Watch the multiplier rise and cash out before it crashes",
      status: "live",
      minBet: 0.1,
      maxBet: 100,
      players: 284,
    },
  ];

  return NextResponse.json({ games });
}

