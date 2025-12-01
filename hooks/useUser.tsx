"use client";

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

interface UserData {
  id: string;
  walletAddress: string;
  createdAt: string;
}

interface WalletData {
  balance: number;
  pendingBalance: number;
  lockedBalance: number;
  publicKey: string;
}

interface UserContextType {
  user: UserData | null;
  wallet: WalletData | null;
  loading: boolean;
  connected: boolean;
  refreshBalance: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  wallet: null,
  loading: true,
  connected: false,
  refreshBalance: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected } = useWallet();
  const [user, setUser] = useState<UserData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);

  const walletAddress = publicKey?.toBase58() || "";

  const fetchUserData = useCallback(async () => {
    if (!walletAddress || !connected) {
      setUser(null);
      setWallet(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        if (data.wallet) {
          setWallet({
            balance: data.wallet.balance,
            pendingBalance: data.wallet.pendingBalance,
            lockedBalance: data.wallet.lockedBalance,
            publicKey: data.wallet.publicKey,
          });
        }
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, connected]);

  const refreshBalance = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/user/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.wallet) {
          setWallet({
            balance: data.wallet.balance,
            pendingBalance: data.wallet.pendingBalance,
            lockedBalance: data.wallet.lockedBalance,
            publicKey: data.wallet.publicKey,
          });
        }
      }
    } catch (error) {
      console.error("Failed to refresh balance:", error);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  return (
    <UserContext.Provider value={{ user, wallet, loading, connected, refreshBalance }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
