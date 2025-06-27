"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarProvider,
  SidebarItem,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { ComandaZapLogo } from "@/components/icons";
import { BookMarked, LogOut, Archive, LayoutGrid, Home } from "lucide-react";

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const menuItems = [
    {
      href: "/dashboard/analytics",
      label: "Painel",
      icon: Home,
    },
    {
      href: "/dashboard",
      label: "Comandas",
      icon: LayoutGrid,
    },
    {
      href: "/dashboard/menu",
      label: "Cardápio",
      icon: BookMarked,
    },
    {
      href: "/dashboard/inventory",
      label: "Estoque",
      icon: Archive,
    },
  ];

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarHeader>
            <div className="flex items-center gap-2">
              <ComandaZapLogo className="size-7 text-primary" />
              <span className="text-lg font-semibold">ComandaZap</span>
            </div>
          </SidebarHeader>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    isActive={pathname === item.href}
                    icon={<item.icon />}
                  >
                    {item.label}
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarImage src="https://placehold.co/40x40" alt="Admin" />
              <AvatarFallback>A</AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-sm">
              <span className="font-semibold">Administrador</span>
              <span className="text-muted-foreground">admin@comandazap.com</span>
            </div>
            <Link href="/" className="ml-auto">
              <Button variant="ghost" size="icon">
                <LogOut className="size-4" />
              </Button>
            </Link>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur-sm md:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold">
              {menuItems.find((item) => item.href === pathname)?.label || "Dashboard"}
            </h1>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
