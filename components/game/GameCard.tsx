"use client";

import Link from "next/link";

interface GameCardProps {
  title: string;
  description: string;
  href: string;
  playerCount?: number;
  multiplier?: string;
  status?: "live" | "coming-soon" | "maintenance";
  accentColor: string;
}

export function GameCard({
  title,
  description,
  href,
  playerCount = 0,
  multiplier,
  status = "live",
  accentColor,
}: GameCardProps) {
  const isPlayable = status === "live";

  return (
    <Link
      href={isPlayable ? href : "#"}
      className={`group relative block ${!isPlayable ? "cursor-not-allowed" : ""}`}
    >
      <div
        className={`relative overflow-hidden rounded-xl xl:rounded-2xl border border-white/10 bg-zinc-900/40 backdrop-blur-sm transition-all duration-300 ${
          isPlayable
            ? "hover:border-white/20 hover:bg-zinc-900/60"
            : "opacity-50"
        }`}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 xl:h-1"
          style={{ background: accentColor }}
        />

        <div className="p-6 xl:p-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 xl:mb-5">
            <h3 className="text-lg xl:text-2xl font-bold text-white">
              {title}
            </h3>
            <span
              className={`text-xs xl:text-sm font-medium px-2 xl:px-3 py-1 xl:py-1.5 rounded ${
                status === "live"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : status === "coming-soon"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-zinc-500/20 text-zinc-400"
              }`}
            >
              {status === "live"
                ? "Play Now"
                : status === "coming-soon"
                  ? "Soon"
                  : "Down"}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm xl:text-base text-zinc-500 mb-5 xl:mb-8 line-clamp-2">
            {description}
          </p>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm xl:text-base text-zinc-400 pt-2">
            <span>{playerCount.toLocaleString()} playing</span>
            {multiplier && <span>Up to {multiplier}</span>}
          </div>

          {/* Hover indicator */}
          {isPlayable && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5 xl:h-1 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: accentColor }}
            />
          )}
        </div>
      </div>
    </Link>
  );
}
