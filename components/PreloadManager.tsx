"use client";

import { useEffect } from "react";
import { useGLTF } from "@react-three/drei";

// Models to preload
const MODELS = ["/glock17.glb", "/hellcat.glb"];

// Preload GLTF models using drei's preload
MODELS.forEach((model) => {
  useGLTF.preload(model);
});

export function PreloadManager() {
  useEffect(() => {
    // Register service worker for caching
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered:", registration.scope);
        })
        .catch((error) => {
          console.log("SW registration failed:", error);
        });
    }

    // Preload 3D models into browser cache via link tags
    MODELS.forEach((modelPath) => {
      // Check if already preloaded
      const existing = document.querySelector(`link[href="${modelPath}"]`);
      if (existing) return;

      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "fetch";
      link.href = modelPath;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    });

    // Warm fetch cache
    MODELS.forEach((modelPath) => {
      fetch(modelPath, { cache: "force-cache" }).catch(() => {});
    });
  }, []);

  return null;
}

