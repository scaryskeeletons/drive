import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "DriveBy API",
    version: "1.0.0",
    status: "healthy",
    endpoints: {
      games: "/api/games",
      user: "/api/user",
      bets: "/api/bets",
    },
  });
}

