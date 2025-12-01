"use client";

import { useState, useCallback } from "react";

interface GameRound {
  id: string;
  gameType: "SHOOTOUT" | "CRASH";
  status: "WAITING" | "ACTIVE" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  wagerAmount: number;
  won: boolean | null;
  payout: number | null;
  profit: number | null;
  shootoutData?: {
    isPvP: boolean;
    opponentId: string | null;
    shareCode: string | null;
    winnerId: string | null;
  };
  crashData?: {
    crashPoint: number;
    cashedOutAt: number | null;
    autoCashout: number | null;
  };
  user?: {
    id: string;
    username: string | null;
    walletAddress: string | null;
  };
}

interface UseGameReturn {
  currentGame: GameRound | null;
  loading: boolean;
  error: string | null;
  
  // Shootout
  createShootout: (userId: string, wagerAmount: number, isPvP?: boolean) => Promise<GameRound>;
  joinShootout: (gameId: string, userId: string) => Promise<GameRound>;
  resolveShootout: (gameId: string, winnerId: string, spinResult: number) => Promise<GameRound>;
  getOpenGames: (userId?: string) => Promise<GameRound[]>;
  
  // Crash
  createCrash: (userId: string, wagerAmount: number, autoCashout?: number) => Promise<GameRound>;
  cashoutCrash: (gameId: string, multiplier: number) => Promise<GameRound>;
  crashGame: (gameId: string) => Promise<GameRound>;
  
  // Common
  cancelGame: (gameId: string) => Promise<GameRound>;
  getGame: (gameId: string) => Promise<GameRound | null>;
  clearGame: () => void;
}

export function useGame(): UseGameReturn {
  const [currentGame, setCurrentGame] = useState<GameRound | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequest = useCallback(async <T>(
    url: string,
    options?: RequestInit
  ): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Shootout operations
  const createShootout = useCallback(async (
    userId: string,
    wagerAmount: number,
    isPvP = true
  ): Promise<GameRound> => {
    const data = await handleRequest<{ game: GameRound }>("/api/games/shootout", {
      method: "POST",
      body: JSON.stringify({ userId, wagerAmount, isPvP }),
    });
    setCurrentGame(data.game);
    return data.game;
  }, [handleRequest]);

  const joinShootout = useCallback(async (
    gameId: string,
    userId: string
  ): Promise<GameRound> => {
    const data = await handleRequest<{ game: GameRound }>(`/api/games/shootout/${gameId}`, {
      method: "POST",
      body: JSON.stringify({ action: "join", userId }),
    });
    setCurrentGame(data.game);
    return data.game;
  }, [handleRequest]);

  const resolveShootout = useCallback(async (
    gameId: string,
    winnerId: string,
    spinResult: number
  ): Promise<GameRound> => {
    const data = await handleRequest<{ game: GameRound }>(`/api/games/shootout/${gameId}`, {
      method: "POST",
      body: JSON.stringify({ action: "resolve", winnerId, spinResult }),
    });
    setCurrentGame(data.game);
    return data.game;
  }, [handleRequest]);

  const getOpenGames = useCallback(async (userId?: string): Promise<GameRound[]> => {
    const params = userId ? `?userId=${userId}` : "";
    const data = await handleRequest<{ games: GameRound[] }>(`/api/games/shootout${params}`);
    return data.games;
  }, [handleRequest]);

  // Crash operations
  const createCrash = useCallback(async (
    userId: string,
    wagerAmount: number,
    autoCashout?: number
  ): Promise<GameRound> => {
    const data = await handleRequest<{ game: GameRound }>("/api/games/crash", {
      method: "POST",
      body: JSON.stringify({ userId, wagerAmount, autoCashout }),
    });
    setCurrentGame(data.game);
    return data.game;
  }, [handleRequest]);

  const cashoutCrash = useCallback(async (
    gameId: string,
    cashoutMultiplier: number
  ): Promise<GameRound> => {
    const data = await handleRequest<{ game: GameRound }>(`/api/games/crash/${gameId}`, {
      method: "POST",
      body: JSON.stringify({ action: "cashout", cashoutMultiplier }),
    });
    setCurrentGame(data.game);
    return data.game;
  }, [handleRequest]);

  const crashGame = useCallback(async (gameId: string): Promise<GameRound> => {
    const data = await handleRequest<{ game: GameRound }>(`/api/games/crash/${gameId}`, {
      method: "POST",
      body: JSON.stringify({ action: "crash" }),
    });
    setCurrentGame(data.game);
    return data.game;
  }, [handleRequest]);

  // Common operations
  const cancelGame = useCallback(async (gameId: string): Promise<GameRound> => {
    // Determine game type from current game or fetch it
    const gameType = currentGame?.gameType === "CRASH" ? "crash" : "shootout";
    const data = await handleRequest<{ game: GameRound }>(`/api/games/${gameType}/${gameId}`, {
      method: "POST",
      body: JSON.stringify({ action: "cancel" }),
    });
    setCurrentGame(null);
    return data.game;
  }, [handleRequest, currentGame]);

  const getGame = useCallback(async (gameId: string): Promise<GameRound | null> => {
    try {
      // Try shootout first
      let data = await handleRequest<{ game: GameRound }>(`/api/games/shootout/${gameId}`);
      if (data.game) {
        setCurrentGame(data.game);
        return data.game;
      }
    } catch {
      // Try crash
      try {
        const data = await handleRequest<{ game: GameRound }>(`/api/games/crash/${gameId}`);
        if (data.game) {
          setCurrentGame(data.game);
          return data.game;
        }
      } catch {
        return null;
      }
    }
    return null;
  }, [handleRequest]);

  const clearGame = useCallback(() => {
    setCurrentGame(null);
    setError(null);
  }, []);

  return {
    currentGame,
    loading,
    error,
    createShootout,
    joinShootout,
    resolveShootout,
    getOpenGames,
    createCrash,
    cashoutCrash,
    crashGame,
    cancelGame,
    getGame,
    clearGame,
  };
}

