"use client";

import { useState, useEffect } from "react";
import { Bar, BarChart, Area, AreaChart } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface DataPoint {
  time: string;
  label: string;
  players: number;
  games: number;
  volume: number;
}

// Generate mock data relative to current time
function generateTimeData(minutes: number): DataPoint[] {
  const now = new Date();
  const data: DataPoint[] = [];
  const intervals = Math.min(24, Math.max(6, Math.floor(minutes / 5)));
  const intervalMs = (minutes * 60 * 1000) / intervals;

  for (let i = intervals; i >= 0; i--) {
    const time = new Date(now.getTime() - i * intervalMs);
    const seed = Math.floor(time.getTime() / intervalMs);
    data.push({
      time: time.toISOString(),
      label: formatTimeLabel(time, minutes),
      players: 100 + (seed % 300),
      games: 10 + (seed % 50),
      volume: 10000 + (seed % 50000),
    });
  }
  return data;
}

function formatTimeLabel(date: Date, totalMinutes: number): string {
  if (totalMinutes <= 1440) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

const timeRanges = [
  { label: "5m", minutes: 5 },
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 360 },
  { label: "24h", minutes: 1440 },
];

const chartConfig: ChartConfig = {
  players: { label: "Players", color: "#a78bfa" },
  games: { label: "Games", color: "#f97316" },
  volume: { label: "Volume", color: "#22c55e" },
};

export function StatsCharts() {
  const [timeRange, setTimeRange] = useState(5);
  const [data, setData] = useState<DataPoint[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setData(generateTimeData(timeRange));
  }, [timeRange]);

  if (!mounted || data.length === 0) {
    return (
      <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-xl xl:rounded-2xl p-4 xl:p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <h3 className="text-sm xl:text-base font-semibold text-white">Analytics</h3>
          <div className="flex gap-1">
            {timeRanges.map((range) => (
              <button key={range.minutes} className="px-2 py-1 text-xs rounded text-zinc-500">
                {range.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 xl:gap-6 animate-pulse flex-1 min-h-0">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-800/50 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const avgPlayers = Math.round(data.reduce((acc, curr) => acc + curr.players, 0) / data.length);
  const totalGames = data.reduce((acc, curr) => acc + curr.games, 0);
  const totalVolume = data.reduce((acc, curr) => acc + curr.volume, 0);

  return (
    <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-xl xl:rounded-2xl p-4 xl:p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-sm xl:text-base font-semibold text-white">Analytics</h3>
        <div className="flex gap-1 xl:gap-2">
          {timeRanges.map((range) => (
            <button
              key={range.minutes}
              onClick={() => setTimeRange(range.minutes)}
              className={`px-2 xl:px-3 py-1 xl:py-1.5 text-xs xl:text-sm rounded-lg transition-colors ${
                timeRange === range.minutes
                  ? "bg-white/10 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats + Charts Grid */}
      <div className="grid grid-cols-3 gap-4 xl:gap-6 flex-1 min-h-0">
        {/* Players */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-baseline justify-between mb-2 shrink-0">
            <span className="text-xs xl:text-sm text-zinc-500">Avg Players</span>
            <span className="text-lg xl:text-2xl font-bold text-violet-400">{avgPlayers}</span>
          </div>
          <div className="flex-1 min-h-0 w-full">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel className="bg-zinc-900 border-zinc-800 text-white" />}
                />
                <Bar dataKey="players" fill="var(--color-players)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        {/* Games */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-baseline justify-between mb-2 shrink-0">
            <span className="text-xs xl:text-sm text-zinc-500">Games Played</span>
            <span className="text-lg xl:text-2xl font-bold text-orange-400">{totalGames}</span>
          </div>
          <div className="flex-1 min-h-0 w-full">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel className="bg-zinc-900 border-zinc-800 text-white" />}
                />
                <Bar dataKey="games" fill="var(--color-games)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        {/* Volume */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-baseline justify-between mb-2 shrink-0">
            <span className="text-xs xl:text-sm text-zinc-500">Volume</span>
            <span className="text-lg xl:text-2xl font-bold text-emerald-400">
              ${(totalVolume / 1000).toFixed(1)}k
            </span>
          </div>
          <div className="flex-1 min-h-0 w-full">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <AreaChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel className="bg-zinc-900 border-zinc-800 text-white" />}
                />
                <Area
                  dataKey="volume"
                  type="monotone"
                  fill="url(#volumeGradient)"
                  stroke="#22c55e"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
