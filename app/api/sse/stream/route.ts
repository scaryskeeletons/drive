// SSE Stream endpoint - real-time updates for clients
import { NextRequest } from "next/server";
import { createSSEStream, sseHeaders } from "@/lib/sse";
import { broadcaster } from "@/lib/sse/broadcaster";
import { StatsService, ActivityService } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const gameId = searchParams.get("gameId");

  const { stream, send, close } = createSSEStream();

  // Send initial connection event
  send({
    type: "connected",
    data: {
      timestamp: Date.now(),
      userId,
      gameId,
    },
  });

  // Send initial data
  try {
    const [stats, activity] = await Promise.all([
      StatsService.getCurrentStats(),
      ActivityService.getRecentActivity(10),
    ]);

    send({ type: "stats", data: stats });
    send({ type: "activity", data: activity });
  } catch (error) {
    console.error("Error fetching initial SSE data:", error);
  }

  // Subscribe to broadcaster
  const unsubscribe = broadcaster.subscribe(
    (event) => send(event),
    {
      userId: userId || undefined,
      gameId: gameId || undefined,
    }
  );

  // Heartbeat to keep connection alive
  const heartbeatInterval = setInterval(() => {
    send({ type: "heartbeat", data: { timestamp: Date.now() } });
  }, 30000); // Every 30 seconds

  // Stats update interval (less frequent to reduce DB calls)
  const statsInterval = setInterval(async () => {
    try {
      const stats = await StatsService.getCurrentStats();
      send({ type: "stats", data: stats });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, 60000); // Every minute

  // Cleanup on disconnect
  request.signal.addEventListener("abort", () => {
    clearInterval(heartbeatInterval);
    clearInterval(statsInterval);
    unsubscribe();
    close();
  });

  return new Response(stream, {
    headers: sseHeaders(),
  });
}

