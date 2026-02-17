"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, MessageCircle, QrCode, Wifi, WifiOff, Phone, CheckCircle, XCircle, Info } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

export default function WhatsAppSettingsPage() {
  const t = useTranslations("settings.whatsapp");
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [status, setStatus] = useState<{
    connected: boolean;
    phoneNumber?: string;
    provider?: string;
    qrCode?: string;
  }>({ connected: false });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await authService.fetchWithAuth("/whatsapp/status");
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setStatus({
          connected: data.connected || data.status === "connected",
          phoneNumber: data.phoneNumber || data.phone,
          provider: data.provider || "whatsapp-web.js",
        });
        if (data.connected || data.status === "connected") {
          setQrCode(null);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [loadStatus]);

  async function handleConnect() {
    try {
      setConnecting(true);
      const res = await authService.fetchWithAuth("/whatsapp/connect", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.qrCode || json.qrCode) {
          setQrCode(json.data?.qrCode || json.qrCode);
          toast.info(t("scanQrTitle"), { description: t("scanQrDesc") });
          // Start polling for status
          pollingRef.current = setInterval(loadStatus, 5000);
        } else if (json.data?.connected) {
          setStatus((prev) => ({ ...prev, connected: true }));
          toast.success(t("connectedTitle"), { description: t("connectedDesc") });
        }
      } else {
        toast.error(t("connectFailedTitle"), { description: t("connectFailedDesc") });
      }
    } catch {
      toast.error(t("connectFailedTitle"), { description: t("connectFailedDesc") });
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      setDisconnecting(true);
      const res = await authService.fetchWithAuth("/whatsapp/disconnect", { method: "POST" });
      if (res.ok) {
        setStatus({ connected: false });
        setQrCode(null);
        toast.success(t("disconnectedTitle"), { description: t("disconnectedDesc") });
      } else {
        toast.error(t("disconnectFailedTitle"), { description: t("disconnectFailedDesc") });
      }
    } catch {
      toast.error(t("disconnectFailedTitle"), { description: t("disconnectFailedDesc") });
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status.connected ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
            {t("connectionStatus")}
          </CardTitle>
          <CardDescription>{t("connectionStatusDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t("status")}:</span>
                <Badge variant={status.connected ? "default" : "destructive"}>
                  {status.connected ? (
                    <><CheckCircle className="h-3 w-3 mr-1" />{t("connected")}</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" />{t("notConnected")}</>
                  )}
                </Badge>
              </div>
              {status.connected && status.phoneNumber && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {status.phoneNumber}
                </p>
              )}
            </div>
            {status.connected ? (
              <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <WifiOff className="mr-2 h-4 w-4" />}
                {disconnecting ? t("disconnecting") : t("disconnect")}
              </Button>
            ) : (
              <Button onClick={handleConnect} disabled={connecting}>
                {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
                {connecting ? t("connecting") : t("connect")}
              </Button>
            )}
          </div>

          {status.connected && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
              <p className="font-medium">{t("whatsappConnected")}</p>
              <p>{t("canSendReminders")}</p>
            </div>
          )}

          {!status.connected && !qrCode && (
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p>{t("clickConnect")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {qrCode && !status.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" /> {t("qrCode")}
            </CardTitle>
            <CardDescription>{t("qrCodeDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 border rounded-lg" />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>{t("scanInstructions1")}</p>
              <p>{t("scanInstructions2")}</p>
              <p>{t("scanInstructions3")}</p>
              <p>{t("scanInstructions4")}</p>
            </div>
            <p className="text-xs text-center text-muted-foreground">{t("qrAutoUpdate")}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" /> {t("howToUse")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">1</div>
              <div>
                <p className="font-medium">{t("step1Title")}</p>
                <p className="text-sm text-muted-foreground">{t("step1Desc")}</p>
              </div>
            </div>
            <Separator />
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">2</div>
              <div>
                <p className="font-medium">{t("step2Title")}</p>
                <p className="text-sm text-muted-foreground">{t("step2Desc")}</p>
              </div>
            </div>
            <Separator />
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">3</div>
              <div>
                <p className="font-medium">{t("step3Title")}</p>
                <p className="text-sm text-muted-foreground">{t("step3Desc")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
