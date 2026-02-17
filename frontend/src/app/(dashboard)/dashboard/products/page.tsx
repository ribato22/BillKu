"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Package,
  Loader2,
  Cloud,
  CloudOff,
} from "lucide-react";
import { toast } from "sonner";
import { productService } from "@/lib/db/products";
import type { Product } from "@/lib/db";

export default function ProductsPage() {
  const t = useTranslations("products");
  const tc = useTranslations("common");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    unit: "pcs",
    sku: "",
    isActive: true,
    trackStock: false,
    currentStock: 0,
    lowStockAlert: "",
  });

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      const data = await productService.getAll();
      setProducts(data);
    } catch (error) {
      console.error("Failed to load products:", error);
      toast.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(query: string) {
    setSearchQuery(query);
    if (query.trim()) {
      const results = await productService.search(query);
      setProducts(results);
    } else {
      loadProducts();
    }
  }

  function openCreateDialog() {
    setEditingProduct(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      unit: "pcs",
      sku: "",
      isActive: true,
      trackStock: false,
      currentStock: 0,
      lowStockAlert: "",
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(product: Product) {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || "",
      price: product.price.toString(),
      unit: product.unit,
      sku: product.sku || "",
      isActive: product.isActive,
      trackStock: (product as unknown as Record<string, unknown>).trackStock as boolean || false,
      currentStock: (product as unknown as Record<string, unknown>).currentStock as number || 0,
      lowStockAlert: ((product as unknown as Record<string, unknown>).lowStockAlert as number)?.toString() || "",
    });
    setIsDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formData.name.trim()) {
      toast.error(t("nameRequired"));
      return;
    }
    if (!formData.price || isNaN(Number(formData.price))) {
      toast.error(t("priceRequired"));
      return;
    }

    try {
      const productData = {
        ...formData,
        price: Number(formData.price),
        lowStockAlert: formData.lowStockAlert ? Number(formData.lowStockAlert) : null,
      };

      if (editingProduct) {
        await productService.update(editingProduct.id!, productData);
        toast.success(t("updateSuccess"));
      } else {
        await productService.create(productData);
        toast.success(t("addSuccess"));
      }
      setIsDialogOpen(false);
      loadProducts();
    } catch (error) {
      console.error("Failed to save product:", error);
      toast.error(t("saveError"));
    }
  }

  async function handleDelete(product: Product) {
    if (!confirm(t("deleteConfirm", { name: product.name }))) return;

    try {
      await productService.hardDelete(product.id!);
      toast.success(t("deleteSuccess"));
      loadProducts();
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast.error(t("deleteError"));
    }
  }

  function getSyncBadge(status: Product["syncStatus"]) {
    switch (status) {
      case "synced":
        return (
          <Badge variant="outline" className="text-green-600">
            <Cloud className="mr-1 h-3 w-3" /> Synced
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="text-yellow-600">
            <CloudOff className="mr-1 h-3 w-3" /> Pending
          </Badge>
        );
      default:
        return <Badge variant="destructive">Conflict</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" /> {t("addProduct")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? t("editProduct") : t("addNew")}
              </DialogTitle>
              <DialogDescription>
                {editingProduct
                  ? t("editInfo")
                  : t("fillNew")}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t("nameLabel")}</Label>
                <Input
                  id="name"
                  placeholder={t("namePlaceholder")}
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t("descriptionLabel")}</Label>
                <Input
                  id="description"
                  placeholder={t("descriptionPlaceholder")}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">{t("priceLabel")}</Label>
                  <Input
                    id="price"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formData.price ? Number(formData.price.toString().replace(/\./g, '')).toLocaleString('id-ID') : ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, price: raw });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">{t("unitLabel")}</Label>
                  <Input
                    id="unit"
                    placeholder={t("unitPlaceholder")}
                    value={formData.unit}
                    onChange={(e) =>
                      setFormData({ ...formData, unit: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">{t("skuLabel")}</Label>
                <Input
                  id="sku"
                  placeholder={t("skuPlaceholder")}
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="trackStock"
                  checked={formData.trackStock}
                  onChange={(e) =>
                    setFormData({ ...formData, trackStock: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="trackStock">{t("trackStock")}</Label>
              </div>
              {formData.trackStock && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentStock">{t("initialStock")}</Label>
                    <Input
                      id="currentStock"
                      type="number"
                      placeholder="0"
                      value={formData.currentStock}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          currentStock: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lowStockAlert">{t("lowStockAlert")}</Label>
                    <Input
                      id="lowStockAlert"
                      type="number"
                      placeholder={t("lowStockPlaceholder")}
                      value={formData.lowStockAlert}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lowStockAlert: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button onClick={handleSubmit}>
                {editingProduct ? tc("save") : tc("add")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("totalProducts")}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          className="pl-10"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">{t("noProducts")}</h3>
              <p className="text-muted-foreground">
                {t("addFirst")}
              </p>
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" /> {t("addProduct")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tc("name")}</TableHead>
                  <TableHead>{t("sku")}</TableHead>
                  <TableHead className="text-right">{tc("price")}</TableHead>
                  <TableHead>{tc("unit")}</TableHead>
                  <TableHead>{t("syncStatus")}</TableHead>
                  <TableHead className="w-[100px]">{tc("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {product.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{product.sku || "-"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {productService.formatPrice(product.price)}
                    </TableCell>
                    <TableCell>{product.unit}</TableCell>
                    <TableCell>{getSyncBadge(product.syncStatus)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(product)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(product)}
                        >
                          <Trash2 className="h-4 w-4" />
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
    </div>
  );
}
