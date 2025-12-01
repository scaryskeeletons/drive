import Link from "next/link";
import {
  ArrowLeft,
  Book,
  Gamepad2,
  Wallet,
  MessageSquare,
  Shield,
  Zap,
  Code,
} from "lucide-react";

export default function DocsPage() {
  const sections = [
    {
      title: "Getting Started",
      icon: <Zap className="w-5 h-5" />,
      items: [
        { title: "Introduction", href: "#introduction" },
        { title: "Connecting Your Wallet", href: "#wallet" },
        { title: "Making Your First Bet", href: "#first-bet" },
      ],
    },
    {
      title: "Games",
      icon: <Gamepad2 className="w-5 h-5" />,
      items: [
        { title: "Shootout", href: "#shootout" },
        { title: "Crash", href: "#crash" },
        { title: "Game Rules", href: "#rules" },
      ],
    },
    {
      title: "Wallet & Transactions",
      icon: <Wallet className="w-5 h-5" />,
      items: [
        { title: "Supported Wallets", href: "#supported-wallets" },
        { title: "Deposits", href: "#deposits" },
        { title: "Withdrawals", href: "#withdrawals" },
      ],
    },
    {
      title: "Provably Fair",
      icon: <Shield className="w-5 h-5" />,
      items: [
        { title: "How It Works", href: "#provably-fair" },
        { title: "Verification Code", href: "#verification-code" },
        { title: "Mathematical Formula", href: "#formula" },
      ],
    },
  ];

  const verificationCode = `// Provably Fair Verification Script
// Run this in your browser console or Node.js

const crypto = require('crypto'); // Node.js only

function hashSeed(seed) {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function combineSeeds(serverSeed, clientSeed, nonce) {
  return crypto.createHmac('sha256', serverSeed)
    .update(clientSeed + ':' + nonce)
    .digest('hex');
}

function getCrashPointFromHash(hash, houseEdge = 0.03) {
  const hashHex = hash.slice(0, 13);
  const hashInt = parseInt(hashHex, 16);
  const maxValue = Math.pow(2, 52);
  
  // Instant crash probability = house edge
  if (hashInt < maxValue * houseEdge) {
    return 1.0;
  }
  
  const adjustedHash = (hashInt - maxValue * houseEdge) / (maxValue * (1 - houseEdge));
  const crashPoint = 1 / (1 - adjustedHash * 0.99);
  
  return Math.max(1.0, Math.floor(crashPoint * 100) / 100);
}

function verifyGame(serverSeed, serverSeedHash, clientSeed, nonce) {
  // Step 1: Verify the hash matches
  const calculatedHash = hashSeed(serverSeed);
  if (calculatedHash !== serverSeedHash) {
    return { valid: false, error: 'Hash mismatch!' };
  }
  
  // Step 2: Calculate crash point
  const combinedHash = combineSeeds(serverSeed, clientSeed, nonce);
  const crashPoint = getCrashPointFromHash(combinedHash);
  
  return { valid: true, crashPoint };
}

// Example:
// verifyGame('server-seed', 'expected-hash', 'client-seed', 0);`;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <main className="pt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Header */}
          <div className="mb-12">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Games
            </Link>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 rounded-xl bg-violet-500/20">
                <Book className="w-8 h-8 text-violet-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">Documentation</h1>
                <p className="text-zinc-400 mt-1">
                  Everything you need to know about DriveBy
                </p>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[280px_1fr] gap-12">
            {/* Sidebar Navigation */}
            <aside className="hidden lg:block">
              <nav className="sticky top-24 space-y-6">
                {sections.map((section) => (
                  <div key={section.title}>
                    <div className="flex items-center gap-2 text-zinc-400 mb-2">
                      {section.icon}
                      <span className="text-sm font-semibold uppercase tracking-wider">
                        {section.title}
                      </span>
                    </div>
                    <ul className="space-y-1 ml-7">
                      {section.items.map((item) => (
                        <li key={item.href}>
                          <a
                            href={item.href}
                            className="block py-1.5 text-sm text-zinc-500 hover:text-white transition-colors"
                          >
                            {item.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </aside>

            {/* Content */}
            <div className="prose prose-invert prose-zinc max-w-none">
              {/* Introduction */}
              <section id="introduction" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Zap className="w-6 h-6 text-violet-400" />
                  Introduction
                </h2>
                <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
                  <p className="text-zinc-300 leading-relaxed mb-4">
                    Welcome to DriveBy, a decentralized gaming platform built on
                    Solana. Experience fast, fair, and transparent gaming with
                    instant settlements and provably fair outcomes.
                  </p>
                  <p className="text-zinc-300 leading-relaxed">
                    Our platform leverages the speed and low cost of Solana to
                    provide a seamless gaming experience. All games are provably
                    fair - you can verify every outcome yourself.
                  </p>
                </div>
              </section>

              {/* Connecting Wallet */}
              <section id="wallet" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Wallet className="w-6 h-6 text-violet-400" />
                  Connecting Your Wallet
                </h2>
                <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
                  <p className="text-zinc-300 leading-relaxed">
                    To start playing, you&apos;ll need to connect a Solana
                    wallet. We support:
                  </p>
                  <ul className="space-y-2">
                    {["Phantom", "Solflare", "Backpack", "Ledger"].map(
                      (wallet) => (
                        <li
                          key={wallet}
                          className="flex items-center gap-2 text-zinc-300"
                        >
                          <div className="w-2 h-2 rounded-full bg-emerald-400" />
                          {wallet}
                        </li>
                      )
                    )}
                  </ul>
                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
                    <p className="text-sm text-violet-300">
                      <strong>Tip:</strong> Click the &quot;Connect Wallet&quot;
                      button in the sidebar to get started.
                    </p>
                  </div>
                </div>
              </section>

              {/* Shootout */}
              <section id="shootout" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Gamepad2 className="w-6 h-6 text-orange-400" />
                  Shootout
                </h2>
                <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
                  <p className="text-zinc-300 leading-relaxed">
                    Shootout is a fast-paced multiplayer elimination game where
                    players compete for the pot. Each round, players are
                    randomly eliminated until only the winners remain.
                  </p>
                  <h4 className="text-lg font-semibold text-white">
                    How to Play:
                  </h4>
                  <ol className="space-y-2 list-decimal list-inside text-zinc-300">
                    <li>Place your bet before the round starts</li>
                    <li>Wait for other players to join</li>
                    <li>Survive the elimination rounds</li>
                    <li>Last players standing split the pot</li>
                  </ol>
                </div>
              </section>

              {/* Crash */}
              <section id="crash" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Gamepad2 className="w-6 h-6 text-emerald-400" />
                  Crash
                </h2>
                <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
                  <p className="text-zinc-300 leading-relaxed">
                    Crash is a thrilling game where a multiplier increases from
                    1x until it randomly &quot;crashes.&quot; Cash out before
                    the crash to secure your winnings!
                  </p>
                  <h4 className="text-lg font-semibold text-white">
                    How to Play:
                  </h4>
                  <ol className="space-y-2 list-decimal list-inside text-zinc-300">
                    <li>Place your bet before the round starts</li>
                    <li>Watch the multiplier increase (accelerates over time)</li>
                    <li>Click &quot;Cashout&quot; to lock in your tokens</li>
                    <li>If the game crashes before you cash out, you lose</li>
                  </ol>
                  <h4 className="text-lg font-semibold text-white mt-6">
                    The Math:
                  </h4>
                  <p className="text-zinc-300 leading-relaxed">
                    The multiplier grows exponentially with acceleration - it starts
                    slow (1.00x to 2.00x takes time) but gets faster as it climbs.
                    This makes early cashouts safer but limits winnings, while late
                    cashouts are risky but potentially very rewarding.
                  </p>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <p className="text-sm text-emerald-300">
                      <strong>Pro Tip:</strong> Set an auto-cashout multiplier
                      to automatically secure profits at your target.
                    </p>
                  </div>
                </div>
              </section>

              {/* Provably Fair */}
              <section id="provably-fair" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Shield className="w-6 h-6 text-violet-400" />
                  Provably Fair System
                </h2>
                <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 space-y-6">
                  <p className="text-zinc-300 leading-relaxed">
                    Every game on DriveBy uses a provably fair system. This cryptographic
                    method guarantees that outcomes are random and cannot be manipulated
                    by either the platform or the player.
                  </p>
                  
                  <div>
                    <h4 className="text-lg font-semibold text-white mb-3">
                      How It Works:
                    </h4>
                    <ol className="space-y-3 list-decimal list-inside text-zinc-300">
                      <li>
                        <strong className="text-white">Before the game:</strong> We generate
                        a random server seed and show you its SHA-256 hash
                      </li>
                      <li>
                        <strong className="text-white">Your seed:</strong> You provide a
                        client seed (or we generate one for you)
                      </li>
                      <li>
                        <strong className="text-white">Game outcome:</strong> The crash point
                        is calculated from both seeds combined with a nonce
                      </li>
                      <li>
                        <strong className="text-white">After the game:</strong> We reveal
                        the server seed so you can verify the result
                      </li>
                    </ol>
                  </div>

                  <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
                    <h5 className="font-semibold text-violet-300 mb-2">Why is this fair?</h5>
                    <ul className="text-sm text-violet-200 space-y-1">
                      <li>We commit to the outcome BEFORE you bet (via the hash)</li>
                      <li>We cannot change the server seed after showing you the hash</li>
                      <li>You can verify hash(serverSeed) = committedHash</li>
                      <li>Anyone can recalculate the crash point independently</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Formula */}
              <section id="formula" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Code className="w-6 h-6 text-violet-400" />
                  Mathematical Formula
                </h2>
                <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
                  <p className="text-zinc-300 leading-relaxed">
                    The crash point is derived from a combined hash of the server seed,
                    client seed, and nonce:
                  </p>
                  
                  <div className="bg-zinc-950 rounded-lg p-4 font-mono text-sm">
                    <div className="text-zinc-400 mb-2">// Combined hash</div>
                    <div className="text-emerald-400">combinedHash = HMAC-SHA256(serverSeed, clientSeed:nonce)</div>
                    <div className="text-zinc-400 mt-4 mb-2">// Extract 52 bits of entropy</div>
                    <div className="text-emerald-400">hashInt = parseInt(combinedHash.slice(0, 13), 16)</div>
                    <div className="text-zinc-400 mt-4 mb-2">// Calculate crash point (3% house edge)</div>
                    <div className="text-emerald-400">crashPoint = 1 / (1 - (hashInt / 2^52) * 0.99)</div>
                  </div>

                  <p className="text-zinc-300 leading-relaxed">
                    This formula creates a natural distribution where:
                  </p>
                  <ul className="space-y-1 text-zinc-300">
                    <li>3% chance of instant crash (1.00x)</li>
                    <li>50% chance of crashing below 2.00x</li>
                    <li>10% chance of reaching 10.00x+</li>
                    <li>1% chance of reaching 100.00x+</li>
                  </ul>
                </div>
              </section>

              {/* Verification Code */}
              <section id="verification-code" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <Code className="w-6 h-6 text-emerald-400" />
                  Verification Code
                </h2>
                <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
                  <p className="text-zinc-300 leading-relaxed">
                    Use this JavaScript code to verify any game result. Run it in
                    Node.js or your browser console:
                  </p>
                  
                  <div className="relative">
                    <pre className="bg-zinc-950 rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto max-h-[500px] overflow-y-auto">
                      {verificationCode}
                    </pre>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-sm text-amber-300">
                      <strong>Browser Version:</strong> For browsers, use the SubtleCrypto
                      API or include a library like CryptoJS. The in-game verification
                      modal handles this for you automatically.
                    </p>
                  </div>
                </div>
              </section>

              {/* Chat */}
              <section id="chat" className="mb-16">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <MessageSquare className="w-6 h-6 text-violet-400" />
                  Live Chat
                </h2>
                <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
                  <p className="text-zinc-300 leading-relaxed">
                    Connect with other players through our live chat feature.
                    Share strategies, celebrate wins, and be part of the
                    community. Please be respectful and follow our community
                    guidelines.
                  </p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
