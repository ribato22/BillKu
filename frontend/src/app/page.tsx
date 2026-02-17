"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  FileText,
  Users,
  TrendingUp,
  Smartphone,
  Shield,
  Zap,
} from "lucide-react";

export default function Home() {
  const t = useTranslations();

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 mx-auto">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/icons/icon-192x192.png"
              alt="BillKu"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-xl font-bold text-primary">BillKu</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher />
            <Link href="/login">
              <Button variant="ghost">{t("landing.hero.login")}</Button>
            </Link>
            <Link href="/register">
              <Button>{t("landing.hero.cta")}</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container flex flex-col items-center justify-center gap-8 px-4 py-24 text-center mx-auto">
        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            {t("landing.hero.title")}{" "}
            <span className="text-primary">{t("landing.hero.titleHighlight")}</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            {t("landing.hero.subtitle")}
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link href="/register">
            <Button size="lg" className="h-12 px-8 text-lg">
              {t("landing.hero.cta")}
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container px-4 py-24 mx-auto">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold">
            {t("landing.features.title")}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t("landing.features.subtitle")}
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<FileText className="h-8 w-8 text-primary" />}
            title={t("landing.features.invoice.title")}
            description={t("landing.features.invoice.desc")}
          />
          <FeatureCard
            icon={<Users className="h-8 w-8 text-primary" />}
            title={t("landing.features.receivables.title")}
            description={t("landing.features.receivables.desc")}
          />
          <FeatureCard
            icon={<TrendingUp className="h-8 w-8 text-primary" />}
            title={t("landing.features.reports.title")}
            description={t("landing.features.reports.desc")}
          />
          <FeatureCard
            icon={<Smartphone className="h-8 w-8 text-primary" />}
            title={t("landing.features.whatsapp.title")}
            description={t("landing.features.whatsapp.desc")}
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8 text-primary" />}
            title={t("landing.features.offline.title")}
            description={t("landing.features.offline.desc")}
          />
          <FeatureCard
            icon={<Zap className="h-8 w-8 text-primary" />}
            title={t("landing.features.team.title")}
            description={t("landing.features.team.desc")}
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary py-16">
        <div className="container px-4 text-center mx-auto">
          <h2 className="text-3xl font-bold text-primary-foreground">
            {t("landing.cta.title")}
          </h2>
          <p className="mt-2 text-primary-foreground/80">
            {t("landing.cta.subtitle")}
          </p>
          <Link href="/register">
            <Button
              size="lg"
              variant="secondary"
              className="mt-6 h-12 px-8 text-lg"
            >
              {t("landing.cta.button")}
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 px-4 sm:flex-row mx-auto">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/icons/icon-192x192.png"
              alt="BillKu"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="text-sm text-muted-foreground">
              {t("landing.footer.copyright", { year: new Date().getFullYear() })}
            </span>
          </Link>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>{t("landing.footer.madeWith")}</span>
            <span className="text-red-500">❤</span>
            <span>{t("landing.footer.forIndonesia")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-3 p-6">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
