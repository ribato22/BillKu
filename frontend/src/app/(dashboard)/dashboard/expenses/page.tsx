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
  Plus, Trash2, Loader2, Receipt, TrendingDown, PieChart,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

interface Expense {
  id: string;
  categoryType: string;
  description: string;
  amount: string;
  date: string;
  vendorName?: string;
  notes?: string;
  createdAt: string;
}

interface ExpenseSummary {
  categories: { category: string; total: number; count: number }[];
  grandTotal: number;
}

export default function ExpensesPage() {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");

  const CATEGORIES = [
    { value: "operational", label: t("categoryOperational") },
    { value: "material", label: t("categoryMaterial") },
    { value: "salary", label: t("categorySalary") },
    { value: "utilities", label: t("categoryUtilities") },
    { value: "marketing", label: t("categoryMarketing") },
    { value: "other", label: t("categoryOther") },
  ];

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    categoryType: "operational",
    description: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    vendorName: "",
    notes: "",
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [eRes, sRes] = await Promise.all([
        authService.fetchWithAuth("/expenses"),
        authService.fetchWithAuth("/expenses/summary"),
      ]);
      const eData = await eRes.json();
      const sData = await sRes.json();
      setExpenses(eData.data || []);
      setSummary(sData.data || null);
    } catch (error) {
      console.error(error);
      toast.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setFormData({
      categoryType: "operational",
      description: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      vendorName: "",
      notes: "",
    });
    setIsDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.description.trim()) {
      toast.error(t("descriptionRequired"));
      return;
    }
    if (formData.amount <= 0) {
      toast.error(t("amountRequired"));
      return;
    }
    try {
      const res = await authService.fetchWithAuth("/expenses", {
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

  async function handleDelete(e: Expense) {
    if (!confirm(t("deleteConfirm", { description: e.description }))) return;
    try {
      await authService.fetchWithAuth(`/expenses/${e.id}`, { method: "DELETE" });
      toast.success(t("deleteSuccess"));
      loadData();
    } catch {
      toast.error(t("deleteError"));
    }
  }

  function getCategoryLabel(val: string) {
    return CATEGORIES.find((c) => c.value === val)?.label || val;
  }

  const filtered = categoryFilter === "all"
    ? expenses
    : expenses.filter((e) => e.categoryType === categoryFilter);

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
              <Plus className="mr-2 h-4 w-4" /> {t("addExpense")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("newExpense")}</DialogTitle>
              <DialogDescription>{t("newExpenseDesc")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>{t("categoryLabel")}</Label>
                <Select value={formData.categoryType} onValueChange={(v) => setFormData({ ...formData, categoryType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("descriptionLabel")}</Label>
                <Input placeholder={t("descriptionPlaceholder")} value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("amountLabel")}</Label>
                  <Input type="number" placeholder="150000" value={formData.amount || ""}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("dateLabel")}</Label>
                  <Input type="date" value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("vendorLabel")}</Label>
                <Input placeholder={t("vendorPlaceholder")} value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t("notesLabel")}</Label>
                <Input placeholder={t("notesPlaceholder")} value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>{tc("cancel")}</Button>
              <Button onClick={handleSubmit}>{tc("save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("totalExpenses")}</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              Rp {(summary?.grandTotal || 0).toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("transactionCount")}</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expenses.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("categories")}</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.categories?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {summary && summary.categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("categoryBreakdown")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.categories.map((cat) => (
                <div key={cat.category} className="flex items-center justify-between">
                  <span className="text-sm">{getCategoryLabel(cat.category)} ({cat.count})</span>
                  <span className="font-medium">Rp {cat.total.toLocaleString("id-ID")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">{t("noExpenses")}</h3>
              <p className="text-muted-foreground">{t("addFirst")}</p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" /> {t("addExpense")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("dateColumn")}</TableHead>
                  <TableHead>{t("categoryColumn")}</TableHead>
                  <TableHead>{t("descriptionColumn")}</TableHead>
                  <TableHead>{t("vendorColumn")}</TableHead>
                  <TableHead className="text-right">{t("amountColumn")}</TableHead>
                  <TableHead className="w-[80px]">{tc("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{new Date(e.date).toLocaleDateString("id-ID")}</TableCell>
                    <TableCell>{getCategoryLabel(e.categoryType)}</TableCell>
                    <TableCell className="font-medium">{e.description}</TableCell>
                    <TableCell>{e.vendorName || "-"}</TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      Rp {Number(e.amount).toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-destructive"
                        onClick={() => handleDelete(e)}>
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
