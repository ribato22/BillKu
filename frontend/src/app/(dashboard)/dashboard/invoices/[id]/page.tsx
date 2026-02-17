"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
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
import {
  ArrowLeft,
  Printer,
  Edit,
  CheckCircle,
  Loader2,
  CreditCard,
  Plus,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatRupiahPlain(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | string | undefined | null): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Interpolate template HTML with invoice data.
 * Supports {{variable}} replacement and {{#items}}...{{/items}} loop.
 */
function interpolateTemplate(
  html: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoice: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customer: any,
): string {
  const business = invoice.business || {};
  const items = invoice.items || [];
  const currency = invoice.currency || { symbol: "Rp", symbolPosition: "before" };

  // Build variable map
  const vars: Record<string, string> = {
    "{{businessName}}": business.name || "—",
    "{{businessAddress}}": business.address || "",
    "{{businessPhone}}": business.phone || "",
    "{{businessEmail}}": business.email || "",
    "{{logoUrl}}": business.logoUrl || "",
    "{{invoiceNumber}}": invoice.invoiceNumber || "",
    "{{issueDate}}": formatDate(invoice.issueDate),
    "{{dueDate}}": formatDate(invoice.dueDate),
    "{{customerName}}": customer?.name || "—",
    "{{customerAddress}}": customer?.address || "",
    "{{customerEmail}}": customer?.email || "",
    "{{customerPhone}}": customer?.phone || "",
    "{{currencySymbol}}": currency.symbol || "Rp",
    "{{grandTotal}}": formatRupiahPlain(Number(invoice.total || 0)),
    "{{subtotal}}": formatRupiahPlain(Number(invoice.subtotal || 0)),
    "{{taxAmount}}": formatRupiahPlain(Number(invoice.taxAmount || 0)),
    "{{discount}}": formatRupiahPlain(Number(invoice.discountAmount || 0)),
    "{{bankName}}": business.bankName || "",
    "{{bankAccountNumber}}": business.bankAccountNumber || "",
    "{{bankAccountName}}": business.bankAccountName || "",
    "{{notes}}": invoice.notes || "",
    "{{status}}": invoice.status || "",
  };

  let result = html;

  // Handle {{#items}}...{{/items}} loop
  const itemsMatch = result.match(/\{\{#items\}\}([\s\S]*?)\{\{\/items\}\}/);
  if (itemsMatch) {
    const itemTemplate = itemsMatch[1];
    const renderedItems = items
      .map((item: { description?: string; product?: { name: string }; qty: number; unitPrice: number; total: number }) => {
        let itemHtml = itemTemplate;
        itemHtml = itemHtml.replace(/\{\{description\}\}/g, item.description || item.product?.name || "—");
        itemHtml = itemHtml.replace(/\{\{qty\}\}/g, String(item.qty || 0));
        itemHtml = itemHtml.replace(/\{\{unitPrice\}\}/g, formatRupiahPlain(Number(item.unitPrice || 0)));
        itemHtml = itemHtml.replace(/\{\{total\}\}/g, formatRupiahPlain(Number(item.total || 0)));
        return itemHtml;
      })
      .join("");
    result = result.replace(/\{\{#items\}\}[\s\S]*?\{\{\/items\}\}/, renderedItems);
  }

  // Replace all simple variables
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
  }

  // Handle logo: if {{logoUrl}} was in the template but business has no logo, remove any img tag
  // that has an empty src
  result = result.replace(/<img[^>]*src=""[^>]*>/g, "");

  return result;
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("invoiceDetail");
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [invoice, setInvoice] = useState<any>(null);
  const [templateHtml, setTemplateHtml] = useState<string | null>(null);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadData() {
    try {
      // Fetch invoice and template in parallel
      const [invoiceRes, templateRes] = await Promise.all([
        authService.fetchWithAuth(`/invoices/${id}`),
        authService.fetchWithAuth("/invoice-templates/default"),
      ]);

      if (!invoiceRes.ok) {
        toast.error(t("invoiceNotFound"));
        router.push("/dashboard/invoices");
        return;
      }
      const invoiceData = await invoiceRes.json();
      setInvoice(invoiceData.data || invoiceData);

      // Load template (may fail if no templates exist yet)
      if (templateRes.ok) {
        const templateData = await templateRes.json();
        if (templateData.data?.htmlBody) {
          setTemplateHtml(templateData.data.htmlBody);
        }
      }
    } catch (error) {
      console.error("Failed to load invoice:", error);
      toast.error(t("failedLoadInvoice"));
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "secondary", label: t("statusDraft") },
      sent: { variant: "default", label: t("statusSent") },
      paid: { variant: "outline", label: t("statusPaid") },
      overdue: { variant: "destructive", label: t("statusOverdue") },
      cancelled: { variant: "secondary", label: t("statusCancelled") },
    };
    const style = styles[status] || styles.draft;
    return <Badge variant={style.variant}>{style.label}</Badge>;
  }

  async function handleMarkPaid() {
    if (!invoice) return;

    try {
      setMarkingPaid(true);
      const res = await authService.fetchWithAuth(`/invoices/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      if (res.ok) {
        toast.success(t("markedPaid"));
        loadData();
      } else {
        toast.error(t("failedChangeStatus"));
      }
    } catch (error) {
      console.error("Failed to mark as paid:", error);
      toast.error(t("failedChangeStatus"));
    } finally {
      setMarkingPaid(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  async function handleSendReminder() {
    if (!invoice?.customer?.phone) {
      toast.error(t("noPhoneError"));
      return;
    }

    try {
      setSendingReminder(true);
      const res = await authService.fetchWithAuth(`/invoices/${id}/remind`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success(t("reminderSent"));
      } else {
        const data = await res.json();
        toast.error(data.message || t("failedSendReminder"));
      }
    } catch (error) {
      console.error("Failed to send reminder:", error);
      toast.error(t("failedSendReminderWA"));
    } finally {
      setSendingReminder(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!invoice) {
    return null;
  }

  const customer = invoice.customer;
  const items = invoice.items || [];
  const payments = invoice.payments || [];
  const totalPaid = payments.reduce((sum: number, p: { amount: number }) => sum + (p.amount || 0), 0);
  const remainingBalance = Math.max(0, (invoice.total || 0) - totalPaid);

  // Render template-based HTML or fallback
  const renderedInvoiceHtml = templateHtml
    ? interpolateTemplate(templateHtml, invoice, customer)
    : null;

  return (
    <div className="space-y-6">
      {/* Header - Hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/invoices">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {invoice.invoiceNumber}
            </h1>
            <p className="text-muted-foreground">{t("detailTitle")}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> {t("print")}
          </Button>
        {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <>
              <Link href={`/dashboard/invoices/${id}/edit`}>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" /> {t("edit")}
                </Button>
              </Link>
              <Button 
                variant="outline" 
                onClick={handleSendReminder}
                disabled={sendingReminder || !customer?.phone}
                title={!customer?.phone ? t("noPhoneTooltip") : t("sendReminderTooltip")}
              >
                {sendingReminder ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MessageCircle className="mr-2 h-4 w-4" />
                )}
                {t("reminder")}
              </Button>
              <Button onClick={handleMarkPaid} disabled={markingPaid}>
                {markingPaid ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {t("markPaid")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Print styles to preserve backgrounds/colors */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          .print\\:hidden { display: none !important; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}} />

      {/* Invoice Content - Printable */}
      <div ref={printRef} id="printable-area">
        {renderedInvoiceHtml ? (
          /* ── Template-based rendering ── */
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div dangerouslySetInnerHTML={{ __html: renderedInvoiceHtml }} />

            {/* Payment summary (appended below template) */}
            {totalPaid > 0 && (
              <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: "'Segoe UI', sans-serif", padding: '0 40px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: 300 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#16a34a' }}>
                      <span>{t("alreadyPaid")}</span>
                      <span>- {formatRupiah(totalPaid)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #e5e7eb', fontWeight: 600, fontSize: 15 }}>
                      <span>{t("remainingBalance")}</span>
                      <span style={{ color: remainingBalance > 0 ? '#ea580c' : '#16a34a' }}>{formatRupiah(remainingBalance)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Signature Area */}
            <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: "'Segoe UI', sans-serif", padding: '0 40px' }}>
              <div style={{ marginTop: 48, display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center', width: '40%' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 64 }}>{t("receiver")}</div>
                  <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 8, fontSize: 13 }}>{t("signatureAndName")}</div>
                </div>
                <div style={{ textAlign: 'center', width: '40%' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 64 }}>{t("regards")}</div>
                  <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 8, fontSize: 13, fontWeight: 600 }}>{invoice.business?.name || 'BillKu'}</div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: '#9ca3af' }}>{t("thankYou")}</p>
                <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 4 }}>{t("digitalInvoice")}</p>
              </div>
            </div>
          </div>
        ) : (
          /* ── Fallback: hardcoded layout (when no template exists) ── */
          <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif", color: '#1f2937', lineHeight: 1.6 }}>
            {/* Gradient Header */}
            <div style={{ background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)', padding: '32px 40px', borderRadius: '12px 12px 0 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 3, color: '#ffffff', opacity: 0.8, marginBottom: 4 }}>Invoice</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: '#ffffff', letterSpacing: -0.5 }}>{invoice.invoiceNumber}</div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 16 }}>
                  {invoice.business?.logoUrl && (
                    <img
                      src={invoice.business.logoUrl}
                      alt="Logo"
                      style={{ height: 56, width: 56, objectFit: 'contain', borderRadius: 8, background: '#fff', padding: 4 }}
                    />
                  )}
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#ffffff' }}>{invoice.business?.name || 'BillKu'}</div>
                    {invoice.business?.address && (
                      <div style={{ fontSize: 12, color: '#ffffff', opacity: 0.8, marginTop: 2 }}>{invoice.business.address}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '32px 40px' }}>
              {/* Status + Dates Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: '#6b7280', marginBottom: 8 }}>{t("billedTo")}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{customer?.name || '—'}</div>
                  {customer?.address && <div style={{ fontSize: 13, color: '#6b7280' }}>{customer.address}</div>}
                  {customer?.phone && <div style={{ fontSize: 13, color: '#6b7280' }}>{customer.phone}</div>}
                  {customer?.email && <div style={{ fontSize: 13, color: '#6b7280' }}>{customer.email}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ marginBottom: 12 }}>{getStatusBadge(invoice.status)}</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>
                    <div style={{ marginBottom: 4 }}>
                      <span>{t("dateLabel")} </span>
                      <strong style={{ color: '#1f2937' }}>{formatDate(invoice.issueDate)}</strong>
                    </div>
                    <div>
                      <span>{t("dueDateLabel")} </span>
                      <strong style={{ color: '#dc2626' }}>{formatDate(invoice.dueDate)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>#</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>{t("descriptionCol")}</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>{t("qtyCol")}</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>{t("unitPriceCol")}</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b', fontWeight: 600, borderBottom: '2px solid #e2e8f0' }}>{t("amountCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: { id?: string; description: string; product?: { name: string }; qty: number; unitPrice: number; total: number }, index: number) => (
                    <tr key={item.id || index} style={{ background: index % 2 === 1 ? '#f8fafc' : 'transparent' }}>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#94a3b8' }}>{index + 1}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, fontWeight: 500 }}>{item.description || item.product?.name || '—'}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, textAlign: 'center' }}>{item.qty}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, textAlign: 'right' }}>{formatRupiah(item.unitPrice)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 13, textAlign: 'right', fontWeight: 600 }}>{formatRupiah(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: 300 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#6b7280' }}>
                    <span>{t("subtotal")}</span>
                    <span style={{ color: '#1f2937' }}>{formatRupiah(invoice.subtotal)}</span>
                  </div>
                  {invoice.taxEnabled && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#6b7280' }}>
                      <span>PPN ({invoice.taxRateBps / 100}%)</span>
                      <span style={{ color: '#1f2937' }}>{formatRupiah(invoice.taxAmount)}</span>
                    </div>
                  )}
                  {invoice.discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#16a34a' }}>
                      <span>{t("discount")}</span>
                      <span>- {formatRupiah(invoice.discountAmount)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', marginTop: 8, borderTop: '2px solid #0f766e', fontSize: 18, fontWeight: 700 }}>
                    <span>{t("total")}</span>
                    <span style={{ color: '#0f766e' }}>{formatRupiah(invoice.total)}</span>
                  </div>
                  {totalPaid > 0 && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, color: '#16a34a' }}>
                        <span>{t("alreadyPaid")}</span>
                        <span>- {formatRupiah(totalPaid)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #e5e7eb', fontWeight: 600, fontSize: 15 }}>
                        <span>{t("remainingBalance")}</span>
                        <span style={{ color: remainingBalance > 0 ? '#ea580c' : '#16a34a' }}>{formatRupiah(remainingBalance)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Bank Details */}
              {(invoice.business?.bankName || invoice.business?.bankAccountNumber) && (
                <div style={{ marginTop: 32, padding: '20px 24px', background: '#f0fdfa', borderRadius: 10, border: '1px solid #99f6e4' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: '#0f766e', fontWeight: 600, marginBottom: 10 }}>{t("paymentInfo")}</div>
                  <div style={{ display: 'flex', gap: 40, fontSize: 13 }}>
                    {invoice.business.bankName && (
                      <div>
                        <div style={{ color: '#6b7280', marginBottom: 2 }}>{t("bank")}</div>
                        <div style={{ fontWeight: 600 }}>{invoice.business.bankName}</div>
                      </div>
                    )}
                    {invoice.business.bankAccountNumber && (
                      <div>
                        <div style={{ color: '#6b7280', marginBottom: 2 }}>{t("accountNumber")}</div>
                        <div style={{ fontWeight: 600 }}>{invoice.business.bankAccountNumber}</div>
                      </div>
                    )}
                    {invoice.business.bankAccountName && (
                      <div>
                        <div style={{ color: '#6b7280', marginBottom: 2 }}>{t("accountName")}</div>
                        <div style={{ fontWeight: 600 }}>{invoice.business.bankAccountName}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {invoice.notes && (
                <div style={{ marginTop: 24, padding: '16px 20px', background: '#fefce8', borderRadius: 8, border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>{t("notes")}</div>
                  <div style={{ fontSize: 13, color: '#78350f' }}>{invoice.notes}</div>
                </div>
              )}

              {/* Signature Area */}
              <div style={{ marginTop: 48, display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ textAlign: 'center', width: '40%' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 64 }}>{t("receiver")}</div>
                  <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 8, fontSize: 13 }}>{t("signatureAndName")}</div>
                </div>
                <div style={{ textAlign: 'center', width: '40%' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 64 }}>{t("regards")}</div>
                  <div style={{ borderTop: '1px solid #d1d5db', paddingTop: 8, fontSize: 13, fontWeight: 600 }}>{invoice.business?.name || 'BillKu'}</div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: '#9ca3af' }}>{t("thankYou")}</p>
                <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 4 }}>{t("digitalInvoice")}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment History - Hidden on print */}
      <Card className="print:hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("paymentHistory")}
          </CardTitle>
          {invoice.status !== "paid" && invoice.status !== "cancelled" && (
            <Link href={`/dashboard/payments/new?invoiceId=${id}`}>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" /> {t("recordPayment")}
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t("noPayments")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dateColumn")}</TableHead>
                  <TableHead>{t("methodColumn")}</TableHead>
                  <TableHead className="text-right">{t("amountColumn")}</TableHead>
                  <TableHead>{t("notesColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment: { id: string; date: string; method: string; amount: number; notes?: string }) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {payment.method || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-green-600">
                      {formatRupiah(payment.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {payment.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: portrait;
            margin: 15mm;
          }
          body * {
            visibility: hidden;
          }
          #printable-area,
          #printable-area * {
            visibility: visible;
          }
          #printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 1rem;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
