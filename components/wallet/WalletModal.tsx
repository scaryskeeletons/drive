"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from "@/components/ui/Toast";

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  walletAddress: string | null;
  balance: number;
  pendingBalance: number;
  lockedBalance: number;
}

type Tab = "deposit" | "withdraw";

export function WalletModal({
  isOpen,
  onClose,
  userId,
  walletAddress,
  balance,
  pendingBalance,
  lockedBalance,
}: WalletModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>("deposit");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Live balance checking for deposits
  const [onChainBalance, setOnChainBalance] = useState<number | null>(null);
  const [checkingBalance, setCheckingBalance] = useState(false);

  const { showDeposit, showWithdraw, showError } = useToast();

  const availableBalance = balance - pendingBalance - lockedBalance;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setWithdrawAmount("");
      setDestinationAddress("");
      setError(null);
      setOnChainBalance(null);
    }
  }, [isOpen]);

  // Countdown timer for cooldown
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(
        () => setCooldownSeconds(cooldownSeconds - 1),
        1000
      );
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  // Check on-chain balance every 10 seconds when on deposit tab
  const checkBalance = useCallback(async () => {
    if (!walletAddress || !userId) return;

    setCheckingBalance(true);
    try {
      const response = await fetch(
        `/api/wallet/balance?address=${walletAddress}`
      );
      if (response.ok) {
        const data = await response.json();
        setOnChainBalance(data.balance);

        // If balance increased, trigger deposit processing
        if (data.balance > 0 && data.newDeposit) {
          showDeposit(data.depositAmount);
        }
      }
    } catch (error) {
      console.error("Failed to check balance:", error);
    } finally {
      setCheckingBalance(false);
    }
  }, [walletAddress, userId, showDeposit]);

  useEffect(() => {
    if (!isOpen || activeTab !== "deposit" || !walletAddress) return;

    // Check immediately
    checkBalance();

    // Then check every 10 seconds
    const interval = setInterval(checkBalance, 10000);
    return () => clearInterval(interval);
  }, [isOpen, activeTab, walletAddress, checkBalance]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.error("Failed to copy");
    }
  };

  const handleWithdraw = async () => {
    if (!userId || !withdrawAmount || !destinationAddress) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Invalid amount");
      return;
    }

    if (amount > availableBalance) {
      setError("Insufficient balance");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          amount,
          destinationAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.waitSeconds) {
          setCooldownSeconds(data.waitSeconds);
        }
        throw new Error(data.error || "Withdrawal failed");
      }

      showWithdraw(amount, "processing");
      setWithdrawAmount("");
      setDestinationAddress("");
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Withdrawal failed";
      setError(message);
      showError(message);
    } finally {
      setLoading(false);
    }
  };

  const setMaxWithdraw = () => {
    setWithdrawAmount(availableBalance.toFixed(6));
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md bg-zinc-950 border border-violet-500/20 rounded-2xl overflow-hidden shadow-2xl shadow-violet-500/10"
        >
          {/* Header with Balance */}
          <div className="p-6 pb-4 bg-gradient-to-b from-violet-500/10 to-transparent">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Wallet</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors text-zinc-500 hover:text-white"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Balance Display */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-zinc-500 text-sm">Available Balance</span>
                <div className="relative">
                  <button
                    onMouseEnter={() => setShowTooltip(true)}
                    onMouseLeave={() => setShowTooltip(false)}
                    className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-500 text-xs flex items-center justify-center hover:bg-zinc-700 hover:text-zinc-400 transition-colors"
                  >
                    ?
                  </button>

                  {/* Tooltip */}
                  <AnimatePresence>
                    {showTooltip &&
                      (pendingBalance > 0 || lockedBalance > 0) && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-2 bg-zinc-800 rounded-lg text-xs whitespace-nowrap z-10 border border-zinc-700"
                        >
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-800 rotate-45 border-l border-t border-zinc-700" />
                          {pendingBalance > 0 && (
                            <div className="flex justify-between gap-4">
                              <span className="text-zinc-400">In games:</span>
                              <span className="text-amber-400">
                                {pendingBalance.toFixed(4)}
                              </span>
                            </div>
                          )}
                          {lockedBalance > 0 && (
                            <div className="flex justify-between gap-4">
                              <span className="text-zinc-400">
                                Withdrawing:
                              </span>
                              <span className="text-orange-400">
                                {lockedBalance.toFixed(4)}
                              </span>
                            </div>
                          )}
                        </motion.div>
                      )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="text-4xl font-bold text-white tracking-tight">
                {availableBalance.toFixed(4)}
              </div>
              <div className="text-zinc-500 text-sm mt-1">tokens</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex mx-6 bg-zinc-900 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("deposit")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === "deposit"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/25"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Deposit
            </button>
            <button
              onClick={() => setActiveTab("withdraw")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === "withdraw"
                  ? "bg-violet-600 text-white shadow-lg shadow-violet-500/25"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Withdraw
            </button>
          </div>

          {/* Content */}
          <div className="p-6 pt-4">
            {activeTab === "deposit" ? (
              <div className="space-y-4">
                {/* Deposit Address */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 uppercase tracking-wider">
                    Your deposit address
                  </label>
                  <div
                    onClick={() =>
                      walletAddress && copyToClipboard(walletAddress)
                    }
                    className="group cursor-pointer bg-zinc-900 border border-zinc-800 hover:border-violet-500/50 rounded-xl p-4 transition-colors"
                  >
                    <div className="font-mono text-[13.5px] text-zinc-300 break-all leading-relaxed">
                      {walletAddress || "Loading..."}
                    </div>
                    <div className="flex items-center gap-2 mt-3 text-xs">
                      <svg
                        className="w-4 h-4 text-violet-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <span
                        className={
                          copied
                            ? "text-emerald-400"
                            : "text-zinc-500 group-hover:text-violet-400 transition-colors"
                        }
                      >
                        {copied ? "Copied!" : "Click to copy"}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-zinc-600 text-center mt-2">
                  Send tokens to the address above. Your balance will update
                  automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Withdraw Amount */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-zinc-500 uppercase tracking-wider">
                      Amount
                    </label>
                    <button
                      onClick={setMaxWithdraw}
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      Max
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.000001"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.0000"
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-violet-500/50 rounded-xl px-4 py-3 text-white text-xl font-medium placeholder:text-zinc-700 focus:outline-none transition-colors"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 text-sm">
                      tokens
                    </span>
                  </div>
                </div>

                {/* Destination Address */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 uppercase tracking-wider">
                    Destination
                  </label>
                  <input
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    placeholder="Solana wallet address"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-violet-500/50 rounded-xl px-4 py-3 text-white font-mono text-sm placeholder:text-zinc-700 focus:outline-none transition-colors"
                  />
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={
                    !withdrawAmount ||
                    !destinationAddress ||
                    loading ||
                    cooldownSeconds > 0
                  }
                  className="w-full py-3 rounded-xl font-semibold transition-all bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white disabled:cursor-not-allowed"
                >
                  {loading
                    ? "Processing..."
                    : cooldownSeconds > 0
                      ? `Wait ${cooldownSeconds}s`
                      : "Withdraw"}
                </button>

                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400 text-center">{error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
