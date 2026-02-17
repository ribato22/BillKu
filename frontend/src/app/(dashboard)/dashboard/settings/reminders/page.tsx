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
import { Textarea } from "@/components/ui/textarea";
import { Bell, Loader2, Plus, Trash2, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { authService } from "@/lib/auth";

interface ReminderSchedule {
  id?: string;
  name: string;
  trigger: string;
  daysBefore: number;
  isActive: boolean;
  messageTemplate: string;
  channel: string;
}

export default function RemindersSettingsPage() {
  const t = useTranslations("settings.reminders");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [schedules, setSchedules] = useState<ReminderSchedule[]>([]);

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadSchedules() {
    try {
      const res = await authService.fetchWithAuth("/settings/reminder-schedules");
      if (res.ok) {
        const json = await res.json();
        setSchedules(json.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(schedule: ReminderSchedule) {
    try {
      setSaving(true);
      const method = schedule.id ? "PUT" : "POST";
      const url = schedule.id
        ? `/settings/reminder-schedules/${schedule.id}`
        : "/settings/reminder-schedules";

      const res = await authService.fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      if (res.ok) {
        toast.success(t("saveSuccess"));
        loadSchedules();
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
      const res = await authService.fetchWithAuth(`/settings/reminder-schedules/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== id));
        toast.success(t("deleteSuccess"));
      }
    } catch {
      toast.error(t("deleteError"));
    }
  }

  function addSchedule() {
    setSchedules((prev) => [
      ...prev,
      {
        name: "",
        trigger: "before_due",
        daysBefore: 3,
        isActive: true,
        messageTemplate: "",
        channel: "email",
      },
    ]);
  }

  function updateSchedule(index: number, field: string, value: string | number | boolean) {
    setSchedules((prev) => {
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
        <Button onClick={addSchedule}>
          <Plus className="mr-2 h-4 w-4" /> {t("addSchedule")}
        </Button>
      </div>

      {schedules.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("noSchedules")}</h3>
            <p className="text-muted-foreground mb-4">{t("noSchedulesDesc")}</p>
            <Button onClick={addSchedule}>
              <Plus className="mr-2 h-4 w-4" /> {t("addSchedule")}
            </Button>
          </CardContent>
        </Card>
      )}

      {schedules.map((schedule, index) => (
        <Card key={schedule.id || `new-${index}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {schedule.name || t("newSchedule")}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={schedule.isActive ? "default" : "secondary"}>
                  {schedule.isActive ? (
                    <><CheckCircle className="h-3 w-3 mr-1" />{t("active")}</>
                  ) : (
                    <><AlertCircle className="h-3 w-3 mr-1" />{t("inactive")}</>
                  )}
                </Badge>
                <Switch checked={schedule.isActive} onCheckedChange={(v) => updateSchedule(index, "isActive", v)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("name")}</Label>
                <Input
                  value={schedule.name}
                  onChange={(e) => updateSchedule(index, "name", e.target.value)}
                  placeholder={t("namePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("channel")}</Label>
                <Select value={schedule.channel} onValueChange={(v) => updateSchedule(index, "channel", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="both">{t("bothChannels")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("trigger")}</Label>
                <Select value={schedule.trigger} onValueChange={(v) => updateSchedule(index, "trigger", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="before_due">{t("beforeDue")}</SelectItem>
                    <SelectItem value="on_due">{t("onDue")}</SelectItem>
                    <SelectItem value="after_due">{t("afterDue")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("days")}</Label>
                <Input
                  type="number"
                  value={schedule.daysBefore}
                  onChange={(e) => updateSchedule(index, "daysBefore", parseInt(e.target.value) || 0)}
                  min="0"
                  max="90"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("messageTemplate")}</Label>
              <Textarea
                value={schedule.messageTemplate}
                onChange={(e) => updateSchedule(index, "messageTemplate", e.target.value)}
                placeholder={t("messagePlaceholder")}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{t("availableVariables")}</p>
            </div>

            <div className="flex justify-between">
              {schedule.id && (
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDelete(schedule.id!)}>
                  <Trash2 className="mr-2 h-4 w-4" /> {t("deleteSchedule")}
                </Button>
              )}
              <Button onClick={() => handleSave(schedule)} disabled={saving} className="ml-auto">
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
