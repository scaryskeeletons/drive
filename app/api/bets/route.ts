import { NextRequest, NextResponse } from "next/server";

// GET /api/bets - Get recent bets
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");
  const limit = parseInt(searchParams.get("limit") || "20");

  // Mock recent bets
  const bets = [
    {
      id: "bet_1",
      gameId: "crash",
      username: "CryptoKing",
      amount: 2.5,
      multiplier: 18.08,
      profit: 42.7,
      timestamp: new Date(Date.now() - 60000).toISOString(),
    },
    {
      id: "bet_2",
      gameId: "shootout",
      username: "SolanaWhale",
      amount: 5.0,
      multiplier: 5.7,
      profit: 23.5,
      timestamp: new Date(Date.now() - 120000).toISOString(),
    },
    {
      id: "bet_3",
      gameId: "crash",
      username: "LuckyApe",
      amount: 10.0,
      multiplier: 24.0,
      profit: 230.0,
      timestamp: new Date(Date.now() - 180000).toISOString(),
    },
    {
      id: "bet_4",
      gameId: "crash",
      username: "Degen42",
      amount: 1.0,
      multiplier: 0,
      profit: -1.0,
      timestamp: new Date(Date.now() - 240000).toISOString(),
    },
    {
      id: "bet_5",
      gameId: "shootout",
      username: "MoonBoi",
      amount: 3.0,
      multiplier: 3.2,
      profit: 6.6,
      timestamp: new Date(Date.now() - 300000).toISOString(),
    },
  ];

  const filteredBets = gameId
    ? bets.filter((bet) => bet.gameId === gameId)
    : bets;

  return NextResponse.json({
    bets: filteredBets.slice(0, limit),
    total: filteredBets.length,
  });
}

// POST /api/bets - Place a new bet
export async function POST(request: NextRequest) {
  const walletAddress = request.headers.get("x-wallet-address");

  if (!walletAddress) {
    return NextResponse.json(
      { error: "Wallet address required" },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { gameId, amount, autoCashout } = body;

  // Validation
  if (!gameId || !amount) {
    return NextResponse.json(
      { error: "gameId and amount are required" },
      { status: 400 }
    );
  }

  if (amount < 0.1 || amount > 100) {
    return NextResponse.json(
      { error: "Bet amount must be between 0.1 and 100 SOL" },
      { status: 400 }
    );
  }

  // Mock bet placement
  const bet = {
    id: `bet_${Date.now()}`,
    gameId,
    walletAddress,
    amount,
    autoCashout: autoCashout || null,
    status: "pending",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json({ bet, success: true });
}

