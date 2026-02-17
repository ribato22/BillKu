"use client";

import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t("passwordTooShort"));
      return;
    }

    if (!token) {
      toast.error(t("invalidToken"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || t("error"));
      }

      setSuccess(true);
      toast.success(t("success"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("tokenExpired");
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t("invalidLink")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("invalidLinkMessage")}
          </p>
        </div>
        <Card className="border-0 shadow-none lg:border lg:shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-0 pt-4 lg:p-6">
            <XCircle className="h-16 w-16 text-destructive" />
            <Button asChild className="w-full">
              <Link href="/forgot-password">{t("requestNewLink")}</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  if (success) {
    return (
      <>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">{t("successTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("successMessage")}
          </p>
        </div>
        <Card className="border-0 shadow-none lg:border lg:shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-0 pt-4 lg:p-6">
            <CheckCircle className="h-16 w-16 text-green-500" />
            <Button asChild className="w-full">
              <Link href="/login">{t("goToLogin")}</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <Card className="border-0 shadow-none lg:border lg:shadow-sm">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 p-0 lg:p-6">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("newPassword")}</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder={t("newPasswordPlaceholder")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t("confirmPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                disabled={isLoading}
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4 p-0 pt-4 lg:p-6 lg:pt-0">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("submit")}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("backToLogin")}
        </Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
