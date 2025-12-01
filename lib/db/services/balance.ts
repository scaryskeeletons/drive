// Balance management service with non-blocking transfers
// We control user's custodial wallets, so we can let them play immediately
// and transfer tokens to game master in the background

import { prisma } from "../client";
import { Prisma } from "@prisma/client";
import { SolanaService } from "@/lib/solana";
import { WalletService } from "./wallet";

type TransactionClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Background task runner - doesn't block
function runInBackground(fn: () => Promise<void>): void {
  setImmediate(() => {
    fn().catch((error) => {
      console.error("Background balance task error:", error);
    });
  });
}

export const BalanceService = {
  // Place a bet - INSTANT balance lock, background token transfer
  // Since we control the custodial wallet, user can play immediately
  async placeBet(
    userId: string,
    amount: number,
    gameRoundId: string
  ): Promise<{ success: boolean; error?: string }> {
    // Lock funds instantly in database
    const lockResult = await prisma.$transaction(
      async (tx: TransactionClient) => {
        const wallet = await tx.custodialWallet.findFirst({
          where: { userId },
        });

        if (!wallet) {
          return { success: false, error: "Wallet not found" };
        }

        const availableBalance =
          wallet.balance - wallet.pendingBalance - wallet.lockedBalance;

        if (amount > availableBalance) {
          return {
            success: false,
            error: `Insufficient balance. Available: ${availableBalance.toFixed(6)}`,
          };
        }

        // Lock funds immediately
        await tx.custodialWallet.update({
          where: { id: wallet.id },
          data: {
            pendingBalance: { increment: amount },
          },
        });

        return { success: true, walletId: wallet.id };
      }
    );

    if (!lockResult.success) {
      return { success: false, error: lockResult.error };
    }

    // Transfer tokens to game master in BACKGROUND
    // User can play immediately since we own the wallet
    runInBackground(async () => {
      await this.transferBetToGameMaster(
        userId,
        lockResult.walletId!,
        amount,
        gameRoundId
      );
    });

    return { success: true };
  },

  // Background transfer of bet to game master
  async transferBetToGameMaster(
    userId: string,
    walletId: string,
    amount: number,
    gameRoundId: string
  ): Promise<void> {
    try {
      // Get user's keypair
      const userKeypair = await WalletService.getKeypair(userId);
      if (!userKeypair) {
        console.error("Failed to get user keypair for bet transfer");
        return;
      }

      // Transfer to game master
      const txSignature = await SolanaService.transferToGameMaster(
        userKeypair,
        amount
      );

      console.log(
        `Bet transfer complete: ${txSignature} for game ${gameRoundId}`
      );
    } catch (error) {
      // Log but don't fail the game - we have the funds locked
      // The funds are still in user's custodial wallet which we control
      console.error("Background bet transfer failed:", error);
      // Optionally retry later or handle in a separate process
    }
  },

  // Unlock funds after game ends (regardless of outcome)
  async unlockFromGame(
    userId: string,
    amount: number,
    gameRoundId: string
  ): Promise<{ success: boolean; error?: string }> {
    return prisma.$transaction(async (tx: TransactionClient) => {
      const wallet = await tx.custodialWallet.findFirst({
        where: { userId },
      });

      if (!wallet) {
        return { success: false, error: "Wallet not found" };
      }

      const newPendingBalance = Math.max(0, wallet.pendingBalance - amount);

      await tx.custodialWallet.update({
        where: { id: wallet.id },
        data: {
          pendingBalance: newPendingBalance,
        },
      });

      return { success: true };
    });
  },

  // Deduct from balance after game loss
  async deductLoss(
    userId: string,
    amount: number,
    gameRoundId: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    return prisma.$transaction(async (tx: TransactionClient) => {
      const wallet = await tx.custodialWallet.findFirst({
        where: { userId },
      });

      if (!wallet) {
        return { success: false, error: "Wallet not found" };
      }

      const newBalance = wallet.balance - amount;
      const newPendingBalance = Math.max(0, wallet.pendingBalance - amount);

      await tx.custodialWallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          pendingBalance: newPendingBalance,
          lowestBalance: Math.min(wallet.lowestBalance, newBalance),
        },
      });

      await tx.balanceSnapshot.create({
        data: {
          userId,
          balance: newBalance,
          reason: "game_loss",
        },
      });

      return { success: true, newBalance };
    });
  },

  // Credit winnings after game win - INSTANT balance update, background payout
  async creditWinnings(
    userId: string,
    wagerAmount: number,
    winnings: number,
    gameRoundId: string
  ): Promise<{ success: boolean; newBalance?: number; error?: string }> {
    // Update balance instantly
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const wallet = await tx.custodialWallet.findFirst({
        where: { userId },
      });

      if (!wallet) {
        return { success: false, error: "Wallet not found" };
      }

      const profit = winnings - wagerAmount;
      const newBalance = wallet.balance + profit;
      const newPendingBalance = Math.max(
        0,
        wallet.pendingBalance - wagerAmount
      );

      await tx.custodialWallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          pendingBalance: newPendingBalance,
          highestBalance: Math.max(wallet.highestBalance, newBalance),
        },
      });

      await tx.balanceSnapshot.create({
        data: {
          userId,
          balance: newBalance,
          reason: "game_win",
        },
      });

      return { success: true, newBalance, walletPublicKey: wallet.publicKey };
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Transfer winnings from game master to user in BACKGROUND
    // User sees balance immediately
    const profit = winnings - wagerAmount;
    if (profit > 0) {
      runInBackground(async () => {
        await this.transferWinningsToUser(
          result.walletPublicKey!,
          profit,
          gameRoundId
        );
      });
    }

    return { success: true, newBalance: result.newBalance };
  },

  // Background transfer of winnings to user
  async transferWinningsToUser(
    userWalletPublicKey: string,
    amount: number,
    gameRoundId: string
  ): Promise<void> {
    try {
      const txSignature = await SolanaService.transferFromGameMaster(
        userWalletPublicKey,
        amount
      );
      console.log(
        `Winnings transfer complete: ${txSignature} for game ${gameRoundId}`
      );
    } catch (error) {
      console.error("Background winnings transfer failed:", error);
      // The user already has the balance credited in database
      // This is just syncing the on-chain state
      // Could be retried later or handled by a reconciliation process
    }
  },

  // Get current balances for a user
  async getBalances(userId: string): Promise<{
    balance: number;
    pendingBalance: number;
    lockedBalance: number;
    withdrawableBalance: number;
  } | null> {
    const wallet = await prisma.custodialWallet.findFirst({
      where: { userId },
    });

    if (!wallet) return null;

    return {
      balance: wallet.balance,
      pendingBalance: wallet.pendingBalance,
      lockedBalance: wallet.lockedBalance,
      withdrawableBalance:
        wallet.balance - wallet.pendingBalance - wallet.lockedBalance,
    };
  },

  // Check if user has sufficient balance for a bet
  async canPlaceBet(userId: string, amount: number): Promise<boolean> {
    const balances = await this.getBalances(userId);
    if (!balances) return false;
    return balances.withdrawableBalance >= amount;
  },
};
