"use client";

import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSync } from "./sync-provider";
import { cn } from "@/lib/utils";

export function SyncIndicator() {
  const { pendingCount, isSyncing, isOnline, lastSyncResult, sync } = useSync();

  const getStatusColor = () => {
    if (!isOnline) return "text-gray-400";
    if (isSyncing) return "text-blue-500";
    if (pendingCount > 0) return "text-yellow-500";
    return "text-green-500";
  };

  const getStatusIcon = () => {
    if (!isOnline) return <CloudOff className="h-4 w-4" />;
    if (isSyncing) return <RefreshCw className="h-4 w-4 animate-spin" />;
    if (pendingCount > 0) return <Cloud className="h-4 w-4" />;
    return <Check className="h-4 w-4" />;
  };

  const getStatusText = () => {
    if (!isOnline) return "Offline";
    if (isSyncing) return "Menyinkronkan...";
    if (pendingCount > 0) return `${pendingCount} belum sync`;
    return "Tersinkron";
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn("gap-2", getStatusColor())}
            onClick={() => sync()}
            disabled={!isOnline || isSyncing || pendingCount === 0}
          >
            {getStatusIcon()}
            <span className="hidden sm:inline text-xs">{getStatusText()}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <p className="font-medium">
              {isOnline ? "Online" : "Offline"} - {getStatusText()}
            </p>
            {pendingCount > 0 && (
              <p className="text-muted-foreground">
                {pendingCount} item menunggu sinkronisasi
              </p>
            )}
            {lastSyncResult && (
              <p className="text-muted-foreground text-xs mt-1">
                Sync terakhir: {lastSyncResult.success} berhasil, {lastSyncResult.failed} gagal
              </p>
            )}
            {!isOnline && (
              <p className="text-yellow-500 flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" />
                Data akan di-sync saat online
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
