"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListChecks, Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

interface CustomField {
  id?: string;
  name: string;
  type: string;
  required: boolean;
  appliesTo: string;
  options?: string[];
}

export default function CustomFieldsPage() {
  const t = useTranslations("settings.customFields");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<CustomField[]>([]);

  useEffect(() => {
    loadFields();
  }, []);

  async function loadFields() {
    try {
      const res = await authService.fetchWithAuth("/settings/custom-fields");
      if (res.ok) {
        const json = await res.json();
        setFields(json.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(field: CustomField) {
    try {
      setSaving(true);
      const method = field.id ? "PUT" : "POST";
      const url = field.id
        ? `/settings/custom-fields/${field.id}`
        : "/settings/custom-fields";

      const res = await authService.fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(field),
      });
      if (res.ok) {
        toast.success(t("saveSuccess"));
        loadFields();
      } else {
        toast.error(t("saveError"));
      }
    } catch {
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await authService.fetchWithAuth(`/settings/custom-fields/${id}`, { method: "DELETE" });
      if (res.ok) {
        setFields((prev) => prev.filter((f) => f.id !== id));
        toast.success(t("deleteSuccess"));
      }
    } catch {
      toast.error(t("deleteError"));
    }
  }

  function addField() {
    setFields((prev) => [
      ...prev,
      {
        name: "",
        type: "text",
        required: false,
        appliesTo: "invoice",
        options: [],
      },
    ]);
  }

  function updateField(index: number, field: string, value: string | boolean | string[]) {
    setFields((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={addField}>
          <Plus className="mr-2 h-4 w-4" /> {t("addField")}
        </Button>
      </div>

      {fields.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <ListChecks className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("noFields")}</h3>
            <p className="text-muted-foreground mb-4">{t("noFieldsDesc")}</p>
            <Button onClick={addField}>
              <Plus className="mr-2 h-4 w-4" /> {t("addField")}
            </Button>
          </CardContent>
        </Card>
      )}

      {fields.map((field, index) => (
        <Card key={field.id || `new-${index}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                {field.name || t("newField")}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{field.appliesTo}</Badge>
                {field.required && <Badge variant="destructive">{t("required")}</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>{t("fieldName")}</Label>
                <Input
                  value={field.name}
                  onChange={(e) => updateField(index, "name", e.target.value)}
                  placeholder={t("fieldNamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("fieldType")}</Label>
                <Select value={field.type} onValueChange={(v) => updateField(index, "type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">{t("typeText")}</SelectItem>
                    <SelectItem value="number">{t("typeNumber")}</SelectItem>
                    <SelectItem value="date">{t("typeDate")}</SelectItem>
                    <SelectItem value="select">{t("typeSelect")}</SelectItem>
                    <SelectItem value="textarea">{t("typeTextarea")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("appliesTo")}</Label>
                <Select value={field.appliesTo} onValueChange={(v) => updateField(index, "appliesTo", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">{t("forInvoice")}</SelectItem>
                    <SelectItem value="customer">{t("forCustomer")}</SelectItem>
                    <SelectItem value="product">{t("forProduct")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={field.required} onCheckedChange={(v) => updateField(index, "required", v)} />
              <Label>{t("required")}</Label>
            </div>

            {field.type === "select" && (
              <div className="space-y-2">
                <Label>{t("options")}</Label>
                <Input
                  value={field.options?.join(", ") || ""}
                  onChange={(e) => updateField(index, "options", e.target.value.split(",").map((o) => o.trim()))}
                  placeholder={t("optionsPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">{t("separateWithComma")}</p>
              </div>
            )}

            <div className="flex justify-between">
              {field.id && (
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(field.id!)}>
                  <Trash2 className="mr-2 h-4 w-4" /> {t("deleteField")}
                </Button>
              )}
              <Button onClick={() => handleSave(field)} disabled={saving} className="ml-auto">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t("save")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
