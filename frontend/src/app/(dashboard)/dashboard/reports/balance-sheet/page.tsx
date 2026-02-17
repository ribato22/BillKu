"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Wallet, TrendingUp, Package, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

interface BalanceSheetData {
  assets: { cash: number; receivables: number; inventory: number; total: number };
  liabilities: { expenses: number; taxCollected: number; taxFromReceivables: number; total: number };
  equity: number;
  tax: { collected: number; outstanding: number; totalTaxLiability: number };
  invoiceCounts: { paid: number; outstanding: number };
}

export default function BalanceSheetPage() {
  const t = useTranslations("reports.balanceSheet");
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    try {
      setLoading(true);
      const res = await authService.fetchWithAuth("/reports/balance-sheet");
      const json = await res.json();
      setData(json.data || null);
    } catch {
      toast.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number) {
    return `Rp ${Math.abs(amount).toLocaleString("id-ID")}`;
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
        <Button variant="outline" onClick={loadReport}>{t("generateReport")}</Button>
      </div>

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("cash")}</CardTitle>
                <Wallet className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent><div className="text-xl font-bold text-green-600">{formatCurrency(data.assets.cash)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("receivables")}</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-blue-600">{formatCurrency(data.assets.receivables)}</div>
                <p className="text-xs text-muted-foreground mt-1">{data.invoiceCounts.outstanding} invoice</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("inventory")}</CardTitle>
                <Package className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent><div className="text-xl font-bold text-purple-600">{formatCurrency(data.assets.inventory)}</div></CardContent>
            </Card>
            <Card className={data.equity >= 0 ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("equity")}</CardTitle>
                <DollarSign className={`h-4 w-4 ${data.equity >= 0 ? "text-green-500" : "text-red-500"}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-xl font-bold ${data.equity >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {data.equity < 0 && "-"}{formatCurrency(data.equity)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("description")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wider mb-3">{t("assets")}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b">
                    <span>{t("cash")}</span>
                    <span className="font-medium text-green-600">{formatCurrency(data.assets.cash)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>{t("receivables")} ({data.invoiceCounts.outstanding} invoice)</span>
                    <span className="font-medium text-blue-600">{formatCurrency(data.assets.receivables)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span>{t("inventory")}</span>
                    <span className="font-medium text-purple-600">{formatCurrency(data.assets.inventory)}</span>
                  </div>
                  <div className="flex justify-between py-2 font-semibold">
                    <span>{t("totalAssets")}</span>
                    <span className="text-green-700">{formatCurrency(data.assets.total)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-3">{t("liabilities")}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b">
                    <span>{t("currentLiabilities")}</span>
                    <span className="font-medium text-red-600">{formatCurrency(data.liabilities.expenses)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <div>
                      <span>VAT / PPN</span>
                      <p className="text-xs text-muted-foreground">{data.invoiceCounts.paid} invoice</p>
                    </div>
                    <span className="font-medium text-orange-600">{formatCurrency(data.tax.collected)}</span>
                  </div>
                  {data.tax.outstanding > 0 && (
                    <div className="flex justify-between py-2 border-b">
                      <div>
                        <span>{t("payables")}</span>
                        <p className="text-xs text-muted-foreground">{data.invoiceCounts.outstanding} invoice</p>
                      </div>
                      <span className="font-medium text-orange-400">{formatCurrency(data.tax.outstanding)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 font-semibold">
                    <span>{t("totalLiabilities")}</span>
                    <span className="text-red-700">{formatCurrency(data.liabilities.total)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className={`flex justify-between py-3 text-lg font-bold rounded-lg px-3 ${
                data.equity >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}>
                <span>{t("equity").toUpperCase()} ({t("assets")} - {t("liabilities")})</span>
                <span>{data.equity < 0 && "-"}{formatCurrency(data.equity)}</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
