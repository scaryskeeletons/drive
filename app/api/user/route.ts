// User API routes
import { NextRequest, NextResponse } from "next/server";
import { UserService, WalletService } from "@/lib/db";

// Get or create user by wallet
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing walletAddress" },
        { status: 400 }
      );
    }

    // Check if database is available
    const isDatabaseAvailable = process.env.DATABASE_URL && 
      !process.env.DATABASE_URL.startsWith("prisma+");

    if (!isDatabaseAvailable) {
      // Return mock data for development without database
      console.log("Database not configured, returning mock user data");
      return NextResponse.json({
        user: {
          id: `mock-${walletAddress.slice(0, 8)}`,
          walletAddress,
          username: null,
          avatarSeed: walletAddress,
          stats: null,
        },
        wallet: {
          publicKey: walletAddress, // Use same address as mock
          balance: 0,
          pendingBalance: 0,
          lockedBalance: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
          highestBalance: 0,
          lowestBalance: 0,
        },
      });
    }

    // Find or create user
    const user = await UserService.findOrCreateByWallet(walletAddress);

    // Create custodial wallet if doesn't exist
    let wallet = await WalletService.getByUserId(user.id);
    if (!wallet) {
      wallet = await WalletService.createWallet(user.id);
    }

    // Update last active
    await UserService.updateLastActive(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        username: user.username,
        avatarSeed: user.avatarSeed,
        stats: user.stats,
      },
      wallet: {
        publicKey: wallet.publicKey,
        balance: wallet.balance,
        pendingBalance: wallet.pendingBalance,
        lockedBalance: wallet.lockedBalance,
        totalDeposited: wallet.totalDeposited,
        totalWithdrawn: wallet.totalWithdrawn,
        highestBalance: wallet.highestBalance,
        lowestBalance: wallet.lowestBalance,
      },
    });
  } catch (error) {
    console.error("Error getting/creating user:", error);
    return NextResponse.json(
      { error: "Failed to process user" },
      { status: 500 }
    );
  }
}
