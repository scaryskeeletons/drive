// Instant Deposit/Withdrawal service with non-blocking blockchain operations
import { prisma } from "../client";
import { Prisma } from "@prisma/client";
import { SolanaService } from "@/lib/solana";
import { WalletService } from "./wallet";
import { broadcastBalanceUpdate } from "@/lib/sse/broadcaster";

type TransactionClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Configuration
const MAX_DECIMALS = 9;
const MIN_AMOUNT = 0.0000001;
const MAX_AMOUNT = 1_000_000_000;
const WITHDRAWAL_COOLDOWN_MS = 60 * 1000; // 1 minute between withdrawals

// In-memory rate limit cache (use Redis in production for multi-instance)
const withdrawalCooldowns = new Map<string, number>();

// Validate amount
function validateAmount(amount: number): { valid: boolean; error?: string } {
  if (typeof amount !== "number" || isNaN(amount)) {
    return { valid: false, error: "Invalid amount type" };
  }
  if (!isFinite(amount)) {
    return { valid: false, error: "Amount must be finite" };
  }
  if (amount < MIN_AMOUNT) {
    return { valid: false, error: `Minimum amount is ${MIN_AMOUNT}` };
  }
  if (amount > MAX_AMOUNT) {
    return { valid: false, error: `Maximum amount is ${MAX_AMOUNT}` };
  }
  const decimalPlaces = (amount.toString().split(".")[1] || "").length;
  if (decimalPlaces > MAX_DECIMALS) {
    return {
      valid: false,
      error: `Maximum ${MAX_DECIMALS} decimal places allowed`,
    };
  }
  return { valid: true };
}

// Sanitize amount
function sanitizeAmount(amount: number): number {
  return (
    Math.floor(amount * Math.pow(10, MAX_DECIMALS)) / Math.pow(10, MAX_DECIMALS)
  );
}

// Background task runner
function runInBackground(fn: () => Promise<void>): void {
  setImmediate(() => {
    fn().catch((error) => {
      console.error("Background task error:", error);
    });
  });
}

// Check withdrawal rate limit
function checkWithdrawalRateLimit(userId: string): {
  allowed: boolean;
  waitSeconds?: number;
} {
  const lastWithdrawal = withdrawalCooldowns.get(userId);
  const now = Date.now();

  if (lastWithdrawal) {
    const elapsed = now - lastWithdrawal;
    if (elapsed < WITHDRAWAL_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((WITHDRAWAL_COOLDOWN_MS - elapsed) / 1000);
      return { allowed: false, waitSeconds };
    }
  }

  return { allowed: true };
}

// Set withdrawal timestamp
function setWithdrawalTimestamp(userId: string): void {
  withdrawalCooldowns.set(userId, Date.now());
  // Clean up old entries after 2 minutes
  setTimeout(() => {
    withdrawalCooldowns.delete(userId);
  }, WITHDRAWAL_COOLDOWN_MS * 2);
}

export const DepositService = {
  // INSTANT deposit processing
  async processDeposit(
    userId: string,
    txSignature: string
  ): Promise<{
    success: boolean;
    amount?: number;
    error?: string;
    pending?: boolean;
  }> {
    if (!txSignature || txSignature.length < 32 || txSignature.length > 128) {
      return { success: false, error: "Invalid transaction signature" };
    }

    const existingDeposit = await prisma.pendingDeposit.findUnique({
      where: { txSignature },
    });

    if (existingDeposit?.status === "confirmed") {
      return { success: false, error: "Deposit already processed" };
    }

    const wallet = await WalletService.getByUserId(userId);
    if (!wallet) {
      return { success: false, error: "Wallet not found" };
    }

    // Quick validation with timeout
    const validationPromise = SolanaService.validateDeposit(
      txSignature,
      wallet.publicKey
    );
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 5000)
    );

    const validation = await Promise.race([validationPromise, timeoutPromise]);

    if (!validation) {
      await prisma.pendingDeposit.upsert({
        where: { txSignature },
        create: {
          walletId: wallet.id,
          amount: 0,
          txSignature,
          tokenMint: SolanaService.getAcceptedTokenMint(),
          status: "pending",
        },
        update: {},
      });

      runInBackground(async () => {
        await this.processDepositBackground(
          userId,
          txSignature,
          wallet.id,
          wallet.publicKey
        );
      });

      return { success: true, pending: true };
    }

    if (!validation.valid) {
      return { success: false, error: "Invalid deposit transaction" };
    }

    const amountCheck = validateAmount(validation.amount);
    if (!amountCheck.valid) {
      return { success: false, error: amountCheck.error };
    }

    const sanitizedAmount = sanitizeAmount(validation.amount);

    return prisma.$transaction(async (tx: TransactionClient) => {
      const existing = await tx.pendingDeposit.findUnique({
        where: { txSignature },
      });

      if (existing?.status === "confirmed") {
        return { success: false, error: "Deposit already processed" };
      }

      await tx.pendingDeposit.upsert({
        where: { txSignature },
        create: {
          walletId: wallet.id,
          amount: sanitizedAmount,
          txSignature,
          tokenMint: validation.tokenMint,
          status: "confirmed",
          confirmations: 1,
          confirmedAt: new Date(),
        },
        update: {
          status: "confirmed",
          amount: sanitizedAmount,
          confirmations: 1,
          confirmedAt: new Date(),
        },
      });

      const currentWallet = await tx.custodialWallet.findUnique({
        where: { id: wallet.id },
      });

      if (!currentWallet) {
        throw new Error("Wallet not found");
      }

      const newBalance = sanitizeAmount(
        currentWallet.balance + sanitizedAmount
      );

      await tx.custodialWallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          totalDeposited: { increment: sanitizedAmount },
          highestBalance: Math.max(currentWallet.highestBalance, newBalance),
        },
      });

      await tx.balanceSnapshot.create({
        data: { userId, balance: newBalance, reason: "deposit" },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "DEPOSIT",
          status: "CONFIRMED",
          amount: sanitizedAmount,
          balanceBefore: currentWallet.balance,
          balanceAfter: newBalance,
          txSignature,
          confirmedAt: new Date(),
        },
      });

      broadcastBalanceUpdate(userId, newBalance, sanitizedAmount);

      return { success: true, amount: sanitizedAmount };
    });
  },

  // Background deposit processing
  async processDepositBackground(
    userId: string,
    txSignature: string,
    walletId: string,
    walletPublicKey: string
  ): Promise<void> {
    try {
      const validation = await SolanaService.validateDeposit(
        txSignature,
        walletPublicKey
      );

      if (!validation?.valid) {
        await prisma.pendingDeposit.update({
          where: { txSignature },
          data: { status: "failed" },
        });
        return;
      }

      const sanitizedAmount = sanitizeAmount(validation.amount);

      await prisma.$transaction(async (tx: TransactionClient) => {
        const existing = await tx.pendingDeposit.findUnique({
          where: { txSignature },
        });

        if (existing?.status === "confirmed") return;

        await tx.pendingDeposit.update({
          where: { txSignature },
          data: {
            status: "confirmed",
            amount: sanitizedAmount,
            confirmations: 1,
            confirmedAt: new Date(),
          },
        });

        const currentWallet = await tx.custodialWallet.findUnique({
          where: { id: walletId },
        });

        if (!currentWallet) return;

        const newBalance = sanitizeAmount(
          currentWallet.balance + sanitizedAmount
        );

        await tx.custodialWallet.update({
          where: { id: walletId },
          data: {
            balance: newBalance,
            totalDeposited: { increment: sanitizedAmount },
            highestBalance: Math.max(currentWallet.highestBalance, newBalance),
          },
        });

        await tx.balanceSnapshot.create({
          data: { userId, balance: newBalance, reason: "deposit" },
        });

        await tx.transaction.create({
          data: {
            userId,
            type: "DEPOSIT",
            status: "CONFIRMED",
            amount: sanitizedAmount,
            balanceBefore: currentWallet.balance,
            balanceAfter: newBalance,
            txSignature,
            confirmedAt: new Date(),
          },
        });

        broadcastBalanceUpdate(userId, newBalance, sanitizedAmount);
      });
    } catch (error) {
      console.error("Background deposit processing failed:", error);
    }
  },

  // INSTANT withdrawal with rate limiting
  async requestWithdrawal(
    userId: string,
    amount: number,
    destinationAddress: string
  ): Promise<{
    success: boolean;
    withdrawalId?: string;
    error?: string;
    waitSeconds?: number;
  }> {
    // Check rate limit FIRST
    const rateLimit = checkWithdrawalRateLimit(userId);
    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Please wait ${rateLimit.waitSeconds} seconds before withdrawing again`,
        waitSeconds: rateLimit.waitSeconds,
      };
    }

    const amountCheck = validateAmount(amount);
    if (!amountCheck.valid) {
      return { success: false, error: amountCheck.error };
    }

    const sanitizedAmount = sanitizeAmount(amount);

    if (
      !destinationAddress ||
      destinationAddress.length < 32 ||
      destinationAddress.length > 44
    ) {
      return { success: false, error: "Invalid destination address" };
    }

    const wallet = await WalletService.getByUserId(userId);
    if (!wallet) {
      return { success: false, error: "Wallet not found" };
    }

    const withdrawableBalance = sanitizeAmount(
      wallet.balance - wallet.pendingBalance - wallet.lockedBalance
    );

    if (sanitizedAmount > withdrawableBalance) {
      return {
        success: false,
        error: `Insufficient balance. Available: ${withdrawableBalance.toFixed(6)}`,
      };
    }

    // Set rate limit timestamp BEFORE processing
    setWithdrawalTimestamp(userId);

    // Deduct balance instantly
    const result = await prisma.$transaction(async (tx: TransactionClient) => {
      const currentWallet = await tx.custodialWallet.findUnique({
        where: { id: wallet.id },
      });

      if (!currentWallet) {
        throw new Error("Wallet not found");
      }

      const currentWithdrawable = sanitizeAmount(
        currentWallet.balance -
          currentWallet.pendingBalance -
          currentWallet.lockedBalance
      );

      if (sanitizedAmount > currentWithdrawable) {
        throw new Error(
          `Insufficient balance. Available: ${currentWithdrawable.toFixed(6)}`
        );
      }

      const newBalance = sanitizeAmount(
        currentWallet.balance - sanitizedAmount
      );

      await tx.custodialWallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
          totalWithdrawn: { increment: sanitizedAmount },
          lowestBalance: Math.min(currentWallet.lowestBalance, newBalance),
        },
      });

      const withdrawal = await tx.pendingWithdrawal.create({
        data: {
          walletId: wallet.id,
          amount: sanitizedAmount,
          destinationAddress,
          tokenMint: SolanaService.getAcceptedTokenMint(),
          status: "processing",
          processedAt: new Date(),
        },
      });

      await tx.balanceSnapshot.create({
        data: { userId, balance: newBalance, reason: "withdraw" },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: "WITHDRAWAL",
          status: "PENDING",
          amount: sanitizedAmount,
          balanceBefore: currentWallet.balance,
          balanceAfter: newBalance,
          metadata: { withdrawalId: withdrawal.id },
        },
      });

      broadcastBalanceUpdate(userId, newBalance, -sanitizedAmount);

      return { withdrawalId: withdrawal.id, newBalance };
    });

    // Process blockchain in background - DON'T AWAIT
    runInBackground(async () => {
      await this.processWithdrawalBackground(
        result.withdrawalId,
        userId,
        wallet.id,
        sanitizedAmount,
        destinationAddress,
        result.newBalance
      );
    });

    return { success: true, withdrawalId: result.withdrawalId };
  },

  // Background withdrawal processing
  async processWithdrawalBackground(
    withdrawalId: string,
    userId: string,
    walletId: string,
    amount: number,
    destinationAddress: string,
    newBalance: number
  ): Promise<void> {
    try {
      const txSignature = await SolanaService.transferFromGameMaster(
        destinationAddress,
        amount
      );

      await prisma.pendingWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: "confirmed",
          txSignature,
          confirmedAt: new Date(),
        },
      });

      await prisma.transaction.updateMany({
        where: { userId, type: "WITHDRAWAL", status: "PENDING" },
        data: { status: "CONFIRMED", txSignature, confirmedAt: new Date() },
      });

      broadcastBalanceUpdate(userId, newBalance, 0, "confirmed");
    } catch (error) {
      console.error("Withdrawal blockchain error:", error);

      await prisma.$transaction(async (tx: TransactionClient) => {
        await tx.custodialWallet.update({
          where: { id: walletId },
          data: {
            balance: { increment: amount },
            totalWithdrawn: { decrement: amount },
          },
        });

        await tx.pendingWithdrawal.update({
          where: { id: withdrawalId },
          data: {
            status: "failed",
            errorMessage:
              error instanceof Error ? error.message : "Unknown error",
          },
        });

        await tx.transaction.updateMany({
          where: { userId, type: "WITHDRAWAL", status: "PENDING" },
          data: { status: "FAILED" },
        });

        broadcastBalanceUpdate(userId, newBalance + amount, amount, "refunded");
      });
    }
  },

  // Get pending operations
  async getPendingOperations(userId: string) {
    const wallet = await WalletService.getByUserId(userId);
    if (!wallet) return { deposits: [], withdrawals: [] };

    const [deposits, withdrawals] = await Promise.all([
      prisma.pendingDeposit.findMany({
        where: { walletId: wallet.id, status: "pending" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.pendingWithdrawal.findMany({
        where: {
          walletId: wallet.id,
          status: { in: ["pending", "processing"] },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { deposits, withdrawals };
  },

  // Get transaction history
  async getTransactionHistory(userId: string, limit = 20) {
    return prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  // Check withdrawal cooldown
  getWithdrawalCooldown(userId: string): {
    canWithdraw: boolean;
    waitSeconds?: number;
  } {
    const rateLimit = checkWithdrawalRateLimit(userId);
    return {
      canWithdraw: rateLimit.allowed,
      waitSeconds: rateLimit.waitSeconds,
    };
  },
};
