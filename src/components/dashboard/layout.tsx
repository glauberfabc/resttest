
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { SnookerBarLogo } from "@/components/icons";
import { BookMarked, LogOut, Archive, LayoutGrid, Home, Users, UserCog, Lock } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import type { User } from "@/lib/types";
import { EditProfileDialog } from "@/components/dashboard/profile/edit-profile-dialog";
import { ChangePasswordDialog } from "@/components/dashboard/profile/change-password-dialog";


export default function DashboardLayoutClient({
  children,
  user
}: {
  children: React.ReactNode;
  user: User;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { setOpenMobile } = useSidebar();
  
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.refresh();
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

  if (user.role === 'admin') {
    menuItems.push({
      href: "/dashboard/users",
      label: "Usuários",
      icon: UserCog,
    });
  }

  const userNameInitial = user?.name?.charAt(0)?.toUpperCase() || '';

  return (
    <>
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
                  onClick={() => setOpenMobile(false)}
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button variant="ghost" className="flex items-center gap-2 w-full justify-start p-2 h-auto">
                 <Avatar className="size-8">
                  <AvatarImage src={`https://placehold.co/40x40/7C3AED/FFFFFF?text=${userNameInitial}`} alt={user.name || ''} />
                  <AvatarFallback>{userNameInitial}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-sm text-left">
                  <span className="font-semibold">{user.name}</span>
                  <span className="text-muted-foreground">{user.email}</span>
                </div>
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mb-2 ml-2">
              <DropdownMenuItem onClick={() => setIsEditProfileOpen(true)}>
                <UserCog className="mr-2 h-4 w-4" />
                <span>Editar Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsChangePasswordOpen(true)}>
                <Lock className="mr-2 h-4 w-4" />
                <span>Alterar Senha</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
      
      {isEditProfileOpen && (
        <EditProfileDialog 
            isOpen={isEditProfileOpen}
            onOpenChange={setIsEditProfileOpen}
            user={user}
        />
      )}
      {isChangePasswordOpen && (
        <ChangePasswordDialog
            isOpen={isChangePasswordOpen}
            onOpenChange={setIsChangePasswordOpen}
        />
      )}
    </>
  );
}
