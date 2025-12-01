"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { truncateWallet, getAvatarUrl } from "@/lib/utils/wallet";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface GameHistory {
  id: string;
  gameType: "SHOOTOUT" | "CRASH";
  wagerAmount: number;
  won: boolean | null;
  payout: number | null;
  profit: number | null;
  multiplier: number | null;
  createdAt: string;
  status: "PENDING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
}

type TimeRange = "24h" | "7d" | "30d" | "all";
type GameFilter = "all" | "SHOOTOUT" | "CRASH";

export default function HistoryPage() {
  const { publicKey, connected } = useWallet();
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [gameFilter, setGameFilter] = useState<GameFilter>("all");
  const [userId, setUserId] = useState<string | null>(null);

  const walletAddress = publicKey?.toBase58() || "";

  // Fetch user ID when wallet connects
  useEffect(() => {
    if (!walletAddress || !connected) {
      setUserId(null);
      setHistory([]);
      setLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        const response = await fetch("/api/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress }),
        });

        if (response.ok) {
          const data = await response.json();
          setUserId(data.user.id);
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      }
    };

    fetchUser();
  }, [walletAddress, connected]);

  // Fetch game history
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/user/${userId}/history?range=${timeRange}`);
        if (response.ok) {
          const data = await response.json();
          setHistory(data.games || []);
        }
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [userId, timeRange]);

  // Filter history
  const filteredHistory = useMemo(() => {
    if (gameFilter === "all") return history;
    return history.filter((game) => game.gameType === gameFilter);
  }, [history, gameFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const completed = filteredHistory.filter((g) => g.status === "COMPLETED");
    const totalGames = completed.length;
    const wins = completed.filter((g) => g.won === true).length;
    const losses = completed.filter((g) => g.won === false).length;
    const totalWagered = completed.reduce((sum, g) => sum + g.wagerAmount, 0);
    const totalProfit = completed.reduce((sum, g) => sum + (g.profit || 0), 0);
    const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;
    const biggestWin = Math.max(...completed.map((g) => g.profit || 0), 0);
    const biggestLoss = Math.min(...completed.map((g) => g.profit || 0), 0);

    return {
      totalGames,
      wins,
      losses,
      totalWagered,
      totalProfit,
      winRate,
      biggestWin,
      biggestLoss,
    };
  }, [filteredHistory]);

  // Chart data - cumulative profit over time
  const profitChartData = useMemo(() => {
    const completed = filteredHistory
      .filter((g) => g.status === "COMPLETED")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let cumulative = 0;
    return completed.map((game, idx) => {
      cumulative += game.profit || 0;
      const date = new Date(game.createdAt);
      return {
        index: idx + 1,
        date: date.toLocaleDateString(),
        time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        profit: game.profit || 0,
        cumulative: cumulative,
      };
    });
  }, [filteredHistory]);

  // Daily PNL for bar chart
  const dailyPnlData = useMemo(() => {
    const completed = filteredHistory.filter((g) => g.status === "COMPLETED");
    const dailyMap = new Map<string, number>();

    completed.forEach((game) => {
      const date = new Date(game.createdAt).toLocaleDateString();
      const current = dailyMap.get(date) || 0;
      dailyMap.set(date, current + (game.profit || 0));
    });

    return Array.from(dailyMap.entries())
      .map(([date, pnl]) => ({ date, pnl }))
      .slice(-14); // Last 14 days
  }, [filteredHistory]);

  const chartConfig = {
    cumulative: {
      label: "Cumulative P/L",
      color: "hsl(142, 76%, 36%)",
    },
    pnl: {
      label: "Daily P/L",
      color: "hsl(262, 83%, 58%)",
    },
  };

  if (!connected) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <svg className="w-8 h-8 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
              <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-zinc-400">Connect your wallet to view your betting history</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-8 overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={getAvatarUrl(walletAddress)} alt="" className="w-full h-full" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Your History</h1>
              <p className="text-zinc-400 text-sm font-mono">{truncateWallet(walletAddress)}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <div className="flex bg-white/5 rounded-lg p-1">
              {(["24h", "7d", "30d", "all"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    timeRange === range
                      ? "bg-violet-600 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {range === "all" ? "All" : range.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex bg-white/5 rounded-lg p-1">
              {(["all", "SHOOTOUT", "CRASH"] as GameFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setGameFilter(filter)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    gameFilter === filter
                      ? "bg-violet-600 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {filter === "all" ? "All" : filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Games" value={stats.totalGames.toString()} />
          <StatCard
            label="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            subtext={`${stats.wins}W / ${stats.losses}L`}
          />
          <StatCard
            label="Total P/L"
            value={`${stats.totalProfit >= 0 ? "+" : ""}${stats.totalProfit.toFixed(4)}`}
            valueColor={stats.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          <StatCard
            label="Volume"
            value={stats.totalWagered.toFixed(4)}
            subtext="tokens wagered"
          />
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Cumulative P/L Chart */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
              Cumulative Profit/Loss
            </h3>
            {profitChartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={profitChartData}>
                    <defs>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis
                      dataKey="index"
                      stroke="rgba(255,255,255,0.3)"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.3)"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={(value) => value.toFixed(2)}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent className="bg-zinc-900 border-white/10" />}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      stroke="hsl(142, 76%, 36%)"
                      strokeWidth={2}
                      fill="url(#profitGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-zinc-500">
                No data yet
              </div>
            )}
          </div>

          {/* Daily P/L Chart */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
              Daily Profit/Loss
            </h3>
            {dailyPnlData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyPnlData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis
                      dataKey="date"
                      stroke="rgba(255,255,255,0.3)"
                      fontSize={10}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="rgba(255,255,255,0.3)"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={(value) => value.toFixed(2)}
                    />
                    <ChartTooltip
                      content={<ChartTooltipContent className="bg-zinc-900 border-white/10" />}
                    />
                    <Bar
                      dataKey="pnl"
                      fill="hsl(262, 83%, 58%)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-zinc-500">
                No data yet
              </div>
            )}
          </div>
        </div>

        {/* History Table */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
              Recent Games
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              No games found. Start playing to see your history!
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-white/5 text-xs text-zinc-500 uppercase tracking-wider font-semibold">
                <div className="col-span-2">Game</div>
                <div className="col-span-2">Time</div>
                <div className="col-span-2 text-right">Wager</div>
                <div className="col-span-2 text-right">Multiplier</div>
                <div className="col-span-2 text-right">Result</div>
                <div className="col-span-2 text-right">P/L</div>
              </div>

              {/* Table Rows */}
              {filteredHistory.slice(0, 50).map((game, idx) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-white/5 transition-colors"
                >
                  {/* Game Type */}
                  <div className="col-span-2 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        game.gameType === "SHOOTOUT" ? "bg-amber-500" : "bg-violet-500"
                      }`}
                    />
                    <span className="text-sm text-white">{game.gameType}</span>
                  </div>

                  {/* Time */}
                  <div className="col-span-2 text-sm text-zinc-400">
                    {new Date(game.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>

                  {/* Wager */}
                  <div className="col-span-2 text-sm text-white text-right">
                    {game.wagerAmount.toFixed(4)}
                  </div>

                  {/* Multiplier */}
                  <div className="col-span-2 text-sm text-right">
                    {game.multiplier ? (
                      <span className="text-amber-400">{game.multiplier.toFixed(2)}x</span>
                    ) : (
                      <span className="text-zinc-500">-</span>
                    )}
                  </div>

                  {/* Result */}
                  <div className="col-span-2 text-sm text-right">
                    {game.status === "COMPLETED" ? (
                      game.won ? (
                        <span className="text-emerald-400">Won</span>
                      ) : (
                        <span className="text-red-400">Lost</span>
                      )
                    ) : (
                      <span className="text-zinc-500">{game.status}</span>
                    )}
                  </div>

                  {/* P/L */}
                  <div className="col-span-2 text-sm text-right font-semibold">
                    {game.profit !== null ? (
                      <span className={game.profit >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {game.profit >= 0 ? "+" : ""}
                        {game.profit.toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-zinc-500">-</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtext,
  valueColor = "text-white",
}: {
  label: string;
  value: string;
  subtext?: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
      <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      <div className={`text-2xl font-bold mt-1 ${valueColor}`}>{value}</div>
      {subtext && <span className="text-xs text-zinc-500">{subtext}</span>}
    </div>
  );
}

