"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";
import { useAuth } from "@/components/auth-provider";

interface CustomerData {
  id: string;
  name: string;
}

interface ProductData {
  id: string;
  name: string;
  price: number;
}

interface LineItem {
  tempId: string;
  productId: string;
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function NewInvoicePage() {
  const t = useTranslations("invoiceNew");
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [items, setItems] = useState<LineItem[]>([]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) loadData();
  }, [authLoading, isAuthenticated]);

  async function loadData() {
    try {
      const [custRes, prodRes] = await Promise.all([
        authService.fetchWithAuth("/customers"),
        authService.fetchWithAuth("/products"),
      ]);
      if (custRes.ok) {
        const custData = await custRes.json();
        setCustomers(custData.data || []);
      }
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        const rawProducts: ProductData[] = prodData.data || [];
        // Deduplicate by name (DB may have duplicates with different IDs)
        const seenNames = new Set<string>();
        const uniqueProducts = rawProducts.filter((p) => {
          if (seenNames.has(p.name)) return false;
          seenNames.add(p.name);
          return true;
        });
        setProducts(uniqueProducts);
      }
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error(t("failedLoadData"));
    }
  }

  function addItem() {
    setItems([
      ...items,
      {
        tempId: crypto.randomUUID(),
        productId: "",
        description: "",
        qty: 1,
        unitPrice: 0,
        total: 0,
      },
    ]);
  }

  function updateItem(tempId: string, field: keyof LineItem, value: unknown) {
    setItems(
      items.map((item) => {
        if (item.tempId !== tempId) return item;

        const updated = { ...item, [field]: value };

        // If product changed, update description and price
        if (field === "productId") {
          const product = products.find((p) => p.id === value);
          if (product) {
            updated.description = product.name;
            updated.unitPrice = product.price;
            updated.total = product.price * updated.qty;
          }
        }

        // Recalculate total if qty or price changed
        if (field === "qty" || field === "unitPrice") {
          updated.total = updated.unitPrice * updated.qty;
        }

        return updated;
      })
    );
  }

  function removeItem(tempId: string) {
    setItems(items.filter((item) => item.tempId !== tempId));
  }

  function calculateSubtotal(): number {
    return items.reduce((sum, item) => sum + item.total, 0);
  }

  function calculateTax(): number {
    return Math.round(calculateSubtotal() * (taxRate / 100));
  }

  function calculateTotal(): number {
    return calculateSubtotal() + calculateTax();
  }

  async function handleSubmit() {
    // Validation
    if (!customerId) {
      toast.error(t("selectCustomer"));
      return;
    }
    if (items.length === 0) {
      toast.error(t("addMinOneItem"));
      return;
    }
    if (items.some((item) => !item.productId)) {
      toast.error(t("selectProductForAll"));
      return;
    }

    try {
      setLoading(true);

      // Build server API payload
      const payload = {
        customerId,
        issueDate,
        dueDate,
        taxEnabled: taxRate > 0,
        taxRateBps: taxRate * 100, // Convert percentage to basis points
        items: items.map((item) => ({
          productId: item.productId,
          description: item.description,
          qty: item.qty,
          unitPrice: item.unitPrice,
        })),
      };

      const res = await authService.fetchWithAuth("/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to create invoice");
      }

      toast.success(t("invoiceCreated"));
      router.push("/dashboard/invoices");
    } catch (error) {
      console.error("Failed to create invoice:", error);
      toast.error(t("failedCreate"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/invoices">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Dates */}
          <Card>
            <CardHeader>
              <CardTitle>{t("invoiceInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer">{t("customerLabel")}</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("customerPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="issueDate">{t("issueDate")}</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">{t("dueDate")}</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("lineItems")}</CardTitle>
              <Button size="sm" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" /> {t("addItem")}
              </Button>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {t("noItems")}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">{t("productColumn")}</TableHead>
                      <TableHead className="text-center">{t("qtyColumn")}</TableHead>
                      <TableHead className="text-right">{t("priceColumn")}</TableHead>
                      <TableHead className="text-right">{t("totalColumn")}</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.tempId}>
                        <TableCell>
                          <Select
                            value={item.productId}
                            onValueChange={(val) =>
                              updateItem(item.tempId, "productId", val)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={t("productPlaceholder")} />
                            </SelectTrigger>
                            <SelectContent>
                              {products
                                .filter((product) => {
                                  const usedIds = items
                                    .filter((it) => it.tempId !== item.tempId)
                                    .map((it) => it.productId)
                                    .filter(Boolean);
                                  return !usedIds.includes(product.id);
                                })
                                .map((product) => (
                                <SelectItem
                                  key={product.id}
                                  value={product.id}
                                >
                                  {product.name} —{" "}
                                  {formatCurrency(product.price)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={1}
                            value={item.qty}
                            onChange={(e) =>
                              updateItem(
                                item.tempId,
                                "qty",
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-20 text-center"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.total)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => removeItem(item.tempId)}
                          >
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

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>{t("notesTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder={t("notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("summary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subtotal")}</span>
                <span>{formatCurrency(calculateSubtotal())}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("tax")}</span>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(taxRate)}
                    onValueChange={(val) => setTaxRate(parseInt(val))}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="11">11%</SelectItem>
                    </SelectContent>
                  </Select>
                  <span>{formatCurrency(calculateTax())}</span>
                </div>
              </div>

              <div className="border-t pt-4 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-primary">
                  {formatCurrency(calculateTotal())}
                </span>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={loading}
              >
                <Save className="mr-2 h-4 w-4" />
                {loading ? t("saving") : t("saveInvoice")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
