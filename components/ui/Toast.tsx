"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";

// Toast types
type ToastType = "deposit" | "withdraw" | "win" | "loss" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  amount?: number;
  txSignature?: string;
}

interface ToastContextType {
  showToast: (toast: Omit<Toast, "id">) => void;
  showDeposit: (amount: number, txSignature?: string) => void;
  showWithdraw: (amount: number, status: "processing" | "confirmed" | "failed") => void;
  showWin: (amount: number, multiplier?: number) => void;
  showLoss: (amount: number) => void;
  showError: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

const TOAST_DURATION = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-2), { ...toast, id }]); // Keep max 3 toasts

    setTimeout(() => removeToast(id), TOAST_DURATION);
  }, [removeToast]);

  const showDeposit = useCallback(
    (amount: number, txSignature?: string) => {
      showToast({
        type: "deposit",
        title: "Deposit Confirmed",
        message: `+${amount.toFixed(4)} tokens added to your balance`,
        amount,
        txSignature,
      });
    },
    [showToast]
  );

  const showWithdraw = useCallback(
    (amount: number, status: "processing" | "confirmed" | "failed") => {
      const titles = {
        processing: "Withdrawal Processing",
        confirmed: "Withdrawal Complete",
        failed: "Withdrawal Failed",
      };
      const messages = {
        processing: `${amount.toFixed(4)} tokens being sent...`,
        confirmed: `${amount.toFixed(4)} tokens sent to your wallet`,
        failed: `${amount.toFixed(4)} tokens refunded to your balance`,
      };
      showToast({
        type: status === "failed" ? "error" : "withdraw",
        title: titles[status],
        message: messages[status],
        amount,
      });
    },
    [showToast]
  );

  const showWin = useCallback(
    (amount: number, multiplier?: number) => {
      showToast({
        type: "win",
        title: "You Won!",
        message: multiplier
          ? `+${amount.toFixed(4)} tokens at ${multiplier.toFixed(2)}x`
          : `+${amount.toFixed(4)} tokens`,
        amount,
      });
    },
    [showToast]
  );

  const showLoss = useCallback(
    (amount: number) => {
      showToast({
        type: "loss",
        title: "Game Over",
        message: `-${amount.toFixed(4)} tokens`,
        amount,
      });
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string) => {
      showToast({
        type: "error",
        title: "Error",
        message,
      });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{ showToast, showDeposit, showWithdraw, showWin, showLoss, showError }}
    >
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center">
      <div className="flex flex-col gap-3 items-center">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => Math.max(0, prev - 100 / (TOAST_DURATION / 50)));
    }, 50);

    return () => clearInterval(interval);
  }, []);

  const styles = {
    deposit: {
      bg: "bg-emerald-500/20",
      border: "border-emerald-500/40",
      icon: "text-emerald-400",
      progress: "bg-emerald-500",
    },
    withdraw: {
      bg: "bg-violet-500/20",
      border: "border-violet-500/40",
      icon: "text-violet-400",
      progress: "bg-violet-500",
    },
    win: {
      bg: "bg-amber-500/20",
      border: "border-amber-500/40",
      icon: "text-amber-400",
      progress: "bg-amber-500",
    },
    loss: {
      bg: "bg-zinc-500/20",
      border: "border-zinc-500/40",
      icon: "text-zinc-400",
      progress: "bg-zinc-500",
    },
    error: {
      bg: "bg-red-500/20",
      border: "border-red-500/40",
      icon: "text-red-400",
      progress: "bg-red-500",
    },
    info: {
      bg: "bg-blue-500/20",
      border: "border-blue-500/40",
      icon: "text-blue-400",
      progress: "bg-blue-500",
    },
  };

  const style = styles[toast.type];

  const icons = {
    deposit: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    withdraw: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
    win: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    loss: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    ),
    error: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    info: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      className={`pointer-events-auto min-w-[300px] max-w-[400px] ${style.bg} backdrop-blur-xl border ${style.border} rounded-2xl overflow-hidden shadow-2xl`}
    >
      <div className="p-4 flex items-start gap-4">
        {/* Icon */}
        <div className={`shrink-0 ${style.icon}`}>{icons[toast.type]}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-semibold text-base">{toast.title}</h4>
          <p className="text-zinc-300 text-sm mt-0.5">{toast.message}</p>
        </div>

        {/* Close button */}
        <button
          onClick={() => onRemove(toast.id)}
          className="shrink-0 w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <svg className="w-3 h-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className={`h-full ${style.progress} transition-all duration-50 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}

