// Global event broadcaster for SSE connections
// Handles multiple connected clients efficiently

import type { SSEEvent, SSEEventType } from "./index";

type Listener = (event: SSEEvent) => void;

interface Subscription {
  id: string;
  listener: Listener;
  filters?: {
    userId?: string;
    gameId?: string;
    eventTypes?: SSEEventType[];
  };
}

class SSEBroadcaster {
  private subscriptions: Map<string, Subscription> = new Map();
  private idCounter = 0;

  // Subscribe to events
  subscribe(listener: Listener, filters?: Subscription["filters"]): () => void {
    const id = `sub_${++this.idCounter}_${Date.now()}`;

    this.subscriptions.set(id, { id, listener, filters });

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(id);
    };
  }

  // Broadcast an event to all matching subscribers
  broadcast(event: SSEEvent, targetUserId?: string, targetGameId?: string) {
    const eventWithId = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    };

    for (const sub of this.subscriptions.values()) {
      // Check filters
      if (sub.filters) {
        // User filter
        if (sub.filters.userId && targetUserId) {
          if (sub.filters.userId !== targetUserId) continue;
        }

        // Game filter
        if (sub.filters.gameId && targetGameId) {
          if (sub.filters.gameId !== targetGameId) continue;
        }

        // Event type filter
        if (sub.filters.eventTypes && sub.filters.eventTypes.length > 0) {
          if (!sub.filters.eventTypes.includes(event.type)) continue;
        }
      }

      // Send to subscriber
      try {
        sub.listener(eventWithId);
      } catch (error) {
        console.error(`Error broadcasting to ${sub.id}:`, error);
        // Remove broken subscriber
        this.subscriptions.delete(sub.id);
      }
    }
  }

  // Broadcast to all without filters
  broadcastAll(event: SSEEvent) {
    this.broadcast(event);
  }

  // Get subscriber count
  getSubscriberCount(): number {
    return this.subscriptions.size;
  }
}

// Singleton instance
export const broadcaster = new SSEBroadcaster();

// ============================================
// GAME BROADCASTS
// ============================================

export interface GameEvent {
  type:
    | "crash_start"
    | "crash_tick"
    | "crash_cashout"
    | "crash_end"
    | "shootout_new_game"
    | "shootout_countdown"
    | "shootout_spinning"
    | "shootout_result"
    | "shootout_cancelled";
  gameId: string;
  [key: string]: unknown;
}

export function broadcastGameUpdate(data: GameEvent) {
  broadcaster.broadcastAll({
    type: "game_update",
    data,
  });
}

// ============================================
// ACTIVITY BROADCASTS
// ============================================

export interface ActivityEvent {
  type: "big_win" | "game_complete" | "new_player";
  [key: string]: unknown;
}

export function broadcastActivityUpdate(activity: ActivityEvent) {
  broadcaster.broadcastAll({
    type: "activity",
    data: activity,
  });
}

// ============================================
// BALANCE BROADCASTS
// ============================================

export function broadcastBalanceUpdate(
  userId: string,
  balance: number,
  change: number,
  status?: "confirmed" | "failed" | "refunded"
) {
  broadcaster.broadcast(
    { type: "balance_update", data: { balance, change, status } },
    userId
  );
}

export function broadcastDepositUpdate(
  userId: string,
  amount: number,
  status: "pending" | "confirmed" | "failed",
  txSignature?: string
) {
  broadcaster.broadcast(
    { type: "deposit_update", data: { amount, status, txSignature } },
    userId
  );
}

export function broadcastWithdrawalUpdate(
  userId: string,
  amount: number,
  status: "processing" | "confirmed" | "failed",
  txSignature?: string
) {
  broadcaster.broadcast(
    { type: "withdrawal_update", data: { amount, status, txSignature } },
    userId
  );
}

// ============================================
// STATS BROADCASTS
// ============================================

export function broadcastStats(stats: Record<string, unknown>) {
  broadcaster.broadcastAll({ type: "stats", data: stats });
}
