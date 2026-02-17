"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Upload, X, Building2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

interface ProfileData {
  businessName: string;
  ownerName: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  taxId: string;
  logoUrl: string | null;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
}

export default function ProfileSettingsPage() {
  const t = useTranslations("settings.profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    businessName: "",
    ownerName: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    postalCode: "",
    taxId: "",
    logoUrl: null,
    bankName: "",
    bankAccountNumber: "",
    bankAccountName: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const res = await authService.fetchWithAuth("/settings/profile");
      const json = await res.json();
      if (json.data) {
        setProfile({
          businessName: json.data.businessName || "",
          ownerName: json.data.ownerName || "",
          phone: json.data.phone || "",
          address: json.data.address || "",
          city: json.data.city || "",
          province: json.data.province || "",
          postalCode: json.data.postalCode || "",
          taxId: json.data.taxId || "",
          logoUrl: json.data.logoUrl || null,
          bankName: json.data.bankName || "",
          bankAccountNumber: json.data.bankAccountNumber || "",
          bankAccountName: json.data.bankAccountName || "",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const res = await authService.fetchWithAuth("/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        toast.success(t("saveSuccess"));
      } else {
        toast.error(t("saveError"));
      }
    } catch {
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const res = await authService.fetchWithAuth("/settings/profile/logo", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (res.ok) {
        setProfile((prev) => ({ ...prev, logoUrl: json.data?.logoUrl || null }));
        toast.success(t("saveSuccess"));
      }
    } catch {
      toast.error(t("saveError"));
    }
  }

  async function handleLogoRemove() {
    try {
      await authService.fetchWithAuth("/settings/profile/logo", { method: "DELETE" });
      setProfile((prev) => ({ ...prev, logoUrl: null }));
    } catch {
      toast.error(t("saveError"));
    }
  }

  function handleChange(field: keyof ProfileData, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
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
            <Building2 className="h-5 w-5" />
            {t("businessInfo")}
          </CardTitle>
          <CardDescription>{t("businessInfoDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("logo")}</Label>
            <p className="text-xs text-muted-foreground">{t("logoDesc")}</p>
            <div className="flex items-center gap-4">
              {profile.logoUrl && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={profile.logoUrl} alt="Logo" className="h-16 w-16 rounded-lg object-cover border" />
                  <button
                    onClick={handleLogoRemove}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {t("uploadLogo")}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("businessName")}</Label>
              <Input value={profile.businessName} onChange={(e) => handleChange("businessName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("ownerName")}</Label>
              <Input value={profile.ownerName} onChange={(e) => handleChange("ownerName", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("phone")}</Label>
              <Input value={profile.phone} onChange={(e) => handleChange("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("taxId")}</Label>
              <Input value={profile.taxId} onChange={(e) => handleChange("taxId", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("address")}</Label>
            <Input value={profile.address} onChange={(e) => handleChange("address", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t("city")}</Label>
              <Input value={profile.city} onChange={(e) => handleChange("city", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("province")}</Label>
              <Input value={profile.province} onChange={(e) => handleChange("province", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t("postalCode")}</Label>
              <Input value={profile.postalCode} onChange={(e) => handleChange("postalCode", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            {t("bankInfo")}
          </CardTitle>
          <CardDescription>{t("bankInfoDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{t("bankName")}</Label>
              <Input value={profile.bankName} onChange={(e) => handleChange("bankName", e.target.value)} placeholder="BCA" />
            </div>
            <div className="space-y-2">
              <Label>{t("bankAccountNumber")}</Label>
              <Input value={profile.bankAccountNumber} onChange={(e) => handleChange("bankAccountNumber", e.target.value)} placeholder="1234567890" />
            </div>
            <div className="space-y-2">
              <Label>{t("bankAccountName")}</Label>
              <Input value={profile.bankAccountName} onChange={(e) => handleChange("bankAccountName", e.target.value)} placeholder={t("bankAccountPlaceholder")} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("saving")}
            </>
          ) : (
            t("save")
          )}
        </Button>
      </div>
    </div>
  );
}
