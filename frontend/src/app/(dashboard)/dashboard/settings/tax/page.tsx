"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Receipt, Download, FileSpreadsheet, Loader2, Building2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

export default function TaxSettingsPage() {
  const t = useTranslations("settings.tax");
  const [loading, setLoading] = useState(true);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState("11");
  const [businessNpwp, setBusinessNpwp] = useState("");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const res = await authService.fetchWithAuth("/business");
      if (res.ok) {
        const data = await res.json();
        const biz = data.data || data;
        setBusinessNpwp(biz.npwp || "");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleExportEfaktur() {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (exportFrom) params.set("from", exportFrom);
      if (exportTo) params.set("to", exportTo);

      const res = await authService.fetchWithAuth(`/invoices/export/efaktur?${params}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `efaktur-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("saveSuccess"));
    } catch {
      toast.error(t("saveError"));
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" /> {t("vatEnabled")}
          </CardTitle>
          <CardDescription>{t("vatEnabledDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{t("vatEnabled")}</p>
              <p className="text-sm text-muted-foreground">{t("vatEnabledDesc")}</p>
            </div>
            <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
          </div>
          {taxEnabled && (
            <div className="space-y-2">
              <Label>{t("vatRate")}</Label>
              <div className="flex items-center gap-2">
                <Input type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
                  className="w-32" min="0" max="100" step="0.5" />
                <span className="text-muted-foreground">%</span>
                <Badge variant="outline">= {parseInt(taxRate) * 100} BPS</Badge>
              </div>
              <p className="text-xs text-muted-foreground">PPN Indonesia: 11% (1100 basis points)</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> {t("taxId")}
          </CardTitle>
          <CardDescription>NPWP</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("taxId")}</Label>
            <Input value={businessNpwp} onChange={(e) => setBusinessNpwp(e.target.value)}
              placeholder="XX.XXX.XXX.X-XXX.XXX" />
            <p className="text-xs text-muted-foreground">Format: XX.XXX.XXX.X-XXX.XXX (15 digit)</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Important:</p>
                <p>NPWP is required for valid E-Faktur export.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <FileSpreadsheet className="h-5 w-5" /> {t("eFaktur")}
          </CardTitle>
          <CardDescription>
            {t("eFakturDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">📋 E-Faktur Export Columns:</p>
            <p className="text-xs">FK, KD_JENIS_TRANSAKSI, FG_PENGGANTI, NOMOR_FAKTUR, MASA_PAJAK, TAHUN_PAJAK, TANGGAL_FAKTUR, NPWP, NAMA, ALAMAT, DPP, PPN, PPNBM, REFERENSI</p>
          </div>

          <Button onClick={handleExportEfaktur} disabled={exporting} className="w-full">
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {exporting ? "Downloading..." : "Download CSV E-Faktur"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
