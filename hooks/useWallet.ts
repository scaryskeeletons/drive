"use client";

import { useState, useCallback, useEffect } from "react";

interface WalletBalances {
  balance: number;
  pendingBalance: number;
  lockedBalance: number;
  withdrawableBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  publicKey: string;
}

interface UseWalletReturn {
  wallet: WalletBalances | null;
  loading: boolean;
  error: string | null;
  modalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  refresh: () => Promise<void>;
  deposit: (txSignature: string) => Promise<boolean>;
  withdraw: (amount: number, destinationAddress: string) => Promise<boolean>;
  canPlaceBet: (amount: number) => boolean;
}

export function useWallet(userId: string | null): UseWalletReturn {
  const [wallet, setWallet] = useState<WalletBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch wallet data
  const refresh = useCallback(async () => {
    if (!userId) {
      setWallet(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/wallet?userId=${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch wallet");
      }

      setWallet({
        balance: data.wallet.balance,
        pendingBalance: data.wallet.pendingBalance || 0,
        lockedBalance: data.wallet.lockedBalance || 0,
        withdrawableBalance:
          data.wallet.balance -
          (data.wallet.pendingBalance || 0) -
          (data.wallet.lockedBalance || 0),
        totalDeposited: data.wallet.totalDeposited,
        totalWithdrawn: data.wallet.totalWithdrawn,
        publicKey: data.wallet.publicKey,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch wallet");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Process deposit
  const deposit = useCallback(
    async (txSignature: string): Promise<boolean> => {
      if (!userId) return false;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/wallet/deposit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, txSignature }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Deposit failed");
        }

        // Refresh wallet data
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Deposit failed");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [userId, refresh]
  );

  // Request withdrawal
  const withdraw = useCallback(
    async (amount: number, destinationAddress: string): Promise<boolean> => {
      if (!userId) return false;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/wallet/withdraw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, amount, destinationAddress }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Withdrawal failed");
        }

        // Refresh wallet data
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Withdrawal failed");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [userId, refresh]
  );

  // Check if user can place a bet
  const canPlaceBet = useCallback(
    (amount: number): boolean => {
      if (!wallet) return false;
      return wallet.withdrawableBalance >= amount;
    },
    [wallet]
  );

  return {
    wallet,
    loading,
    error,
    modalOpen,
    setModalOpen,
    refresh,
    deposit,
    withdraw,
    canPlaceBet,
  };
}

