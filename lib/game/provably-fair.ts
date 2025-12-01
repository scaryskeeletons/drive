/**
 * Provably Fair System
 *
 * How it works:
 * 1. Server generates a random seed BEFORE the game
 * 2. Server hashes the seed and sends hash to client (commit)
 * 3. Client provides their own seed (can be random or custom)
 * 4. Combined hash (server + client + nonce) determines outcome
 * 5. After game, server reveals seed (reveal)
 * 6. Client can verify: hash(serverSeed) === committedHash
 *    AND outcome matches when they recalculate
 *
 * This ensures:
 * - Server can't change outcome after seeing client seed
 * - Client can't predict outcome before game
 * - Anyone can verify after the fact
 */

import crypto from "crypto";
import { getCrashPointFromHash } from "./crash-math";

/**
 * Generate a cryptographically secure random seed
 */
export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a seed using SHA-256
 * This is what we show to the client BEFORE the game
 */
export function hashSeed(seed: string): string {
  return crypto.createHash("sha256").update(seed).digest("hex");
}

/**
 * Combine server seed, client seed, and nonce to get final hash
 * The nonce increments for each game, allowing seed reuse
 */
export function combineSeeds(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): string {
  const combined = `${serverSeed}:${clientSeed}:${nonce}`;
  return crypto
    .createHmac("sha256", serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest("hex");
}

/**
 * Calculate crash point from seeds
 */
export function calculateCrashPoint(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  houseEdge: number = 0.03
): number {
  const combinedHash = combineSeeds(serverSeed, clientSeed, nonce);
  return getCrashPointFromHash(combinedHash, houseEdge);
}

/**
 * Verify a game result
 * Returns true if the provided seeds produce the claimed crash point
 */
export function verifyGame(
  serverSeed: string,
  serverSeedHash: string,
  clientSeed: string,
  nonce: number,
  claimedCrashPoint: number,
  houseEdge: number = 0.05
): { valid: boolean; error?: string; calculatedCrashPoint?: number } {
  // Step 1: Verify server seed hash matches
  const calculatedHash = hashSeed(serverSeed);
  if (calculatedHash !== serverSeedHash) {
    return {
      valid: false,
      error:
        "Server seed hash does not match. The server may have changed the seed.",
    };
  }

  // Step 2: Calculate crash point from seeds
  const calculatedCrashPoint = calculateCrashPoint(
    serverSeed,
    clientSeed,
    nonce,
    houseEdge
  );

  // Step 3: Verify crash point matches (with small tolerance for rounding)
  const tolerance = 0.01;
  if (Math.abs(calculatedCrashPoint - claimedCrashPoint) > tolerance) {
    return {
      valid: false,
      error: `Crash point mismatch. Expected ${claimedCrashPoint}, calculated ${calculatedCrashPoint}`,
      calculatedCrashPoint,
    };
  }

  return {
    valid: true,
    calculatedCrashPoint,
  };
}

/**
 * Generate default client seed (can be overridden by user)
 */
export function generateClientSeed(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * Create a new game session
 * Returns the server seed hash (to show before game) and keeps seed secret
 */
export interface GameSession {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export function createGameSession(
  existingServerSeed?: string,
  existingClientSeed?: string,
  nonce: number = 0
): GameSession {
  const serverSeed = existingServerSeed || generateServerSeed();
  const serverSeedHash = hashSeed(serverSeed);
  const clientSeed = existingClientSeed || generateClientSeed();

  return {
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce,
  };
}

/**
 * Rotate server seed (after user requests new seed)
 * Returns the OLD seed (for verification) and creates new session
 */
export function rotateServerSeed(currentSession: GameSession): {
  oldSeed: string;
  newSession: GameSession;
} {
  return {
    oldSeed: currentSession.serverSeed,
    newSession: createGameSession(undefined, currentSession.clientSeed, 0),
  };
}

// ============================================
// CLIENT-SIDE VERIFICATION CODE
// This is what goes in the docs for users to verify
// ============================================

export const CLIENT_VERIFICATION_CODE = `
// Provably Fair Verification Script
// Run this in your browser console or Node.js to verify any game

const crypto = require('crypto'); // Node.js
// For browser, use: https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js

function hashSeed(seed) {
  return crypto.createHash('sha256').update(seed).digest('hex');
}

function combineSeeds(serverSeed, clientSeed, nonce) {
  return crypto.createHmac('sha256', serverSeed)
    .update(clientSeed + ':' + nonce)
    .digest('hex');
}

function getCrashPointFromHash(hash, houseEdge = 0.05) {
  const hashHex = hash.slice(0, 13);
  const hashInt = parseInt(hashHex, 16);
  const maxValue = Math.pow(2, 52);
  
  if (hashInt < maxValue * houseEdge) {
    return 1.0;
  }
  
  const adjustedHash = (hashInt - maxValue * houseEdge) / (maxValue * (1 - houseEdge));
  const crashPoint = 1 / (1 - adjustedHash * 0.99);
  
  return Math.max(1.0, Math.floor(crashPoint * 100) / 100);
}

function verifyGame(serverSeed, serverSeedHash, clientSeed, nonce) {
  // Step 1: Verify the hash
  const calculatedHash = hashSeed(serverSeed);
  if (calculatedHash !== serverSeedHash) {
    return { valid: false, error: 'Hash mismatch - server may have cheated!' };
  }
  
  // Step 2: Calculate crash point
  const combinedHash = combineSeeds(serverSeed, clientSeed, nonce);
  const crashPoint = getCrashPointFromHash(combinedHash);
  
  return { valid: true, crashPoint };
}

// Example usage:
// const result = verifyGame(
//   'your-server-seed',
//   'the-hash-shown-before-game',
//   'your-client-seed',
//   0 // nonce (game number)
// );
// console.log(result);
`;
