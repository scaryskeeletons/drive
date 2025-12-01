"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { truncateWallet, getAvatarUrl, preloadAvatars } from "@/lib/utils/wallet";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  walletAddress: string;
  totalGamesPlayed: number;
  totalWon: number;
  netProfit: number;
  biggestWin: number;
  highestMultiplier: number;
}

type SortOption = "netProfit" | "totalWon" | "biggestWin";

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("netProfit");

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch(`/api/leaderboard?orderBy=${sortBy}&limit=25`);
        const data = await res.json();
        const entries = data.leaderboard || [];
        setLeaderboard(entries);
        
        // Preload all avatars for smooth display
        preloadAvatars(entries.map((e: LeaderboardEntry) => e.walletAddress));
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [sortBy]);

  const podium = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  // Reorder podium for display: [2nd, 1st, 3rd]
  const podiumOrder = podium.length >= 3 
    ? [podium[1], podium[0], podium[2]] 
    : podium;

  const formatNumber = (num: number) => {
    if (Math.abs(num) >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    }
    if (Math.abs(num) >= 1000) {
      return `${(num / 1000).toFixed(2)}K`;
    }
    return num.toFixed(2);
  };

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
            <p className="text-zinc-400 text-sm mt-1">Top 25 players</p>
          </div>

          {/* Sort Options */}
          <div className="flex gap-2">
            {[
              { value: "netProfit", label: "PNL" },
              { value: "totalWon", label: "Volume" },
              { value: "biggestWin", label: "Best Win" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSortBy(option.value as SortOption)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sortBy === option.value
                    ? "bg-violet-600 text-white"
                    : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            No players yet. Be the first!
          </div>
        ) : (
          <>
            {/* Podium */}
            <div className="mb-12">
              <div className="flex items-end justify-center gap-4 lg:gap-8">
                {podiumOrder.map((entry, idx) => {
                  if (!entry) return null;
                  const actualRank = entry.rank;
                  const heights = { 1: 180, 2: 140, 3: 100 };
                  const height = heights[actualRank as 1 | 2 | 3] || 100;
                  const colors = {
                    1: "from-amber-500/30 to-amber-600/10 border-amber-500/40",
                    2: "from-zinc-400/30 to-zinc-500/10 border-zinc-400/40",
                    3: "from-orange-600/30 to-orange-700/10 border-orange-600/40",
                  };
                  const colorClass = colors[actualRank as 1 | 2 | 3] || colors[3];
                  const ringColors = {
                    1: "ring-amber-500",
                    2: "ring-zinc-400",
                    3: "ring-orange-600",
                  };
                  const ringColor = ringColors[actualRank as 1 | 2 | 3] || "ring-zinc-500";

                  return (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 + 0.2 }}
                      className="flex flex-col items-center"
                    >
                      {/* Avatar */}
                      <div className={`relative mb-3 ${actualRank === 1 ? "scale-110" : ""}`}>
                        <div
                          className={`w-16 h-16 lg:w-20 lg:h-20 rounded-full overflow-hidden ring-4 ${ringColor} bg-zinc-800`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getAvatarUrl(entry.walletAddress)}
                            alt="Avatar"
                            width={80}
                            height={80}
                            className="w-full h-full"
                          />
                        </div>
                        {/* Rank Badge */}
                        <div
                          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            actualRank === 1
                              ? "bg-amber-500 text-black"
                              : actualRank === 2
                              ? "bg-zinc-400 text-black"
                              : "bg-orange-600 text-white"
                          }`}
                        >
                          {actualRank}
                        </div>
                      </div>

                      {/* Wallet */}
                      <span className="text-white font-mono text-sm mb-2">
                        {truncateWallet(entry.walletAddress)}
                      </span>

                      {/* Podium Block */}
                      <div
                        className={`w-24 lg:w-32 rounded-t-xl bg-gradient-to-b ${colorClass} border border-b-0 flex flex-col items-center justify-start pt-4`}
                        style={{ height }}
                      >
                        <div className="text-center">
                          <div className="text-xs text-zinc-400 uppercase tracking-wider">
                            {sortBy === "netProfit" ? "PNL" : sortBy === "totalWon" ? "Volume" : "Best"}
                          </div>
                          <div
                            className={`font-bold text-lg ${
                              sortBy === "netProfit"
                                ? entry.netProfit >= 0
                                  ? "text-emerald-400"
                                  : "text-red-400"
                                : "text-white"
                            }`}
                          >
                            {sortBy === "netProfit" && entry.netProfit >= 0 ? "+" : ""}
                            {formatNumber(
                              sortBy === "netProfit"
                                ? entry.netProfit
                                : sortBy === "totalWon"
                                ? entry.totalWon
                                : entry.biggestWin
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Rest of Leaderboard */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-4 lg:px-6 py-3 border-b border-white/10 bg-white/5">
                <div className="col-span-1 text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  #
                </div>
                <div className="col-span-5 text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                  Player
                </div>
                <div className="col-span-3 text-xs text-zinc-500 uppercase tracking-wider font-semibold text-right">
                  Volume
                </div>
                <div className="col-span-3 text-xs text-zinc-500 uppercase tracking-wider font-semibold text-right">
                  PNL
                </div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-white/5">
                {rest.map((entry, idx) => (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 + 0.4 }}
                    className="grid grid-cols-12 gap-4 px-4 lg:px-6 py-4 hover:bg-white/5 transition-colors"
                  >
                    {/* Rank */}
                    <div className="col-span-1 flex items-center">
                      <span className="text-zinc-500 font-medium">{entry.rank}</span>
                    </div>

                    {/* Player */}
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getAvatarUrl(entry.walletAddress)}
                          alt="Avatar"
                          width={40}
                          height={40}
                          className="w-full h-full"
                        />
                      </div>
                      <span className="text-white font-mono text-sm">
                        {truncateWallet(entry.walletAddress)}
                      </span>
                    </div>

                    {/* Volume */}
                    <div className="col-span-3 flex items-center justify-end">
                      <span className="text-zinc-300 font-medium">
                        {formatNumber(entry.totalWon)}
                      </span>
                    </div>

                    {/* PNL */}
                    <div className="col-span-3 flex items-center justify-end">
                      <span
                        className={`font-semibold ${
                          entry.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {entry.netProfit >= 0 ? "+" : ""}
                        {formatNumber(entry.netProfit)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Empty State for rest */}
              {rest.length === 0 && podium.length > 0 && (
                <div className="py-8 text-center text-zinc-500">
                  Only {podium.length} players so far
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

