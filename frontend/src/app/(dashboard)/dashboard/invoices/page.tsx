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
  FileText,
  Loader2,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Wallet,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";
import { useAuth } from "@/components/auth-provider";

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  total: number;
  customer?: { id: string; name: string };
  customerId?: string;
}

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "paid":
      return "default";
    case "sent":
      return "secondary";
    case "overdue":
      return "destructive";
    default:
      return "outline";
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export default function InvoicesPage() {
  const t = useTranslations("invoices");
  const tc = useTranslations("common");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    totalAmount: 0,
    paid: 0,
    paidAmount: 0,
    unpaid: 0,
    unpaidAmount: 0,
    overdue: 0,
    overdueAmount: 0,
  });

  const STATUS_LABELS: Record<string, string> = {
    draft: t("statusDraft"),
    sent: t("statusSent"),
    paid: t("statusPaid"),
    overdue: t("statusOverdue"),
    canceled: t("statusCanceled"),
    partial: t("statusPartial"),
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  async function loadData() {
    try {
      setLoading(true);
      const [invoiceRes, dashRes] = await Promise.all([
        authService.fetchWithAuth("/invoices"),
        authService.fetchWithAuth("/reports/dashboard"),
      ]);
      const invoiceData = await invoiceRes.json();
      const allInvoices: InvoiceData[] = invoiceData.data || [];
      setInvoices(allInvoices);

      // Calculate stats from server data
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        const d = dashData.data;
        if (d?.invoices) {
          const paidInvoices = allInvoices.filter((i) => i.status === "paid");
          const unpaidInvoices = allInvoices.filter(
            (i) => i.status !== "paid" && i.status !== "canceled"
          );
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const overdueInvoices = allInvoices.filter(
            (i) =>
              i.status !== "paid" &&
              i.status !== "canceled" &&
              new Date(i.dueDate) < today
          );

          setStats({
            total: allInvoices.length,
            totalAmount: allInvoices.reduce((s, i) => s + Number(i.total), 0),
            paid: paidInvoices.length,
            paidAmount: paidInvoices.reduce((s, i) => s + Number(i.total), 0),
            unpaid: unpaidInvoices.length,
            unpaidAmount: unpaidInvoices.reduce(
              (s, i) => s + Number(i.total),
              0
            ),
            overdue: overdueInvoices.length,
            overdueAmount: overdueInvoices.reduce(
              (s, i) => s + Number(i.total),
              0
            ),
          });
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(query: string) {
    setSearchQuery(query);
  }

  const filteredInvoices = invoices.filter(
    (inv) =>
      !searchQuery ||
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleDelete(invoice: InvoiceData) {
    if (!confirm(t("deleteConfirm", { number: invoice.invoiceNumber }))) return;

    try {
      const res = await authService.fetchWithAuth(`/invoices/${invoice.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed");
      }
      toast.success(t("deleteSuccess"));
      loadData();
    } catch (error) {
      console.error("Failed to delete invoice:", error);
      toast.error(t("deleteError"));
    }
  }

  async function handleMarkPaid(invoice: InvoiceData) {
    try {
      // Call server API directly to update status
      const res = await authService.fetchWithAuth(
        `/invoices/${invoice.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "paid" }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed");
      }
      toast.success(t("markPaidSuccess"));
      loadData();
    } catch (error) {
      console.error("Failed to update invoice:", error);
      toast.error(t("markPaidError"));
    }
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
        <Link href="/dashboard/invoices/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> {t("createInvoice")}
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalInvoice")}
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats.totalAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("paid")}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.paid}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats.paidAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("unpaid")}
            </CardTitle>
            <Wallet className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.unpaid}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats.unpaidAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("overdue")}
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.overdue}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats.overdueAmount)}
            </p>
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
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">
                {t("noInvoices")}
              </h3>
              <p className="text-muted-foreground">
                {t("createFirst")}
              </p>
              <Link href="/dashboard/invoices/new">
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" /> {t("createInvoice")}
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoiceNumber")}</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("issueDate")}</TableHead>
                  <TableHead>{t("dueDate")}</TableHead>
                  <TableHead className="text-right">{tc("total")}</TableHead>
                  <TableHead>{tc("status")}</TableHead>
                  <TableHead className="w-[80px]">{tc("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      {invoice.customer?.name || "-"}
                    </TableCell>
                    <TableCell>
                      {formatDate(invoice.issueDate)}
                    </TableCell>
                    <TableCell>
                      {formatDate(invoice.dueDate)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(invoice.total))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(invoice.status)}>
                        {STATUS_LABELS[invoice.status] || invoice.status}
                      </Badge>
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
                            <Link href={`/dashboard/invoices/${invoice.id}`}>
                              <Eye className="mr-2 h-4 w-4" /> {t("view")}
                            </Link>
                          </DropdownMenuItem>
                          {invoice.status === "draft" && (
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/dashboard/invoices/${invoice.id}/edit`}
                              >
                                <Pencil className="mr-2 h-4 w-4" /> {t("edit")}
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {invoice.status !== "paid" &&
                            invoice.status !== "canceled" && (
                              <DropdownMenuItem
                                onClick={() => handleMarkPaid(invoice)}
                              >
                                <CheckCircle className="mr-2 h-4 w-4" /> {t("markPaid")}
                              </DropdownMenuItem>
                            )}
                          {invoice.status === "draft" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(invoice)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> {tc("delete")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
