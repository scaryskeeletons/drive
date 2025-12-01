"use client";

import { useState, useEffect } from "react";
import { GameModelPicker } from "@/components/game/GameModelPicker";
import { truncateWallet } from "@/lib/utils/wallet";

interface Activity {
  id: string;
  walletAddress?: string;
  user?: { walletAddress?: string };
  type: string;
  gameType: string;
  wagerAmount?: number;
  payout?: number | null;
  profit?: number | null;
  won?: boolean | null;
  crashData?: { cashedOutAt?: number | null; crashPoint?: number };
  createdAt: string;
}

export default function Home() {
  const [liveActivity, setLiveActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch("/api/activity?type=recent_games&limit=10");
        if (res.ok) {
          const data = await res.json();
          setLiveActivity(data.games || data.activity || []);
        }
      } catch (error) {
        console.error("Failed to fetch activity:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();

    // Refresh every 30 seconds
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  // Format activity for display
  const formattedActivity = liveActivity.map((a) => {
    const wallet = a.walletAddress || a.user?.walletAddress;
    const multiplier = a.crashData?.cashedOutAt || a.crashData?.crashPoint;

    return {
      user: wallet ? truncateWallet(wallet) : "Unknown",
      action: a.won ? "won" : "bet",
      amount: a.won ? a.payout || 0 : a.wagerAmount || 0,
      game:
        a.gameType === "CRASH"
          ? "Crash"
          : a.gameType === "SHOOTOUT"
            ? "Shootout"
            : a.gameType,
      mult: multiplier ? `${multiplier.toFixed(2)}x` : null,
    };
  });

  const hasActivity = formattedActivity.length > 0;

  return (
    <div className="flex-1 flex flex-col p-6 xl:p-10 overflow-hidden">
      {/* Hero */}
      <div className="text-center mb-6 xl:mb-10 shrink-0">
        <h1 className="text-4xl xl:text-6xl font-bold text-white mb-2 xl:mb-4 tracking-tight">
          DriveBy
        </h1>
        <p className="text-zinc-500 xl:text-lg">
          Fast, fair, and provably transparent gaming on Solana.
        </p>
      </div>

      {/* 3D Game Picker */}
      <GameModelPicker className="mb-6 xl:mb-10 w-full flex-1" />

      {/* Live Activity */}
      <div className="w-full shrink-0">
        <h3 className="text-xs xl:text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-2 xl:mb-4">
          Live Activity
        </h3>
        <div
          className="flex gap-2 xl:gap-4 overflow-x-auto scrollbar-hide pb-1"
          style={{
            maskImage:
              "linear-gradient(to right, black calc(100% - 40px), transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, black calc(100% - 40px), transparent 100%)",
          }}
        >
          {loading ? (
            // Loading skeleton
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-36 xl:w-44 p-3 xl:p-5 bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-lg xl:rounded-xl animate-pulse"
              >
                <div className="h-4 bg-zinc-800 rounded mb-2 w-20" />
                <div className="h-8 bg-zinc-800 rounded mb-2 w-16" />
                <div className="h-3 bg-zinc-800 rounded w-12" />
              </div>
            ))
          ) : hasActivity ? (
            formattedActivity.map((activity, i) => (
              <div
                key={i}
                className="shrink-0 w-36 xl:w-44 p-3 xl:p-5 bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-lg xl:rounded-xl"
              >
                <p className="text-sm xl:text-base font-medium text-white truncate mb-1">
                  {activity.user}
                </p>
                <p
                  className={`text-xl xl:text-3xl font-bold mb-1 ${
                    activity.action === "won"
                      ? "text-emerald-400"
                      : "text-zinc-500"
                  }`}
                >
                  {activity.action === "won" ? "+" : ""}
                  {activity.amount.toFixed(2)}
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs xl:text-sm text-zinc-600">
                    {activity.game}
                  </p>
                  {activity.mult && (
                    <p className="text-xs xl:text-sm text-zinc-500">
                      {activity.mult}
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            // Empty state
            <div className="flex items-center justify-center w-full py-6">
              <p className="text-zinc-600 text-sm">
                No activity yet. Be the first to play!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
