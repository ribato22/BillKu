import type { Metadata, Viewport } from "next";
import { Inter, DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth-provider";
import { SyncWrapper } from "@/components/sync-wrapper";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BillKu - Kelola piutang, lancarkan bisnis",
  description:
    "Aplikasi billing & invoice untuk UMKM Indonesia. Kelola faktur, lacak piutang, kirim reminder pembayaran dengan mudah.",
  keywords: [
    "billing",
    "invoice",
    "piutang",
    "UMKM",
    "faktur",
    "pembayaran",
    "Indonesia",
  ],
  authors: [{ name: "BillKu" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BillKu",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1a7a7c" },
    { media: "(prefers-color-scheme: dark)", color: "#0f3d3e" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${dmSans.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <SyncWrapper>
              {children}
            </SyncWrapper>
          </AuthProvider>
        </NextIntlClientProvider>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
