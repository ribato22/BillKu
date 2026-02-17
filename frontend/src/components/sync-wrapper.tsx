"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import { SyncProvider } from "./sync-provider";
import { authService } from "@/lib/auth";
import { syncService } from "@/lib/db/sync";

interface SyncWrapperProps {
  children: ReactNode;
}

/**
 * Wrapper that connects SyncProvider with auth service
 * Should be used inside AuthProvider
 */
export function SyncWrapper({ children }: SyncWrapperProps) {
  const [, setMappingsPopulated] = useState(false);
  const hasPopulated = useRef(false);

  // Populate ID mappings when auth becomes available
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 10;
    let timeoutId: NodeJS.Timeout;

    const tryPopulateMappings = async () => {
      // Only try once successfully
      if (hasPopulated.current) return;
      
      const token = authService.getAccessToken();
      
      if (token && syncService.isConfigured()) {
        try {
          const result = await syncService.populateIdMappings();
          console.log('ID mappings populated:', result);
          setMappingsPopulated(true);
          hasPopulated.current = true;
        } catch (error) {
          console.error('Failed to populate ID mappings:', error);
        }
      } else if (retryCount < maxRetries) {
        // Token not available yet, retry after delay
        retryCount++;
        timeoutId = setTimeout(tryPopulateMappings, 3000);
      }
    };

    // Start checking after initial delay
    timeoutId = setTimeout(tryPopulateMappings, 2000);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <SyncProvider
      apiBaseUrl={process.env.NEXT_PUBLIC_API_URL || "/api/v1"}
      getAuthToken={async () => authService.getAccessToken()}
    >
      {children}
    </SyncProvider>
  );
}
