"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Loader2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";
import { paymentService } from "@/lib/db/payments";
import { invoiceService } from "@/lib/db/invoices";
import { customerService } from "@/lib/db/customers";
import type { Invoice, Customer } from "@/lib/db";

function NewPaymentPageContent() {
  const t = useTranslations("paymentNew");
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedInvoiceId = searchParams.get("invoiceId");
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Map<string, Customer>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "transfer" | "qris" | "other"
  >("transfer");
  const [notes, setNotes] = useState("");

  // Selected invoice details
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [remainingBalance, setRemainingBalance] = useState(0);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    try {
      // Try backend API first for accurate data
      let unpaidInvoices: Invoice[] = [];
      const customerMap = new Map<string, Customer>();

      try {
        const [invRes, custRes] = await Promise.all([
          authService.fetchWithAuth("/invoices?status=sent"),
          authService.fetchWithAuth("/customers"),
        ]);

        if (invRes.ok && custRes.ok) {
          const invData = await invRes.json();
          const custData = await custRes.json();
          // Also fetch partial invoices
          const partialRes = await authService.fetchWithAuth("/invoices?status=partial");
          const partialData = partialRes.ok ? await partialRes.json() : { data: [] };
          // Also fetch draft invoices (user may want to record payment for draft too)
          const draftRes = await authService.fetchWithAuth("/invoices?status=draft");
          const draftData = draftRes.ok ? await draftRes.json() : { data: [] };

          unpaidInvoices = [
            ...(invData.data || []),
            ...(partialData.data || []),
            ...(draftData.data || []),
          ];

          const customers = custData.data || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          customers.forEach((c: any) => customerMap.set(c.id, c));
        } else {
          throw new Error("API unavailable");
        }
      } catch {
        // Fallback to Dexie offline data
        const [invoicesData, customersData] = await Promise.all([
          invoiceService.getAll(),
          customerService.getAll(),
        ]);
        unpaidInvoices = invoicesData.filter(
          (inv) => inv.status !== "paid" && inv.status !== "cancelled"
        );
        customersData.forEach((c) => customerMap.set(c.id!, c));
      }

      setInvoices(unpaidInvoices);
      setCustomers(customerMap);

      // Pre-select invoice from URL if provided
      if (preselectedInvoiceId) {
        const invoice = unpaidInvoices.find((inv) => inv.id === preselectedInvoiceId);
        if (invoice) {
          setInvoiceId(preselectedInvoiceId);
          setSelectedInvoice(invoice);
          // Calculate remaining from payments data
          try {
            const summaryRes = await authService.fetchWithAuth(`/invoices/${preselectedInvoiceId}/payments/summary`);
            if (summaryRes.ok) {
              const summaryData = await summaryRes.json();
              const remaining = summaryData.remaining ?? (Number(invoice.total) - (summaryData.totalPaid || 0));
              setRemainingBalance(remaining);
              setAmount(String(remaining));
            } else {
              setRemainingBalance(Number(invoice.total));
              setAmount(String(Number(invoice.total)));
            }
          } catch {
            setRemainingBalance(Number(invoice.total));
            setAmount(String(Number(invoice.total)));
          }
        }
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error(t("failedLoadData"));
    } finally {
      setLoading(false);
    }
  }

  async function handleInvoiceChange(id: string) {
    setInvoiceId(id);
    const invoice = invoices.find((inv) => inv.id === id);
    setSelectedInvoice(invoice || null);

    if (invoice) {
      try {
        const summaryRes = await authService.fetchWithAuth(`/invoices/${id}/payments/summary`);
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          const remaining = summaryData.remaining ?? (Number(invoice.total) - (summaryData.totalPaid || 0));
          setRemainingBalance(remaining);
          setAmount(String(remaining));
        } else {
          // Fallback: use invoice total
          setRemainingBalance(Number(invoice.total));
          setAmount(String(Number(invoice.total)));
        }
      } catch {
        // Fallback to local
        const remaining = await paymentService.getRemainingBalance(id);
        setRemainingBalance(remaining);
        setAmount(String(remaining));
      }
    }
  }

  async function handleSubmit() {
    if (!invoiceId) {
      toast.error(t("selectInvoice"));
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error(t("enterValidAmount"));
      return;
    }

    const amountNum = parseFloat(amount);
    if (amountNum > remainingBalance) {
      toast.error(
        t("exceedsRemaining", { amount: paymentService.formatCurrency(remainingBalance) })
      );
      return;
    }

    try {
      setSaving(true);

      // Map frontend field names to backend field names
      const paymentPayload = {
        date: paymentDate,
        amount: amountNum,
        method: paymentMethod,
        note: notes || undefined,
      };

      // Call backend API directly so invoice status updates immediately
      const res = await authService.fetchWithAuth(`/invoices/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentPayload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || t("failedRecord"));
      }

      toast.success(t("paymentRecorded"));
      router.push("/dashboard/payments");
    } catch (error) {
      console.error("Failed to create payment:", error);
      const msg = error instanceof Error ? error.message : t("failedRecord");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/payments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("paymentDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Invoice Selection */}
              <div className="space-y-2">
                <Label htmlFor="invoice">{t("invoiceLabel")}</Label>
                <Select value={invoiceId} onValueChange={handleInvoiceChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("invoicePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        {t("noUnpaidInvoices")}
                      </div>
                    ) : (
                      invoices.map((invoice) => {
                        const customer = customers.get(invoice.customerId);
                        return (
                          <SelectItem key={invoice.id} value={invoice.id!}>
                            {invoice.invoiceNumber} - {customer?.name || "—"} (
                            {invoiceService.formatCurrency(invoice.total)})
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">{t("amountLabel")}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    min={0}
                    step={1000}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-10"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Payment Date */}
              <div className="space-y-2">
                <Label htmlFor="paymentDate">{t("paymentDate")}</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="method">{t("paymentMethod")}</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(val) =>
                    setPaymentMethod(
                      val as "cash" | "transfer" | "qris" | "other"
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">{t("methodTransfer")}</SelectItem>
                    <SelectItem value="cash">{t("methodCash")}</SelectItem>
                    <SelectItem value="qris">{t("methodQris")}</SelectItem>
                    <SelectItem value="other">{t("methodOther")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">{t("notesLabel")}</Label>
                <Textarea
                  id="notes"
                  placeholder={t("notesPlaceholder")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          {selectedInvoice ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  {selectedInvoice.invoiceNumber}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("totalBill")}</span>
                  <span className="font-medium">
                    {invoiceService.formatCurrency(selectedInvoice.total)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("remainingBill")}</span>
                  <span className="font-bold text-primary">
                    {paymentService.formatCurrency(remainingBalance)}
                  </span>
                </div>
                {amount && (
                  <>
                    <div className="border-t pt-4 flex justify-between">
                      <span className="text-muted-foreground">{t("paymentAmount")}</span>
                      <span className="font-medium text-green-600">
                        - {paymentService.formatCurrency(parseFloat(amount) || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>{t("remainingAfter")}</span>
                      <span>
                        {paymentService.formatCurrency(
                          Math.max(0, remainingBalance - (parseFloat(amount) || 0))
                        )}
                      </span>
                    </div>
                  </>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={saving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? t("saving") : t("savePayment")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("selectInvoiceHint")}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewPaymentPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <NewPaymentPageContent />
    </Suspense>
  );
}
