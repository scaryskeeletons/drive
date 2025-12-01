// Chat API - in-memory for now, can be upgraded to DB persistence
import { NextRequest, NextResponse } from "next/server";

interface ChatMessage {
  id: string;
  walletAddress: string;
  content: string;
  timestamp: number;
}

// In-memory message store (in production, use Redis or DB)
const messages: ChatMessage[] = [];
const MAX_MESSAGES = 100;

export async function GET() {
  // Return last 50 messages
  const recentMessages = messages.slice(-50);
  return NextResponse.json({ messages: recentMessages });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, content } = body;

    if (!walletAddress || !content) {
      return NextResponse.json(
        { error: "Missing walletAddress or content" },
        { status: 400 }
      );
    }

    // Validate content length
    if (content.length > 100) {
      return NextResponse.json(
        { error: "Message too long (max 100 characters)" },
        { status: 400 }
      );
    }

    // Create message
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      walletAddress,
      content: content.trim(),
      timestamp: Date.now(),
    };

    messages.push(message);

    // Keep only last MAX_MESSAGES
    if (messages.length > MAX_MESSAGES) {
      messages.splice(0, messages.length - MAX_MESSAGES);
    }

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
