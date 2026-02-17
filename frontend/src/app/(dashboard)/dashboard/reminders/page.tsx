"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  MessageCircle,
  Settings,
  Send,
  Eye,
  AlertTriangle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  reminderService,
  type ReminderTemplate,
  REMINDER_VARIABLES,
} from "@/lib/db/reminders";
import { paymentService } from "@/lib/db/payments";
import { whatsappService } from "@/lib/services/whatsapp";
import { customerService } from "@/lib/db/customers";
import type { Invoice } from "@/lib/db";
import { useTranslations } from "next-intl";

interface InvoiceWithReminder {
  invoice: Invoice;
  customerName: string;
  remaining: number;
  daysOverdue: number;
}

export default function RemindersPage() {
  const t = useTranslations('reminders');
  const tc = useTranslations('common');
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceWithReminder[]>([]);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [previewText, setPreviewText] = useState<string>("");
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [businessSettings, setBusinessSettings] = useState({
    companyName: "",
    bankAccount: "",
  });
  const [showSettings, setShowSettings] = useState(false);
  const [waConnected, setWaConnected] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    // Check WhatsApp connection status
    whatsappService.getStatus().then((s) => setWaConnected(s.isConnected)).catch(() => {});
  }, []);

  async function loadData() {
    try {
      const [invoiceData, templateData] = await Promise.all([
        reminderService.getInvoicesNeedingReminders(),
        Promise.resolve(reminderService.getTemplates()),
      ]);

      setInvoices(invoiceData);
      setTemplates(templateData);
      setBusinessSettings(reminderService.getBusinessSettings());

      if (templateData.length > 0) {
        setSelectedTemplate(templateData[0].id);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  }

  async function handlePreview(invoiceId: string) {
    if (!selectedTemplate) {
      toast.error(t('selectTemplateFirst'));
      return;
    }

    try {
      const invoice = invoices.find((i) => i.invoice.id === invoiceId);
      const text = await reminderService.fillTemplate(
        templates.find((t) => t.id === selectedTemplate)!,
        invoiceId
      );
      setPreviewText(text);
      setPreviewInvoice(invoice?.invoice || null);
    } catch (error) {
      console.error("Failed to generate preview:", error);
      toast.error(t('previewError'));
    }
  }

  async function handleSendWhatsApp(invoiceId: string) {
    if (!selectedTemplate) {
      toast.error(t('selectTemplateFirst'));
      return;
    }

    // If WhatsApp is connected, send directly via API
    if (waConnected) {
      setSending(invoiceId);
      try {
        const message = await reminderService.fillTemplate(
          templates.find((t) => t.id === selectedTemplate)!,
          invoiceId
        );

        // Get customer phone from local data
        const invoiceData = invoices.find((i) => i.invoice.id === invoiceId);
        const customer = invoiceData
          ? await customerService.getById(invoiceData.invoice.customerId)
          : undefined;

        if (!customer?.phone) {
          toast.error(t('noPhone'));
          setSending(null);
          return;
        }

        // Format phone number
        let phone = customer.phone.replace(/\D/g, "");
        if (phone.startsWith("0")) {
          phone = "62" + phone.substring(1);
        }

        const result = await whatsappService.sendMessage(phone, message);
        if (result.success) {
          toast.success(t('sendSuccess'));
        } else {
          toast.error(result.error || t('sendError'));
        }
      } catch (error) {
        console.error("Failed to send reminder:", error);
        toast.error(t('sendError'));
      } finally {
        setSending(null);
      }
      return;
    }

    // Fallback: open wa.me link if not connected
    try {
      const link = await reminderService.generateWhatsAppLink(
        selectedTemplate,
        invoiceId
      );
      window.open(link, "_blank");
      toast.success(t('openWhatsApp'));
    } catch (error) {
      console.error("Failed to generate WhatsApp link:", error);
      if (error instanceof Error && error.message.includes("phone")) {
        toast.error(t('noPhone'));
      } else {
        toast.error(t('whatsAppLinkError'));
      }
    }
  }

  function handleSaveSettings() {
    reminderService.saveBusinessSettings(businessSettings);
    setShowSettings(false);
    toast.success(t('settingsSaved'));
  }

  function getStatusBadge(daysOverdue: number) {
    if (daysOverdue <= 0) {
      return <Badge variant="outline" className="text-green-600">{t('notYetDue')}</Badge>;
    } else if (daysOverdue <= 7) {
      return <Badge variant="secondary" className="text-yellow-600">{t('overdueDays', { days: daysOverdue })}</Badge>;
    } else if (daysOverdue <= 30) {
      return <Badge variant="destructive">{t('overdueDays', { days: daysOverdue })}</Badge>;
    } else {
      return <Badge variant="destructive" className="bg-red-700">{t('overdueDays', { days: daysOverdue })}</Badge>;
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowSettings(true)}>
          <Settings className="mr-2 h-4 w-4" />
          {t('settingsButton')}
        </Button>
      </div>

      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('templateTitle')}</CardTitle>
          <CardDescription>
            {t('templateDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder={t('templatePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        {template.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Eye className="mr-2 h-4 w-4" />
                  {t('viewVariables')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t('variablesTitle')}</DialogTitle>
                  <DialogDescription>
                    {t('variablesDesc')}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 mt-4">
                  {REMINDER_VARIABLES.map((variable) => (
                    <div key={variable.key} className="flex justify-between items-start text-sm">
                      <div>
                        <code className="bg-muted px-1 rounded text-xs">{variable.key}</code>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {variable.description}
                        </p>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {variable.example}
                      </span>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {t('invoicesNeedReminder', { count: invoices.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('noInvoicesNeedReminder')}</p>
              <p className="text-sm">{t('allPaid')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invoiceColumn')}</TableHead>
                  <TableHead>{t('customerColumn')}</TableHead>
                  <TableHead className="text-right">{t('remainingColumn')}</TableHead>
                  <TableHead>{t('statusColumn')}</TableHead>
                  <TableHead className="text-right">{t('actionsColumn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(({ invoice, customerName, remaining, daysOverdue }) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="font-medium hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{customerName}</TableCell>
                    <TableCell className="text-right font-medium">
                      {paymentService.formatCurrency(remaining)}
                    </TableCell>
                    <TableCell>{getStatusBadge(daysOverdue)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(invoice.id!)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{t('previewTitle')}</DialogTitle>
                              <DialogDescription>
                                Invoice: {previewInvoice?.invoiceNumber}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm">
                              {previewText}
                            </div>
                            <div className="flex justify-end">
                              <Button onClick={() => handleSendWhatsApp(invoice.id!)}>
                                <Send className="mr-2 h-4 w-4" />
                                {t('sendViaWhatsApp')}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendWhatsApp(invoice.id!)}
                          disabled={sending === invoice.id}
                        >
                          {sending === invoice.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <MessageCircle className="mr-2 h-4 w-4" />
                          )}
                          WhatsApp
                          {!waConnected && <ExternalLink className="ml-1 h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settingsTitle')}</DialogTitle>
            <DialogDescription>
              {t('settingsDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">{t('companyNameLabel')}</Label>
              <Input
                id="companyName"
                value={businessSettings.companyName}
                onChange={(e) =>
                  setBusinessSettings((s) => ({ ...s, companyName: e.target.value }))
                }
                placeholder={t('companyNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bankAccount">{t('bankAccountLabel')}</Label>
              <Textarea
                id="bankAccount"
                value={businessSettings.bankAccount}
                onChange={(e) =>
                  setBusinessSettings((s) => ({ ...s, bankAccount: e.target.value }))
                }
                placeholder={t('bankAccountPlaceholder')}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                {tc('cancel')}
              </Button>
              <Button onClick={handleSaveSettings}>{tc('save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
