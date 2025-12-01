// Check wallet balance and auto-process deposits
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { SolanaService } from "@/lib/solana";

type PrismaTransaction = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  try {
    // Get on-chain balance
    const onChainBalance = await SolanaService.getTokenBalance(address);

    // Get user's custodial wallet
    const wallet = await prisma.custodialWallet.findFirst({
      where: { publicKey: address },
      include: { user: true },
    });

    if (!wallet) {
      return NextResponse.json({
        balance: onChainBalance,
        newDeposit: false,
      });
    }

    // Check if there's a new deposit (on-chain balance > 0)
    // In a real system, you'd track processed amounts more carefully
    let newDeposit = false;
    let depositAmount = 0;

    if (onChainBalance > 0) {
      // Check if this balance was already processed
      const lastSnapshot = await prisma.balanceSnapshot.findFirst({
        where: { userId: wallet.userId },
        orderBy: { timestamp: "desc" },
      });

      // Simple check: if on-chain has funds, credit them
      // In production, you'd want more sophisticated tracking
      const existingPendingDeposit = await prisma.pendingDeposit.findFirst({
        where: {
          walletId: wallet.id,
          status: "pending",
        },
      });

      if (!existingPendingDeposit && onChainBalance > 0.0001) {
        // Credit the deposit
        depositAmount = onChainBalance;
        newDeposit = true;

        await prisma.$transaction(async (tx: PrismaTransaction) => {
          // Update wallet balance
          await tx.custodialWallet.update({
            where: { id: wallet.id },
            data: {
              balance: { increment: depositAmount },
              highestBalance: Math.max(
                wallet.highestBalance,
                wallet.balance + depositAmount
              ),
            },
          });

          // Create balance snapshot
          await tx.balanceSnapshot.create({
            data: {
              userId: wallet.userId,
              balance: wallet.balance + depositAmount,
              reason: "deposit",
            },
          });

          // Record transaction
          await tx.transaction.create({
            data: {
              userId: wallet.userId,
              type: "DEPOSIT",
              amount: depositAmount,
              balanceBefore: wallet.balance,
              balanceAfter: wallet.balance + depositAmount,
              status: "CONFIRMED",
              metadata: { source: "auto_detect", address },
            },
          });
        });

        // Transfer to game master in background (non-blocking)
        // This moves the funds from user's custodial wallet to game master
        // But we don't await it - user's balance is already credited
        setImmediate(async () => {
          try {
            const userKeypair = await getKeypairForWallet(wallet.id);
            if (userKeypair) {
              await SolanaService.transferToGameMaster(
                userKeypair,
                depositAmount
              );
            }
          } catch (error) {
            console.error("Background transfer failed:", error);
          }
        });
      }
    }

    return NextResponse.json({
      balance: onChainBalance,
      newDeposit,
      depositAmount,
      platformBalance: wallet.balance + (newDeposit ? depositAmount : 0),
    });
  } catch (error) {
    console.error("Error checking balance:", error);

    // Return a safe fallback
    return NextResponse.json({
      balance: 0,
      newDeposit: false,
      error: "Failed to check balance",
    });
  }
}

// Helper to get keypair for wallet (placeholder)
async function getKeypairForWallet(walletId: string) {
  // In production, you'd decrypt and return the keypair
  // For now, return null to skip the transfer
  return null;
}
