"use client";

import Link from "next/link";
import { ShootoutGame } from "@/components/game/ShootoutGame";

export default function ShootoutPage() {
  return (
    <div className="flex-1 flex flex-col p-6 xl:p-10 overflow-auto scrollbar-minimal">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors mb-6 text-sm w-fit"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Games
      </Link>
      <div className="flex-1 flex items-start justify-center">
        <ShootoutGame />
      </div>
    </div>
  );
}
