"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Trash2, Loader2, Truck,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

interface DeliveryNoteItem {
  description: string;
  qty: number;
  unit: string;
  productId?: string;
}

interface DeliveryNote {
  id: string;
  noteNumber: string;
  deliveryDate: string;
  recipient: string;
  address?: string;
  notes?: string;
  invoice?: { id: string; invoiceNumber: string };
  items: DeliveryNoteItem[];
  createdAt: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
}

interface Product {
  id: string;
  name: string;
  unit: string;
}

export default function DeliveryNotesPage() {
  const t = useTranslations("deliveryNotes");
  const tc = useTranslations("common");
  const [notes, setNotes] = useState<DeliveryNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingInvoice, setFetchingInvoice] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    invoiceId: "",
    deliveryDate: new Date().toISOString().split("T")[0],
    recipient: "",
    address: "",
    notes: "",
    items: [{ description: "", qty: 1, unit: "pcs" }] as DeliveryNoteItem[],
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [nRes, iRes, pRes] = await Promise.all([
        authService.fetchWithAuth("/delivery-notes"),
        authService.fetchWithAuth("/invoices"),
        authService.fetchWithAuth("/products"),
      ]);
      const nData = await nRes.json();
      const iData = await iRes.json();
      const pData = await pRes.json();
      setNotes(nData.data || []);
      setInvoices(iData.data?.invoices || iData.data || []);
      setProducts(pData.data || []);
    } catch (error) {
      console.error(error);
      toast.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleInvoiceSelect(invoiceId: string) {
    setFormData((prev) => ({ ...prev, invoiceId }));
    setAutoFilled(false);

    if (!invoiceId) return;

    try {
      setFetchingInvoice(true);
      const res = await authService.fetchWithAuth(`/invoices/${invoiceId}`);
      if (!res.ok) return;
      const data = await res.json();
      const inv = data.data || data;

      // Auto-fill items from invoice
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invoiceItems: DeliveryNoteItem[] = (inv.items || []).map((item: any) => ({
        description: item.description || item.product?.name || "",
        qty: item.qty || item.quantity || 1,
        unit: item.product?.unit || "pcs",
        productId: item.productId || undefined,
      }));

      // Auto-fill recipient and address from customer
      const recipient = inv.customer?.name || "";
      const address = inv.customer?.address || "";

      setFormData((prev) => ({
        ...prev,
        invoiceId,
        recipient: prev.recipient || recipient,
        address: prev.address || address,
        items: invoiceItems.length > 0 ? invoiceItems : prev.items,
      }));
      if (invoiceItems.length > 0) {
        setAutoFilled(true);
        toast.success(t("autoFillSuccess", { count: invoiceItems.length }));
      }
    } catch (error) {
      console.error("Failed to fetch invoice details:", error);
    } finally {
      setFetchingInvoice(false);
    }
  }

  function openCreateDialog() {
    setFormData({
      invoiceId: "",
      deliveryDate: new Date().toISOString().split("T")[0],
      recipient: "",
      address: "",
      notes: "",
      items: [{ description: "", qty: 1, unit: "pcs" }],
    });
    setAutoFilled(false);
    setIsDialogOpen(true);
  }

  function addItem() {
    setFormData({
      ...formData,
      items: [...formData.items, { description: "", qty: 1, unit: "pcs" }],
    });
  }

  function removeItem(idx: number) {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== idx),
    });
  }

  function updateItem(idx: number, field: keyof DeliveryNoteItem, value: string | number) {
    const items = [...formData.items];
    items[idx] = { ...items[idx], [field]: value };
    setFormData({ ...formData, items });
  }

  function selectProduct(idx: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const items = [...formData.items];
    items[idx] = {
      ...items[idx],
      productId: product.id,
      description: product.name,
      unit: product.unit || "pcs",
    };
    setFormData({ ...formData, items });
  }

  async function handleSubmit() {
    if (!formData.invoiceId) {
      toast.error(t("invoiceRequired"));
      return;
    }
    if (!formData.recipient.trim()) {
      toast.error(t("recipientRequired"));
      return;
    }

    try {
      const res = await authService.fetchWithAuth("/delivery-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("createSuccess"));
      setIsDialogOpen(false);
      loadData();
    } catch {
      toast.error(t("createError"));
    }
  }

  async function handleDelete(n: DeliveryNote) {
    if (!confirm(t("deleteConfirm", { number: n.noteNumber }))) return;
    try {
      const res = await authService.fetchWithAuth(`/delivery-notes/${n.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success(t("deleteSuccess"));
      loadData();
    } catch {
      toast.error(t("deleteError"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" /> {t("createDeliveryNote")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("newDeliveryNote")}</DialogTitle>
              <DialogDescription>{t("newDeliveryNoteDesc")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>{t("invoiceLabel")}</Label>
                <Select value={formData.invoiceId} onValueChange={handleInvoiceSelect}>
                  <SelectTrigger>
                    {fetchingInvoice ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> {t("loadingItems")}
                      </span>
                    ) : (
                      <SelectValue placeholder={t("invoicePlaceholder")} />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {invoices.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>{inv.invoiceNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("deliveryDateLabel")}</Label>
                  <Input type="date" value={formData.deliveryDate}
                    onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("recipientLabel")}</Label>
                  <Input placeholder={t("recipientPlaceholder")} value={formData.recipient}
                    onChange={(e) => setFormData({ ...formData, recipient: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("addressLabel")}</Label>
                <Input placeholder={t("addressPlaceholder")} value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("notesLabel")}</Label>
                <Input placeholder={t("notesPlaceholder")} value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">{t("deliveryItems")}</Label>
                    {autoFilled && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {t("autoFillFromInvoice")}
                      </span>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="mr-1 h-3 w-3" /> {t("addItem")}
                  </Button>
                </div>
                {formData.items.map((item, idx) => (
                  <div key={idx} className="space-y-2 rounded-lg border p-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t("selectFromProducts")}</Label>
                      <Select value={item.productId || ""} onValueChange={(v) => selectProduct(idx, v)}>
                        <SelectTrigger><SelectValue placeholder={t("selectProductPlaceholder")} /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name} ({p.unit || "pcs"})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Input placeholder={t("descriptionPlaceholder")} value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)} />
                      </div>
                      <div className="col-span-3">
                        <Input type="number" placeholder={t("qtyPlaceholder")} value={item.qty}
                          onChange={(e) => updateItem(idx, "qty", Number(e.target.value))} />
                      </div>
                      <div className="col-span-3">
                        <Input placeholder={t("unitPlaceholder")} value={item.unit}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)} />
                      </div>
                      <div className="col-span-1">
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}
                          disabled={formData.items.length === 1}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{tc("cancel")}</Button>
              <Button onClick={handleSubmit}>{t("createDeliveryNote")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalDeliveryNotes")}</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{notes.length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Truck className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">{t("noDeliveryNotes")}</h3>
              <p className="text-muted-foreground">{t("createFirst")}</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" /> {t("createDeliveryNote")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("noteNumber")}</TableHead>
                  <TableHead>{t("invoiceColumn")}</TableHead>
                  <TableHead>{t("deliveryDateColumn")}</TableHead>
                  <TableHead>{t("recipientColumn")}</TableHead>
                  <TableHead>{t("itemsColumn")}</TableHead>
                  <TableHead className="w-[80px]">{tc("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.noteNumber}</TableCell>
                    <TableCell>{n.invoice?.invoiceNumber || "-"}</TableCell>
                    <TableCell>{new Date(n.deliveryDate).toLocaleDateString("id-ID")}</TableCell>
                    <TableCell>{n.recipient}</TableCell>
                    <TableCell>{t("itemCount", { count: n.items?.length || 0 })}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-destructive"
                        onClick={() => handleDelete(n)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
