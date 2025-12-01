"use client";

import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useState, useEffect, useCallback } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

interface UserBalance {
  balance: number;
  pendingBalance: number;
  lockedBalance: number;
  withdrawableBalance: number;
}

export function useSolanaWallet() {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { connection } = useConnection();
  
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [custodialWallet, setCustodialWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = publicKey?.toBase58() || null;

  // Fetch SOL balance from chain
  useEffect(() => {
    if (!publicKey || !connection) {
      setSolBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        const balance = await connection.getBalance(publicKey);
        setSolBalance(balance / LAMPORTS_PER_SOL);
      } catch (err) {
        console.error("Error fetching SOL balance:", err);
      }
    };

    fetchBalance();
    
    // Subscribe to balance changes
    const subscriptionId = connection.onAccountChange(publicKey, (account) => {
      setSolBalance(account.lamports / LAMPORTS_PER_SOL);
    });

    return () => {
      connection.removeAccountChangeListener(subscriptionId);
    };
  }, [publicKey, connection]);

  // Register/login user when wallet connects
  useEffect(() => {
    if (!walletAddress || !connected) {
      setUserId(null);
      setUserBalance(null);
      setCustodialWallet(null);
      return;
    }

    const registerUser = async () => {
      setLoading(true);
      setError(null);

      try {
        // Create or get user
        const response = await fetch("/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress }),
        });

        if (!response.ok) {
          throw new Error("Failed to register user");
        }

        const data = await response.json();
        setUserId(data.user.id);
        setCustodialWallet(data.wallet?.publicKey || null);

        if (data.wallet) {
          setUserBalance({
            balance: data.wallet.balance,
            pendingBalance: data.wallet.pendingBalance,
            lockedBalance: data.wallet.lockedBalance,
            withdrawableBalance:
              data.wallet.balance -
              data.wallet.pendingBalance -
              data.wallet.lockedBalance,
          });
        }
      } catch (err) {
        console.error("Error registering user:", err);
        setError(err instanceof Error ? err.message : "Failed to connect");
      } finally {
        setLoading(false);
      }
    };

    registerUser();
  }, [walletAddress, connected]);

  // Refresh balance from backend
  const refreshBalance = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/user/${userId}`);
      if (!response.ok) return;

      const data = await response.json();
      if (data.wallet) {
        setUserBalance({
          balance: data.wallet.balance,
          pendingBalance: data.wallet.pendingBalance,
          lockedBalance: data.wallet.lockedBalance,
          withdrawableBalance:
            data.wallet.balance -
            data.wallet.pendingBalance -
            data.wallet.lockedBalance,
        });
      }
    } catch (err) {
      console.error("Error refreshing balance:", err);
    }
  }, [userId]);

  return {
    // Wallet connection state
    connected,
    connecting,
    disconnect,
    walletAddress,
    
    // Chain data
    solBalance,
    
    // Platform data
    userId,
    custodialWallet,
    userBalance,
    
    // Actions
    refreshBalance,
    
    // Status
    loading,
    error,
  };
}

