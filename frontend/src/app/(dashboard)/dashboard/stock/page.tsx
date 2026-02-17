"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Package, AlertTriangle, Loader2, TrendingUp, TrendingDown,
  Search, ArrowDownToLine, ArrowUpFromLine, BarChart3, Boxes,
} from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";
import { useAuth } from "@/components/auth-provider";
import { useTranslations } from "next-intl";

interface Product {
  id: string;
  name: string;
  sku?: string;
  price: number;
  unit: string;
  trackStock: boolean;
  currentStock: number;
  lowStockAlert: number | null;
  isLowStock: boolean;
}

interface StockSummary {
  totalTracked: number;
  lowStockCount: number;
  lowStockProducts: { id: string; name: string; currentStock: number; lowStockAlert: number; unit: string }[];
}

type StockLevel = "critical" | "low" | "normal" | "high";

function getStockLevel(product: Product): StockLevel {
  if (product.lowStockAlert === null) return "normal";
  if (product.currentStock <= 0) return "critical";
  if (product.currentStock <= product.lowStockAlert) return "low";
  if (product.currentStock >= product.lowStockAlert * 3) return "high";
  return "normal";
}

function getStockLevelConfig(level: StockLevel) {
  switch (level) {
    case "critical":
      return {
        labelKey: "levelEmpty",
        color: "text-red-700 dark:text-red-400",
        bg: "bg-red-100 dark:bg-red-900/30",
        border: "border-red-200 dark:border-red-800",
        barColor: "bg-red-500",
        icon: AlertTriangle,
      };
    case "low":
      return {
        labelKey: "levelWarning",
        color: "text-orange-700 dark:text-orange-400",
        bg: "bg-orange-100 dark:bg-orange-900/30",
        border: "border-orange-200 dark:border-orange-800",
        barColor: "bg-orange-500",
        icon: TrendingDown,
      };
    case "high":
      return {
        labelKey: "levelHigh",
        color: "text-blue-700 dark:text-blue-400",
        bg: "bg-blue-100 dark:bg-blue-900/30",
        border: "border-blue-200 dark:border-blue-800",
        barColor: "bg-blue-500",
        icon: TrendingUp,
      };
    default:
      return {
        labelKey: "levelSafe",
        color: "text-green-700 dark:text-green-400",
        bg: "bg-green-100 dark:bg-green-900/30",
        border: "border-green-200 dark:border-green-800",
        barColor: "bg-green-500",
        icon: Package,
      };
  }
}

function StockBar({ product }: { product: Product }) {
  const level = getStockLevel(product);
  const config = getStockLevelConfig(level);
  const maxDisplay = product.lowStockAlert ? product.lowStockAlert * 4 : 100;
  const percentage = Math.min((product.currentStock / maxDisplay) * 100, 100);

  return (
    <div className="w-full">
      <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${config.barColor}`}
          style={{ width: `${Math.max(percentage, 2)}%` }}
        />
      </div>
    </div>
  );
}

export default function StockManagementPage() {
  const t = useTranslations('stock');
  const tc = useTranslations('common');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustType, setAdjustType] = useState<"in" | "out">("in");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  async function loadData() {
    try {
      setLoading(true);
      const [productsRes, summaryRes] = await Promise.all([
        authService.fetchWithAuth("/products"),
        authService.fetchWithAuth("/products/stock-summary"),
      ]);
      const productsData = await productsRes.json();
      const summaryData = await summaryRes.json();
      const tracked = (productsData.data || []).filter((p: Product) => p.trackStock);
      setProducts(tracked);
      setSummary(summaryData.data || null);
    } catch {
      toast.error(t('loadError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAdjust() {
    if (!adjustTarget || !adjustAmount) return;
    const rawAmount = Math.abs(parseInt(adjustAmount));
    if (isNaN(rawAmount) || rawAmount === 0) {
      toast.error(t('qtyRequired'));
      return;
    }
    const adjustment = adjustType === "out" ? -rawAmount : rawAmount;

    if (adjustType === "out" && rawAmount > adjustTarget.currentStock) {
      toast.error(t('insufficientStock', { available: `${adjustTarget.currentStock} ${adjustTarget.unit}` }));
      return;
    }

    try {
      const res = await authService.fetchWithAuth(`/products/${adjustTarget.id}/adjust-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adjustment, reason: adjustReason || undefined }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed");
      }
      toast.success(
        adjustType === "in"
          ? t('stockInSuccess', { amount: rawAmount, unit: adjustTarget.unit, product: adjustTarget.name })
          : t('stockOutSuccess', { amount: rawAmount, unit: adjustTarget.unit, product: adjustTarget.name })
      );
      setShowAdjust(false);
      setAdjustTarget(null);
      setAdjustAmount("");
      setAdjustReason("");
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('adjustError'));
    }
  }

  function openAdjust(product: Product, direction: "in" | "out") {
    setAdjustTarget(product);
    setAdjustType(direction);
    setAdjustAmount("");
    setAdjustReason("");
    setShowAdjust(true);
  }

  // Filtered + searched products
  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));
    if (filter === "low") return matchSearch && p.isLowStock;
    if (filter === "out") return matchSearch && p.currentStock <= 0;
    if (filter === "normal") return matchSearch && !p.isLowStock && p.currentStock > 0;
    return matchSearch;
  });

  // Compute totals
  const totalStockValue = products.reduce((sum, p) => sum + p.currentStock * p.price, 0);
  const totalUnits = products.reduce((sum, p) => sum + p.currentStock, 0);
  const criticalCount = products.filter((p) => p.currentStock <= 0).length;
  const lowCount = summary?.lowStockCount || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('loadingInventory')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('totalTracked')}</CardTitle>
            <Boxes className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('totalUnits', { count: totalUnits })}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('stockValue')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rp {totalStockValue.toLocaleString("id-ID")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('stockValueDesc')}</p>
          </CardContent>
        </Card>

        <Card className={lowCount > 0 ? "border-orange-200 dark:border-orange-800" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('lowStockCount')}</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${lowCount > 0 ? "text-orange-500" : "text-green-500"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowCount > 0 ? "text-orange-600" : "text-green-600"}`}>
              {lowCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {lowCount === 0 ? t('allStockSafe') : t('needRestock')}
            </p>
          </CardContent>
        </Card>

        <Card className={criticalCount > 0 ? "border-red-200 dark:border-red-800" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('outOfStock')}</CardTitle>
            <TrendingDown className={`h-4 w-4 ${criticalCount > 0 ? "text-red-500" : "text-green-500"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${criticalCount > 0 ? "text-red-600" : "text-green-600"}`}>
              {criticalCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {criticalCount === 0 ? t('noOutOfStock') : t('cantSell')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alert Banner */}
      {summary && summary.lowStockCount > 0 && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full p-2 bg-orange-100 dark:bg-orange-900/50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-orange-800 dark:text-orange-300 text-sm">
                  {t('lowStockWarning', { count: summary.lowStockCount })}
                </h4>
                <div className="flex flex-wrap gap-2 mt-2">
                  {summary.lowStockProducts.map((p) => (
                    <Badge key={p.id} variant="outline" className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 font-normal">
                      {p.name}: <span className="font-bold ml-1">{p.currentStock}</span>/{p.lowStockAlert} {p.unit}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter Bar */}
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
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filterAll')}</SelectItem>
            <SelectItem value="low">{t('filterLow')}</SelectItem>
            <SelectItem value="out">{t('filterOut')}</SelectItem>
            <SelectItem value="normal">{t('filterNormal')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stock Table */}
      <Card>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-semibold">
                {products.length === 0
                  ? t('noProducts')
                  : t('noMatchingProducts')}
              </h3>
              <p className="text-muted-foreground text-sm mt-1">
                {products.length === 0
                  ? t('noProductsDesc')
                  : t('changeFilterHint')}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('productColumn')}</TableHead>
                  <TableHead>{t('stockLevelColumn')}</TableHead>
                  <TableHead className="text-right">{t('qtyColumn')}</TableHead>
                  <TableHead className="text-right">{t('minThreshold')}</TableHead>
                  <TableHead className="text-right">{t('valueColumn')}</TableHead>
                  <TableHead>{t('statusColumn')}</TableHead>
                  <TableHead className="text-right">{t('actionsColumn')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => {
                  const level = getStockLevel(product);
                  const config = getStockLevelConfig(level);
                  const StatusIcon = config.icon;
                  const stockValue = product.currentStock * product.price;

                  return (
                    <TableRow key={product.id} className={level === "critical" ? "bg-red-50/50 dark:bg-red-950/10" : level === "low" ? "bg-orange-50/30 dark:bg-orange-950/10" : ""}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{product.name}</span>
                          {product.sku && (
                            <span className="block text-xs text-muted-foreground">{product.sku}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="w-40">
                        <StockBar product={product} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono font-bold text-lg ${config.color}`}>
                          {product.currentStock}
                        </span>
                        <span className="text-muted-foreground text-xs ml-1">{product.unit}</span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {product.lowStockAlert !== null ? `${product.lowStockAlert} ${product.unit}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        Rp {stockValue.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${config.bg} ${config.color} ${config.border} border gap-1`} variant="outline">
                          <StatusIcon className="h-3 w-3" />
                          {t(config.labelKey)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                            onClick={() => openAdjust(product, "in")}
                          >
                            <ArrowDownToLine className="h-3.5 w-3.5 mr-1" /> {t('inButton')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={() => openAdjust(product, "out")}
                            disabled={product.currentStock <= 0}
                          >
                            <ArrowUpFromLine className="h-3.5 w-3.5 mr-1" /> {t('outButton')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {adjustType === "in" ? (
                <><ArrowDownToLine className="h-5 w-5 text-green-600" /> {t('stockIn')}</>
              ) : (
                <><ArrowUpFromLine className="h-5 w-5 text-red-600" /> {t('stockOut')}</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Product info */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="font-medium">{adjustTarget?.name}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {t('currentStock')}: <span className="font-bold text-foreground">{adjustTarget?.currentStock} {adjustTarget?.unit}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('qtyLabel')} ({adjustTarget?.unit})</Label>
              <Input
                type="number"
                min="1"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder={t('enterQty', { unit: adjustTarget?.unit || '' })}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>{t('notesLabel')}</Label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder={adjustType === "in" ? t('reasonPlaceholderIn') : t('reasonPlaceholderOut')}
              />
            </div>

            {/* Preview */}
            {adjustAmount && adjustTarget && parseInt(adjustAmount) > 0 && (
              <div className={`p-3 rounded-lg text-sm font-medium ${adjustType === "in" ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"}`}>
                <div className="flex items-center justify-between">
                  <span>{t('change')}:</span>
                  <span>{adjustType === "in" ? "+" : "-"}{Math.abs(parseInt(adjustAmount))} {adjustTarget.unit}</span>
                </div>
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-current/10">
                  <span>{t('newStock')}:</span>
                  <span className="font-bold">
                    {adjustType === "in"
                      ? adjustTarget.currentStock + Math.abs(parseInt(adjustAmount))
                      : adjustTarget.currentStock - Math.abs(parseInt(adjustAmount))
                    } {adjustTarget.unit}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjust(false)}>{tc('cancel')}</Button>
            <Button
              onClick={handleAdjust}
              className={adjustType === "in" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
              disabled={!adjustAmount || parseInt(adjustAmount) <= 0}
            >
              {adjustType === "in" ? t('addStock') : t('reduceStock')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
