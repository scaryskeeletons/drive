"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { truncateWallet, getAvatarUrl } from "@/lib/utils/wallet";
import { useUser } from "@/hooks/useUser";

interface Message {
  id: string;
  walletAddress: string;
  content: string;
  timestamp: number;
  color?: string;
}

interface ChatProps {
  className?: string;
  open?: boolean;
  setOpen?: (open: boolean) => void;
  defaultExpanded?: boolean;
}

const MAX_MESSAGE_LENGTH = 100;

function getUserColor(wallet: string): string {
  const colors = [
    "#f472b6",
    "#a78bfa",
    "#60a5fa",
    "#34d399",
    "#fbbf24",
    "#fb923c",
    "#f87171",
  ];
  let hash = 0;
  for (let i = 0; i < wallet.length; i++) {
    hash = wallet.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function Chat({
  className,
  open: controlledOpen,
  setOpen: controlledSetOpen,
  defaultExpanded = true,
}: ChatProps) {
  const [internalOpen, setInternalOpen] = useState(defaultExpanded);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { user, connected } = useUser();
  const currentWallet = user?.walletAddress || "";

  // Support both controlled and uncontrolled modes
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledSetOpen || setInternalOpen;

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      if (res.ok) {
        const data = await res.json();
        setMessages(
          (data.messages || []).map((m: Message) => ({
            ...m,
            color: getUserColor(m.walletAddress),
          }))
        );
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchMessages();

    // Poll every 3 seconds for new messages
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !connected || !currentWallet || sending) return;

    const content = newMessage.trim();
    if (content.length > MAX_MESSAGE_LENGTH) return;

    setSending(true);

    // Optimistic update
    const optimisticMessage: Message = {
      id: `temp_${Date.now()}`,
      walletAddress: currentWallet,
      content,
      timestamp: Date.now(),
      color: getUserColor(currentWallet),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: currentWallet,
          content,
        }),
      });

      if (!res.ok) {
        // Remove optimistic message on error
        setMessages((prev) =>
          prev.filter((m) => m.id !== optimisticMessage.id)
        );
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const charactersLeft = MAX_MESSAGE_LENGTH - newMessage.length;

  if (!isOpen) {
    return null;
  }

  return (
    <div className={`flex flex-col h-full ${className || ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <h2 className="text-base font-semibold text-white">Chat</h2>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-hidden p-4 space-y-3"
        style={{
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 10%, black 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 10%, black 100%)",
        }}
      >
        <div className="flex flex-col justify-end min-h-full space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-zinc-600 text-sm py-8">
              No messages yet. Be the first to say something!
            </div>
          ) : (
            messages.slice(-30).map((message) => (
              <div key={message.id} className="flex items-start gap-2">
                <div className="w-8 h-8 shrink-0 rounded-full overflow-hidden bg-zinc-800">
                  <img
                    src={getAvatarUrl(message.walletAddress)}
                    alt=""
                    className="w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className="font-mono font-medium text-sm"
                    style={{
                      color:
                        message.color || getUserColor(message.walletAddress),
                    }}
                  >
                    {truncateWallet(message.walletAddress)}
                  </span>
                  <p className="text-sm text-zinc-300 wrap-break-word leading-relaxed">
                    {message.content}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-white/5">
        {connected ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) =>
                  setNewMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
                }
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 bg-zinc-900/50 border-white/10 text-white text-base h-11 placeholder:text-zinc-600"
                disabled={sending}
                maxLength={MAX_MESSAGE_LENGTH}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sending}
                className="h-11 px-4 bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
              >
                {sending ? (
                  <svg
                    className="w-4 h-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeOpacity="0.25"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </svg>
                )}
              </Button>
            </div>
            <div className="flex justify-end">
              <span
                className={`text-xs ${charactersLeft < 20 ? "text-amber-400" : "text-zinc-600"}`}
              >
                {charactersLeft}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center text-zinc-500 text-sm py-2">
            Connect wallet to chat
          </div>
        )}
      </div>
    </div>
  );
}
