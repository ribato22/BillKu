"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  ChevronUp,
  MessageCircle,
  Smartphone,
  Clock,
  CreditCard,
  CalendarClock,
  UsersRound,
  FileCheck,
  Receipt,
  Truck,
  TrendingUp,
  ScrollText,
  Building2,
  Boxes,
  Scale,
  FileCode2,
  Settings2,
  Mail,
  Coins,
  FileSpreadsheet,
} from "lucide-react";
import { authService } from "@/lib/auth";

// Menu items use translation keys that are resolved at render time
const menuConfig = [
  {
    labelKey: "main" as const,
    items: [
      { titleKey: "dashboard" as const, url: "/dashboard", icon: LayoutDashboard },
      { titleKey: "customers" as const, url: "/dashboard/customers", icon: Users },
      { titleKey: "products" as const, url: "/dashboard/products", icon: Package },
      { titleKey: "stock" as const, url: "/dashboard/stock", icon: Boxes },
    ],
  },
  {
    labelKey: "finance" as const,
    items: [
      { titleKey: "invoices" as const, url: "/dashboard/invoices", icon: FileText },
      { titleKey: "quotations" as const, url: "/dashboard/quotations", icon: FileCheck },
      { titleKey: "payments" as const, url: "/dashboard/payments", icon: Wallet },
      { titleKey: "expenses" as const, url: "/dashboard/expenses", icon: Receipt },
      { titleKey: "deliveryNotes" as const, url: "/dashboard/delivery-notes", icon: Truck },
    ],
  },
  {
    labelKey: "management" as const,
    items: [
      { titleKey: "recurring" as const, url: "/dashboard/recurring", icon: CalendarClock },
      { titleKey: "team" as const, url: "/dashboard/team", icon: UsersRound },
      { titleKey: "auditLogs" as const, url: "/dashboard/audit-logs", icon: ScrollText },
    ],
  },
  {
    labelKey: "reports" as const,
    items: [
      { titleKey: "receivables" as const, url: "/dashboard/receivables", icon: BarChart3 },
      { titleKey: "profitLoss" as const, url: "/dashboard/reports/profit-loss", icon: TrendingUp },
      { titleKey: "balanceSheet" as const, url: "/dashboard/reports/balance-sheet", icon: Scale },
      { titleKey: "reminders" as const, url: "/dashboard/reminders", icon: MessageCircle },
    ],
  },
  {
    labelKey: "settings" as const,
    items: [
      { titleKey: "settings" as const, url: "/dashboard/settings/profile", icon: Building2 },
      { titleKey: "invoices" as const, url: "/dashboard/settings/templates", icon: FileCode2 },
      { titleKey: "settings" as const, url: "/dashboard/settings/custom-fields", icon: Settings2 },
      { titleKey: "settings" as const, url: "/dashboard/settings/email", icon: Mail },
      { titleKey: "settings" as const, url: "/dashboard/settings/whatsapp", icon: Smartphone },
      { titleKey: "reminders" as const, url: "/dashboard/settings/reminders", icon: Clock },
      { titleKey: "settings" as const, url: "/dashboard/settings/payment-gateway", icon: CreditCard },
      { titleKey: "settings" as const, url: "/dashboard/settings/tax", icon: FileSpreadsheet },
      { titleKey: "settings" as const, url: "/dashboard/settings/currency", icon: Coins },
    ],
  },
];

function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [businessName, setBusinessName] = useState<string>("...");

  useEffect(() => {
    authService.getMe().then((me) => {
      if (me?.business?.name) {
        setBusinessName(me.business.name);
      }
    });
  }, []);

  // Generate initials from business name
  const initials = businessName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-2">
          <Image
            src="/icons/icon-192x192.png"
            alt="BillKu"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="text-lg font-bold text-primary">BillKu</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {menuConfig.map((group) => (
          <SidebarGroup key={group.labelKey}>
            <SidebarGroupLabel>{t(group.labelKey)}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.url}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{t(item.titleKey)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-left truncate">{businessName}</span>
                  <ChevronUp className="h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-[--radix-popper-anchor-width]"
              >
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    {t("settings")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={async () => {
                    const { authService } = await import("@/lib/auth");
                    await authService.logout();
                    window.location.href = "/login";
                  }}
                  className="text-destructive cursor-pointer"
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-6" />
            <div className="flex-1" />
            <LanguageSwitcher />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
      <PWAInstallPrompt />
    </>
  );
}
