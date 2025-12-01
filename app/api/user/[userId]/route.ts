// Individual user operations
import { NextRequest, NextResponse } from "next/server";
import { UserService, WalletService, TransactionService } from "@/lib/db";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const includeHistory = searchParams.get("history") === "true";
  const includeStats = searchParams.get("stats") === "true";
  const timeframe = searchParams.get("timeframe") as
    | "24h"
    | "7d"
    | "30d"
    | "all"
    | null;

  try {
    const user = await UserService.getById(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const wallet = await WalletService.getByUserId(userId);

    let history = null;
    let gameHistory = null;
    let balanceStats = null;
    let transactionStats = null;

    if (includeHistory || includeStats) {
      const since = getTimeframeSince(timeframe);

      if (includeHistory) {
        [history, gameHistory] = await Promise.all([
          WalletService.getBalanceHistory(userId, { since, limit: 50 }),
          UserService.getGameHistory(userId, { limit: 50 }),
        ]);
      }

      if (includeStats && since) {
        [balanceStats, transactionStats] = await Promise.all([
          WalletService.getBalanceStats(userId, since),
          TransactionService.getUserStats(userId, since),
        ]);
      }
    }

    return NextResponse.json({
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        avatarSeed: user.avatarSeed,
        createdAt: user.createdAt,
        stats: user.stats,
      },
      wallet: wallet
        ? {
            publicKey: wallet.publicKey,
            balance: wallet.balance,
            totalDeposited: wallet.totalDeposited,
            totalWithdrawn: wallet.totalWithdrawn,
            highestBalance: wallet.highestBalance,
            lowestBalance: wallet.lowestBalance,
          }
        : null,
      ...(includeHistory && { balanceHistory: history, gameHistory }),
      ...(includeStats && { balanceStats, transactionStats }),
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// Update user profile
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  try {
    const body = await request.json();
    const { username } = body;

    if (username) {
      await UserService.updateUsername(userId, username);
    }

    const user = await UserService.getById(userId);

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

function getTimeframeSince(
  timeframe: "24h" | "7d" | "30d" | "all" | null
): Date | undefined {
  if (!timeframe || timeframe === "all") return undefined;

  const now = Date.now();
  const msMap = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

  return new Date(now - msMap[timeframe]);
}

