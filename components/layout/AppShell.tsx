"use client";

import { useState, createContext, useContext, ReactNode } from "react";
import Link from "next/link";
import { Sidebar, SidebarBody, SidebarLink } from "@/components/ui/sidebar";
import { Chat } from "@/components/chat/Chat";
import { WalletSection } from "@/components/wallet/WalletSection";
import { SolanaWalletProvider } from "@/components/wallet/SolanaWalletProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { PreloadManager } from "@/components/PreloadManager";
import { UserProvider } from "@/hooks/useUser";
import Dither from "@/components/Dither";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// Context for app-wide state
interface AppShellContextType {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
}

const AppShellContext = createContext<AppShellContextType | null>(null);

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error("useAppShell must be used within AppShell");
  }
  return context;
}

// Navigation links
const mainLinks = [
  {
    label: "Games",
    href: "/",
    icon: (
      <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="8" cy="12" r="2" />
        <path d="M15 9v6M12 12h6" />
      </svg>
    ),
  },
  {
    label: "Leaderboard",
    href: "/leaderboard",
    icon: (
      <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 21v-6M12 21V9M16 21v-4M6 21h12" />
        <path d="M12 3l3 3-3 3-3-3 3-3z" />
      </svg>
    ),
  },
  {
    label: "History",
    href: "/history",
    icon: (
      <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

const secondaryLinks = [
  {
    label: "Docs",
    href: "/docs",
    icon: (
      <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
      </svg>
    ),
  },
];

const socialLinks = [
  {
    label: "Twitter",
    href: "https://twitter.com",
    icon: (
      <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Discord",
    href: "https://discord.com",
    icon: (
      <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
      </svg>
    ),
  },
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  return (
    <SolanaWalletProvider>
    <UserProvider>
    <AppShellContext.Provider value={{ sidebarOpen, setSidebarOpen, chatOpen, setChatOpen }}>
      <ToastProvider>
      <PreloadManager />
      <div className="relative h-screen overflow-hidden bg-zinc-950">
        {/* Dither Background */}
        <div className="fixed inset-0 z-0 opacity-30">
          <Dither
            waveColor={[0.2, 0.15, 0.25]}
            disableAnimation={false}
            enableMouseInteraction={true}
            mouseRadius={0.15}
            colorNum={4}
            waveAmplitude={0.5}
            waveFrequency={6}
            waveSpeed={0.02}
          />
        </div>

        {/* Main Layout */}
        <div className={cn("relative z-10 flex h-screen")}>
          {/* Sidebar */}
          <Sidebar open={sidebarOpen} setOpen={setSidebarOpen}>
            <SidebarBody className="justify-between gap-6 bg-violet-950/40 backdrop-blur-xl border-r border-violet-500/10">
              <div className="flex flex-1 flex-col overflow-x-hidden overflow-y-auto">
                {/* Logo */}
                {sidebarOpen ? (
                  <Link href="/" className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal">
                    <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-white" />
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="font-bold whitespace-pre text-white"
                    >
                      DriveBy
                    </motion.span>
                  </Link>
                ) : (
                  <Link href="/" className="relative z-20 flex items-center space-x-2 py-1 text-sm font-normal">
                    <div className="h-5 w-6 shrink-0 rounded-tl-lg rounded-tr-sm rounded-br-lg rounded-bl-sm bg-white" />
                  </Link>
                )}

                {/* Wallet Section (Connect + Deposit/Withdraw) */}
                <div className="mt-4 pb-4 border-b border-violet-500/10">
                  <WalletSection expanded={sidebarOpen} />
                </div>

                {/* Main Navigation */}
                <div className="mt-4 flex flex-col">
                  <motion.span
                    initial={false}
                    animate={{ opacity: sidebarOpen ? 1 : 0, height: sidebarOpen ? 20 : 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider px-0.5 overflow-hidden"
                  >
                    Play
                  </motion.span>
                  {mainLinks.map((link, idx) => (
                    <SidebarLink key={idx} link={link} />
                  ))}
                </div>

                <div className="my-4 border-t border-violet-500/10" />

                <div className="flex flex-col">
                  <motion.span
                    initial={false}
                    animate={{ opacity: sidebarOpen ? 1 : 0, height: sidebarOpen ? 20 : 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider px-0.5 overflow-hidden"
                  >
                    More
                  </motion.span>
                  {secondaryLinks.map((link, idx) => (
                    <SidebarLink key={idx} link={link} />
                  ))}
                </div>
              </div>

              <div className="border-t border-violet-500/10 pt-4">
                <motion.span
                  initial={false}
                  animate={{ opacity: sidebarOpen ? 1 : 0, height: sidebarOpen ? 20 : 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider px-0.5 block overflow-hidden"
                >
                  Connect
                </motion.span>
                <div className="flex flex-col">
                  {socialLinks.map((link, idx) => (
                    <SidebarLink key={idx} link={link} />
                  ))}
                </div>
              </div>
            </SidebarBody>
          </Sidebar>

          {/* Main Content */}
          <main className="flex-1 flex flex-col overflow-auto">
            {children}
          </main>

          {/* Chat */}
          {chatOpen ? (
            <motion.aside
              initial={false}
              animate={{ width: 320, opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="border-l border-white/5 bg-zinc-900/40 backdrop-blur-sm flex flex-col xl:w-[380px] shrink-0"
            >
              <Chat open={chatOpen} setOpen={setChatOpen} />
            </motion.aside>
          ) : (
            <div className="fixed bottom-6 right-6 z-50">
              <button
                onClick={() => setChatOpen(true)}
                className="w-12 h-12 rounded-full bg-zinc-900/80 backdrop-blur border border-white/10 flex items-center justify-center hover:bg-zinc-800/80 transition-colors shadow-lg"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-400">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
      </ToastProvider>
    </AppShellContext.Provider>
    </UserProvider>
    </SolanaWalletProvider>
  );
}
