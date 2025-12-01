// SSE (Server-Sent Events) utilities for real-time streaming
// This provides efficient, low-overhead real-time updates

export type SSEEventType =
  | "connected"
  | "game_update"
  | "balance_update"
  | "deposit_update"
  | "withdrawal_update"
  | "activity"
  | "stats"
  | "error"
  | "heartbeat";

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  id?: string;
}

// Create SSE response headers
export function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable nginx buffering
  };
}

// Format an SSE message
export function formatSSEMessage(event: SSEEvent): string {
  const lines: string[] = [];

  if (event.id) {
    lines.push(`id: ${event.id}`);
  }

  lines.push(`event: ${event.type}`);
  lines.push(`data: ${JSON.stringify(event.data)}`);
  lines.push(""); // Empty line to end the message

  return lines.join("\n") + "\n";
}

// Create a readable stream for SSE
export function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
    },
    cancel() {
      controller = null;
    },
  });

  const send = (event: SSEEvent) => {
    if (controller) {
      try {
        const message = formatSSEMessage(event);
        controller.enqueue(encoder.encode(message));
      } catch {
        // Stream might be closed
      }
    }
  };

  const close = () => {
    if (controller) {
      try {
        controller.close();
      } catch {
        // Already closed
      }
      controller = null;
    }
  };

  return { stream, send, close };
}

// Batch multiple events for efficiency
export class SSEBatcher {
  private events: SSEEvent[] = [];
  private flushInterval: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private onFlush: (events: SSEEvent[]) => void;

  constructor(
    onFlush: (events: SSEEvent[]) => void,
    flushInterval = 100 // ms
  ) {
    this.onFlush = onFlush;
    this.flushInterval = flushInterval;
  }

  add(event: SSEEvent) {
    this.events.push(event);

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushInterval);
    }
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.events.length > 0) {
      this.onFlush([...this.events]);
      this.events = [];
    }
  }

  destroy() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.events = [];
  }
}
