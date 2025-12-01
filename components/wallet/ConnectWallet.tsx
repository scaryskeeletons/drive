"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { truncateWallet, getAvatarUrl } from "@/lib/utils/wallet";

interface ConnectWalletProps {
  className?: string;
  expanded?: boolean;
  variant?: "default" | "minimal" | "full";
}

export function ConnectWallet({
  className,
  expanded = true,
  variant = "default",
}: ConnectWalletProps) {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  const isConnected = !!publicKey;
  const walletAddress = publicKey?.toBase58() || "";
  const shortAddress = truncateWallet(walletAddress);
  const avatarUrl = getAvatarUrl(walletAddress);

  const handleClick = () => {
    if (isConnected) {
      disconnect();
    } else {
      setVisible(true);
    }
  };

  // Full button style (like station pages)
  if (variant === "full") {
    return (
      <button
        onClick={handleClick}
        disabled={connecting}
        className={`px-4 py-2 bg-white hover:bg-white/90 text-black rounded-lg font-semibold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 ${className}`}
      >
        {connecting ? (
          <>
            <LoadingSpinner className="w-4 h-4" />
            <span>Connecting...</span>
          </>
        ) : isConnected ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarUrl} alt="" className="w-5 h-5 rounded" />
            <span className="font-mono">{shortAddress}</span>
          </>
        ) : (
          <>
            <WalletIcon className="w-4 h-4" />
            <span>Connect Wallet</span>
          </>
        )}
      </button>
    );
  }

  // Minimal style (icon only)
  if (variant === "minimal") {
    return (
      <button
        onClick={handleClick}
        disabled={connecting}
        className={`p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50 ${className}`}
      >
        {connecting ? (
          <LoadingSpinner className="w-5 h-5 text-zinc-400" />
        ) : isConnected ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-5 h-5 rounded" />
        ) : (
          <WalletIcon className="w-5 h-5 text-zinc-400" />
        )}
      </button>
    );
  }

  // Default style (for sidebar use)
  return (
    <button
      onClick={handleClick}
      disabled={connecting}
      className={`flex items-center justify-start gap-2 h-9 group/sidebar disabled:opacity-50 ${className}`}
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
      ) : isConnected ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarUrl} alt="" className="w-5 h-5 rounded shrink-0" />
          {expanded && (
            <span className="text-zinc-400 text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre font-mono">
              {shortAddress}
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
