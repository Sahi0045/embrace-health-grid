import { useEffect, useState, type ReactNode } from "react";
import { initializeStore } from "@/lib/realtime-store";

export function AppInitializer({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initializeStore()
      .then(() => {
        setIsReady(true);
      })
      .catch((err) => {
        console.error("[AppInitializer] Init failed:", err);
      });
  }, []);

  if (!isReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            Initializing Embrace Health Grid...
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
