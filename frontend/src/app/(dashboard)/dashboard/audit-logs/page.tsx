"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ScrollText, Filter } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";
import { useAuth } from "@/components/auth-provider";
import { useTranslations } from "next-intl";

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
  user?: { name?: string; email?: string };
}

const ACTION_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
  login: "outline",
  export: "outline",
};

export default function AuditLogsPage() {
  const t = useTranslations('auditLogs');
  const tc = useTranslations('common');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [resourceFilter, setResourceFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const pageSize = 20;

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      loadLogs();
    }
  }, [authLoading, isAuthenticated, page, resourceFilter, actionFilter, dateFrom, dateTo]);

  async function loadLogs() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pageSize));
      if (resourceFilter !== "all") params.set("resource", resourceFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const res = await authService.fetchWithAuth(`/audit-logs?${params.toString()}`);
      const data = await res.json();
      setLogs(data.data?.logs || data.data || []);
      setTotal(data.data?.total || 0);
    } catch (error) {
      console.error(error);
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('total', { count: total })}</CardTitle>
            <ScrollText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{total}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" /> {tc('filter')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={resourceFilter} onValueChange={(v) => { setResourceFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Resource" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allActions')}</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="customer">{tc('customer')}</SelectItem>
                <SelectItem value="product">{tc('product')}</SelectItem>
                <SelectItem value="quotation">{tc('quotation')}</SelectItem>
                <SelectItem value="expense">{tc('expense')}</SelectItem>
                <SelectItem value="payment">{tc('payment')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder={t('filterAction')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allActions')}</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="export">Export</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="w-[160px]" value={dateFrom} placeholder="Dari"
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
            <Input type="date" className="w-[160px]" value={dateTo} placeholder="Sampai"
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ScrollText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">{t('noLogs')}</h3>
              <p className="text-muted-foreground">{t('noLogsDesc')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dateTimeColumn')}</TableHead>
                  <TableHead>{t('userColumn')}</TableHead>
                  <TableHead>{t('actionColumn')}</TableHead>
                  <TableHead>{t('resourceColumn')}</TableHead>
                  <TableHead>{t('detailsColumn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.user?.name || log.user?.email || log.userId?.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ACTION_COLORS[log.action] || "secondary"}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{log.resource}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {log.resourceId && <span>ID: {log.resourceId.slice(0, 12)}...</span>}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <span className="ml-2">{JSON.stringify(log.metadata).slice(0, 60)}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {tc('page')} {page} / {totalPages} ({total} {tc('total')})
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1}
              onClick={() => setPage(page - 1)}>{tc('previous')}</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}>{tc('next')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
