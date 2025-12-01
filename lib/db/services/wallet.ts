// Wallet service - handles custodial wallet operations
import { prisma } from "../client";
import { Prisma } from "@prisma/client";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

// Type for the wallet from Prisma
type CustodialWallet = Prisma.CustodialWalletGetPayload<object>;
type BalanceSnapshot = Prisma.BalanceSnapshotGetPayload<object>;

// Transaction client type
type TransactionClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// In production, use proper encryption (e.g., AWS KMS, Vault)
const ENCRYPTION_KEY =
  process.env.WALLET_ENCRYPTION_KEY || "dev-key-replace-in-prod";

function encryptKey(privateKey: Uint8Array): string {
  // TODO: Implement proper encryption in production
  // For now, just base58 encode (NOT SECURE FOR PRODUCTION)
  return bs58.encode(privateKey);
}

function decryptKey(encrypted: string): Uint8Array {
  // TODO: Implement proper decryption in production
  return bs58.decode(encrypted);
}

export const WalletService = {
  // Create a new custodial wallet for a user
  async createWallet(userId: string): Promise<CustodialWallet> {
    // Check if user already has a wallet
    const existing = await prisma.custodialWallet.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    // Generate new keypair
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const encryptedKey = encryptKey(keypair.secretKey);

    return prisma.custodialWallet.create({
      data: {
        userId,
        publicKey,
        encryptedKey,
        balance: 0,
        totalDeposited: 0,
        totalWithdrawn: 0,
        highestBalance: 0,
        lowestBalance: 0,
      },
    });
  },

  // Get wallet by user ID
  async getByUserId(userId: string): Promise<CustodialWallet | null> {
    return prisma.custodialWallet.findUnique({
      where: { userId },
    });
  },

  // Get wallet by public key
  async getByPublicKey(publicKey: string): Promise<CustodialWallet | null> {
    return prisma.custodialWallet.findUnique({
      where: { publicKey },
    });
  },

  // Get decrypted keypair (for signing transactions)
  async getKeypair(userId: string): Promise<Keypair | null> {
    const wallet = await prisma.custodialWallet.findUnique({
      where: { userId },
    });

    if (!wallet) return null;

    const secretKey = decryptKey(wallet.encryptedKey);
    return Keypair.fromSecretKey(secretKey);
  },

  // Update balance (atomic operation with history tracking)
  async updateBalance(
    userId: string,
    amount: number, // Positive for credit, negative for debit
    reason: string
  ): Promise<{ wallet: CustodialWallet; newBalance: number }> {
    return prisma.$transaction(async (tx: TransactionClient) => {
      const wallet = await tx.custodialWallet.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new Error("Wallet not found");
      }

      const newBalance = wallet.balance + amount;

      if (newBalance < 0) {
        throw new Error("Insufficient balance");
      }

      // Update wallet
      const updatedWallet = await tx.custodialWallet.update({
        where: { userId },
        data: {
          balance: newBalance,
          highestBalance: Math.max(wallet.highestBalance, newBalance),
          lowestBalance: Math.min(wallet.lowestBalance, newBalance),
          ...(amount > 0 &&
            reason === "deposit" && {
              totalDeposited: { increment: amount },
            }),
          ...(amount < 0 &&
            reason === "withdraw" && {
              totalWithdrawn: { increment: Math.abs(amount) },
            }),
        },
      });

      // Create balance snapshot
      await tx.balanceSnapshot.create({
        data: {
          userId,
          balance: newBalance,
          reason,
        },
      });

      return { wallet: updatedWallet, newBalance };
    });
  },

  // Get balance history for a user
  async getBalanceHistory(
    userId: string,
    options: {
      since?: Date;
      limit?: number;
    } = {}
  ): Promise<BalanceSnapshot[]> {
    const { since, limit = 100 } = options;

    return prisma.balanceSnapshot.findMany({
      where: {
        userId,
        ...(since && { timestamp: { gte: since } }),
      },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
  },

  // Get balance stats for timeframe
  async getBalanceStats(
    userId: string,
    since: Date
  ): Promise<{
    highest: number;
    lowest: number;
    start: number;
    end: number;
  }> {
    const snapshots = await prisma.balanceSnapshot.findMany({
      where: {
        userId,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: "asc" },
    });

    if (snapshots.length === 0) {
      const wallet = await prisma.custodialWallet.findUnique({
        where: { userId },
      });
      const balance = wallet?.balance || 0;
      return {
        highest: balance,
        lowest: balance,
        start: balance,
        end: balance,
      };
    }

    const balances = snapshots.map((s: BalanceSnapshot) => s.balance);
    return {
      highest: Math.max(...balances),
      lowest: Math.min(...balances),
      start: balances[0],
      end: balances[balances.length - 1],
    };
  },
};
