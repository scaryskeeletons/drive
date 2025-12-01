// Database types with relations
import type {
  GameRound,
  ShootoutRound,
  CrashRound,
  User,
  UserStats,
  CustodialWallet,
} from "@prisma/client";

// Game round with all relations
export type GameRoundWithRelations = GameRound & {
  shootoutData: ShootoutRound | null;
  crashData: CrashRound | null;
  user: Pick<User, "id" | "username" | "walletAddress" | "avatarSeed"> | null;
};

// User with stats and wallet
export type UserWithStats = User & {
  stats: UserStats | null;
  custodialWallet: Pick<CustodialWallet, "balance" | "publicKey"> | null;
};

