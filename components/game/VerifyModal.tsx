"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLIENT_VERIFICATION_CODE } from "@/lib/game/provably-fair";

interface VerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId?: string;
}

interface VerificationData {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  crashPoint: number;
}

export function VerifyModal({ isOpen, onClose, gameId }: VerifyModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<VerificationData | null>(null);
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean;
    error?: string;
    calculatedCrashPoint?: number;
  } | null>(null);
  const [showCode, setShowCode] = useState(false);
  
  // Manual verification inputs
  const [manualServerSeed, setManualServerSeed] = useState("");
  const [manualHash, setManualHash] = useState("");
  const [manualClientSeed, setManualClientSeed] = useState("");
  const [manualNonce, setManualNonce] = useState("");
  const [manualCrashPoint, setManualCrashPoint] = useState("");

  // Fetch verification data for a specific game
  useEffect(() => {
    if (!isOpen || !gameId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/games/crash/verify?gameId=${gameId}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
          // Pre-fill manual fields
          setManualServerSeed(json.serverSeed);
          setManualHash(json.serverSeedHash);
          setManualClientSeed(json.clientSeed);
          setManualNonce(json.nonce.toString());
          setManualCrashPoint(json.crashPoint.toString());
        }
      } catch (error) {
        console.error("Failed to fetch verification data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, gameId]);

  // Verify game
  const handleVerify = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/games/crash/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverSeed: manualServerSeed,
          serverSeedHash: manualHash,
          clientSeed: manualClientSeed,
          nonce: parseInt(manualNonce),
          crashPoint: parseFloat(manualCrashPoint),
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setVerifyResult(result);
      }
    } catch (error) {
      console.error("Verification failed:", error);
      setVerifyResult({ valid: false, error: "Verification request failed" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            Provably Fair Verification
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* How it works */}
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50">
            <h3 className="font-semibold text-white mb-2">How It Works</h3>
            <ol className="text-sm text-zinc-400 space-y-1 list-decimal list-inside">
              <li>Before each game, we generate a random server seed</li>
              <li>We show you the hash of this seed (you see this before playing)</li>
              <li>You provide a client seed (or we generate one)</li>
              <li>The crash point is calculated from both seeds combined</li>
              <li>After the game, we reveal the server seed for verification</li>
            </ol>
          </div>

          {/* Game Data */}
          {data && (
            <div className="space-y-3">
              <h3 className="font-semibold text-white">Game Data</h3>
              
              <div className="grid gap-3">
                <div>
                  <label className="text-xs text-zinc-500 uppercase">Server Seed Hash (shown before game)</label>
                  <div className="flex gap-2">
                    <Input
                      value={manualHash}
                      onChange={(e) => setManualHash(e.target.value)}
                      className="font-mono text-xs bg-zinc-800 border-zinc-700"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(manualHash)}
                      className="shrink-0"
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 uppercase">Server Seed (revealed after game)</label>
                  <div className="flex gap-2">
                    <Input
                      value={manualServerSeed}
                      onChange={(e) => setManualServerSeed(e.target.value)}
                      className="font-mono text-xs bg-zinc-800 border-zinc-700"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(manualServerSeed)}
                      className="shrink-0"
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-500 uppercase">Client Seed</label>
                  <Input
                    value={manualClientSeed}
                    onChange={(e) => setManualClientSeed(e.target.value)}
                    className="font-mono text-xs bg-zinc-800 border-zinc-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 uppercase">Nonce</label>
                    <Input
                      value={manualNonce}
                      onChange={(e) => setManualNonce(e.target.value)}
                      type="number"
                      className="font-mono bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 uppercase">Crash Point</label>
                    <Input
                      value={manualCrashPoint}
                      onChange={(e) => setManualCrashPoint(e.target.value)}
                      type="number"
                      step="0.01"
                      className="font-mono bg-zinc-800 border-zinc-700"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manual Verification */}
          {!data && !loading && (
            <div className="space-y-3">
              <h3 className="font-semibold text-white">Manual Verification</h3>
              <p className="text-sm text-zinc-400">
                Enter the game data to verify any round:
              </p>
              
              <div className="grid gap-3">
                <div>
                  <label className="text-xs text-zinc-500 uppercase">Server Seed Hash</label>
                  <Input
                    value={manualHash}
                    onChange={(e) => setManualHash(e.target.value)}
                    placeholder="e.g. a1b2c3d4..."
                    className="font-mono text-xs bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase">Server Seed</label>
                  <Input
                    value={manualServerSeed}
                    onChange={(e) => setManualServerSeed(e.target.value)}
                    placeholder="Revealed after game"
                    className="font-mono text-xs bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 uppercase">Client Seed</label>
                  <Input
                    value={manualClientSeed}
                    onChange={(e) => setManualClientSeed(e.target.value)}
                    placeholder="Your seed"
                    className="font-mono text-xs bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 uppercase">Nonce</label>
                    <Input
                      value={manualNonce}
                      onChange={(e) => setManualNonce(e.target.value)}
                      type="number"
                      placeholder="0"
                      className="font-mono bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 uppercase">Crash Point</label>
                    <Input
                      value={manualCrashPoint}
                      onChange={(e) => setManualCrashPoint(e.target.value)}
                      type="number"
                      step="0.01"
                      placeholder="e.g. 2.35"
                      className="font-mono bg-zinc-800 border-zinc-700"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Verify Button */}
          <Button
            onClick={handleVerify}
            disabled={loading || !manualServerSeed || !manualHash}
            className="w-full bg-violet-600 hover:bg-violet-500"
          >
            {loading ? "Verifying..." : "Verify Game"}
          </Button>

          {/* Verification Result */}
          {verifyResult && (
            <div className={`rounded-lg p-4 border ${
              verifyResult.valid 
                ? "bg-emerald-500/10 border-emerald-500/30" 
                : "bg-red-500/10 border-red-500/30"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {verifyResult.valid ? (
                  <>
                    <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    <span className="font-semibold text-emerald-400">Verified!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                    <span className="font-semibold text-red-400">Verification Failed</span>
                  </>
                )}
              </div>
              {verifyResult.error && (
                <p className="text-sm text-red-300">{verifyResult.error}</p>
              )}
              {verifyResult.calculatedCrashPoint && (
                <p className="text-sm text-zinc-300">
                  Calculated crash point: <span className="font-mono font-bold">{verifyResult.calculatedCrashPoint.toFixed(2)}x</span>
                </p>
              )}
            </div>
          )}

          {/* Show Code Toggle */}
          <div className="border-t border-zinc-800 pt-4">
            <button
              onClick={() => setShowCode(!showCode)}
              className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300"
            >
              <svg 
                className={`w-4 h-4 transition-transform ${showCode ? "rotate-90" : ""}`} 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
              {showCode ? "Hide" : "Show"} Verification Code (JavaScript)
            </button>

            {showCode && (
              <div className="mt-3 relative">
                <pre className="bg-zinc-950 rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto max-h-96 overflow-y-auto">
                  {CLIENT_VERIFICATION_CODE}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(CLIENT_VERIFICATION_CODE)}
                  className="absolute top-2 right-2"
                >
                  Copy Code
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

