"use client";

import { useEffect, useRef } from "react";

export function ServiceWorkerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;

    if (typeof window === "undefined" || !navigator.serviceWorker) {
      return;
    }

    registered.current = true;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        // Listen for updates
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              // New content is available — this will be used on next navigation
              console.warn("[SW] New version available");
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[SW] Registration failed:", err.message);
      });
  }, []);

  return <>{children}</>;
}
