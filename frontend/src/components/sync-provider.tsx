"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { syncService } from "@/lib/db/sync";

interface SyncContextType {
  pendingCount: number;
  isSyncing: boolean;
  isConfigured: boolean;
  isOnline: boolean;
  lastSyncResult: { success: number; failed: number } | null;
  sync: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

interface SyncProviderProps {
  children: React.ReactNode;
  apiBaseUrl?: string;
  getAuthToken?: () => Promise<string | null>;
}

export function SyncProvider({
  children,
  apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "/api/v1",
  getAuthToken,
}: SyncProviderProps) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSyncResult, setLastSyncResult] = useState<{ success: number; failed: number } | null>(null);

  // Configure sync service on mount
  useEffect(() => {
    if (getAuthToken) {
      syncService.configure({
        baseUrl: apiBaseUrl,
        getAuthToken,
      });
      setIsConfigured(true);
    }
  }, [apiBaseUrl, getAuthToken]);

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Refresh pending count
  const refresh = useCallback(async () => {
    try {
      const status = await syncService.getStatus();
      setPendingCount(status.pending);
      setIsSyncing(status.syncing);
      setIsConfigured(status.configured);
    } catch (error) {
      console.error("Failed to refresh sync status:", error);
    }
  }, []);

  // Initial refresh and periodic check
  useEffect(() => {
    refresh();

    // Check every 30 seconds
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Auto-sync when coming online OR when configured with pending items
  useEffect(() => {
    if (isOnline && isConfigured && pendingCount > 0 && !isSyncing) {
      sync();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, isConfigured, pendingCount]);

  // Sync function
  const sync = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await syncService.processQueue();
      setLastSyncResult(result);
      await refresh();
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, refresh]);

  return (
    <SyncContext.Provider
      value={{
        pendingCount,
        isSyncing,
        isConfigured,
        isOnline,
        lastSyncResult,
        sync,
        refresh,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}
