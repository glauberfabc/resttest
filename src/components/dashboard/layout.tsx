
"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
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
import { SnookerBarLogo } from "@/components/icons";
import { BookMarked, LogOut, Archive, LayoutGrid, Home, Users } from "lucide-react";
import { useUser } from "@/context/user-context";

export default function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useUser();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

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
    {
      href: "/dashboard/clients",
      label: "Clientes",
      icon: Users,
    },
  ];

  if (!user) {
    // Or a loading spinner
    return null;
  }

  const userNameInitial = user?.name?.charAt(0)?.toUpperCase() || '';

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarHeader>
            <div className="flex items-center gap-2">
              <SnookerBarLogo className="size-7 text-primary" />
              <span className="text-lg font-semibold">Snooker Bar</span>
            </div>
          </SidebarHeader>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  icon={<item.icon />}
                >
                  <Link href={item.href}>
                    {item.label}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarImage src={`https://placehold.co/40x40/7C3AED/FFFFFF?text=${userNameInitial}`} alt={user.name || ''} />
              <AvatarFallback>{userNameInitial}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col text-sm">
              <span className="font-semibold">{user.name}</span>
              <span className="text-muted-foreground">{user.email}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="ml-auto">
                <LogOut className="size-4" />
            </Button>
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
