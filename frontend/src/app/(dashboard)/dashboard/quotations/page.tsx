"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Trash2, FileCheck, ArrowRightLeft, Loader2,
  MoreHorizontal, Send, CheckCircle2, XCircle, Clock,
  Search, FileText, DollarSign, TrendingUp, Mail, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";
import { useAuth } from "@/components/auth-provider";
import { useTranslations } from "next-intl";

interface QuotationItem {
  description: string;
  qty: number;
  unitPrice: number;
  productId?: string;
}

interface Quotation {
  id: string;
  quotationNumber: string;
  status: string;
  issueDate: string;
  validUntil: string;
  notes?: string;
  currencyCode: string;
  customer: { id: string; name: string; email?: string; phone?: string };
  items: QuotationItem[];
  createdAt: string;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  border: string;
  icon: typeof FileText;
}> = {
  draft: {
    label: "statusDraft",
    color: "text-gray-700 dark:text-gray-300",
    bg: "bg-gray-100 dark:bg-gray-800",
    border: "border-gray-200 dark:border-gray-700",
    icon: FileText,
  },
  sent: {
    label: "statusSent",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    border: "border-blue-200 dark:border-blue-700",
    icon: Send,
  },
  accepted: {
    label: "statusAccepted",
    color: "text-green-700 dark:text-green-300",
    bg: "bg-green-100 dark:bg-green-900/30",
    border: "border-green-200 dark:border-green-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "statusRejected",
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-100 dark:bg-red-900/30",
    border: "border-red-200 dark:border-red-700",
    icon: XCircle,
  },
  converted: {
    label: "statusConverted",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    border: "border-purple-200 dark:border-purple-700",
    icon: ArrowRightLeft,
  },
};

function isExpired(validUntil: string, status: string): boolean {
  return (
    !["converted", "rejected"].includes(status) &&
    new Date(validUntil) < new Date()
  );
}

export default function QuotationsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const t = useTranslations('quotations');
  const tc = useTranslations('common');
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendingQuotation, setSendingQuotation] = useState<Quotation | null>(null);
  const [formData, setFormData] = useState({
    customerId: "",
    issueDate: new Date().toISOString().split("T")[0],
    validUntil: "",
    notes: "",
    items: [{ description: "", qty: 1, unitPrice: 0 }] as QuotationItem[],
  });

  useEffect(() => {
    if (!authLoading && isAuthenticated) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  async function loadData() {
    try {
      setLoading(true);
      const [qRes, cRes, pRes] = await Promise.all([
        authService.fetchWithAuth("/quotations"),
        authService.fetchWithAuth("/customers"),
        authService.fetchWithAuth("/products"),
      ]);
      const qData = await qRes.json();
      const cData = await cRes.json();
      const pData = await pRes.json();
      setQuotations(qData.data || []);
      setCustomers(cData.data || cData.data?.customers || []);
      // Deduplicate products by name (DB may have duplicates with different IDs)
      const rawProducts = pData.data || [];
      const seenNames = new Set<string>();
      const uniqueProducts = rawProducts.filter((p: Product) => {
        if (seenNames.has(p.name)) return false;
        seenNames.add(p.name);
        return true;
      });
      setProducts(uniqueProducts);
    } catch (error) {
      console.error("Failed to load:", error);
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setFormData({
      customerId: "",
      issueDate: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      notes: "",
      items: [{ description: "", qty: 1, unitPrice: 0 }],
    });
    setIsDialogOpen(true);
  }

  function addItem() {
    setFormData({
      ...formData,
      items: [...formData.items, { description: "", qty: 1, unitPrice: 0 }],
    });
  }

  function removeItem(idx: number) {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== idx),
    });
  }

  function updateItem(idx: number, field: keyof QuotationItem, value: string | number) {
    const items = [...formData.items];
    items[idx] = { ...items[idx], [field]: value };
    setFormData({ ...formData, items });
  }

  function selectProduct(idx: number, productId: string) {
    if (productId === "__custom") {
      const items = [...formData.items];
      items[idx] = { ...items[idx], productId: undefined, description: "", unitPrice: 0 };
      setFormData({ ...formData, items });
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const items = [...formData.items];
    items[idx] = {
      ...items[idx],
      productId: product.id,
      description: product.name,
      unitPrice: product.price,
    };
    setFormData({ ...formData, items });
  }

  async function handleSubmit() {
    if (!formData.customerId) {
      toast.error(t('customerRequired'));
      return;
    }
    if (formData.items.some((i) => !i.description)) {
      toast.error(t('itemsRequired'));
      return;
    }

    try {
      const payload = {
        ...formData,
        items: formData.items.map(({ productId, ...rest }) => ({
          ...rest,
          ...(productId && productId !== "__custom" ? { productId } : {}),
        })),
      };
      const res = await authService.fetchWithAuth("/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t('createSuccess'));
      setIsDialogOpen(false);
      loadData();
    } catch (error) {
      console.error(error);
      toast.error(t('createError'));
    }
  }

  async function handleDelete(q: Quotation) {
    if (!confirm(t('deleteConfirm', { number: q.quotationNumber }))) return;
    try {
      const res = await authService.fetchWithAuth(`/quotations/${q.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success(t('deleteSuccess'));
      loadData();
    } catch {
      toast.error(t('deleteError'));
    }
  }

  async function handleStatusChange(q: Quotation, newStatus: string) {
    const labels: Record<string, string> = {
      sent: t('actionSend'),
      accepted: t('actionAccept'),
      rejected: t('actionReject'),
    };
    const label = labels[newStatus] || newStatus;
    if (!confirm(t('statusChangeConfirm', { action: label, number: q.quotationNumber }))) return;

    try {
      const res = await authService.fetchWithAuth(`/quotations/${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t('statusChangeSuccess', { action: label.toLowerCase() }));
      loadData();
    } catch {
      toast.error(t('statusChangeError'));
    }
  }

  function openSendDialog(q: Quotation) {
    setSendingQuotation(q);
    setSendDialogOpen(true);
  }

  async function handleSendViaEmail(q: Quotation) {
    if (!q.customer?.email) {
      toast.error(t('sendDialog.noEmail'));
      return;
    }
    try {
      const res = await authService.fetchWithAuth(`/quotations/${q.id}/send-email`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed");
      }
      toast.success(t('sendDialog.emailSuccess'));
      setSendDialogOpen(false);
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('sendDialog.sendError');
      toast.error(msg);
    }
  }

  async function handleSendViaWhatsApp(q: Quotation) {
    if (!q.customer?.phone) {
      toast.error(t('sendDialog.noPhone'));
      return;
    }
    try {
      const res = await authService.fetchWithAuth(`/quotations/${q.id}/send-whatsapp`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed");
      }
      const result = await res.json().catch(() => ({ data: {} }));
      const data = result.data || {};
      if (data.success) {
        toast.success(t('sendDialog.whatsappSuccess'));
      } else {
        toast.error(
          t('sendDialog.whatsappError', { error: data.error || t('sendDialog.whatsappDefaultError') }),
          { duration: 8000 }
        );
      }
      setSendDialogOpen(false);
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('sendDialog.sendError');
      toast.error(msg);
    }
  }

  async function handleSendViaBoth(q: Quotation) {
    if (!q.customer?.email && !q.customer?.phone) {
      toast.error(t('sendDialog.noContact'));
      return;
    }
    try {
      const res = await authService.fetchWithAuth(`/quotations/${q.id}/send-both`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed");
      }
      const result = await res.json().catch(() => ({ data: {} }));
      const data = result.data || {};
      const msgs: string[] = [];
      if (data.email?.success) msgs.push("Email ✓");
      else msgs.push("Email ✗");
      if (data.whatsapp?.success) msgs.push("WhatsApp ✓");
      else msgs.push("WhatsApp ✗");
      toast.success(t('sendDialog.bothResult', { results: msgs.join(', ') }));
      setSendDialogOpen(false);
      loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('sendDialog.sendError');
      toast.error(msg);
    }
  }

  async function handleConvert(q: Quotation) {
    if (!confirm(t('convertConfirm', { number: q.quotationNumber }))) return;
    try {
      const res = await authService.fetchWithAuth(`/quotations/${q.id}/convert`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t('convertSuccess'));
      loadData();
    } catch {
      toast.error(t('convertError'));
    }
  }

  function calcTotal(items: QuotationItem[]) {
    return items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  }

  function getStatusBadge(status: string) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.bg} ${config.color} ${config.border} gap-1`}>
        <Icon className="h-3 w-3" />
        {t(config.label)}
      </Badge>
    );
  }

  // Filtered + searched quotations
  const filtered = quotations.filter((q) => {
    const matchStatus = statusFilter === "all" || q.status === statusFilter;
    const matchSearch = !search ||
      q.quotationNumber.toLowerCase().includes(search.toLowerCase()) ||
      q.customer?.name?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Stats
  const totalValue = quotations.reduce((sum, q) => sum + calcTotal(q.items), 0);
  const acceptedValue = quotations
    .filter((q) => q.status === "accepted" || q.status === "converted")
    .reduce((sum, q) => sum + calcTotal(q.items), 0);
  const conversionRate = quotations.length > 0
    ? Math.round(
        (quotations.filter((q) => q.status === "accepted" || q.status === "converted").length /
          quotations.length) *
          100,
      )
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('loadingData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" /> {t('createQuotation')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('newQuotation')}</DialogTitle>
              <DialogDescription>{t('newQuotationDesc')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>{t('selectCustomer')}</Label>
                <Select value={formData.customerId} onValueChange={(v) => setFormData({ ...formData, customerId: v })}>
                  <SelectTrigger><SelectValue placeholder={t('selectCustomerPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('dateLabel')}</Label>
                  <Input type="date" value={formData.issueDate}
                    onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('validUntilLabel')}</Label>
                  <Input type="date" value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('notesLabel')}</Label>
                <Input placeholder={t('notesPlaceholder')} value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">{t('quotationItems')}</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="mr-1 h-3 w-3" /> {t('addItem')}
                  </Button>
                </div>
                {formData.items.map((item, idx) => (
                  <div key={idx} className="space-y-2 rounded-lg border p-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t('selectFromProducts')}</Label>
                      <Select value={item.productId || ""} onValueChange={(v) => selectProduct(idx, v)}>
                        <SelectTrigger><SelectValue placeholder={t('selectProductPlaceholder')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__custom">{t('manualInput')}</SelectItem>
                          {products
                            .filter((p) => {
                              const usedIds = formData.items
                                .filter((_, i) => i !== idx)
                                .map((it) => it.productId)
                                .filter(Boolean);
                              return !usedIds.includes(p.id);
                            })
                            .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} — Rp {p.price.toLocaleString("id-ID")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Input placeholder={t('descriptionPlaceholder')} value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" placeholder={t('qtyPlaceholder')} value={item.qty}
                          onChange={(e) => updateItem(idx, "qty", Number(e.target.value))} />
                      </div>
                      <div className="col-span-4">
                        <Input type="text" inputMode="numeric" placeholder={t('unitPricePlaceholder')}
                          value={item.unitPrice ? item.unitPrice.toLocaleString('id-ID') : ''}
                          onChange={(e) => updateItem(idx, "unitPrice", Number(e.target.value.replace(/\D/g, '')))} />
                      </div>
                      <div className="col-span-1">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}
                          disabled={formData.items.length === 1}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {item.qty > 0 && item.unitPrice > 0 && (
                      <div className="text-xs text-muted-foreground text-right">
                        {t('subtotal')}: Rp {(item.qty * item.unitPrice).toLocaleString("id-ID")}
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="font-semibold">{t('totalQuotation')}</span>
                  <span className="text-xl font-bold">
                    Rp {calcTotal(formData.items).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{tc('cancel')}</Button>
              <Button onClick={handleSubmit}>{t('createQuotation')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('totalQuotations')}</CardTitle>
            <FileCheck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{quotations.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {quotations.filter((q) => q.status === "draft").length} draft,{" "}
              {quotations.filter((q) => q.status === "sent").length} terkirim
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('totalValue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp {totalValue.toLocaleString("id-ID")}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('allActive')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('acceptedValue')}</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Rp {acceptedValue.toLocaleString("id-ID")}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {quotations.filter((q) => q.status === "accepted" || q.status === "converted").length} penawaran
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('conversionRate')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{conversionRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">{t('acceptedSlashTotal')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatus')}</SelectItem>
            <SelectItem value="draft">{t('statusDraft')}</SelectItem>
            <SelectItem value="sent">{t('statusSent')}</SelectItem>
            <SelectItem value="accepted">{t('statusAccepted')}</SelectItem>
            <SelectItem value="rejected">{t('statusRejected')}</SelectItem>
            <SelectItem value="converted">{t('statusConverted')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quotation Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileCheck className="h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold">
                {quotations.length === 0 ? t('noQuotations') : t('noMatching')}
              </h3>
              <p className="text-muted-foreground text-sm mt-1">
                {quotations.length === 0
                  ? t('createFirst')
                  : t('tryChangeFilter')}
              </p>
              {quotations.length === 0 && (
                <Button className="mt-4" onClick={openCreateDialog}>
                  <Plus className="mr-2 h-4 w-4" /> {t('createQuotation')}
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('quotationNumber')}</TableHead>
                  <TableHead>{tc('customer')}</TableHead>
                  <TableHead>{t('dateLabel')}</TableHead>
                  <TableHead>{t('validColumn')}</TableHead>
                  <TableHead>{tc('status')}</TableHead>
                  <TableHead className="text-right">{tc('total')}</TableHead>
                  <TableHead className="w-[80px]">{tc('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => {
                  const expired = isExpired(q.validUntil, q.status);
                  const total = calcTotal(q.items);

                  return (
                    <TableRow key={q.id} className={expired ? "bg-red-50/30 dark:bg-red-950/10" : ""}>
                      <TableCell>
                        <span className="font-medium font-mono">{q.quotationNumber}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{q.customer?.name || "-"}</span>
                          {q.customer?.email && (
                            <span className="block text-xs text-muted-foreground">{q.customer.email}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(q.issueDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className={`text-sm ${expired ? "text-red-600 font-medium" : ""}`}>
                            {new Date(q.validUntil).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          {expired && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">
                              <Clock className="h-2.5 w-2.5 mr-0.5" /> Expired
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(q.status)}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono font-medium">
                          Rp {total.toLocaleString("id-ID")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {/* Status transitions based on current status */}
                            {q.status === "draft" && (
                              <DropdownMenuItem onClick={() => openSendDialog(q)}>
                                <Send className="mr-2 h-4 w-4 text-blue-600" /> {t('sendToCustomer')}
                              </DropdownMenuItem>
                            )}
                            {(q.status === "sent" || q.status === "draft") && (
                              <>
                                <DropdownMenuItem onClick={() => handleStatusChange(q, "accepted")}>
                                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> {t('markAccepted')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(q, "rejected")}>
                                  <XCircle className="mr-2 h-4 w-4 text-red-600" /> {t('markRejected')}
                                </DropdownMenuItem>
                              </>
                            )}
                            {(q.status === "accepted" || q.status === "sent" || q.status === "draft") && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleConvert(q)}>
                                  <ArrowRightLeft className="mr-2 h-4 w-4 text-purple-600" /> {t('convertToInvoice')}
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(q)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> {tc('delete')}
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

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('sendDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('sendDialog.description', { number: sendingQuotation?.quotationNumber || '' })}
            </DialogDescription>
          </DialogHeader>
          {sendingQuotation && (
            <div className="space-y-4 py-4">
              {/* Quotation Summary */}
              <div className="rounded-lg border p-4 bg-muted/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('sendDialog.customerLabel')}</span>
                  <span className="font-medium">{sendingQuotation.customer?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('sendDialog.totalLabel')}</span>
                  <span className="font-bold">Rp {calcTotal(sendingQuotation.items).toLocaleString("id-ID")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('sendDialog.validUntilLabel')}</span>
                  <span>{new Date(sendingQuotation.validUntil).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
                </div>
              </div>

              {/* Send Methods */}
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="h-auto p-4 justify-start gap-4 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-900 dark:hover:bg-blue-950/30 dark:hover:text-blue-100"
                  onClick={() => handleSendViaEmail(sendingQuotation)}
                >
                  <div className="rounded-full bg-blue-100 dark:bg-blue-900/50 p-2">
                    <Mail className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-foreground">{t('sendDialog.viaEmail')}</div>
                    <div className="text-xs text-muted-foreground">
                      {sendingQuotation.customer?.email
                        ? sendingQuotation.customer.email
                        : t('sendDialog.noEmail')}
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto p-4 justify-start gap-4 hover:bg-green-50 hover:border-green-300 hover:text-green-900 dark:hover:bg-green-950/30 dark:hover:text-green-100"
                  onClick={() => handleSendViaWhatsApp(sendingQuotation)}
                >
                  <div className="rounded-full bg-green-100 dark:bg-green-900/50 p-2">
                    <MessageCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-foreground">{t('sendDialog.viaWhatsApp')}</div>
                    <div className="text-xs text-muted-foreground">{sendingQuotation.customer?.phone || t('sendDialog.noPhone')}</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto p-4 justify-start gap-4 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-900 dark:hover:bg-purple-950/30 dark:hover:text-purple-100"
                  onClick={() => handleSendViaBoth(sendingQuotation)}
                >
                  <div className="rounded-full bg-purple-100 dark:bg-purple-900/50 p-2">
                    <Send className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-foreground">{t('sendDialog.viaBoth')}</div>
                    <div className="text-xs text-muted-foreground">{t('sendDialog.viaBoth')}</div>
                  </div>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
