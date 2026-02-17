"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  TrendingUp,
  AlertTriangle,
  Clock,
  Users,
  FileText,
  ArrowRight,
} from "lucide-react";
import {
  receivablesService,
  type AgingBucket,
  type CustomerReceivable,
  type ReceivablesSummary,
} from "@/lib/db/receivables";
import { paymentService } from "@/lib/db/payments";

export default function ReceivablesPage() {
  const t = useTranslations("receivables");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ReceivablesSummary | null>(null);
  const [agingBuckets, setAgingBuckets] = useState<AgingBucket[]>([]);
  const [topDebtors, setTopDebtors] = useState<CustomerReceivable[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [summaryData, bucketsData, debtorsData] = await Promise.all([
        receivablesService.getSummary(),
        receivablesService.getAgingBuckets(),
        receivablesService.getTopDebtors(5),
      ]);

      setSummary(summaryData);
      setAgingBuckets(bucketsData);
      setTopDebtors(debtorsData);
    } catch (error) {
      console.error("Failed to load receivables data:", error);
    } finally {
      setLoading(false);
    }
  }

  function getBucketColor(index: number): string {
    const colors = [
      "bg-green-500",
      "bg-yellow-500",
      "bg-orange-500",
      "bg-red-500",
      "bg-red-700",
    ];
    return colors[index] || "bg-gray-500";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const overduePercent =
    summary && summary.totalOutstanding > 0
      ? (summary.totalOverdue / summary.totalOutstanding) * 100
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalReceivables")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {receivablesService.formatCurrency(summary?.totalOutstanding || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("unpaidInvoices", { count: summary?.invoiceCount || 0 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("overdue")}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {receivablesService.formatCurrency(summary?.totalOverdue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("overdueInvoices", { count: summary?.overdueCount || 0 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("notYetDue")}
            </CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {receivablesService.formatCurrency(summary?.totalCurrent || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {receivablesService.formatPercent(
                summary?.totalCurrent || 0,
                summary?.totalOutstanding || 0
              )}{" "}
              {t("ofTotal")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("customers")}
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary?.customerCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("hasActiveReceivables")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Progress */}
      {summary && summary.totalOutstanding > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("overdueRatio")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("overdueOf", {
                  overdue: receivablesService.formatCurrency(summary.totalOverdue),
                  total: receivablesService.formatCurrency(summary.totalOutstanding),
                })}
              </span>
              <span className="font-medium">
                {t("percentOverdue", { percent: Math.round(overduePercent) })}
              </span>
            </div>
            <Progress
              value={overduePercent}
              className="h-2"
            />
            {overduePercent > 50 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {t("overdueWarning")}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aging Buckets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t("agingReport")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agingBuckets.map((bucket, index) => {
                const percent =
                  summary && summary.totalOutstanding > 0
                    ? (bucket.amount / summary.totalOutstanding) * 100
                    : 0;

                return (
                  <div key={bucket.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-full ${getBucketColor(index)}`}
                        />
                        {bucket.label}
                      </span>
                      <span className="font-medium">
                        {receivablesService.formatCurrency(bucket.amount)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full ${getBucketColor(index)}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {bucket.count} inv
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Debtors */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("topDebtors")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topDebtors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("noReceivables")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("customerColumn")}</TableHead>
                    <TableHead className="text-right">{t("receivableColumn")}</TableHead>
                    <TableHead className="text-center">{t("invColumn")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topDebtors.map((debtor) => (
                    <TableRow key={debtor.customerId}>
                      <TableCell className="font-medium">
                        {debtor.customerName}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium text-orange-600">
                          {paymentService.formatCurrency(debtor.remainingAmount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{debtor.invoiceCount}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("quickActions")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/invoices?status=sent">
              <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                {t("unpaidInvoicesButton")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard/payments/new">
              <Button>{t("recordPayment")}</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
