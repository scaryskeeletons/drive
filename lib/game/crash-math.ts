/**
 * Crash Game Mathematics
 *
 * The multiplier grows exponentially, accelerating over time:
 * - Slow in early game (1.00x to ~2.00x)
 * - Fast in late game (10x+ grows very quickly)
 *
 * Formula: multiplier = e^(growthRate * time^accelerationFactor)
 *
 * This creates a curve that starts gentle and gets steeper,
 * making early cashouts safer but late-game very risky.
 */

// Growth parameters
const GROWTH_RATE = 0.00006; // Base growth rate per ms
const ACCELERATION = 1.15; // How much faster it grows over time (>1 = accelerates)
const TICK_INTERVAL = 50; // ms between updates

/**
 * Calculate multiplier at a given time (in milliseconds)
 * Uses exponential growth with acceleration
 */
export function getMultiplierAtTime(elapsedMs: number): number {
  if (elapsedMs <= 0) return 1.0;

  // Exponential with acceleration: e^(rate * time^accel)
  // This makes growth slow at start, fast later
  const exponent = GROWTH_RATE * Math.pow(elapsedMs, ACCELERATION);
  const multiplier = Math.exp(exponent);

  // Round to 2 decimal places
  return Math.floor(multiplier * 100) / 100;
}

/**
 * Calculate time (ms) to reach a given multiplier
 * Inverse of getMultiplierAtTime
 */
export function getTimeForMultiplier(multiplier: number): number {
  if (multiplier <= 1.0) return 0;

  const lnMultiplier = Math.log(multiplier);
  const time = Math.pow(lnMultiplier / GROWTH_RATE, 1 / ACCELERATION);

  return Math.floor(time);
}

/**
 * Calculate payout for a given wager and multiplier
 */
export function calculatePayout(wager: number, multiplier: number): number {
  return Math.floor(wager * multiplier * 10000) / 10000; // 4 decimal precision
}

/**
 * Calculate profit for a given wager and multiplier
 */
export function calculateProfit(wager: number, multiplier: number): number {
  return calculatePayout(wager, multiplier) - wager;
}

/**
 * Generate crash point from a hash (provably fair)
 *
 * The crash point is determined by the combined server+client seed hash.
 * This uses a mathematically fair distribution that gives the house a small edge.
 *
 * House edge is ~3% (configurable)
 */
export function getCrashPointFromHash(
  hash: string,
  houseEdge: number = 0.05
): number {
  // Take first 13 hex characters (52 bits) for randomness
  const hashHex = hash.slice(0, 13);
  const hashInt = parseInt(hashHex, 16);

  // Max value for 52 bits
  const maxValue = Math.pow(2, 52);

  // Calculate crash point using inverse of exponential distribution
  // This naturally creates the characteristic crash curve
  // P(crash at x) decreases as x increases

  // House edge: game instantly crashes with probability = houseEdge
  const instantCrash = hashInt < maxValue * houseEdge;
  if (instantCrash) {
    return 1.0; // Instant crash
  }

  // For non-instant crash, calculate point using remaining probability space
  const adjustedHash =
    (hashInt - maxValue * houseEdge) / (maxValue * (1 - houseEdge));

  // Inverse exponential distribution
  // crashPoint = 1 / (1 - adjustedHash)
  // This gives us: P(crash > x) = 1/x for x >= 1
  const crashPoint = 1 / (1 - adjustedHash * 0.99); // 0.99 prevents division by zero

  // Round to 2 decimal places, minimum 1.00
  return Math.max(1.0, Math.floor(crashPoint * 100) / 100);
}

/**
 * Get tick schedule - returns array of [time, multiplier] pairs
 * Used for client-side rendering synchronization
 */
export function generateTickSchedule(
  crashPoint: number,
  maxTicks: number = 10000
): Array<{ time: number; multiplier: number }> {
  const schedule: Array<{ time: number; multiplier: number }> = [];
  let time = 0;
  let multiplier = 1.0;

  while (multiplier < crashPoint && schedule.length < maxTicks) {
    schedule.push({ time, multiplier });
    time += TICK_INTERVAL;
    multiplier = getMultiplierAtTime(time);
  }

  // Add final crash point
  const crashTime = getTimeForMultiplier(crashPoint);
  schedule.push({ time: crashTime, multiplier: crashPoint });

  return schedule;
}

/**
 * Expected value calculation for players
 * With 5% house edge, EV = 0.95 * wager
 */
export function getExpectedValue(
  wager: number,
  houseEdge: number = 0.05
): number {
  return wager * (1 - houseEdge);
}

// Export constants for client use
export const CRASH_CONFIG = {
  GROWTH_RATE,
  ACCELERATION,
  TICK_INTERVAL,
  HOUSE_EDGE: 0.05,
};
