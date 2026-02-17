"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Loader2, Plus, Settings2, CheckCircle, XCircle, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

interface GatewayConfig {
  id?: string;
  provider: string;
  isActive: boolean;
  config: Record<string, string>;
}

const PROVIDERS = [
  { id: "midtrans", name: "Midtrans", description: "Popular payment gateway in Indonesia" },
  { id: "xendit", name: "Xendit", description: "Modern payment gateway for Southeast Asia" },
];

export default function PaymentGatewayPage() {
  const t = useTranslations("settings.paymentGateway");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gateways, setGateways] = useState<GatewayConfig[]>([]);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadGateways();
  }, []);

  async function loadGateways() {
    try {
      const res = await authService.fetchWithAuth("/settings/payment-gateways");
      if (res.ok) {
        const json = await res.json();
        setGateways(json.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(gateway: GatewayConfig) {
    try {
      setSaving(true);
      const method = gateway.id ? "PUT" : "POST";
      const url = gateway.id
        ? `/settings/payment-gateways/${gateway.id}`
        : "/settings/payment-gateways";

      const res = await authService.fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gateway),
      });
      if (res.ok) {
        toast.success(t("saveSuccess"));
        loadGateways();
      } else {
        toast.error(t("saveError"));
      }
    } catch {
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(gatewayId: string) {
    try {
      const res = await authService.fetchWithAuth(`/settings/payment-gateways/${gatewayId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(t("deleteSuccess"));
        setGateways((prev) => prev.filter((g) => g.id !== gatewayId));
      } else {
        toast.error(t("deleteError"));
      }
    } catch {
      toast.error(t("deleteError"));
    }
  }

  function addNewGateway(provider: string) {
    const existing = gateways.find((g) => g.provider === provider);
    if (existing) {
      toast.error(t("alreadyAdded"));
      return;
    }
    setGateways((prev) => [...prev, { provider, isActive: false, config: {} }]);
  }

  function updateGatewayConfig(index: number, field: string, value: string | boolean) {
    setGateways((prev) => {
      const updated = [...prev];
      if (field === "isActive") {
        updated[index] = { ...updated[index], isActive: value as boolean };
      } else {
        updated[index] = {
          ...updated[index],
          config: { ...updated[index].config, [field]: value as string },
        };
      }
      return updated;
    });
  }

  function toggleSecret(key: string) {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {gateways.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("noGateways")}</h3>
            <p className="text-muted-foreground mb-4">{t("addGatewayHint")}</p>
          </CardContent>
        </Card>
      )}

      {gateways.map((gateway, index) => {
        const providerInfo = PROVIDERS.find((p) => p.id === gateway.provider);
        return (
          <Card key={gateway.id || gateway.provider}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {providerInfo?.name || gateway.provider}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={gateway.isActive ? "default" : "secondary"}>
                    {gateway.isActive ? (
                      <><CheckCircle className="h-3 w-3 mr-1" />{t("active")}</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" />{t("inactive")}</>
                    )}
                  </Badge>
                  <Switch checked={gateway.isActive} onCheckedChange={(v) => updateGatewayConfig(index, "isActive", v)} />
                </div>
              </div>
              <CardDescription>{providerInfo?.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {gateway.provider === "midtrans" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t("serverKey")}</Label>
                      <div className="flex gap-2">
                        <Input
                          type={showSecrets[`${index}-server`] ? "text" : "password"}
                          value={gateway.config.serverKey || ""}
                          onChange={(e) => updateGatewayConfig(index, "serverKey", e.target.value)}
                          placeholder="SB-Mid-server-xxx"
                        />
                        <Button variant="ghost" size="icon" onClick={() => toggleSecret(`${index}-server`)}>
                          {showSecrets[`${index}-server`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("clientKey")}</Label>
                      <Input
                        value={gateway.config.clientKey || ""}
                        onChange={(e) => updateGatewayConfig(index, "clientKey", e.target.value)}
                        placeholder="SB-Mid-client-xxx"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Environment</Label>
                    <Select value={gateway.config.environment || "sandbox"} onValueChange={(v) => updateGatewayConfig(index, "environment", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox ({t("testing")})</SelectItem>
                        <SelectItem value="production">Production ({t("live")})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {gateway.provider === "xendit" && (
                <>
                  <div className="space-y-2">
                    <Label>{t("apiKey")}</Label>
                    <div className="flex gap-2">
                      <Input
                        type={showSecrets[`${index}-api`] ? "text" : "password"}
                        value={gateway.config.apiKey || ""}
                        onChange={(e) => updateGatewayConfig(index, "apiKey", e.target.value)}
                        placeholder="xnd_development_xxx"
                      />
                      <Button variant="ghost" size="icon" onClick={() => toggleSecret(`${index}-api`)}>
                        {showSecrets[`${index}-api`] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("webhookToken")}</Label>
                    <Input
                      value={gateway.config.webhookToken || ""}
                      onChange={(e) => updateGatewayConfig(index, "webhookToken", e.target.value)}
                      placeholder={t("webhookTokenPlaceholder")}
                    />
                  </div>
                </>
              )}

              <Separator />

              <div className="flex justify-between">
                {gateway.id && (
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(gateway.id!)}>
                    <Trash2 className="mr-2 h-4 w-4" /> {t("deleteGateway")}
                  </Button>
                )}
                <Button onClick={() => handleSave(gateway)} disabled={saving} className="ml-auto">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings2 className="mr-2 h-4 w-4" />}
                  {t("saveConfig")}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" /> {t("addGateway")}
          </CardTitle>
          <CardDescription>{t("addGatewayDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROVIDERS.map((provider) => {
              const alreadyAdded = gateways.some((g) => g.provider === provider.id);
              return (
                <div
                  key={provider.id}
                  className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                    alreadyAdded ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-muted/50"
                  }`}
                  onClick={() => !alreadyAdded && addNewGateway(provider.id)}
                >
                  <CreditCard className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{provider.name}</p>
                    <p className="text-xs text-muted-foreground">{provider.description}</p>
                  </div>
                  {alreadyAdded && <Badge variant="outline" className="ml-auto">{t("added")}</Badge>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
