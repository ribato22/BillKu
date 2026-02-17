"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Coins, Loader2, Check, Globe } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

interface Currency {
  code: string;
  name: string;
  symbol: string;
  minorUnit: number;
}

const POPULAR_CURRENCIES: Currency[] = [
  { code: "IDR", name: "Rupiah Indonesia", symbol: "Rp", minorUnit: 0 },
  { code: "USD", name: "US Dollar", symbol: "$", minorUnit: 2 },
  { code: "EUR", name: "Euro", symbol: "€", minorUnit: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", minorUnit: 2 },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", minorUnit: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", minorUnit: 0 },
  { code: "GBP", name: "British Pound", symbol: "£", minorUnit: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", minorUnit: 2 },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", minorUnit: 2 },
  { code: "THB", name: "Thai Baht", symbol: "฿", minorUnit: 2 },
];

export default function CurrencySettingsPage() {
  const t = useTranslations("settings.currency");
  const [loading, setLoading] = useState(true);
  const [currentCurrency, setCurrentCurrency] = useState("IDR");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const res = await authService.fetchWithAuth("/business");
      if (res.ok) {
        const data = await res.json();
        const biz = data.data || data;
        setCurrentCurrency(biz.defaultCurrencyCode || "IDR");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const res = await authService.fetchWithAuth("/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultCurrencyCode: currentCurrency }),
      });
      if (res.ok) {
        toast.success(t("saveSuccess"));
      } else {
        throw new Error();
      }
    } catch {
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  const selected = POPULAR_CURRENCIES.find((c) => c.code === currentCurrency);

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
            <Globe className="h-5 w-5" /> {t("defaultCurrency")}
          </CardTitle>
          <CardDescription>
            {t("defaultCurrencyDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={currentCurrency} onValueChange={setCurrentCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POPULAR_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span className="flex items-center gap-2">
                    <span className="font-mono font-bold w-8">{c.symbol}</span>
                    <span>{c.code}</span>
                    <span className="text-muted-foreground">— {c.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selected && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("code")}</span>
                  <Badge variant="outline">{selected.code}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("symbol")}</span>
                  <span className="font-mono font-bold">{selected.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Decimal</span>
                  <span>{selected.minorUnit} digit</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Example</span>
                  <span className="font-mono">
                    {selected.symbol} {selected.minorUnit > 0 ? "1,234.56" : "1.234.567"}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            {t("selectCurrency")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" /> {t("selectCurrency")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {POPULAR_CURRENCIES.map((c) => (
              <div key={c.code}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                  ${currentCurrency === c.code ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                onClick={() => setCurrentCurrency(c.code)}>
                <span className="text-xl font-mono font-bold w-8 text-center">{c.symbol}</span>
                <div className="flex-1">
                  <p className="font-medium text-sm">{c.code}</p>
                  <p className="text-xs text-muted-foreground">{c.name}</p>
                </div>
                {currentCurrency === c.code && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
