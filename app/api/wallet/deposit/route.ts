// Deposit API - INSTANT processing, background validation if slow
import { NextRequest, NextResponse } from "next/server";
import { DepositService } from "@/lib/db/services/deposit";
import { WalletService } from "@/lib/db";

// Process a deposit - returns INSTANTLY
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, txSignature } = body;

    if (!userId || !txSignature) {
      return NextResponse.json(
        { error: "Missing userId or txSignature" },
        { status: 400 }
      );
    }

    // This returns INSTANTLY
    // If blockchain is slow, it marks as pending and processes in background
    const result = await DepositService.processDeposit(userId, txSignature);

    if (!result.success && !result.pending) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Get updated wallet
    const wallet = await WalletService.getByUserId(userId);

    if (result.pending) {
      return NextResponse.json({
        success: true,
        pending: true,
        message: "Deposit processing - balance will update shortly via SSE",
        wallet: wallet
          ? {
              balance: wallet.balance,
              pendingBalance: wallet.pendingBalance,
            }
          : null,
      });
    }

    return NextResponse.json({
      success: true,
      amount: result.amount,
      message: "Deposit confirmed",
      wallet: wallet
        ? {
            balance: wallet.balance,
            totalDeposited: wallet.totalDeposited,
          }
        : null,
    });
  } catch (error) {
    console.error("Error processing deposit:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process" },
      { status: 500 }
    );
  }
}

// Get pending deposits
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const pending = await DepositService.getPendingOperations(userId);
    return NextResponse.json({ pendingDeposits: pending.deposits });
  } catch (error) {
    console.error("Error fetching pending deposits:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending deposits" },
      { status: 500 }
    );
  }
}
