// Admin endpoint for monitoring withdrawals
// Withdrawals now process instantly in background, this is just for monitoring

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { Prisma } from "@prisma/client";

// Simple API key protection
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

// Get withdrawal stats and any stuck transactions
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (ADMIN_API_KEY && apiKey !== ADMIN_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [pending, processing, confirmed, failed] = await Promise.all([
      prisma.pendingWithdrawal.count({ where: { status: "pending" } }),
      prisma.pendingWithdrawal.count({ where: { status: "processing" } }),
      prisma.pendingWithdrawal.count({ where: { status: "confirmed" } }),
      prisma.pendingWithdrawal.count({ where: { status: "failed" } }),
    ]);

    // Get stuck withdrawals (processing for more than 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const stuck = await prisma.pendingWithdrawal.findMany({
      where: {
        status: "processing",
        processedAt: { lt: fiveMinutesAgo },
      },
      select: {
        id: true,
        amount: true,
        destinationAddress: true,
        processedAt: true,
      },
    });

    return NextResponse.json({
      stats: { pending, processing, confirmed, failed },
      stuck,
      message: "Withdrawals process instantly in background. This is for monitoring only.",
    });
  } catch (error) {
    console.error("Error getting withdrawal stats:", error);
    return NextResponse.json(
      { error: "Failed to get stats" },
      { status: 500 }
    );
  }
}

// Retry stuck withdrawals
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (ADMIN_API_KEY && apiKey !== ADMIN_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Mark very old "processing" withdrawals as failed (over 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    const stuckWithdrawals = await prisma.pendingWithdrawal.findMany({
      where: {
        status: "processing",
        processedAt: { lt: tenMinutesAgo },
      },
      include: { wallet: true },
    });

    let refunded = 0;
    
    for (const withdrawal of stuckWithdrawals) {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Refund the user
        await tx.custodialWallet.update({
          where: { id: withdrawal.walletId },
          data: {
            balance: { increment: withdrawal.amount },
            totalWithdrawn: { decrement: withdrawal.amount },
          },
        });

        // Mark as failed
        await tx.pendingWithdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: "failed",
            errorMessage: "Timed out - auto-refunded by admin",
          },
        });

        // Update transaction
        await tx.transaction.updateMany({
          where: {
            userId: withdrawal.wallet.userId,
            type: "WITHDRAWAL",
            status: "PENDING",
          },
          data: { status: "FAILED" },
        });
      });
      
      refunded++;
    }

    return NextResponse.json({
      message: `Refunded ${refunded} stuck withdrawals`,
      refunded,
    });
  } catch (error) {
    console.error("Error processing stuck withdrawals:", error);
    return NextResponse.json(
      { error: "Failed to process" },
      { status: 500 }
    );
  }
}
