// Preload critical assets for faster page loads
// This runs once on app initialization

// List of 3D models to preload
const MODELS_TO_PRELOAD = [
  "/glock17.glb",
  "/hellcat.glb",
];

// Preload 3D models into browser cache
export function preload3DModels(): void {
  if (typeof window === "undefined") return;

  MODELS_TO_PRELOAD.forEach((modelPath) => {
    // Use link preload for GLB files
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "fetch";
    link.href = modelPath;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);

    // Also fetch to warm the cache
    fetch(modelPath, { 
      method: "GET",
      cache: "force-cache",
    }).catch(() => {
      // Silent fail - not critical
    });
  });
}

// Avatar cache using Map (in-memory)
const avatarCache = new Map<string, string>();

// Preload avatars for a list of wallet addresses
export function preloadAvatars(walletAddresses: string[]): void {
  if (typeof window === "undefined") return;

  walletAddresses.forEach((address) => {
    if (!address || avatarCache.has(address)) return;
    
    const url = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${address}`;
    
    // Create image to preload into browser cache
    const img = new Image();
    img.src = url;
    
    // Store in our cache
    avatarCache.set(address, url);
  });
}

// Get cached avatar URL
export function getCachedAvatarUrl(walletAddress: string): string {
  const url = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${walletAddress}`;
  
  // Add to cache if not present
  if (!avatarCache.has(walletAddress)) {
    avatarCache.set(walletAddress, url);
    
    // Preload if in browser
    if (typeof window !== "undefined") {
      const img = new Image();
      img.src = url;
    }
  }
  
  return url;
}

// Initialize preloading
export function initPreload(): void {
  if (typeof window === "undefined") return;
  
  // Preload 3D models immediately
  preload3DModels();
}

