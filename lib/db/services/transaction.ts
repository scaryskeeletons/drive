// Transaction service - handles all financial transactions
import { prisma } from "../client";
import type {
  Transaction,
  TransactionType,
  TransactionStatus,
} from "@prisma/client";

export interface CreateTransactionInput {
  userId: string;
  type: TransactionType;
  amount: number;
  gameRoundId?: string;
  txSignature?: string;
  metadata?: Record<string, unknown>;
}

export const TransactionService = {
  // Create a new transaction with balance update
  async create(input: CreateTransactionInput): Promise<Transaction> {
    const { userId, type, amount, gameRoundId, txSignature, metadata } = input;

    return prisma.$transaction(async (tx) => {
      // Get current balance
      const wallet = await tx.custodialWallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const balanceBefore = wallet.balance;
      
      // Calculate balance change based on type
      let balanceChange = 0;
      switch (type) {
        case "DEPOSIT":
        case "GAME_WIN":
        case "GAME_REFUND":
        case "BONUS":
          balanceChange = amount;
          break;
        case "WITHDRAWAL":
        case "GAME_BET":
        case "FEE":
          balanceChange = -amount;
          break;
      }

      const balanceAfter = balanceBefore + balanceChange;

      if (balanceAfter < 0) {
        throw new Error("Insufficient balance");
      }

      // Update wallet balance
      await tx.custodialWallet.update({
        where: { userId },
        data: {
          balance: balanceAfter,
          highestBalance: Math.max(wallet.highestBalance, balanceAfter),
          lowestBalance: Math.min(wallet.lowestBalance, balanceAfter),
          ...(type === "DEPOSIT" && {
            totalDeposited: { increment: amount },
          }),
          ...(type === "WITHDRAWAL" && {
            totalWithdrawn: { increment: amount },
          }),
        },
      });

      // Create balance snapshot
      await tx.balanceSnapshot.create({
        data: {
          userId,
          balance: balanceAfter,
          reason: type.toLowerCase(),
        },
      });

      // Create transaction record
      return tx.transaction.create({
        data: {
          userId,
          type,
          status: txSignature ? "CONFIRMED" : "PENDING",
          amount,
          balanceBefore,
          balanceAfter,
          gameRoundId,
          txSignature,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
          confirmedAt: txSignature ? new Date() : null,
        },
      });
    });
  },

  // Confirm a pending transaction
  async confirm(
    transactionId: string,
    txSignature: string
  ): Promise<Transaction> {
    return prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: "CONFIRMED",
        txSignature,
        confirmedAt: new Date(),
      },
    });
  },

  // Fail a transaction (and revert balance if needed)
  async fail(transactionId: string): Promise<Transaction> {
    return prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      if (transaction.status !== "PENDING") {
        throw new Error("Can only fail pending transactions");
      }

      // Revert balance
      const balanceRevert = transaction.balanceAfter - transaction.balanceBefore;
      if (balanceRevert !== 0) {
        await tx.custodialWallet.update({
          where: { userId: transaction.userId },
          data: {
            balance: { decrement: balanceRevert },
          },
        });
      }

      return tx.transaction.update({
        where: { id: transactionId },
        data: { status: "FAILED" },
      });
    });
  },

  // Get transaction by ID
  async getById(id: string): Promise<Transaction | null> {
    return prisma.transaction.findUnique({
      where: { id },
    });
  },

  // Get user's transaction history
  async getUserTransactions(
    userId: string,
    options: {
      type?: TransactionType;
      status?: TransactionStatus;
      limit?: number;
      offset?: number;
      since?: Date;
    } = {}
  ) {
    const { type, status, limit = 50, offset = 0, since } = options;

    return prisma.transaction.findMany({
      where: {
        userId,
        ...(type && { type }),
        ...(status && { status }),
        ...(since && { createdAt: { gte: since } }),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  },

  // Get transaction stats for user
  async getUserStats(userId: string, since?: Date) {
    const where = {
      userId,
      status: "CONFIRMED" as const,
      ...(since && { createdAt: { gte: since } }),
    };

    const [deposits, withdrawals, bets, wins] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...where, type: "DEPOSIT" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { ...where, type: "WITHDRAWAL" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { ...where, type: "GAME_BET" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { ...where, type: "GAME_WIN" },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      totalDeposited: deposits._sum.amount || 0,
      depositCount: deposits._count,
      totalWithdrawn: withdrawals._sum.amount || 0,
      withdrawalCount: withdrawals._count,
      totalWagered: bets._sum.amount || 0,
      betCount: bets._count,
      totalWon: wins._sum.amount || 0,
      winCount: wins._count,
    };
  },
};

