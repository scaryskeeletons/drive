// Withdrawal API - INSTANT balance deduction, background blockchain transfer
import { NextRequest, NextResponse } from "next/server";
import { DepositService } from "@/lib/db/services/deposit";
import { WalletService } from "@/lib/db";

// Request a withdrawal - returns INSTANTLY, blockchain processes in background
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, destinationAddress } = body;

    if (!userId || !amount || !destinationAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // This returns INSTANTLY after deducting balance
    // Blockchain transfer happens in background
    const result = await DepositService.requestWithdrawal(
      userId,
      amount,
      destinationAddress
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Get updated wallet (already has new balance)
    const wallet = await WalletService.getByUserId(userId);

    return NextResponse.json({
      success: true,
      withdrawalId: result.withdrawalId,
      message: "Withdrawal processing - tokens will arrive shortly",
      wallet: wallet
        ? {
            balance: wallet.balance,
            pendingBalance: wallet.pendingBalance,
            lockedBalance: wallet.lockedBalance,
            withdrawableBalance:
              wallet.balance - wallet.pendingBalance - wallet.lockedBalance,
          }
        : null,
    });
  } catch (error) {
    console.error("Error requesting withdrawal:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process" },
      { status: 500 }
    );
  }
}

// Get pending operations
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const pending = await DepositService.getPendingOperations(userId);
    return NextResponse.json(pending);
  } catch (error) {
    console.error("Error fetching pending operations:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending operations" },
      { status: 500 }
    );
  }
}
