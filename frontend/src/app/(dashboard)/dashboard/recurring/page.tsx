"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RefreshCw,
  Plus,
  Play,
  Pause,
  Trash2,
  CalendarClock,
  X,
} from "lucide-react";
import { authService } from "@/lib/auth";
import { productService } from "@/lib/db/products";
import type { Product } from "@/lib/db";
import { useTranslations } from "next-intl";

interface RecurringItem {
  id: string;
  productId: string | null;
  description: string;
  qty: number;
  unitPrice: string;
  product?: { id: string; name: string } | null;
}

interface RecurringInvoice {
  id: string;
  frequency: string;
  currencyCode: string;
  taxEnabled: boolean;
  taxRateBps: number;
  nextDueDate: string;
  dueDayOffset: number;
  isActive: boolean;
  lastGenerated: string | null;
  customer: { id: string; name: string };
  items: RecurringItem[];
}

interface Customer {
  id: string;
  name: string;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
  unit: string;
}


const FREQ_KEYS: Record<string, string> = {
  weekly: "frequencyWeekly",
  monthly: "frequencyMonthly",
  quarterly: "frequencyQuarterly",
  yearly: "frequencyYearly",
};

function formatCurrency(value: number): string {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function RecurringInvoicesPage() {
  const t = useTranslations('recurring');
  const tc = useTranslations('common');
  const [recurring, setRecurring] = useState<RecurringInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formFrequency, setFormFrequency] = useState("monthly");
  const [formNextDueDate, setFormNextDueDate] = useState("");
  const [formDueDayOffset, setFormDueDayOffset] = useState(30);
  const [formItems, setFormItems] = useState<
    { description: string; qty: number; unitPrice: number; productId?: string }[]
  >([{ description: "", qty: 1, unitPrice: 0 }]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [recurRes, custRes, localProducts] = await Promise.all([
        authService.fetchWithAuth("/recurring-invoices"),
        authService.fetchWithAuth("/customers?limit=100"),
        productService.getActive(),
      ]);

      if (recurRes.ok) {
        const d = await recurRes.json();
        setRecurring(d.data);
      }
      if (custRes.ok) {
        const d = await custRes.json();
        setCustomers(d.data?.data || d.data || []);
      }

      // Use local products if available, otherwise fetch from API
      let prodList = localProducts;
      if (!prodList || prodList.length === 0) {
        const prodRes = await authService.fetchWithAuth("/products?limit=100");
        if (prodRes.ok) {
          const d = await prodRes.json();
          prodList = d.data?.data || d.data || [];
        }
      }
      setProducts(prodList.map((p: Product & { unitPrice?: number }) => ({
        id: p.id!,
        name: p.name,
        price: p.price ?? p.unitPrice ?? 0,
        unit: p.unit || 'pcs',
      })));
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!formCustomerId || !formNextDueDate || formItems.length === 0) {
      setError(t('validationError'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await authService.fetchWithAuth("/recurring-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formCustomerId,
          frequency: formFrequency,
          nextDueDate: formNextDueDate,
          dueDayOffset: formDueDayOffset,
          items: formItems
            .filter((i) => i.description)
            .map((i) => ({
              description: i.description,
              qty: i.qty,
              unitPrice: i.unitPrice,
              ...(i.productId && i.productId !== "__custom" ? { productId: i.productId } : {}),
            })),
        }),
      });
      if (res.ok) {
        setSuccess(t('createSuccess'));
        setShowForm(false);
        setFormCustomerId("");
        setFormItems([{ description: "", qty: 1, unitPrice: 0 }]);
        fetchData();
      } else {
        const err = await res.json();
        setError(err.message || t('createError'));
      }
    } catch {
      setError(t('createError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await authService.fetchWithAuth(`/recurring-invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      fetchData();
    } catch {
      setError(t('toggleError'));
    }
  };

  const handleGenerate = async (id: string) => {
    try {
      const res = await authService.fetchWithAuth(
        `/recurring-invoices/${id}/generate`,
        { method: "POST" },
      );
      if (res.ok) {
        setSuccess(t('generateSuccess'));
        fetchData();
      } else {
        const err = await res.json();
        setError(err.message || t('generateError'));
      }
    } catch {
      setError(t('generateError'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteConfirm'))) return;
    try {
      await authService.fetchWithAuth(`/recurring-invoices/${id}`, {
        method: "DELETE",
      });
      setSuccess(t('deleteSuccess'));
      fetchData();
    } catch {
      setError(t('deleteError'));
    }
  };

  const addItem = () =>
    setFormItems([...formItems, { description: "", qty: 1, unitPrice: 0 }]);
  const removeItem = (idx: number) =>
    setFormItems(formItems.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: string | number) =>
    setFormItems(
      formItems.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  const selectProduct = (idx: number, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setFormItems(
        formItems.map((item, i) =>
          i === idx
            ? {
                ...item,
                productId: product.id,
                description: product.name,
                unitPrice: product.price,
              }
            : item,
        ),
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-6 w-6" /> {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition text-sm font-medium"
          >
            <Plus className="h-4 w-4" /> {t('createRecurring')}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 text-sm flex justify-between items-center">
          {success}
          <button onClick={() => setSuccess(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('createFormTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">{tc('customer')}</label>
                <select
                  value={formCustomerId}
                  onChange={(e) => setFormCustomerId(e.target.value)}
                  className="w-full mt-1 rounded-lg border px-4 py-2 text-sm bg-background"
                >
                  <option value="">{t('customerPlaceholder')}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{t('frequencyLabel')}</label>
                <select
                  value={formFrequency}
                  onChange={(e) => setFormFrequency(e.target.value)}
                  className="w-full mt-1 rounded-lg border px-4 py-2 text-sm bg-background"
                >
                  <option value="weekly">{t('frequencyWeekly')}</option>
                  <option value="monthly">{t('frequencyMonthly')}</option>
                  <option value="quarterly">{t('frequencyQuarterly')}</option>
                  <option value="yearly">{t('frequencyYearly')}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{t('startDateLabel')}</label>
                <input
                  type="date"
                  value={formNextDueDate}
                  onChange={(e) => setFormNextDueDate(e.target.value)}
                  className="w-full mt-1 rounded-lg border px-4 py-2 text-sm bg-background"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('dueDayLabel')}</label>
                <input
                  type="number"
                  value={formDueDayOffset}
                  onChange={(e) => setFormDueDayOffset(Number(e.target.value))}
                  className="w-full mt-1 rounded-lg border px-4 py-2 text-sm bg-background"
                />
              </div>
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">{t('itemsLabel')}</label>
                <button
                  onClick={addItem}
                  className="text-xs text-primary hover:underline"
                >
                  + {t('addItem')}
                </button>
              </div>
              <div className="space-y-2">
                {formItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <select
                      value={item.productId === "__custom" ? "__custom" : item.productId || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "__custom") {
                          // Manual input mode
                          setFormItems(
                            formItems.map((it, i) =>
                              i === idx
                                ? { ...it, productId: "__custom", description: "", unitPrice: 0 }
                                : it
                            )
                          );
                        } else if (val) {
                          selectProduct(idx, val);
                        } else {
                          setFormItems(
                            formItems.map((it, i) =>
                              i === idx
                                ? { ...it, productId: undefined, description: "", unitPrice: 0 }
                                : it
                            )
                          );
                        }
                      }}
                      className="w-48 rounded-lg border px-3 py-2 text-sm bg-background"
                    >
                      <option value="">{t('selectProduct')}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - Rp {p.price.toLocaleString("id-ID")}
                        </option>
                      ))}
                      <option value="__custom">✏️ {t('manualInput')}</option>
                    </select>
                    <input
                      placeholder={t('descriptionPlaceholder')}
                      value={item.description}
                      onChange={(e) =>
                        updateItem(idx, "description", e.target.value)
                      }
                      className="flex-1 rounded-lg border px-3 py-2 text-sm bg-background"
                      readOnly={!!item.productId && item.productId !== "__custom"}
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.qty}
                      onChange={(e) =>
                        updateItem(idx, "qty", Number(e.target.value))
                      }
                      className="w-20 rounded-lg border px-3 py-2 text-sm bg-background"
                    />
                    <input
                      type="number"
                      placeholder={t('pricePlaceholder')}
                      value={item.unitPrice}
                      onChange={(e) =>
                        updateItem(idx, "unitPrice", Number(e.target.value))
                      }
                      className="w-32 rounded-lg border px-3 py-2 text-sm bg-background"
                      readOnly={!!item.productId && item.productId !== "__custom"}
                    />
                    {formItems.length > 1 && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border hover:bg-muted transition text-sm"
              >
                {tc('cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition text-sm font-medium"
              >
                {submitting ? t('saving') : tc('save')}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recurring List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : recurring.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {t('noRecurring')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {recurring.map((rec) => {
            const totalPerInvoice = rec.items.reduce(
              (sum, item) => sum + Number(item.qty) * Number(item.unitPrice),
              0,
            );
            return (
              <Card
                key={rec.id}
                className={`${!rec.isActive ? "opacity-60" : ""}`}
              >
                <CardContent className="py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {rec.customer.name}
                        </span>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            rec.isActive
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-800"
                          }`}
                        >
                          {rec.isActive ? t('active') : t('inactive')}
                        </span>
                        <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          {t(FREQ_KEYS[rec.frequency] || rec.frequency)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {rec.items.length} item •{" "}
                        {formatCurrency(totalPerInvoice)} per invoice
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('nextSchedule')}: {formatDate(rec.nextDueDate)}
                        {rec.lastGenerated &&
                          ` • ${t('lastGenerated')}: ${formatDate(rec.lastGenerated)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {rec.isActive && (
                        <button
                          onClick={() => handleGenerate(rec.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 transition text-xs font-medium"
                        >
                          <Play className="h-3.5 w-3.5" /> Generate
                        </button>
                      )}
                      <button
                        onClick={() => handleToggle(rec.id, rec.isActive)}
                        className="p-1.5 rounded-lg hover:bg-muted transition"
                        title={rec.isActive ? t('deactivate') : t('activate')}
                      >
                        {rec.isActive ? (
                          <Pause className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <Play className="h-4 w-4 text-green-500" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(rec.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
