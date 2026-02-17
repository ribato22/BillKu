"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  RefreshCw,
  Crown,
  ShieldCheck,
  User,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { authService } from "@/lib/auth";
import { useTranslations } from "next-intl";

interface Member {
  id: string;
  role: string;
  createdAt: string;
  user: { id: string; email: string };
}

const ROLE_ICONS: Record<string, LucideIcon> = {
  owner: Crown,
  admin: ShieldCheck,
  staff: User,
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  admin: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  staff: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function TeamPage() {
  const t = useTranslations('team');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "staff">("staff");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await authService.fetchWithAuth("/team");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.data);
      }
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await authService.fetchWithAuth("/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        setSuccess(t('inviteSuccess', { email: inviteEmail }));
        setInviteEmail("");
        fetchMembers();
      } else {
        const err = await res.json();
        setError(err.message || t('inviteError'));
      }
    } catch {
      setError(t('inviteError'));
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const res = await authService.fetchWithAuth(`/team/${memberId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        fetchMembers();
      } else {
        const err = await res.json();
        setError(err.message || t('roleChangeError'));
      }
    } catch {
      setError(t('roleChangeError'));
    }
  };

  const handleRemove = async (memberId: string, email: string) => {
    if (!confirm(t('removeConfirm', { email }))) return;
    try {
      const res = await authService.fetchWithAuth(`/team/${memberId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSuccess(t('removeSuccess'));
        fetchMembers();
      } else {
        const err = await res.json();
        setError(err.message || t('removeError'));
      }
    } catch {
      setError(t('removeError'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6" /> {t('title')}
          </h1>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <button
          onClick={fetchMembers}
          className="p-2 rounded-lg hover:bg-muted transition"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 text-sm">
          {success}
        </div>
      )}

      {/* Invite Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5 text-blue-500" /> {t('inviteTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder={t('emailPlaceholder')}
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 rounded-lg border px-4 py-2 text-sm bg-background focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as "admin" | "staff")
              }
              className="rounded-lg border px-4 py-2 text-sm bg-background"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={!inviteEmail || inviting}
              className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition text-sm font-medium"
            >
              {inviting ? t('inviting') : t('inviteButton')}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-violet-500" /> {t('membersCount', { count: members.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t('noMembers')}
            </p>
          ) : (
            <div className="divide-y">
              {members.map((member) => {
                const RoleIcon = ROLE_ICONS[member.role] || User;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between py-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <RoleIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {member.user.email}
                        </p>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${ROLE_COLORS[member.role]}`}
                        >
                          {ROLE_LABELS[member.role] || member.role}
                        </span>
                      </div>
                    </div>
                    {member.role !== "owner" && (
                      <div className="flex items-center gap-2">
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleUpdateRole(member.id, e.target.value)
                          }
                          className="rounded-lg border px-3 py-1.5 text-xs bg-background"
                        >
                          <option value="staff">Staff</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={() =>
                            handleRemove(member.id, member.user.email)
                          }
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
