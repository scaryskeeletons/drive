// Wallet operations API
import { NextRequest, NextResponse } from "next/server";
import { WalletService, TransactionService } from "@/lib/db";
import { broadcastBalanceUpdate } from "@/lib/sse/broadcaster";

// Deposit to wallet (simulated for now - real implementation needs Solana integration)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, amount, txSignature, action } = body;

    if (!userId || !amount) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (action === "deposit") {
      // Create deposit transaction
      const transaction = await TransactionService.create({
        userId,
        type: "DEPOSIT",
        amount,
        txSignature,
      });

      // Get updated wallet
      const wallet = await WalletService.getByUserId(userId);

      // Broadcast balance update
      if (wallet) {
        broadcastBalanceUpdate(userId, wallet.balance, amount);
      }

      return NextResponse.json({
        transaction,
        wallet: wallet
          ? {
              balance: wallet.balance,
              totalDeposited: wallet.totalDeposited,
            }
          : null,
      });
    }

    if (action === "withdraw") {
      // Create withdrawal transaction
      const transaction = await TransactionService.create({
        userId,
        type: "WITHDRAWAL",
        amount,
        txSignature,
      });

      // Get updated wallet
      const wallet = await WalletService.getByUserId(userId);

      // Broadcast balance update
      if (wallet) {
        broadcastBalanceUpdate(userId, wallet.balance, -amount);
      }

      return NextResponse.json({
        transaction,
        wallet: wallet
          ? {
              balance: wallet.balance,
              totalWithdrawn: wallet.totalWithdrawn,
            }
          : null,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error processing wallet operation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process" },
      { status: 500 }
    );
  }
}

// Get wallet info
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const wallet = await WalletService.getByUserId(userId);

    if (!wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    return NextResponse.json({
      wallet: {
        publicKey: wallet.publicKey,
        balance: wallet.balance,
        pendingBalance: wallet.pendingBalance,
        lockedBalance: wallet.lockedBalance,
        withdrawableBalance:
          wallet.balance - wallet.pendingBalance - wallet.lockedBalance,
        totalDeposited: wallet.totalDeposited,
        totalWithdrawn: wallet.totalWithdrawn,
        highestBalance: wallet.highestBalance,
        lowestBalance: wallet.lowestBalance,
      },
    });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet" },
      { status: 500 }
    );
  }
}
