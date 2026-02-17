"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  CreditCard,
  Loader2,
  MoreHorizontal,
  Eye,
  Trash2,
  TrendingUp,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { paymentService } from "@/lib/db/payments";
import { invoiceService } from "@/lib/db/invoices";
import { authService } from "@/lib/auth";
import type { Payment, Invoice } from "@/lib/db";

export default function PaymentsPage() {
  const t = useTranslations("payments");
  const tc = useTranslations("common");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Map<string, Invoice>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    totalAmount: 0,
    thisMonth: 0,
    thisMonthAmount: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      // Try backend API first
      try {
        const [paymentsRes, invoicesRes] = await Promise.all([
          authService.fetchWithAuth('/payments'),
          authService.fetchWithAuth('/invoices?status=sent&status=partial&status=draft&status=paid'),
        ]);

        if (paymentsRes.ok && invoicesRes.ok) {
          const paymentsJson = await paymentsRes.json();
          const invoicesJson = await invoicesRes.json();
          const paymentsRaw = paymentsJson.data || [];
          const invoicesData = invoicesJson.data || [];

          // Map API fields to frontend Payment interface
          const paymentsData = paymentsRaw.map((p: Record<string, unknown>) => ({
            ...p,
            paymentDate: p.paymentDate || p.date || p.createdAt,
            paymentMethod: p.paymentMethod || p.method || 'other',
            notes: p.notes || p.note || '',
          }));

          setPayments(paymentsData);

          // Calculate stats from API data
          const now = new Date();
          const thisMonthPayments = paymentsData.filter((p: Record<string, unknown>) => {
            const dateVal = p.paymentDate || p.date || p.createdAt;
            if (!dateVal) return false;
            const d = new Date(dateVal as string);
            if (isNaN(d.getTime())) return false;
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          });
          setStats({
            total: paymentsData.length,
            totalAmount: paymentsData.reduce((s: number, p: Record<string, unknown>) => s + Number(p.amount), 0),
            thisMonth: thisMonthPayments.length,
            thisMonthAmount: thisMonthPayments.reduce((s: number, p: Record<string, unknown>) => s + Number(p.amount), 0),
          });

          const invoiceMap = new Map<string, Invoice>();
          invoicesData.forEach((inv: Invoice) => invoiceMap.set(inv.id!, inv));
          setInvoices(invoiceMap);
          return; // success — done
        }
      } catch {
        console.warn('Backend API unavailable, falling back to Dexie');
      }

      // Fallback to Dexie (offline)
      const [paymentsData, invoicesData, statsData] = await Promise.all([
        paymentService.getAll(),
        invoiceService.getAll(),
        paymentService.getStats(),
      ]);

      setPayments(paymentsData);
      setStats(statsData);

      const invoiceMap = new Map<string, Invoice>();
      invoicesData.forEach((inv) => invoiceMap.set(inv.id!, inv));
      setInvoices(invoiceMap);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.trim()) {
      const allPayments = await paymentService.getAll();
      const filtered = allPayments.filter((p) => {
        const invoice = invoices.get(p.invoiceId);
        return invoice?.invoiceNumber.toLowerCase().includes(query.toLowerCase());
      });
      setPayments(filtered);
    } else {
      const data = await paymentService.getAll();
      setPayments(data);
    }
  }

  async function handleDelete(payment: Payment) {
    const invoice = invoices.get(payment.invoiceId);
    if (
      !confirm(
        t("deleteConfirm", { amount: paymentService.formatCurrency(payment.amount), invoice: invoice?.invoiceNumber || "invoice" })
      )
    )
      return;

    try {
      await paymentService.delete(payment.id!);
      toast.success(t("deleteSuccess"));
      loadData();
    } catch (error) {
      console.error("Failed to delete payment:", error);
      toast.error(t("deleteError"));
    }
  }

  function getMethodBadge(method: Payment["paymentMethod"]) {
    const styles: Record<string, "default" | "secondary" | "outline"> = {
      cash: "default",
      transfer: "secondary",
      qris: "outline",
      other: "outline",
    };
    return (
      <Badge variant={styles[method] || "outline"}>
        {paymentService.getMethodLabel(method)}
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Link href="/dashboard/payments/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> {t("addPayment")}
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalPayments")}
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {paymentService.formatCurrency(stats.totalAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("thisMonth")}
            </CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.thisMonth}
            </div>
            <p className="text-xs text-muted-foreground">
              {paymentService.formatCurrency(stats.thisMonthAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("average")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {paymentService.formatCurrency(
                stats.total > 0 ? Math.round(stats.totalAmount / stats.total) : 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("perTransaction")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("avgThisMonth")}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {paymentService.formatCurrency(
                stats.thisMonth > 0
                  ? Math.round(stats.thisMonthAmount / stats.thisMonth)
                  : 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("perTransaction")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          className="pl-10"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                {t("noPayments")}
              </h3>
              <p className="text-muted-foreground">
                {t("addFirst")}
              </p>
              <Link href="/dashboard/payments/new">
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" /> {t("addPayment")}
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoiceNumber")}</TableHead>
                  <TableHead>{t("paymentDate")}</TableHead>
                  <TableHead>{t("method")}</TableHead>
                  <TableHead className="text-right">{tc("amount")}</TableHead>
                  <TableHead>{tc("notes")}</TableHead>
                  <TableHead className="w-[80px]">{tc("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => {
                  const invoice = invoices.get(payment.invoiceId);
                  return (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/invoices/${payment.invoiceId}`}
                          className="hover:underline text-primary"
                        >
                          {invoice?.invoiceNumber || "—"}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {paymentService.formatDate(payment.paymentDate)}
                      </TableCell>
                      <TableCell>{getMethodBadge(payment.paymentMethod)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {paymentService.formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {payment.notes || "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/invoices/${payment.invoiceId}`}>
                                <Eye className="mr-2 h-4 w-4" /> {t("viewInvoice")}
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(payment)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> {tc("delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
