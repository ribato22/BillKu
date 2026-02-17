"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Users,
  Wallet,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { authService } from "@/lib/auth";
import { useAuth } from "@/components/auth-provider";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// Types
interface DashboardData {
  invoices: {
    total: number;
    draft: number;
    sent: number;
    partial: number;
    paid: number;
    overdue: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    outstanding: number;
  };
  customers: {
    total: number;
  };
}

interface ChartData {
  monthlyRevenue: {
    month: string;
    revenue: number;
    invoiceCount: number;
    paidCount: number;
  }[];
  statusDistribution: {
    draft: number;
    sent: number;
    partial: number;
    paid: number;
  };
  topDebtors: {
    id: string;
    name: string;
    total: number;
  }[];
}

interface RecentInvoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  total: number;
  status: string;
  dueDate: string;
}

// Color constants
const STATUS_COLORS = {
  draft: "#94a3b8",
  sent: "#3b82f6",
  partial: "#f59e0b",
  paid: "#22c55e",
};

// STATUS_LABELS moved into component to use translations

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)} rb`;
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatFullCurrency(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function getStatusColor(status: string) {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "sent":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "partial":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "draft":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function isOverdue(status: string, dueDate: string): boolean {
  return (
    (status === "sent" || status === "partial") &&
    new Date(dueDate) < new Date()
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const STATUS_LABELS: Record<string, string> = {
    draft: t("statusDraft"),
    sent: t("statusSent"),
    partial: t("statusPartial"),
    paid: t("statusPaid"),
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashRes, chartRes, recentRes] = await Promise.all([
        authService.fetchWithAuth("/reports/dashboard"),
        authService.fetchWithAuth("/reports/chart-data?months=6"),
        authService.fetchWithAuth("/reports/recent-invoices?limit=5"),
      ]);

      if (dashRes.ok) {
        const d = await dashRes.json();
        setDashboard(d.data);
      }
      if (chartRes.ok) {
        const c = await chartRes.json();
        setChartData(c.data);
      }
      if (recentRes.ok) {
        const r = await recentRes.json();
        setRecentInvoices(r.data);
      }
    } catch (err) {
      setError(t("loadError"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch when auth is resolved and user is authenticated
    if (!authLoading && isAuthenticated) {
      fetchData();
    }
  }, [authLoading, isAuthenticated]);

  const stats = dashboard
    ? [
        {
          title: t("totalInvoice"),
          value: dashboard.invoices.total.toString(),
          icon: FileText,
          color: "text-blue-600",
          bg: "bg-blue-50 dark:bg-blue-900/20",
        },
        {
          title: t("totalCustomers"),
          value: dashboard.customers.total.toString(),
          icon: Users,
          color: "text-violet-600",
          bg: "bg-violet-50 dark:bg-violet-900/20",
        },
        {
          title: t("revenueThisMonth"),
          value: formatCurrency(dashboard.revenue.thisMonth),
          subtitle: t("totalRevenue", { amount: formatCurrency(dashboard.revenue.total) }),
          icon: TrendingUp,
          color: "text-green-600",
          bg: "bg-green-50 dark:bg-green-900/20",
        },
        {
          title: t("outstandingReceivables"),
          value: formatCurrency(dashboard.revenue.outstanding),
          subtitle: dashboard.invoices.overdue > 0
            ? t("overdueCount", { count: dashboard.invoices.overdue })
            : t("noOverdue"),
          subtitleColor: dashboard.invoices.overdue > 0 ? "text-red-500" : "text-green-500",
          icon: dashboard.invoices.overdue > 0 ? AlertTriangle : Wallet,
          color: dashboard.invoices.overdue > 0 ? "text-red-600" : "text-emerald-600",
          bg: dashboard.invoices.overdue > 0
            ? "bg-red-50 dark:bg-red-900/20"
            : "bg-emerald-50 dark:bg-emerald-900/20",
        },
      ]
    : [];

  // Pie chart data
  const pieData = chartData
    ? Object.entries(chartData.statusDistribution)
        .filter(([, v]) => v > 0)
        .map(([key, value]) => ({
          name: STATUS_LABELS[key] || key,
          value,
          color: STATUS_COLORS[key as keyof typeof STATUS_COLORS],
        }))
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500">{error}</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
        >
          {tc("tryAgain")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("welcome")}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg hover:bg-muted transition"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              {stat.subtitle && (
                <p className={`text-xs mt-1 ${stat.subtitleColor || "text-muted-foreground"}`}>
                  {stat.subtitle}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart (2/3 width) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center gap-2">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{t("revenueTrend")}</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData && chartData.monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData.monthlyRevenue}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey="month"
                    className="text-xs"
                    tick={{ fill: "currentColor", fontSize: 12 }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: "currentColor", fontSize: 12 }}
                    tickFormatter={(v) => formatCurrency(v)}
                  />
                  <Tooltip
                    formatter={(value: number | undefined) => [
                      formatFullCurrency(value ?? 0),
                      "Revenue",
                    ]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {t("noRevenueData")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution Pie (1/3 width) */}
        <Card>
          <CardHeader>
            <CardTitle>{t("invoiceStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                {t("noInvoices")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Recent Invoices + Top Debtors */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>{t("recentInvoices")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentInvoices.length > 0 ? (
              <div className="space-y-4">
                {recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-sm">
                        {invoice.invoiceNumber}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.customer}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-medium text-sm">
                        {formatFullCurrency(invoice.total)}
                      </p>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          isOverdue(invoice.status, invoice.dueDate)
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : getStatusColor(invoice.status)
                        }`}
                      >
                        {isOverdue(invoice.status, invoice.dueDate)
                          ? t("overdue")
                          : STATUS_LABELS[invoice.status] || invoice.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {t("noInvoices")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Debtors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              {t("topDebtors")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData && chartData.topDebtors.length > 0 ? (
              <div className="space-y-4">
                {chartData.topDebtors.map((debtor, index) => (
                  <div
                    key={debtor.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 text-sm font-bold">
                        {index + 1}
                      </span>
                      <span className="font-medium text-sm">{debtor.name}</span>
                    </div>
                    <span className="font-semibold text-sm text-red-600">
                      {formatCurrency(debtor.total)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {t("noOutstandingDebt")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
