"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Loader2, Send, CheckCircle, AlertCircle, Info, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

export default function EmailSettingsPage() {
  const t = useTranslations("settings.email");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await authService.fetchWithAuth("/settings/email-config");
      if (res.ok) {
        const json = await res.json();
        const cfg = json.data;
        if (cfg) {
          setSmtpHost(cfg.smtpHost || "");
          setSmtpPort(cfg.smtpPort?.toString() || "587");
          setSmtpUser(cfg.smtpUser || "");
          setSenderEmail(cfg.senderEmail || "");
          setIsConfigured(!!cfg.smtpHost);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const res = await authService.fetchWithAuth("/settings/email-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          smtpHost,
          smtpPort: parseInt(smtpPort),
          smtpUser,
          smtpPass: smtpPass || undefined,
          senderEmail,
        }),
      });
      if (res.ok) {
        toast.success(t("saveSuccess"));
        setIsConfigured(true);
      } else {
        toast.error(t("saveError"));
      }
    } catch {
      toast.error(t("saveErrorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTest() {
    if (!testEmail) {
      toast.error(t("testEmailRequired"));
      return;
    }
    try {
      setTesting(true);
      const res = await authService.fetchWithAuth("/settings/email-config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(json.message || "Email test sent!");
      } else {
        toast.error(json.message || t("testFailedDefault"));
      }
    } catch {
      toast.error(t("testSendError"));
    } finally {
      setTesting(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Badge variant={isConfigured ? "default" : "destructive"}>
          {isConfigured ? (
            <><CheckCircle className="h-3 w-3 mr-1" /> {t("configured")}</>
          ) : (
            <><AlertCircle className="h-3 w-3 mr-1" /> {t("notConfigured")}</>
          )}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" /> {t("smtpSettings")}
          </CardTitle>
          <CardDescription>{t("smtpSettingsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("smtpHost")}</Label>
              <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
            </div>
            <div className="space-y-2">
              <Label>{t("port")}</Label>
              <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("username")}</Label>
              <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="user@gmail.com" />
            </div>
            <div className="space-y-2">
              <Label>{t("password")}</Label>
              <Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("sender")}</Label>
            <Input value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder={t("senderPlaceholder")} />
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            {saving ? t("saving") : t("saveConfig")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> {t("testEmail")}
          </CardTitle>
          <CardDescription>{t("testEmailDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isConfigured && (
            <p className="text-sm text-muted-foreground">{t("saveFirstHint")}</p>
          )}
          <div className="space-y-2">
            <Label>{t("destinationEmail")}</Label>
            <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="test@email.com" />
          </div>
          <Button onClick={handleSendTest} disabled={testing || !isConfigured} variant="outline">
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {testing ? t("sending") : t("sendTest")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" /> {t("guide")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="h-4 w-4 mt-0.5 text-red-500" />
              <div>
                <p className="font-medium">Gmail</p>
                <p className="text-muted-foreground">{t("gmailGuide")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="h-4 w-4 mt-0.5 text-blue-500" />
              <div>
                <p className="font-medium">Outlook / Office 365</p>
                <p className="text-muted-foreground">{t("outlookGuide")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="h-4 w-4 mt-0.5 text-gray-500" />
              <div>
                <p className="font-medium">Custom SMTP</p>
                <p className="text-muted-foreground">{t("customSmtpGuide")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
