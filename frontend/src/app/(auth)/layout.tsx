import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("auth.layout");

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side - Branding */}
      <div className="hidden lg:flex flex-col justify-between bg-primary p-10 text-primary-foreground">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/icons/icon-192x192.png"
              alt="BillKu"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <span className="text-2xl font-bold">BillKu</span>
          </Link>
        </div>
        <div className="space-y-4">
          <blockquote className="text-xl font-medium leading-relaxed">
            &ldquo;{t("tagline")}&rdquo;
          </blockquote>
          <div className="flex flex-col gap-1 text-sm text-primary-foreground/80">
            <span>{t("feature1")}</span>
            <span>{t("feature2")}</span>
            <span>{t("feature3")}</span>
            <span>{t("feature4")}</span>
          </div>
        </div>
        <p className="text-sm text-primary-foreground/60">
          © {new Date().getFullYear()} BillKu. Open Source Software.
        </p>
      </div>

      {/* Right side - Auth form */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6">
          {/* Header with language switcher */}
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/icons/icon-192x192.png"
                alt="BillKu"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-xl font-bold text-primary lg:hidden">BillKu</span>
            </Link>
            <LanguageSwitcher />
          </div>
          {children}
          <p className="text-center text-sm text-muted-foreground lg:hidden mt-8">
            © {new Date().getFullYear()} BillKu. Open Source Software.
          </p>
        </div>
      </div>
    </div>
  );
}
