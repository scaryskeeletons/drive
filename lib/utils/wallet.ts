// Wallet address utilities

// In-memory avatar cache
const avatarCache = new Map<string, string>();

/**
 * Truncates a wallet address to format: 1234...5678
 */
export function truncateWallet(address: string, startChars = 4, endChars = 4): string {
  if (!address) return "";
  if (address.length <= startChars + endChars + 3) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Get Dicebear avatar URL for a wallet address (with caching)
 */
export function getAvatarUrl(walletAddress: string): string {
  if (!walletAddress) return "";
  
  // Check cache first
  if (avatarCache.has(walletAddress)) {
    return avatarCache.get(walletAddress)!;
  }
  
  const url = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${walletAddress}`;
  avatarCache.set(walletAddress, url);
  
  // Preload into browser cache
  if (typeof window !== "undefined") {
    const img = new Image();
    img.src = url;
  }
  
  return url;
}

/**
 * Preload avatars for multiple wallet addresses
 */
export function preloadAvatars(addresses: string[]): void {
  if (typeof window === "undefined") return;
  
  addresses.forEach((address) => {
    if (address && !avatarCache.has(address)) {
      getAvatarUrl(address);
    }
  });
}

