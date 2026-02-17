"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

interface ProfitLossData {
  revenue: number;
  totalExpenses: number;
  netProfit: number;
  expenseBreakdown: { category: string; amount: number }[];
  invoiceCount: number;
  taxCollected: number;
  period: { from: string | null; to: string | null };
}

export default function ProfitLossPage() {
  const t = useTranslations("reports.profitLoss");
  const [data, setData] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);

  const CATEGORY_LABELS: Record<string, string> = {
    operational: t("operationalExpenses"),
    material: "Material",
    salary: t("salaryExpenses"),
    utilities: "Utilitas",
    marketing: "Marketing",
    other: t("otherExpenses"),
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadReport() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const res = await authService.fetchWithAuth(`/reports/profit-loss?${params.toString()}`);
      const json = await res.json();
      setData(json.data || null);
    } catch (error) {
      console.error(error);
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>{t("startDate")}</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("endDate")}</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Button onClick={loadReport}>{t("generateReport")}</Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("revenue")}</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(data.revenue)}</div>
                <p className="text-xs text-muted-foreground mt-1">{data.invoiceCount} invoice</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("expenses")}</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(data.totalExpenses)}</div>
              </CardContent>
            </Card>
            <Card className={data.netProfit >= 0 ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("netProfit")}</CardTitle>
                <DollarSign className={`h-4 w-4 ${data.netProfit >= 0 ? "text-green-500" : "text-red-500"}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {data.netProfit < 0 && "-"}{formatCurrency(data.netProfit)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("description")}</CardTitle>
              <CardDescription>
                {t("period")}: {dateFrom ? new Date(dateFrom).toLocaleDateString("id-ID") : "-"} —{" "}
                {dateTo ? new Date(dateTo).toLocaleDateString("id-ID") : "-"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wider mb-2">{t("revenue")}</h3>
                  <div className="flex justify-between py-2 border-b">
                    <span>{t("salesIncome")} ({data.invoiceCount} invoice)</span>
                    <span className="font-medium text-green-600">{formatCurrency(data.revenue)}</span>
                  </div>
                  <div className="flex justify-between py-2 font-semibold">
                    <span>{t("totalRevenue")}</span>
                    <span className="text-green-600">{formatCurrency(data.revenue)}</span>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wider mb-2">{t("expenses")}</h3>
                  {(data.expenseBreakdown || []).length > 0 ? (
                    <>
                      {data.expenseBreakdown.map((cat) => (
                        <div key={cat.category} className="flex justify-between py-2 border-b">
                          <span>{CATEGORY_LABELS[cat.category] || cat.category}</span>
                          <span className="font-medium text-red-600">{formatCurrency(cat.amount)}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">{t("noData")}</p>
                  )}
                  <div className="flex justify-between py-2 font-semibold">
                    <span>{t("totalExpenses")}</span>
                    <span className="text-red-600">{formatCurrency(data.totalExpenses)}</span>
                  </div>
                </div>

                <Separator />

                {data.taxCollected > 0 && (
                  <>
                    <div>
                      <h3 className="text-sm font-semibold text-amber-700 uppercase tracking-wider mb-2">Tax</h3>
                      <div className="flex justify-between py-2 border-b">
                        <span>VAT / PPN</span>
                        <span className="font-medium text-amber-600">{formatCurrency(data.taxCollected)}</span>
                      </div>
                    </div>

                    <Separator />
                  </>
                )}

                <div className={`flex justify-between py-3 text-lg font-bold rounded-lg px-3 ${
                  data.netProfit >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}>
                  <span>{t("netProfit").toUpperCase()}</span>
                  <span>{data.netProfit < 0 && "-"}{formatCurrency(data.netProfit)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
