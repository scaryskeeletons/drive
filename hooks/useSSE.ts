"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { SSEEventType } from "@/lib/sse";

interface SSEMessage {
  type: SSEEventType;
  data: unknown;
  id?: string;
}

interface UseSSEOptions {
  userId?: string;
  gameId?: string;
  onMessage?: (event: SSEMessage) => void;
  onStats?: (stats: Record<string, unknown>) => void;
  onActivity?: (activity: unknown[]) => void;
  onGameUpdate?: (data: Record<string, unknown>) => void;
  onBalanceUpdate?: (data: { balance: number; change: number }) => void;
  reconnectDelay?: number;
  maxRetries?: number;
}

export function useSSE(options: UseSSEOptions = {}) {
  const {
    userId,
    gameId,
    onMessage,
    onStats,
    onActivity,
    onGameUpdate,
    onBalanceUpdate,
    reconnectDelay = 3000,
    maxRetries = 5,
  } = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [activity, setActivity] = useState<unknown[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const retriesRef = useRef(0);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Build URL with params
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    if (gameId) params.set("gameId", gameId);

    const url = `/api/sse/stream${params.toString() ? `?${params}` : ""}`;

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setError(null);
        retriesRef.current = 0;
      };

      eventSource.onerror = () => {
        if (!mountedRef.current) return;
        setConnected(false);

        eventSource.close();
        eventSourceRef.current = null;

        // Retry connection
        if (retriesRef.current < maxRetries) {
          retriesRef.current++;
          setTimeout(connect, reconnectDelay);
        } else {
          setError("Connection failed after multiple retries");
        }
      };

      // Handle different event types
      eventSource.addEventListener("connected", (e) => {
        if (!mountedRef.current) return;
        const data = JSON.parse(e.data);
        onMessage?.({ type: "connected", data });
      });

      eventSource.addEventListener("stats", (e) => {
        if (!mountedRef.current) return;
        const data = JSON.parse(e.data);
        setStats(data);
        onStats?.(data);
        onMessage?.({ type: "stats", data });
      });

      eventSource.addEventListener("activity", (e) => {
        if (!mountedRef.current) return;
        const data = JSON.parse(e.data);
        setActivity(Array.isArray(data) ? data : [data, ...activity].slice(0, 20));
        onActivity?.(data);
        onMessage?.({ type: "activity", data });
      });

      eventSource.addEventListener("game_update", (e) => {
        if (!mountedRef.current) return;
        const data = JSON.parse(e.data);
        onGameUpdate?.(data);
        onMessage?.({ type: "game_update", data });
      });

      eventSource.addEventListener("balance_update", (e) => {
        if (!mountedRef.current) return;
        const data = JSON.parse(e.data);
        onBalanceUpdate?.(data);
        onMessage?.({ type: "balance_update", data });
      });

      eventSource.addEventListener("heartbeat", () => {
        // Just keep-alive, no action needed
      });
    } catch (err) {
      setError("Failed to connect to SSE");
      console.error("SSE connection error:", err);
    }
  }, [userId, gameId, onMessage, onStats, onActivity, onGameUpdate, onBalanceUpdate, reconnectDelay, maxRetries, activity]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnected(false);
    }
  }, []);

  return {
    connected,
    error,
    stats,
    activity,
    disconnect,
    reconnect: connect,
  };
}

