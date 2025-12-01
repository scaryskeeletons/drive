// Game Services Export
export { CrashGameService } from "./crash-service";
export { ShootoutService } from "./shootout-service";

// Provably Fair System
export {
  generateServerSeed,
  hashSeed,
  combineSeeds,
  calculateCrashPoint,
  verifyGame,
  generateClientSeed,
  createGameSession,
  rotateServerSeed,
  CLIENT_VERIFICATION_CODE,
  type GameSession,
} from "./provably-fair";

// Crash Math
export {
  getMultiplierAtTime,
  getTimeForMultiplier,
  calculatePayout,
  calculateProfit,
  getCrashPointFromHash,
  generateTickSchedule,
  getExpectedValue,
  CRASH_CONFIG,
} from "./crash-math";

