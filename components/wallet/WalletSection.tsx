"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { truncateWallet, getAvatarUrl } from "@/lib/utils/wallet";
import { WalletModal } from "./WalletModal";
import { motion } from "motion/react";

interface WalletSectionProps {
  expanded?: boolean;
}

interface WalletData {
  balance: number;
  pendingBalance: number;
  lockedBalance: number;
  publicKey: string;
}

export function WalletSection({ expanded = true }: WalletSectionProps) {
  const { publicKey, connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  
  const [userId, setUserId] = useState<string | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const walletAddress = publicKey?.toBase58() || "";
  const shortAddress = truncateWallet(walletAddress);
  const avatarUrl = getAvatarUrl(walletAddress);

  // Register/fetch user when wallet connects
  useEffect(() => {
    if (!walletAddress || !connected) {
      setUserId(null);
      setWalletData(null);
      return;
    }

    const fetchUser = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress }),
        });

        if (response.ok) {
          const data = await response.json();
          setUserId(data.user.id);
          if (data.wallet) {
            setWalletData({
              balance: data.wallet.balance,
              pendingBalance: data.wallet.pendingBalance,
              lockedBalance: data.wallet.lockedBalance,
              publicKey: data.wallet.publicKey,
            });
          } else {
            // No wallet data yet, set defaults
            setWalletData({
              balance: 0,
              pendingBalance: 0,
              lockedBalance: 0,
              publicKey: walletAddress,
            });
          }
        } else {
          // API failed, still show button with defaults
          setWalletData({
            balance: 0,
            pendingBalance: 0,
            lockedBalance: 0,
            publicKey: walletAddress,
          });
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
        // On error, still show button with defaults
        setWalletData({
          balance: 0,
          pendingBalance: 0,
          lockedBalance: 0,
          publicKey: walletAddress,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [walletAddress, connected]);

  const handleConnect = () => {
    setVisible(true);
  };

  const handleDisconnect = () => {
    disconnect();
  };

  // Not connected state
  if (!connected) {
    return (
      <button
        onClick={handleConnect}
        disabled={connecting}
        className="flex items-center justify-start gap-2 h-9 group/sidebar w-full disabled:opacity-50"
      >
        {connecting ? (
          <>
            <LoadingSpinner className="w-5 h-5 shrink-0 text-zinc-400" />
            {expanded && (
              <span className="text-zinc-400 text-sm whitespace-pre">
                Connecting...
              </span>
            )}
          </>
        ) : (
          <>
            <WalletIcon className="w-5 h-5 shrink-0 text-zinc-400" />
            {expanded && (
              <span className="text-zinc-400 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre">
                Connect Wallet
              </span>
            )}
          </>
        )}
      </button>
    );
  }

  // Connected state
  return (
    <div className="space-y-2">
      {/* Wallet Address */}
      <button
        onClick={handleDisconnect}
        className="flex items-center justify-start gap-2 h-9 group/sidebar w-full"
        title="Click to disconnect"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" className="w-5 h-5 rounded shrink-0" />
        {expanded && (
          <span className="text-zinc-400 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre font-mono">
            {shortAddress}
          </span>
        )}
      </button>

      {/* Balance & Deposit/Withdraw Button - Always show when expanded */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-2"
        >
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <LoadingSpinner className="w-4 h-4 text-zinc-500" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-zinc-500">Balance</span>
                <span className="text-xs text-emerald-400 font-semibold">
                  {(walletData?.balance || 0).toFixed(4)}
                </span>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="w-full py-2 px-3 bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 rounded-lg text-sm text-violet-300 font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Deposit / Withdraw
              </button>
            </>
          )}
        </motion.div>
      )}

      {/* Icon-only deposit button when collapsed */}
      {!expanded && !loading && (
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center w-5 h-5 mx-auto"
          title="Deposit / Withdraw"
        >
          <svg className="w-5 h-5 text-violet-400 hover:text-violet-300 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {/* Wallet Modal */}
      <WalletModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        userId={userId}
        walletAddress={walletData?.publicKey || walletAddress}
        balance={walletData?.balance || 0}
        pendingBalance={walletData?.pendingBalance || 0}
        lockedBalance={walletData?.lockedBalance || 0}
      />
    </div>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
