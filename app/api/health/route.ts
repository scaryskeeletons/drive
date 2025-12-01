// Health check endpoint for monitoring
import { NextResponse } from "next/server";
import { SolanaService } from "@/lib/solana";
import { prisma } from "@/lib/db/client";

export async function GET() {
  const checks: Record<string, { status: string; message?: string; value?: unknown }> = {};

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: "ok" };
  } catch (error) {
    checks.database = {
      status: "error",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }

  // Check Solana connection
  try {
    const slot = await SolanaService.getGameMasterSOLBalance();
    checks.solana = {
      status: "ok",
      value: { gameMasterSOL: slot },
    };
  } catch (error) {
    checks.solana = {
      status: "error",
      message: error instanceof Error ? error.message : "Connection failed",
    };
  }

  // Check game master token balance
  try {
    const balance = await SolanaService.getGameMasterBalance();
    checks.gameMasterTokens = {
      status: balance > 0 ? "ok" : "warning",
      value: { balance },
      message: balance === 0 ? "Game master has no tokens" : undefined,
    };
  } catch (error) {
    checks.gameMasterTokens = {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to get balance",
    };
  }

  // Check pending withdrawals
  try {
    const pending = await prisma.pendingWithdrawal.count({
      where: { status: "pending" },
    });
    const processing = await prisma.pendingWithdrawal.count({
      where: { status: "processing" },
    });
    checks.withdrawals = {
      status: processing > 5 ? "warning" : "ok",
      value: { pending, processing },
      message: processing > 5 ? "Many withdrawals stuck processing" : undefined,
    };
  } catch (error) {
    checks.withdrawals = {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to check",
    };
  }

  // Overall status
  const hasErrors = Object.values(checks).some((c) => c.status === "error");
  const hasWarnings = Object.values(checks).some((c) => c.status === "warning");

  return NextResponse.json({
    status: hasErrors ? "unhealthy" : hasWarnings ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    checks,
  });
}

